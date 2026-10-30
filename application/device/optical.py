"""Send one authorized optical request. Never repeat an uncertain device operation."""

import argparse
import asyncio
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sys
import time

# Support both direct script execution and package imports from local checks.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from device.ble_transport import (  # noqa: E402
    MANIFEST,
    INVOKE as INVOKE,
    RECEIPT,
    PAGES,
    MAX_RECEIPT as MAX_RECEIPT,
    TransportError as OpticalError,
    parse_json,
    encode_chunks as encode_chunks,
    read_receipt,
    write_request,
)


class OpticalAuthorizationError(OpticalError, PermissionError):
    pass


CHALLENGE_FIELDS = {
    "work_order_digest",
    "session_id",
    "request_id",
    "nonce",
    "bits",
    "half_symbol_ms",
    "requested_at",
    "expires_at",
}


def validate_request(envelope, now=None):
    now = int(time.time()) if now is None else now
    if not isinstance(envelope, dict) or set(envelope) != {"challenge", "contact"}:
        raise OpticalError("Use the original prepared optical request.")
    c, contact = envelope["challenge"], envelope["contact"]
    if (
        not isinstance(c, dict)
        or not CHALLENGE_FIELDS.issubset(c)
        or set(c) - CHALLENGE_FIELDS - {"schema", "protocol"}
    ):
        raise OpticalError("Use the original prepared optical challenge.")
    if not isinstance(contact, dict) or not re.fullmatch(
        r"[A-Za-z0-9_-]{1,31}", contact.get("provider", "")
    ):
        raise OpticalError("Pin one optical provider.")
    for field, pattern in (
        ("work_order_digest", r"0x[0-9a-f]{64}"),
        ("session_id", r"[0-9a-f]{16}"),
        ("request_id", r"[0-9a-f]{16}"),
        ("bits", r"[0-9a-f]{8}"),
    ):
        if not isinstance(c[field], str) or not re.fullmatch(pattern, c[field]):
            raise OpticalError("The optical challenge contains an invalid binding.")
    for field in ("nonce", "half_symbol_ms", "requested_at", "expires_at"):
        if type(c[field]) is not int:
            raise OpticalError("Optical timing and nonce fields must be integers.")
    if not (
        1 <= c["nonce"] <= 2147483647
        and c["half_symbol_ms"] == 250
        and 1700000000 <= c["requested_at"] <= 4294967250
        and c["requested_at"] < c["expires_at"] <= c["requested_at"] + 45
        and c["requested_at"] <= now + 2
        and c["expires_at"] - now >= 19
        and now <= c["requested_at"] + 30
    ):
        raise OpticalError("The optical challenge is invalid or no longer fresh.")
    return c, contact["provider"]


def make_payload(challenge, provider, boot_id, secret):
    if not isinstance(boot_id, str) or not re.fullmatch(r"[0-9a-f]{16}", boot_id):
        raise OpticalError("The board boot identity is missing.")
    if (
        not isinstance(secret, str)
        or not 16 <= len(secret.encode()) <= 128
        or "\0" in secret
    ):
        raise OpticalError("Configure the exact provisioned authorization secret.")
    c = challenge
    message = "|".join(
        map(
            str,
            [
                "proof-of-ready-optical-auth-v1",
                c["request_id"],
                provider,
                boot_id,
                c["work_order_digest"],
                c["session_id"],
                c["bits"],
                250,
                c["nonce"],
                c["requested_at"],
                c["expires_at"],
            ],
        )
    )
    return {
        "protocol": "capmesh/0.1",
        "request_id": c["request_id"],
        "device_id": provider,
        "boot_id": boot_id,
        "capability": "optical.emit",
        "parameters": {
            "work_order_digest": c["work_order_digest"],
            "session_id": c["session_id"],
            "bits": c["bits"],
            "half_symbol_ms": 250,
            "sensor": "optical-led",
        },
        "nonce": c["nonce"],
        "timestamp": c["requested_at"],
        "expiration": c["expires_at"],
        "authorization": {
            "type": "proof-of-ready-optical-hmac-v1",
            "token": hmac.new(
                secret.encode(), message.encode(), hashlib.sha256
            ).hexdigest(),
        },
    }


def validate_receipt(receipt, challenge, provider):
    if not isinstance(receipt, dict):
        raise OpticalError("The optical receipt is invalid.")
    if receipt.get("status") == "error":
        code = receipt.get("error", {}).get("code", "DEVICE_ERROR")
        if not isinstance(code, str) or not re.fullmatch(r"[A-Z_]{1,64}", code):
            code = "DEVICE_ERROR"
        raise OpticalError(f"The original optical operation failed ({code}).")
    expected = {
        "protocol": "proof-of-ready/optical-execution/v1",
        "provider": provider,
        "sensor": "optical-led",
        "symbol_count": 72,
        **{
            k: challenge[k]
            for k in (
                "work_order_digest",
                "session_id",
                "request_id",
                "nonce",
                "bits",
                "half_symbol_ms",
            )
        },
    }
    if set(receipt) != set(expected) | {
        "started_at",
        "completed_at",
        "receipt_signature",
    } or any(
        type(receipt[k]) is not type(v) or receipt[k] != v for k, v in expected.items()
    ):
        raise OpticalError("The optical receipt differs from the original challenge.")
    start, end = receipt["started_at"], receipt["completed_at"]
    if (
        type(start) is not int
        or type(end) is not int
        or not challenge["requested_at"] - 2 <= start <= end <= challenge["expires_at"]
        or not 17 <= end - start <= 20
    ):
        raise OpticalError("The original optical execution timing is invalid.")
    signature = receipt["receipt_signature"]
    if not isinstance(signature, str) or not signature.startswith("v3:"):
        raise OpticalError("The optical receipt signature is missing.")
    raw = base64.b64decode(signature[3:], validate=True)
    if len(raw) != 64 or base64.b64encode(raw).decode() != signature[3:]:
        raise OpticalError("The optical receipt signature encoding is invalid.")
    # The coordinator verifies P-256 against the independently enrolled public key.
    return receipt


