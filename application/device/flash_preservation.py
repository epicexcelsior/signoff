"""Compare an existing flash backup and proposed image without opening a device."""

import hashlib
from pathlib import Path
import struct


class PreservationError(ValueError):
    """The proposed write cannot establish preservation of stored device data."""


def partitions(table):
    """Decode and authenticate an ESP-IDF partition table with its MD5 trailer."""
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
    original = backup.read_bytes()
    if len(original) != 0x400000:
        raise PreservationError("Use the original complete 4 MB C6FH4 flash backup.")
    if table_offset < 0 or table_offset % 0x1000 or table_offset + 0x1000 > len(original):
        raise PreservationError("The reviewed partition-table offset is invalid.")
    original_table = partitions(original[table_offset:table_offset + 0x1000])
    table_name = flash_files.get(hex(table_offset))
    if table_name is None:
        raise PreservationError("The flash mapping omits the reviewed partition table.")
    table_path = (build / table_name).resolve(strict=True)
    if build not in table_path.parents:
        raise PreservationError("The proposed partition table leaves the build directory.")
    proposed_table = partitions(table_path.read_bytes())
    if any(item["offset"] + item["bytes"] > len(original)
           for item in original_table + proposed_table):
        raise PreservationError("A partition exceeds the original flash capacity.")
    old_data = [item for item in original_table if item["type"] == 1]
    new_data = [item for item in proposed_table if item["type"] == 1]
    if not old_data or old_data != new_data:
        raise PreservationError("Data partition layouts differ. Preserve identity and replay storage before recovery.")
    for offset, name in flash_files.items():
        artifact = (build / name).resolve(strict=True)
        if build not in artifact.parents:
            raise PreservationError("A proposed flash artifact leaves the build directory.")
        start = int(offset, 16) // 0x1000 * 0x1000
        end = ((int(offset, 16) + artifact.stat().st_size + 0xFFF) // 0x1000) * 0x1000
        if end > len(original):
            raise PreservationError("A proposed write exceeds the original flash capacity.")
        if any(start < item["offset"] + item["bytes"] and item["offset"] < end
               for item in old_data):
            raise PreservationError("A proposed write erases a stored data partition.")
    return {
        "status": "BACKUP_LAYOUT_MATCHES_NO_DATA_WRITE",
        "backupSha256": hashlib.sha256(original).hexdigest(),
        "backupBytes": len(original),
        "partitionTableOffset": table_offset,
        "preservedDataPartitions": old_data,
        "limits": "Offline layout check only. Confirm this is the current device backup before flash approval.",
    }
