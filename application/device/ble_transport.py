"""Bounded BLE framing shared by contact and optical readers."""

import hashlib
import hmac
import json
import re
import struct

MANIFEST = "0000cb01-0000-1000-8000-00805f9b34fb"
INVOKE = "0000cb02-0000-1000-8000-00805f9b34fb"
RECEIPT = "0000cb03-0000-1000-8000-00805f9b34fb"
PAGES = "0000cb04-0000-1000-8000-00805f9b34fb"
MAX_RECEIPT = 1536


class TransportError(ValueError):
    """A bounded public error with no private configuration values."""


def _unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise TransportError("Duplicate JSON fields are invalid.")
        result[key] = value
    return result


def parse_json(raw, limit):
    if not isinstance(raw, (str, bytes, bytearray)) or len(raw) > limit:
        raise TransportError("The device message exceeds its size limit.")
    return json.loads(
        raw,
        object_pairs_hook=_unique,
        parse_constant=lambda _value: (_ for _ in ()).throw(
            ValueError("Invalid JSON number.")
        ),
    )


def encode_chunks(payload, mtu):
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode()
    if len(raw) > 1536:
        raise TransportError("The device request exceeds its size limit.")
    size = max(20, min(512, mtu - 3))
    for offset in range(0, len(raw), size - 8):
        yield (
            struct.pack(">2sBBHH", b"PR", 1, 0, len(raw), offset)
            + raw[offset : offset + size - 8]
        )


async def read_receipt(
    client, request_id, *, allow_pages=True, max_receipt=MAX_RECEIPT
):
    raw = bytes(await client.read_gatt_char(RECEIPT))
    value = parse_json(raw, max_receipt)
    if not isinstance(value, dict):
        raise TransportError("The device receipt must be a JSON object.")
    if value.get("protocol") != "proof-of-ready/receipt-pages/v1":
        return value
    if not allow_pages:
        raise TransportError("The board did not advertise the receipt page protocol.")
    length, digest = value.get("length"), value.get("sha256")
    if (
        set(value) != {"protocol", "request_id", "length", "sha256"}
        or value.get("request_id") != request_id
        or type(length) is not int
        or not 1 <= length <= MAX_RECEIPT
        or not isinstance(digest, str)
        or not re.fullmatch(r"[0-9a-f]{64}", digest)
    ):
        raise TransportError(
            "The receipt page index differs from the original request."
        )
    result = bytearray()
    while len(result) < length:
        command = {"request_id": request_id, "offset": len(result)}
        await client.write_gatt_char(
            PAGES, json.dumps(command, separators=(",", ":")).encode(), response=True
        )
        page = bytes(await client.read_gatt_char(PAGES))
        if not page or len(page) > 384 or len(result) + len(page) > length:
            raise TransportError("The original receipt page is incomplete.")
        result.extend(page)
    if not hmac.compare_digest(hashlib.sha256(result).hexdigest(), digest):
        raise TransportError("The original receipt pages changed during retrieval.")
    return parse_json(result, MAX_RECEIPT)


async def write_request(client, payload, manifest):
    """Write once using the advertised framing. Never restart an uncertain write."""
    mode = manifest.get("request_chunks")
    if mode is None:
        raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode()
        if len(raw) > 512:
            raise TransportError(
                "The request exceeds the legacy board transport limit."
            )
        # Bleak's response=True path retains the legacy GATT long-write behavior.
        await client.write_gatt_char(INVOKE, raw, response=True)
        return
    if mode != "proof-of-ready/request-chunks/v1":
        raise TransportError("The board advertises an unsupported request transport.")
    if type(client.mtu_size) is not int or client.mtu_size < 23:
        raise TransportError("The board connection has an invalid BLE MTU.")
    for chunk in encode_chunks(payload, client.mtu_size):
        await client.write_gatt_char(INVOKE, chunk, response=True)
