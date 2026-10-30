"""Read one pinned FieldProof contact. Never actuate a device or repeat a request."""

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

# Direct entry point: resolve only the adjacent, trusted application package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from device.ble_transport import (  # noqa: E402
    MANIFEST,
    PAGES,
    RECEIPT,
    TransportError,
    parse_json,
    read_receipt,
    write_request,
)


def validate_request(request, now=None):
    now = int(time.time()) if now is None else now
    if not isinstance(request, dict) or set(request) != {"challenge", "contact"}:
        raise TransportError("Use the original prepared contact request.")
    challenge, contact = request["challenge"], request["contact"]
    if (
        not isinstance(challenge, dict)
        or set(challenge) != {"request_id", "nonce", "timestamp", "expiration"}
        or not isinstance(challenge["request_id"], str)
        or not re.fullmatch(r"[A-Za-z0-9_-]{1,16}", challenge["request_id"])
        or any(
            type(challenge[k]) is not int for k in ("nonce", "timestamp", "expiration")
        )
        or not 1 <= challenge["nonce"] <= 2147483647
        or not 0
        < challenge["timestamp"]
        < challenge["expiration"]
        <= challenge["timestamp"] + 30
        or challenge["timestamp"] > now + 2
        or now > challenge["expiration"]
    ):
        raise TransportError("The original contact challenge is invalid or expired.")
    if (
        not isinstance(contact, dict)
        or set(contact) != {"provider", "sensor", "location"}
        or not isinstance(contact["provider"], str)
        or not re.fullmatch(r"[A-Za-z0-9_-]{1,31}", contact["provider"])
        or contact["location"] != "demo-gate"
        or not isinstance(contact["sensor"], str)
        or not re.fullmatch(r"gpio[0-9]{1,2}-contact", contact["sensor"])
    ):
        raise TransportError("Pin one supported physical contact.")
    return challenge, contact


def make_payload(challenge, contact, secret):
    if not isinstance(secret, str) or len(secret) < 16 or "\0" in secret:
        raise TransportError("Configure the exact provisioned authorization secret.")
    message = "|".join(
        map(
            str,
            [
                "fieldproof-auth-v1",
                challenge["request_id"],
                contact["provider"],
                "state.observe",
                contact["location"],
                challenge["nonce"],
                challenge["timestamp"],
                challenge["expiration"],
            ],
        )
    )
    return {
        "protocol": "capmesh/0.1",
        "request_id": challenge["request_id"],
        "device_id": contact["provider"],
        "capability": "state.observe",
        "parameters": {"location": contact["location"]},
        "nonce": challenge["nonce"],
        "timestamp": challenge["timestamp"],
        "expiration": challenge["expiration"],
        "authorization": {
            "type": "hmac-sha256-v2",
            "token": hmac.new(
                secret.encode(), message.encode(), hashlib.sha256
            ).hexdigest(),
        },
    }


