import json
import os
from pathlib import Path
import tempfile
import unittest
from application.device.firmware_plan import PlanError, inspect_build, save_review


class FirmwarePlanTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.build = self.directory / "build"
        self.build.mkdir()
        self.flash = {
            "extra_esptool_args": {"chip": "esp32c6"},
            "flash_settings": {"flash_mode": "dio", "flash_size": "2MB"},
            "flash_files": {"0x10000": "firmware.bin"},
        }
        (self.build / "project_description.json").write_text(json.dumps({
            "target": "esp32c6", "project_name": "proof_of_ready_device",
            "project_path": "/explicit/source/firmware",
        }))
        (self.build / "sdkconfig").write_text(
            "CONFIG_PROOFREADY_BOARD_REVIEWED=y\n"
            "CONFIG_PROOFREADY_CONTACT_ENABLED=y\n"
            "CONFIG_PROOFREADY_CONTACT_GPIO=2\n"
            "CONFIG_PROOFREADY_OPTICAL_ENABLED=y\n"
            "CONFIG_PROOFREADY_OPTICAL_GPIO=3\n"
        )
        (self.build / "firmware.bin").write_bytes(b"review bytes")
        self.write_flash()

    def write_flash(self):
        (self.build / "flasher_args.json").write_text(json.dumps(self.flash))

    def test_review_preserves_artifact_hashes_without_authorizing_synthetic_pins(self):
        import hashlib
        output = self.directory / "review.json"
        plan = save_review(self.build, output)
        self.assertFalse(plan["flashAuthorized"])
        self.assertFalse(plan["hardwareEvidence"])
        self.assertFalse(plan["boardReviewVerified"])
        self.assertEqual(plan["configuredProfile"]["contact_gpio"], "2")
        self.assertEqual(plan["artifacts"][0]["sha256"], hashlib.sha256(b"review bytes").hexdigest())
        self.assertEqual(os.stat(output).st_mode & 0o777, 0o600)
        with self.assertRaises(FileExistsError):
            save_review(self.build, output)
        self.assertEqual(json.loads(output.read_text()), plan)

    def test_review_records_addressable_emitter_configuration(self):
        with (self.build / "sdkconfig").open("a") as stream:
            stream.write("CONFIG_PROOFREADY_OPTICAL_WS2812=y\n"
                         "CONFIG_PROOFREADY_OPTICAL_BRIGHTNESS=32\n")
        plan = inspect_build(self.build)
        self.assertEqual(plan["configuredProfile"]["optical_ws2812"], "y")
        self.assertEqual(plan["configuredProfile"]["optical_brightness"], "32")
        self.assertFalse(plan["flashAuthorized"])

    def test_wrong_target_and_empty_artifacts_reject(self):
        self.flash["extra_esptool_args"]["chip"] = "esp32"
        self.write_flash()
        with self.assertRaises(PlanError):
            inspect_build(self.build)
        self.flash["extra_esptool_args"]["chip"] = "esp32c6"
        self.flash["flash_files"] = {}
        self.write_flash()
        with self.assertRaises(PlanError):
            inspect_build(self.build)

    def test_traversal_symlink_absolute_and_overlap_reject(self):
        (self.directory / "outside.bin").write_bytes(b"outside")
        (self.build / "link.bin").symlink_to(self.directory / "outside.bin")
        for value in ["../outside.bin", "link.bin", str(self.directory / "outside.bin")]:
            self.flash["flash_files"] = {"0x10000": value}
            self.write_flash()
            with self.assertRaises(PlanError):
                inspect_build(self.build)
        self.flash["flash_files"] = {"0x10000": "firmware.bin", "0x10001": "firmware.bin"}
        self.write_flash()
        with self.assertRaises(PlanError):
            inspect_build(self.build)

    def test_review_requires_private_absolute_output(self):
        with self.assertRaises(PlanError):
            save_review(self.build, "relative-review.json")
        source = Path(__file__).resolve().parents[3]
        with self.assertRaises(PlanError):
            save_review(self.build, source / "review.json")


if __name__ == "__main__":
    unittest.main()