async def _execute(envelope, env, scanner=None, client_factory=None):
    if env.get("PROOFREADY_OPTICAL_AUTHORIZED") != "true":
        raise OpticalAuthorizationError(
            "Optical emission requires explicit authorization. No device request ran."
        )
    c, provider = validate_request(envelope)
    address, secret = (
        env.get("FIELDPROOF_BLE_ADDRESS", ""),
        env.get("FIELDPROOF_DEVICE_SECRET", ""),
    )
    if not re.fullmatch(r"(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", address):
        raise OpticalError("Configure the pinned board address.")
    # Validate the secret before discovery. The real boot identity comes from the manifest.
    make_payload(c, provider, "0" * 16, secret)
    if scanner is None or client_factory is None:
        from bleak import BleakClient, BleakScanner

        scanner, client_factory = BleakScanner, BleakClient
    device = await scanner.find_device_by_address(address, timeout=4)
    if device is None:
        raise RuntimeError("The pinned optical board is unavailable.")
    async with client_factory(device, timeout=8) as client:
        manifest = parse_json(bytes(await client.read_gatt_char(MANIFEST)), 1536)
        if (
            not isinstance(manifest, dict)
            or manifest.get("protocol") != "capmesh/0.1"
            or manifest.get("device_id") != provider
            or manifest.get("authorization_provisioned") is not True
            or manifest.get("request_chunks") != "proof-of-ready/request-chunks/v1"
            or manifest.get("receipt_pages") != PAGES
            or not any(
                isinstance(x, dict)
                and x.get("id") == "optical.emit"
                and x.get("half_symbol_ms") == 250
                for x in manifest.get("capabilities", [])
            )
        ):
            raise OpticalError(
                "The pinned board does not offer the prepared optical protocol."
            )
        validate_request(envelope)
        payload = make_payload(c, provider, manifest.get("boot_id"), secret)
        ready = asyncio.Event()
        await client.start_notify(RECEIPT, lambda _sender, _data: ready.set())
        try:
            # There is exactly one write sequence. Failure never restarts it.
            await write_request(client, payload, manifest)
            deadline = time.monotonic() + min(25, c["expires_at"] - time.time())
            while time.monotonic() < deadline:
                try:
                    await asyncio.wait_for(ready.wait(), timeout=0.25)
                except asyncio.TimeoutError:
                    pass
                ready.clear()
                receipt = await read_receipt(client, c["request_id"])
                if isinstance(receipt, dict) and receipt.get("status") in (
                    "idle",
                    "pending",
                ):
                    continue
                return validate_receipt(receipt, c, provider)
            raise TimeoutError(
                "The original optical operation has no completed receipt. Do not repeat it automatically."
            )
        finally:
            await asyncio.wait_for(client.stop_notify(RECEIPT), timeout=2)


async def execute(envelope, env, scanner=None, client_factory=None):
    if env.get("PROOFREADY_OPTICAL_AUTHORIZED") != "true":
        raise OpticalAuthorizationError(
            "Optical emission requires explicit authorization. No device request ran."
        )
    challenge, _provider = validate_request(envelope)
    remaining = min(45, challenge["expires_at"] - time.time())
    try:
        async with asyncio.timeout(remaining):
            return await _execute(envelope, env, scanner, client_factory)
    except TimeoutError as error:
        raise OpticalError(
            "The original optical operation timed out. Do not repeat it automatically."
        ) from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--prepare",
        action="store_true",
        help="Validate the private request without discovering or writing to a board.",
    )
    args = parser.parse_args()
    try:
        envelope = parse_json(os.environ.get("PROOFREADY_OPTICAL_REQUEST", ""), 4096)
        c, _provider = validate_request(envelope)
        if args.prepare:
            result = {
                "executed": False,
                "request_id": c["request_id"],
                "authorizationRequired": "PROOFREADY_OPTICAL_AUTHORIZED=true",
            }
        else:
            result = asyncio.run(execute(envelope, os.environ))
        print(json.dumps(result, separators=(",", ":")))
    except Exception as error:
        # Never print BLE addresses, authorization material, or external exception payloads.
        message = (
            str(error)
            if isinstance(error, (OpticalError, TimeoutError))
            else "The pinned optical operation failed. Check its original request and board configuration."
        )
        print(message, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
