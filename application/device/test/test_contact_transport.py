"""Regressions for the retained contact reader against both BLE transports."""

from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import time
import struct
import subprocess
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("observe", ROOT / "scripts/observe.py")
observe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(observe)


def request():
    now = int(time.time())
    return {
        "challenge": {
            "request_id": "abcdef1234567890",
            "nonce": 2147483647,
            "timestamp": now,
            "expiration": now + 30,
        },
        "contact": {
            "provider": "p" * 31,
            "sensor": "gpio2-contact",
            "location": "demo-gate",
        },
    }


def receipt(envelope):
    c, contact = envelope["challenge"], envelope["contact"]
    return {
        "protocol": "capmesh/0.1",
        "request_id": c["request_id"],
        "status": "success",
        "provider": contact["provider"],
        "capability": "state.observe",
        "parameters": {"location": contact["location"]},
        "nonce": c["nonce"],
        "result": {
            "metric": "gate.closed",
            "sensor": contact["sensor"],
            "closed": False,
            "stable_samples": 5,
            "total_samples": 5,
        },
        "started_at": c["timestamp"],
        "completed_at": c["timestamp"],
        "receipt_signature": "v3:" + "A" * 86 + "==",
    }


class Scanner:
    @staticmethod
    async def find_device_by_address(_address, timeout):
        return object()


class Client:
    def __init__(self, envelope, value, modern=True):
        self.mtu_size = 247
        self.raw = json.dumps(value, separators=(",", ":")).encode()
        self.result = value
        self.offset, self.writes = 0, []
        self.modern = modern
        self.invoke_bytes = bytearray()
        self.completed = 0
        self.stopped = False
        self.fail_write = False
        self.fail_at = None
        self.corrupt_page = False
        self.wrong_index = False
        self.empty_page = False
        self.manifest = {
            "protocol": "capmesh/0.1",
            "device_id": envelope["contact"]["provider"],
            "capabilities": [{"id": "state.observe"}],
        }
        if modern:
            self.manifest.update(
                request_chunks="proof-of-ready/request-chunks/v1",
                receipt_pages="0000cb04-0000-1000-8000-00805f9b34fb",
            )

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        pass

    async def start_notify(self, _char, callback):
        self.callback = callback

    async def stop_notify(self, _char):
        self.stopped = True

    async def write_gatt_char(self, char, raw, response):
        self.writes.append((char, bytes(raw)))
        if self.fail_write or len(self.writes) == self.fail_at:
            raise RuntimeError("Disconnected after an uncertain write")
        if char.startswith("0000cb04"):
            self.offset = json.loads(raw)["offset"]
        elif raw.startswith(b"PR"):
            magic, version, reserved, total, offset = struct.unpack(">2sBBHH", raw[:8])
            assert (magic, version, reserved, offset) == (
                b"PR",
                1,
                0,
                len(self.invoke_bytes),
            )
            assert len(raw) <= min(512, self.mtu_size - 3)
            self.invoke_bytes.extend(raw[8:])
            if len(self.invoke_bytes) == total:
                self.completed += 1
                self.callback(None, None)
        else:
            assert not self.modern
            self.invoke_bytes.extend(raw)
            self.completed += 1
            self.callback(None, None)

    async def read_gatt_char(self, char):
        if char.startswith("0000cb01"):
            return json.dumps(self.manifest).encode()
        if char.startswith("0000cb04"):
            if self.empty_page:
                return b""
            page = self.raw[self.offset : self.offset + 384]
            return b"x" + page[1:] if self.corrupt_page else page
        if self.modern and len(self.raw) > 480:
            return json.dumps(
                {
                    "protocol": "proof-of-ready/receipt-pages/v1",
                    "request_id": "0000000000000000"
                    if self.wrong_index
                    else self.result["request_id"],
                    "length": len(self.raw),
                    "sha256": hashlib.sha256(self.raw).hexdigest(),
                }
            ).encode()
        return self.raw


