#!/usr/bin/env bash
set -euo pipefail
umask 077
source_dir="$(cd "$(dirname "$0")" && pwd)"
sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
android_jar="$sdk_root/platforms/android-36/android.jar"
build_tools="$sdk_root/build-tools/36.0.0"
output_dir="${PROOFREADY_MOBILE_BUILD_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/proof-of-ready/seeker-build}"
scratch_dir="$(mktemp -d "${TMPDIR:-/tmp}/proofready-seeker.XXXXXX")"
trap 'rm -rf -- "$scratch_dir"' EXIT
for tool in javac keytool jar zip python3; do command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 1; }; done
for file in "$android_jar" "$build_tools/aapt2" "$build_tools/d8" "$build_tools/zipalign" "$build_tools/apksigner"; do
  test -f "$file" || { echo "Missing $file" >&2; exit 1; }
done
python3 - "$source_dir" "$output_dir" <<'PY'
from pathlib import Path
import sys
source = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
if source.parent.parent in output.parents or output == source.parent.parent:
    raise SystemExit('Keep APKs and signing keys outside the source repository.')
PY
mkdir -p "$scratch_dir/classes" "$scratch_dir/dex" "$output_dir"
mapfile -t java_sources < <(find "$source_dir/src/com" -name '*.java' -print | sort)
javac --release 8 -Xlint:deprecation -cp "$android_jar" -d "$scratch_dir/classes" "${java_sources[@]}"
jar cf "$scratch_dir/classes.jar" -C "$scratch_dir/classes" .
"$build_tools/d8" --lib "$android_jar" --min-api 28 --output "$scratch_dir/dex" "$scratch_dir/classes.jar"
"$build_tools/aapt2" compile --dir "$source_dir/res" -o "$scratch_dir/resources.zip"
"$build_tools/aapt2" link -o "$scratch_dir/base.apk" --manifest "$source_dir/AndroidManifest.xml" -I "$android_jar" --min-sdk-version 28 --target-sdk-version 36 "$scratch_dir/resources.zip"
(cd "$scratch_dir/dex" && zip -q "$scratch_dir/base.apk" classes.dex)
"$build_tools/zipalign" -f 4 "$scratch_dir/base.apk" "$scratch_dir/aligned.apk"
if test ! -f "$output_dir/debug.keystore"; then
  keytool -genkeypair -keystore "$output_dir/debug.keystore" -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 3650 -dname "CN=Proof of Ready local debug,O=Proof of Ready,C=DE" -noprompt >/dev/null 2>&1
fi
"$build_tools/apksigner" sign --ks "$output_dir/debug.keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$output_dir/proof-of-ready-seeker-debug.apk" "$scratch_dir/aligned.apk"
"$build_tools/apksigner" verify --verbose "$output_dir/proof-of-ready-seeker-debug.apk"
python3 - "$output_dir/proof-of-ready-seeker-debug.apk" <<'PY'
import hashlib,json,pathlib,sys
apk=pathlib.Path(sys.argv[1])
print(json.dumps({'artifact':str(apk),'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'installed':False,'targetSdk':36,'minSdk':28}))
PY
