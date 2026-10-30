"""Read one pinned FieldProof contact. Never actuate a device or repeat a request."""
import asyncio
import hashlib
import hmac
import json
import os
import re
import sys

MANIFEST = "0000cb01-0000-1000-8000-00805f9b34fb"
INVOKE = "0000cb02-0000-1000-8000-00805f9b34fb"
RECEIPT = "0000cb03-0000-1000-8000-00805f9b34fb"


async def main():
    from bleak import BleakClient, BleakScanner
    request = json.loads(os.environ["FIELDPROOF_OBSERVATION"])
    challenge, contact = request["challenge"], request["contact"]
    address = os.environ["FIELDPROOF_BLE_ADDRESS"]
    secret = os.environ["FIELDPROOF_DEVICE_SECRET"]
    if not re.fullmatch(r"(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}", address) or len(secret) < 16:
        raise ValueError("Configure the board address and its authorization secret")
    message = "|".join(map(str, ["fieldproof-auth-v1", challenge["request_id"], contact["provider"],
                                "state.observe", contact["location"], challenge["nonce"],
                                challenge["timestamp"], challenge["expiration"]]))
    payload = dict(protocol="capmesh/0.1", request_id=challenge["request_id"],
                   device_id=contact["provider"], capability="state.observe",
                   parameters={"location": contact["location"]}, nonce=challenge["nonce"],
                   timestamp=challenge["timestamp"], expiration=challenge["expiration"],
                   authorization={"type": "hmac-sha256-v2", "token":
                                  hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()})
    device = await BleakScanner.find_device_by_address(address, timeout=4)
    if device is None:
        raise RuntimeError("The configured board is unavailable")
    async with BleakClient(device, timeout=8) as client:
        manifest = json.loads((await client.read_gatt_char(MANIFEST)).decode())
        if (manifest.get("protocol") != "capmesh/0.1" or manifest.get("device_id") != contact["provider"]
                or not any(c.get("id") == "state.observe" for c in manifest.get("capabilities", []))):
            raise ValueError("The configured board does not offer the selected observation")
        completed = asyncio.Event()
        await client.start_notify(RECEIPT, lambda _sender, _data: completed.set())
        await client.write_gatt_char(INVOKE, json.dumps(payload).encode(), response=True)
        await asyncio.wait_for(completed.wait(), timeout=8)
        raw = await client.read_gatt_char(RECEIPT)
        if len(raw) > 8192:
            raise ValueError("The board receipt exceeds the size limit")
        print(json.dumps(json.loads(raw.decode())))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception:
        print("The pinned contact observation failed. Check board availability and configuration.", file=sys.stderr)
        sys.exit(1)
