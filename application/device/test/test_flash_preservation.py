import hashlib
from pathlib import Path
import struct
import tempfile
import unittest
from application.device.flash_preservation import PreservationError, partitions, verify_preservation


def table(nvs_offset=0x9000):
    data = struct.pack("<HBBII16sI", 0x50AA, 1, 2, nvs_offset, 0x6000, b"nvs", 0)
    data += struct.pack("<HBBII16sI", 0x50AA, 0, 0, 0x10000, 0x100000, b"factory", 0)
    return data + b"\xeb\xeb" + b"\xff" * 14 + hashlib.md5(data).digest()


class FlashPreservationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.build = Path(self.temporary.name)
        original = bytearray(b"\xff" * 0x400000)
        original[0x8000:0x8000 + len(table())] = table()
        original[0x9000:0x9008] = b"identity"
        self.backup = self.build / "backup.bin"
        self.original = bytes(original)
        self.backup.write_bytes(original)
        (self.build / "table.bin").write_bytes(table())
        (self.build / "app.bin").write_bytes(b"new app")
        self.files = {"0x8000": "table.bin", "0x10000": "app.bin"}

    def test_matching_layout_preserves_original_and_records_hash(self):
        before = self.backup.read_bytes()
        result = verify_preservation(self.build, self.backup, self.files)
        self.assertEqual(result["status"], "BACKUP_LAYOUT_MATCHES_NO_DATA_WRITE")
        self.assertEqual(result["backupSha256"], hashlib.sha256(before).hexdigest())
        self.assertEqual(self.backup.read_bytes(), before)

    def test_changed_data_layout_rejects(self):
        (self.build / "table.bin").write_bytes(table(0xA000))
        with self.assertRaisesRegex(PreservationError, "layouts differ"):
            verify_preservation(self.build, self.backup, self.files)

    def test_data_erase_including_unaligned_sector_rejects(self):
        for offset in ["0x9000", "0xefff"]:
            with self.assertRaisesRegex(PreservationError, "erases"):
                verify_preservation(self.build, self.backup, {**self.files, offset: "app.bin"})

    def test_bad_checksum_incomplete_and_out_of_flash_reject(self):
        with self.assertRaises(PreservationError):
            partitions(table()[:-1] + b"\x00")
        self.backup.write_bytes(b"short")
        with self.assertRaises(PreservationError):
            verify_preservation(self.build, self.backup, self.files)
        self.backup.write_bytes(self.original)
        with self.assertRaises(PreservationError):
            verify_preservation(self.build, self.backup, {**self.files, "0x400000": "app.bin"})


if __name__ == "__main__":
    unittest.main()