def validate_receipt(receipt, challenge, contact):
    if not isinstance(receipt, dict):
        raise TransportError("The original contact receipt is invalid.")
    if receipt.get("status") == "error":
        raise TransportError(
            "The original contact operation failed. Do not repeat it automatically."
        )
    expected = {
        "protocol": "capmesh/0.1",
        "request_id": challenge["request_id"],
        "status": "success",
        "provider": contact["provider"],
        "capability": "state.observe",
        "nonce": challenge["nonce"],
    }
    required = set(expected) | {
        "parameters",
        "result",
        "started_at",
        "completed_at",
        "receipt_signature",
    }
    optional = {"delivery_proof", "authorization_ref", "error"}
    if (
        not required.issubset(receipt)
        or set(receipt) - required - optional
        or any(receipt[k] is not None for k in optional if k in receipt)
        or any(
            type(receipt[k]) is not type(v) or receipt[k] != v
            for k, v in expected.items()
        )
        or receipt["parameters"] != {"location": contact["location"]}
    ):
        raise TransportError("The contact receipt differs from the original request.")
    result = receipt["result"]
    if (
        not isinstance(result, dict)
        or set(result)
        != {"metric", "sensor", "closed", "stable_samples", "total_samples"}
        or result["metric"] != "gate.closed"
        or result["sensor"] != contact["sensor"]
        or type(result["closed"]) is not bool
        or type(result["stable_samples"]) is not int
        or not 0 <= result["stable_samples"] <= 5
        or type(result["total_samples"]) is not int
        or result["total_samples"] != 5
    ):
        raise TransportError("The contact receipt contains unsupported measurements.")
    start, end = receipt["started_at"], receipt["completed_at"]
    if (
        type(start) is not int
        or type(end) is not int
        or not challenge["timestamp"] - 2 <= start <= end <= challenge["expiration"]
    ):
        raise TransportError("The original contact receipt timing is invalid.")
    signature = receipt["receipt_signature"]
    if not isinstance(signature, str) or not signature.startswith("v3:"):
        raise TransportError("The contact receipt signature is missing.")
    try:
        raw = base64.b64decode(signature[3:], validate=True)
    except (ValueError, TypeError) as error:
        raise TransportError(
            "The contact receipt signature encoding is invalid."
        ) from error
    if len(raw) != 64 or base64.b64encode(raw).decode() != signature[3:]:
        raise TransportError("The contact receipt signature encoding is invalid.")
    # The coordinator verifies P-256 with the independently enrolled public key.
    return receipt


async def _execute(request, env, scanner, client_factory):
    challenge, contact = validate_request(request)
    address = env.get("FIELDPROOF_BLE_ADDRESS", "")
    if not re.fullmatch(r"(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", address):
        raise TransportError("Configure the pinned board address.")
    payload = make_payload(challenge, contact, env.get("FIELDPROOF_DEVICE_SECRET", ""))
    if scanner is None or client_factory is None:
        from bleak import BleakClient, BleakScanner

        scanner, client_factory = BleakScanner, BleakClient
    device = await scanner.find_device_by_address(address, timeout=4)
    if device is None:
        raise TransportError("The pinned contact board is unavailable.")
    async with client_factory(device, timeout=8) as client:
        manifest = parse_json(bytes(await client.read_gatt_char(MANIFEST)), 8192)
        if (
            not isinstance(manifest, dict)
            or manifest.get("protocol") != "capmesh/0.1"
            or manifest.get("device_id") != contact["provider"]
            or not isinstance(manifest.get("capabilities"), list)
            or not any(
                isinstance(c, dict) and c.get("id") == "state.observe"
                for c in manifest["capabilities"]
            )
        ):
            raise TransportError(
                "The pinned board does not offer the selected observation."
            )
        validate_request(request)
        completed = asyncio.Event()
        await client.start_notify(RECEIPT, lambda _sender, _data: completed.set())
        try:
            await write_request(client, payload, manifest)
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                try:
                    await asyncio.wait_for(completed.wait(), timeout=0.25)
                except asyncio.TimeoutError:
                    pass
                completed.clear()
                receipt = await read_receipt(
                    client,
                    challenge["request_id"],
                    allow_pages=manifest.get("receipt_pages") == PAGES,
                    max_receipt=8192,
                )
                if receipt.get("status") in ("idle", "pending"):
                    continue
                return validate_receipt(receipt, challenge, contact)
            raise TransportError(
                "The original contact receipt is unavailable. Do not repeat it automatically."
            )
        finally:
            await asyncio.wait_for(client.stop_notify(RECEIPT), timeout=2)


async def execute(request, env, scanner=None, client_factory=None):
    challenge, _contact = validate_request(request)
    try:
        async with asyncio.timeout(min(22, challenge["expiration"] + 1 - time.time())):
            return await _execute(request, env, scanner, client_factory)
    except TimeoutError as error:
        raise TransportError(
            "The original contact operation timed out. Do not repeat it automatically."
        ) from error


async def main():
    request = parse_json(os.environ.get("FIELDPROOF_OBSERVATION", ""), 4096)
    result = await execute(request, os.environ)
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as error:
        message = (
            str(error)
            if isinstance(error, TransportError)
            else "The pinned contact observation failed. Inspect its original request and board configuration. Do not repeat it automatically."
        )
        print(message, file=sys.stderr)
        sys.exit(1)
