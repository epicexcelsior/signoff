import base64
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import time
import unittest

PATH = Path(__file__).resolve().parents[1] / "optical.py"
spec = importlib.util.spec_from_file_location("optical", PATH)
optical = importlib.util.module_from_spec(spec)
spec.loader.exec_module(optical)


def envelope():
    now = int(time.time())
    return {
        "challenge": {
            "work_order_digest": "0x" + "a" * 64,
            "session_id": "1234567890abcdef",
            "request_id": "abcdef1234567890",
            "nonce": 123,
            "bits": "8041fe03",
            "half_symbol_ms": 250,
            "requested_at": now,
            "expires_at": now + 45,
        },
        "contact": {"provider": "proof-ready-reference"},
    }


def receipt(c):
    return {
        "protocol": "proof-of-ready/optical-execution/v1",
        "provider": "proof-ready-reference",
        "sensor": "optical-led",
        **{
            k: c[k]
            for k in (
                "work_order_digest",
                "session_id",
                "request_id",
                "nonce",
                "bits",
                "half_symbol_ms",
            )
        },
        "started_at": c["requested_at"],
        "completed_at": c["requested_at"] + 18,
        "symbol_count": 72,
        "receipt_signature": "v3:" + base64.b64encode(bytes(range(64))).decode(),
    }


class OpticalTests(unittest.IsolatedAsyncioTestCase):
    def test_original_binding_and_timing_validation(self):
        request = envelope()
        self.assertEqual(optical.validate_request(request)[1], "proof-ready-reference")
        for field, value in (
            ("nonce", True),
            ("nonce", 0),
            ("expires_at", request["challenge"]["requested_at"] + 46),
            ("half_symbol_ms", 125),
            ("bits", "FFFFFFFF"),
            ("session_id", "bad"),
        ):
            changed = copy.deepcopy(request)
            changed["challenge"][field] = value
            with self.assertRaises(ValueError, msg=field):
                optical.validate_request(changed)
        with self.assertRaises(ValueError):
            optical.validate_request(
                request, now=request["challenge"]["expires_at"] - 18
            )
        self.assertEqual(
            optical.validate_request(
                request, now=request["challenge"]["expires_at"] - 19
            )[0],
            request["challenge"],
        )

    def test_json_duplicate_fields_and_size_reject(self):
        for raw in ('{"nonce":1,"nonce":2}', '{"x":NaN}', "x" * 4097):
            with self.assertRaises(ValueError):
                optical.parse_json(raw, 4096)

    def test_payload_and_chunks_reconstruct_exactly_at_small_mtu(self):
        c = envelope()["challenge"]
        c["requested_at"], c["expires_at"] = 1793368000, 1793368045
        payload = optical.make_payload(
            c, "proof-ready-reference", "0" * 16, "disposable-test-secret"
        )
        self.assertEqual(
            payload["authorization"]["token"],
            "fd8020f048edd10bc5b0c5921bad8b2ce10b490a7673066dba3e982e944e62c0",
        )
        for mtu in (23, 247, 512, 517):
            chunks = list(optical.encode_chunks(payload, mtu))
            raw = bytearray()
            for chunk in chunks:
                magic, version, reserved, total, offset = struct.unpack(
                    ">2sBBHH", chunk[:8]
                )
                self.assertEqual(
                    (magic, version, reserved, offset), (b"PR", 1, 0, len(raw))
                )
                self.assertLessEqual(len(chunk), min(512, mtu - 3))
                raw.extend(chunk[8:])
            self.assertEqual(len(raw), total)
            self.assertEqual(json.loads(raw), payload)

    def test_receipt_rejects_another_attempt_and_bad_signature_encoding(self):
        c = envelope()["challenge"]
        original = receipt(c)
        self.assertIs(
            optical.validate_receipt(original, c, "proof-ready-reference"), original
        )
        for field, value in (
            ("session_id", "0" * 16),
            ("symbol_count", 71),
            ("nonce", True),
            ("completed_at", c["expires_at"] + 1),
            ("receipt_signature", "v3:AA=="),
        ):
            changed = {**original, field: value}
            with self.assertRaises(ValueError, msg=field):
                optical.validate_receipt(changed, c, "proof-ready-reference")

    async def test_unauthorized_has_no_discovery_or_write(self):
        with self.assertRaises(PermissionError):
            await optical.execute(envelope(), {})

    async def test_receipt_pages_verify_exact_hash(self):
        request = envelope()
        original = receipt(request["challenge"])
        client = FakeClient(request, original)
        self.assertEqual(
            await optical.read_receipt(client, original["request_id"]), original
        )
        client.corrupt_page = True
        with self.assertRaisesRegex(ValueError, "changed"):
            await optical.read_receipt(client, original["request_id"])

    async def test_one_operation_write_sequence_and_no_repeat_after_unknown_write(self):
        request = envelope()
        client = FakeClient(request, receipt(request["challenge"]))
        env = {
            "PROOFREADY_OPTICAL_AUTHORIZED": "true",
            "FIELDPROOF_BLE_ADDRESS": "00:11:22:33:44:55",
            "FIELDPROOF_DEVICE_SECRET": "disposable-test-secret",
        }
        result = await optical.execute(
            request, env, FakeScanner, lambda *_args, **_kwargs: client
        )
        self.assertEqual(result["request_id"], request["challenge"]["request_id"])
        chunks = [x for char, x in client.writes if char == optical.INVOKE]
        self.assertEqual(struct.unpack(">H", chunks[0][6:8])[0], 0)
        self.assertEqual(
            b"".join(x[8:] for x in chunks),
            json.dumps(
                optical.make_payload(
                    request["challenge"],
                    request["contact"]["provider"],
                    "0" * 16,
                    env["FIELDPROOF_DEVICE_SECRET"],
                ),
                separators=(",", ":"),
            ).encode(),
        )
        uncertain = FakeClient(request, receipt(request["challenge"]))
        uncertain.fail_write = True
        with self.assertRaises(RuntimeError):
            await optical.execute(
                request, env, FakeScanner, lambda *_args, **_kwargs: uncertain
            )
        self.assertEqual(len(uncertain.writes), 1)
        self.assertTrue(uncertain.stopped)

    async def test_wrong_provider_rejects_before_any_write(self):
        request = envelope()
        client = FakeClient(request, receipt(request["challenge"]))
        client.manifest["device_id"] = "another-provider"
        env = {
            "PROOFREADY_OPTICAL_AUTHORIZED": "true",
            "FIELDPROOF_BLE_ADDRESS": "00:11:22:33:44:55",
            "FIELDPROOF_DEVICE_SECRET": "disposable-test-secret",
        }
        with self.assertRaises(ValueError):
            await optical.execute(
                request, env, FakeScanner, lambda *_args, **_kwargs: client
            )
        self.assertEqual(client.writes, [])


