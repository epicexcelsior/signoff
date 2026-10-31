"""Open the existing real-evidence demo without starting hardware or payments."""
import json
import fcntl
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parents[2]
URL = "http://127.0.0.1:4022"


def station_mode():
    try:
        with urllib.request.urlopen(URL + "/api/config", timeout=2) as response:
            return json.load(response).get("mode")
    except urllib.error.URLError:
        return None


def main():
    logs = ROOT / ".local/demo-now"
    logs.mkdir(mode=0o700, parents=True, exist_ok=True)
    lease = (logs / "launch.lock").open("a")
    try:
        fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise RuntimeError("Another demo launch is in progress. Wait for its result.")
    mode = station_mode()
    if mode is not None and mode != "physical":
        raise RuntimeError("Port 4022 has another station. Leave it running and ask for help.")
    if mode is None:
        launcher = ROOT / ".local/private-config/hardware/optical-only-station-launch.py"
        if not launcher.is_file():
            raise RuntimeError("The private demo setup is missing. Do not create a replacement station.")
        pid_file = logs / "station.pid"
        if pid_file.exists():
            try:
                os.kill(int(pid_file.read_text()), 0)
            except ProcessLookupError:
                pass
            else:
                raise RuntimeError("The previous station process still exists. Do not start another copy. Ask for help.")
        with (logs / "station.log").open("ab") as log:
            process = subprocess.Popen(["python3", str(launcher)], cwd=ROOT, stdout=log, stderr=log, start_new_session=True)
        pid_file.write_text(str(process.pid))
        for _ in range(40):
            if process.poll() is not None:
                raise RuntimeError("The station did not start. Read .local/demo-now/station.log. Do not reset evidence.")
            if station_mode() == "physical":
                break
            time.sleep(0.25)
        else:
            raise RuntimeError("The station is still starting. Wait, then run this command again. Do not start another copy.")
    print("DEMO READY: " + URL + "/demo/")
    print("Open the saved real-evidence demo. Expected decision: REWORK.")
    print("This command starts no camera, device test, or payment.")
    webbrowser.open(URL + "/demo/")


if __name__ == "__main__":
    os.umask(0o077)
    try:
        main()
    except (OSError, ValueError, RuntimeError) as error:
        raise SystemExit("DEMO NOT STARTED: " + str(error))
