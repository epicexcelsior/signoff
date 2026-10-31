"""Inspect an existing ESP32-C6 build for a later explicit flash review.

This command reads local build artifacts only. It never opens a serial port,
reads a provisioning secret, flashes firmware, or issues a device operation.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
try:
    from .flash_preservation import PreservationError, verify_preservation
except ImportError:
    from flash_preservation import PreservationError, verify_preservation


class PlanError(ValueError):
    """A build cannot supply a complete immutable review record."""


def _outside_source(path):
    source = Path(__file__).resolve().parents[2]
    if path == source or source in path.parents:
        raise PlanError("Keep build artifacts and review records outside source.")


def inspect_build(build, backup=None):
    build = Path(build).resolve(strict=True)
    _outside_source(build)
    description = json.loads((build / "project_description.json").read_text())
    flash = json.loads((build / "flasher_args.json").read_text())
    if description.get("target") != "esp32c6" or flash.get(
        "extra_esptool_args", {}
    ).get("chip") != "esp32c6":
        raise PlanError("Use the compiled ESP32-C6 project and matching flash metadata.")
    if description.get("project_name") != "proof_of_ready_device":
        raise PlanError("Use a Proof of Ready firmware build.")
    project_path = description.get("project_path")
    if not isinstance(project_path, str) or not Path(project_path).is_absolute():
        raise PlanError("The build must identify its absolute source directory.")
    config = {}
    for line in (build / "sdkconfig").read_text().splitlines():
        if line.startswith("CONFIG_") and "=" in line:
            key, value = line.split("=", 1)
            config[key] = value
    files = flash.get("flash_files")
    if not isinstance(files, dict) or not files:
        raise PlanError("The build contains no flash artifact mapping.")
    artifacts = []
    ranges = []
    for offset, name in files.items():
        if not isinstance(offset, str) or not re.fullmatch(r"0x[0-9a-fA-F]+", offset):
            raise PlanError("The flash artifact contains an invalid offset.")
        if not isinstance(name, str) or Path(name).is_absolute():
            raise PlanError("Use relative flash artifacts within the build directory.")
        artifact = (build / name).resolve(strict=True)
        if build not in artifact.parents or not artifact.is_file():
            raise PlanError("A flash artifact leaves the reviewed build directory.")
        content = artifact.read_bytes()
        if not content:
            raise PlanError("A flash artifact is empty.")
        start, end = int(offset, 16), int(offset, 16) + len(content)
        if any(start < old_end and old_start < end for old_start, old_end in ranges):
            raise PlanError("Flash artifact ranges overlap.")
        ranges.append((start, end))
        artifacts.append(
            {
                "offset": offset,
                "file": name,
                "bytes": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
            }
        )
    profile = {
        key.removeprefix("CONFIG_PROOFREADY_").lower(): config.get(key, "n")
        for key in (
            "CONFIG_PROOFREADY_BOARD_REVIEWED",
            "CONFIG_PROOFREADY_CONTACT_ENABLED",
            "CONFIG_PROOFREADY_CONTACT_GPIO",
            "CONFIG_PROOFREADY_OPTICAL_ENABLED",
            "CONFIG_PROOFREADY_OPTICAL_GPIO",
            "CONFIG_PROOFREADY_OPTICAL_ACTIVE_LOW",
            "CONFIG_PROOFREADY_OPTICAL_WS2812",
            "CONFIG_PROOFREADY_OPTICAL_BRIGHTNESS",
        )
    }
    preservation = {"status": "UNVERIFIED", "flashAuthorized": False,
                    "reason": "Compare a current complete device backup before flash approval."}
    if backup is not None:
        try:
            preservation = verify_preservation(build, backup, files,
                int(config.get("CONFIG_PARTITION_TABLE_OFFSET", "0x8000"), 0))
        except PreservationError as error:
            raise PlanError(str(error)) from error
    blocked_by = [
        "Identify carrier board and manufacturer pinout.",
        "Review USB power and preserve native USB pins.",
    ]
    if profile["contact_enabled"] == "y":
        blocked_by.append(
            "Review actual button terminals, pull-up input, ground and contact GPIO."
        )
    if profile["optical_enabled"] == "y":
        blocked_by.append(
            "Review onboard WS2812 power, data routing and optical GPIO."
            if profile["optical_ws2812"] == "y"
            else "Review external LED, resistor, polarity and optical GPIO circuit."
        )
    blocked_by.extend([
        "Reject compiler-coverage profiles. Build an approved physical profile.",
        "Verify provisioning, receipt-key enrollment and private recovery backup.",
        "Approve exact image hashes, offsets, port, reset and flash action.",
    ])
    return {
        "schema": "proof-of-ready/firmware-flash-review/v1",
        "flashAuthorized": False,
        "hardwareEvidence": False,
        "boardReviewVerified": False,
        "buildDirectory": str(build),
        "target": "esp32c6",
        "configuredProfile": profile,
        "flashSettings": flash.get("flash_settings"),
        "storagePreservation": preservation,
        "artifacts": sorted(artifacts, key=lambda item: int(item["offset"], 16)),
        "blockedBy": blocked_by,
        "flashCommandForLaterReview": [
            "idf.py",
            "-C",
            project_path,
            "-B",
            str(build),
            "-p",
            "EXPLICIT_REVIEWED_SERIAL_PORT",
            "flash",
        ],
    }


def save_review(build, output, backup=None):
    output = Path(output)
    if not output.is_absolute():
        raise PlanError("Use an absolute private review-record path.")
    _outside_source(output.resolve())
    plan = inspect_build(build, backup)
    encoded = json.dumps(plan, indent=2, sort_keys=True) + "\n"
    descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        stream.write(encoded)
        stream.flush()
        os.fsync(stream.fileno())
    return plan


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("build_directory")
    parser.add_argument("private_review_file")
    parser.add_argument("--backup-image", help="Current complete private 4 MB device backup for offline data-layout checks")
    args = parser.parse_args()
    try:
        plan = save_review(args.build_directory, args.private_review_file, args.backup_image)
    except PlanError as error:
        parser.exit(1, f"{error} No device operation ran.\n")
    except FileExistsError:
        parser.exit(1, "The review file already exists. Its contents remain unchanged. No device operation ran.\n")
    except (OSError, ValueError, TypeError, KeyError):
        parser.exit(1, "Cannot prepare review. Check the existing build metadata and private output directory. No device operation ran.\n")
    print(json.dumps({"prepared": True, "artifacts": len(plan["artifacts"]), "flashAuthorized": False, "hardwareEvidence": False}))


if __name__ == "__main__":
    main()