class ContactTests(unittest.IsolatedAsyncioTestCase):
    async def test_paged_contact_reaches_original_receipt(self):
        envelope = request()
        expected = receipt(envelope)
        client = Client(envelope, expected)
        self.assertGreater(len(client.raw), 480)
        fake = types.SimpleNamespace(
            BleakClient=lambda *_args, **_kwargs: client, BleakScanner=Scanner
        )
        output = io.StringIO()
        env = {
            "FIELDPROOF_OBSERVATION": json.dumps(envelope),
            "FIELDPROOF_BLE_ADDRESS": "00:11:22:33:44:55",
            "FIELDPROOF_DEVICE_SECRET": "disposable-test-secret",
        }
        with (
            patch.dict(sys.modules, {"bleak": fake}),
            patch.dict(os.environ, env),
            redirect_stdout(output),
        ):
            await observe.main()
        self.assertEqual(json.loads(output.getvalue()), expected)

    def env(self):
        return {
            "FIELDPROOF_BLE_ADDRESS": "00:11:22:33:44:55",
            "FIELDPROOF_DEVICE_SECRET": "disposable-test-secret",
        }

    async def run_client(self, envelope, client):
        return await observe.execute(
            envelope, self.env(), Scanner, lambda *_args, **_kwargs: client
        )

    async def test_legacy_board_retains_one_raw_write_and_optional_null_fields(self):
        envelope = request()
        expected = {
            **receipt(envelope),
            "delivery_proof": None,
            "authorization_ref": None,
            "error": None,
        }
        client = Client(envelope, expected, modern=False)
        client.mtu_size = 23
        actual = await self.run_client(envelope, client)
        self.assertEqual(actual, expected)
        self.assertEqual(len(client.writes), 1)
        self.assertTrue(client.writes[0][1].startswith(b"{"))
        self.assertEqual(
            json.loads(client.invoke_bytes),
            observe.make_payload(
                envelope["challenge"],
                envelope["contact"],
                self.env()["FIELDPROOF_DEVICE_SECRET"],
            ),
        )
        self.assertTrue(client.stopped)

    async def test_modern_small_mtu_fragments_exactly_one_original_request(self):
        envelope = request()
        client = Client(envelope, receipt(envelope))
        client.mtu_size = 23
        self.assertEqual(await self.run_client(envelope, client), receipt(envelope))
        self.assertGreater(
            len([x for x in client.writes if x[0].startswith("0000cb02")]), 1
        )
        self.assertEqual(client.completed, 1)
        self.assertEqual(
            json.loads(client.invoke_bytes),
            observe.make_payload(
                envelope["challenge"],
                envelope["contact"],
                self.env()["FIELDPROOF_DEVICE_SECRET"],
            ),
        )

    async def test_modern_short_receipt_without_pages_remains_supported(self):
        envelope = request()
        envelope["contact"]["provider"] = "reference"
        envelope["challenge"]["nonce"] = 1
        client = Client(envelope, receipt(envelope))
        self.assertLessEqual(len(client.raw), 480)
        self.assertEqual(await self.run_client(envelope, client), receipt(envelope))
        self.assertFalse(
            any(char.startswith("0000cb04") for char, _raw in client.writes)
        )

    async def test_wrong_receipt_binding_rejects(self):
        envelope = request()
        for field, value in (
            ("nonce", 1),
            ("provider", "another-provider"),
            ("request_id", "1111111111111111"),
        ):
            with self.subTest(field=field):
                changed = {**receipt(envelope), field: value}
                client = Client(envelope, changed)
                with self.assertRaises(ValueError):
                    await self.run_client(envelope, client)
                self.assertEqual(client.completed, 1)
                self.assertTrue(client.stopped)

    async def test_wrong_page_index_rejects_before_page_writes(self):
        envelope = request()
        client = Client(envelope, receipt(envelope))
        client.wrong_index = True
        with self.assertRaisesRegex(ValueError, "index"):
            await self.run_client(envelope, client)
        self.assertFalse(
            any(char.startswith("0000cb04") for char, _raw in client.writes)
        )

    async def test_corrupt_and_missing_pages_reject_without_repeating_operation(self):
        envelope = request()
        for flag in ("corrupt_page", "empty_page"):
            with self.subTest(flag=flag):
                client = Client(envelope, receipt(envelope))
                setattr(client, flag, True)
                with self.assertRaises(ValueError):
                    await self.run_client(envelope, client)
                self.assertEqual(client.completed, 1)
                self.assertTrue(client.stopped)

    async def test_uncertain_write_disconnect_never_starts_another_sequence(self):
        envelope = request()
        for modern, fail_at in ((False, 1), (True, 1), (True, 2)):
            with self.subTest(modern=modern, fail_at=fail_at):
                client = Client(envelope, receipt(envelope), modern=modern)
                client.fail_at = fail_at
                with self.assertRaises(RuntimeError):
                    await self.run_client(envelope, client)
                self.assertEqual(len(client.writes), fail_at)
                self.assertTrue(client.stopped)

    async def test_unknown_transport_and_wrong_manifest_reject_before_writes(self):
        envelope = request()
        for field, value in (
            ("request_chunks", "unknown/v2"),
            ("device_id", "wrong-provider"),
        ):
            with self.subTest(field=field):
                client = Client(envelope, receipt(envelope))
                client.manifest[field] = value
                with self.assertRaises(ValueError):
                    await self.run_client(envelope, client)
                self.assertEqual(client.writes, [])

    async def test_node_p256_signed_contact_survives_python_pages_and_rejects_tamper(
        self,
    ):
        envelope = request()
        sign_source = """
            import {generateKeyPairSync,sign} from 'node:crypto';
            import {readFileSync} from 'node:fs';
            import {receiptMessage} from './src/evidence.js';
            const receipt=JSON.parse(readFileSync(0,'utf8'));
            const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
            const jwk=publicKey.export({format:'jwk'});
            receipt.receipt_signature='v3:'+sign('sha256',Buffer.from(receiptMessage(receipt)),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64');
            const point='04'+Buffer.from(jwk.x,'base64url').toString('hex')+Buffer.from(jwk.y,'base64url').toString('hex');
            console.log(JSON.stringify({receipt,publicKey:point}));
        """
        signed = json.loads(
            subprocess.run(
                ["node", "--input-type=module", "-e", sign_source],
                cwd=ROOT,
                input=json.dumps(receipt(envelope)),
                text=True,
                capture_output=True,
                check=True,
            ).stdout
        )
        client = Client(envelope, signed["receipt"])
        actual = await self.run_client(envelope, client)
        self.assertEqual(actual, signed["receipt"])
        verify_source = """
            import {readFileSync} from 'node:fs';
            import {verifyEvidence} from './src/evidence.js';
            const input=JSON.parse(readFileSync(0,'utf8'));
            const verified=verifyEvidence(input);
            if(!verified.accepted || verified.state!=='OPEN') throw Error('Original did not verify');
            input.receipt.result.closed=true;
            let rejected=false;
            try { verifyEvidence(input); } catch(error) { rejected=error.code==='INVALID_SIGNATURE'; }
            if(!rejected) throw Error('Edited contact did not reject');
            console.log(JSON.stringify({accepted:verified.accepted,tamperRejected:rejected}));
        """
        verified = subprocess.run(
            ["node", "--input-type=module", "-e", verify_source],
            cwd=ROOT,
            input=json.dumps(
                {
                    "receipt": actual,
                    "publicKey": signed["publicKey"],
                    **envelope,
                    "now": envelope["challenge"]["timestamp"],
                }
            ),
            text=True,
            capture_output=True,
            check=True,
        )
        self.assertEqual(
            json.loads(verified.stdout), {"accepted": True, "tamperRejected": True}
        )

    async def test_cli_error_does_not_expose_private_configuration(self):
        envelope = request()
        env = {
            **os.environ,
            "FIELDPROOF_OBSERVATION": json.dumps(envelope),
            "FIELDPROOF_BLE_ADDRESS": "private-invalid-address",
            "FIELDPROOF_DEVICE_SECRET": "private-do-not-print-secret",
        }
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts/observe.py")],
            env=env,
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertNotIn(env["FIELDPROOF_BLE_ADDRESS"], result.stderr)
        self.assertNotIn(env["FIELDPROOF_DEVICE_SECRET"], result.stderr)


if __name__ == "__main__":
    unittest.main()
