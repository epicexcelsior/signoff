"""Compare an existing flash backup and proposed image without opening a device."""

import hashlib
from pathlib import Path
import re
import struct


class PreservationError(ValueError):
    """The proposed write cannot establish preservation of stored device data."""


def partitions(table):
    """Decode an ESP-IDF partition table and verify its MD5 checksum trailer."""
    result = []
    for offset in range(0, min(len(table), 0xC00), 32):
        record = table[offset:offset + 32]
        if len(record) != 32:
            break
        magic = struct.unpack_from("<H", record)[0]
        if magic == 0xEBEB:
            if record[16:] != hashlib.md5(table[:offset]).digest():
                raise PreservationError("The partition table checksum does not match.")
            if not result:
                raise PreservationError("The partition table contains no partitions.")
            return result
        if magic != 0x50AA:
            break
        _, kind, subtype, start, size, label, flags = struct.unpack("<HBBII16sI", record)
        if not size or start % 0x1000 or size % 0x1000:
            raise PreservationError("A partition has an invalid flash range.")
        if any(start < item["offset"] + item["bytes"] and item["offset"] < start + size
               for item in result):
            raise PreservationError("The partition table contains overlapping ranges.")
        try:
            name = label.rstrip(b"\0").decode("ascii")
        except UnicodeDecodeError as error:
            raise PreservationError("A partition label is invalid.") from error
        result.append({"type": kind, "subtype": subtype, "offset": start,
                       "bytes": size, "label": name, "flags": flags})
    raise PreservationError("The partition table has no verified checksum trailer.")


def verify_preservation(build, backup, flash_files, table_offset=0x8000):
    build = Path(build).resolve(strict=True)
    backup = Path(backup).resolve(strict=True)
    if not build.is_dir() or not backup.is_file():
        raise PreservationError("Use an existing build directory and a regular flash backup file.")
    if not isinstance(flash_files, dict) or not flash_files:
        raise PreservationError("The proposed flash mapping must contain artifacts.")
    if (not isinstance(table_offset, int) or isinstance(table_offset, bool) or
            table_offset < 0 or table_offset % 0x1000 or table_offset + 0x1000 > 0x400000):
        raise PreservationError("The reviewed partition-table offset is invalid.")
    writes = []
    for offset, name in flash_files.items():
        if not isinstance(offset, str) or not re.fullmatch(r"0x[0-9a-fA-F]+", offset):
            raise PreservationError("A proposed write has an invalid nonnegative hexadecimal offset.")
        if not isinstance(name, str) or not name or Path(name).is_absolute():
            raise PreservationError("Use nonempty relative artifact paths within the build directory.")
        artifact = (build / name).resolve(strict=True)
        if build not in artifact.parents or not artifact.is_file():
            raise PreservationError("A proposed flash artifact leaves the build directory or is not a regular file.")
        size = artifact.stat().st_size
        if not size:
            raise PreservationError("A proposed flash artifact is empty.")
        address = int(offset, 16)
        start = address // 0x1000 * 0x1000
        end = ((address + size + 0xFFF) // 0x1000) * 0x1000
        if end > 0x400000:
            raise PreservationError("A proposed write exceeds the original flash capacity.")
        writes.append({"address": address, "start": start, "end": end, "artifact": artifact})
    original = backup.read_bytes()
    if len(original) != 0x400000:
        raise PreservationError("Use the original complete 4 MB C6FH4 flash backup.")
    original_table = partitions(original[table_offset:table_offset + 0x1000])
    table_write = next((item for item in writes if item["address"] == table_offset), None)
    if table_write is None:
        raise PreservationError("The flash mapping omits the reviewed partition table.")
    proposed_table = partitions(table_write["artifact"].read_bytes())
    if any(item["offset"] + item["bytes"] > len(original)
           for item in original_table + proposed_table):
        raise PreservationError("A partition exceeds the original flash capacity.")
    old_data = [item for item in original_table if item["type"] == 1]
    new_data = [item for item in proposed_table if item["type"] == 1]
    if not old_data or old_data != new_data:
        raise PreservationError("Data partition layouts differ. Preserve identity and replay storage before recovery.")
    checked = []
    for write in writes:
        start, end = write["start"], write["end"]
        if any(start < item["offset"] + item["bytes"] and item["offset"] < end
               for item in old_data):
            raise PreservationError("A proposed write erases a stored data partition.")
        if any(start < old_end and old_start < end for old_start, old_end in checked):
            raise PreservationError("Proposed write erase-sector ranges overlap.")
        checked.append((start, end))
    return {
        "status": "BACKUP_LAYOUT_MATCHES_NO_DATA_WRITE",
        "backupSha256": hashlib.sha256(original).hexdigest(),
        "backupBytes": len(original),
        "partitionTableOffset": table_offset,
        "preservedDataPartitions": old_data,
        "limits": "Offline layout check only. Confirm this is the current device backup before flash approval.",
    }