class FakeScanner:
    @staticmethod
    async def find_device_by_address(_address, timeout):
        return object()


class FakeClient:
    def __init__(self, request, result):
        self.mtu_size = 247
        self.writes, self.offset = [], 0
        self.raw = json.dumps(result, separators=(",", ":")).encode()
        self.index = {
            "protocol": "proof-of-ready/receipt-pages/v1",
            "request_id": request["challenge"]["request_id"],
            "length": len(self.raw),
            "sha256": hashlib.sha256(self.raw).hexdigest(),
        }
        self.manifest = {
            "protocol": "capmesh/0.1",
            "device_id": "proof-ready-reference",
            "boot_id": "0" * 16,
            "authorization_provisioned": True,
            "request_chunks": "proof-of-ready/request-chunks/v1",
            "receipt_pages": optical.PAGES,
            "capabilities": [{"id": "optical.emit", "half_symbol_ms": 250}],
        }
        self.fail_write, self.corrupt_page, self.stopped = False, False, False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        pass

    async def read_gatt_char(self, char):
        if char == optical.MANIFEST:
            return json.dumps(self.manifest).encode()
        if char == optical.RECEIPT:
            return json.dumps(self.index).encode()
        page = self.raw[self.offset : self.offset + 384]
        return (b"x" + page[1:]) if self.corrupt_page else page

    async def start_notify(self, _char, callback):
        self.callback = callback

    async def stop_notify(self, _char):
        self.stopped = True

    async def write_gatt_char(self, char, raw, response):
        self.writes.append((char, bytes(raw)))
        if self.fail_write:
            raise RuntimeError("Transport disconnected after an uncertain write")
        if char == optical.PAGES:
            self.offset = json.loads(raw)["offset"]
        else:
            _magic, _version, _reserved, total, offset = struct.unpack(
                ">2sBBHH", raw[:8]
            )
            if offset + len(raw) - 8 == total:
                self.callback(None, None)


if __name__ == "__main__":
    unittest.main()
