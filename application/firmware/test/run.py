"""Compile real portable firmware code and run host rejection checks."""

from pathlib import Path
import argparse
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--sanitize", action="store_true")
args = parser.parse_args()
with tempfile.TemporaryDirectory(prefix="proofready-host-") as temporary:
    binary = str(Path(temporary) / "protocol-test")
    command = [
        "cc",
        "-std=c11",
        "-D_POSIX_C_SOURCE=200809L",
        "-DCJSON_NESTING_LIMIT=16",
        "-Wall",
        "-Wextra",
        "-Werror",
        "-g",
        "-I",
        str(root / "core"),
        "-I",
        str(root / "components/cjson"),
    ]
    if args.sanitize:
        command += ["-fsanitize=address,undefined", "-fno-omit-frame-pointer"]
    command += [
        str(root / p)
        for p in (
            "test/protocol_test.c",
            "core/protocol.c",
            "core/transfer.c",
            "core/ws2812.c",
            "core/c6_pins.c",
            "components/cjson/cJSON.c",
        )
    ]
    command += ["-lm", "-o", binary]
    subprocess.run(command, check=True)
    subprocess.run([binary], check=True)
