# Proof of Ready Seeker companion

The Android companion prepares the Solana Mobile Seeker for local commissioning. It contains no Solana integration, wallet, payment code, or actuator command.

Optical execution uses the station's browser camera controller and the laptop's Python BLE driver. The Station WebView permits camera capture only for its selected forwarded loopback origin. Real Seeker camera/optical performance remains untested. The native phone-witness photo is separate and cannot replace the complete optical waveform.

The app has three separate flows:

- **Station** opens the existing commissioning interface through one selected USB-forwarded loopback port. Its WebView has no native JavaScript bridge.
- **Phone witness** reserves one coordinator challenge, captures one rear-camera JPEG, and signs its digest with an Android Keystore P-256 key. The JPEG stays in private app storage. Only the signed envelope reaches the coordinator.
- **BLE preflight** reads the manifest from one configured Bluetooth address. It performs no scan or characteristic write. The manifest alone does not authenticate the board.

## Build and test locally

Use Node.js 24, JDK 17 or later, Android SDK platform 36, and build-tools 36.0.0. Set `ANDROID_HOME` or `ANDROID_SDK_ROOT` to the SDK directory. The build uses installed tools without downloading Gradle or dependencies.

From `application/mobile/`, run:

```sh
npm test
npm run check
npm run build
```

The build writes a debug APK and its debug signing key outside the repository. Its default directory is `$XDG_STATE_HOME/proof-of-ready/seeker-build`, or `$HOME/.local/state/proof-of-ready/seeker-build`. `PROOFREADY_MOBILE_BUILD_DIR` selects another directory outside source. The package name is `com.proofofready.seeker`. It targets API 36 and supports API 28 or later. This is a local debug artifact, not a distribution release.

The host tests cover original request/key binding, optional JPEG-byte verification, edited claims, timing boundaries, malformed input, restricted URLs, and USB authorization. They compile the actual Java signature and URL classes. Java generates 256 P-256 signatures and checks their P1363 conversion. A Java-generated signature also passes the Node envelope verifier. [Evidence](../../research/EVIDENCE.md#current-local-implementation-evidence) owns current check counts and observed results.

After the parent application dependencies exist, run `npm run format:check`. No Java formatter or Android lint task exists in this offline build. The Android compiler reports compatibility deprecations for pre-33 BLE callbacks and pre-30 window insets. These branches preserve the declared minimum SDK.

## Prepare USB forwarding

Installation, USB forwarding, and device operations require targeted authorization. The preparation commands below do not install or connect the phone:

```sh
npm run usb:plan -- EXPLICIT_ADB_SERIAL 4022
```

The result names one device, the forwarding command, and its removal command. The coordinator remains bound to laptop loopback.

After targeted authorization, install the debug APK with `adb -s EXPLICIT_ADB_SERIAL install -r APK_PATH`. Open **Proof of Ready** on the phone. Enable USB debugging only for the trusted laptop.

After separate forwarding authorization, run:

```sh
PROOFREADY_USB_AUTHORIZED=true npm run usb:connect -- EXPLICIT_ADB_SERIAL 4022
```

`PROOFREADY_ADB` selects an explicit adb executable. The script requires that exact serial in `adb devices` with the `device` state. It does not select the first connected phone. Remove forwarding with `adb -s EXPLICIT_ADB_SERIAL reverse --remove tcp:4022`.

Use the same coordinator port in the app. The native client and WebView permit only `http://127.0.0.1:PORT`. They reject another host, port, credentials, encoded paths, redirects, and non-HTTP schemes. The WebView grants only camera permission for that origin. Every native POST uses the current local coordinator capability. Packet downloads need the laptop browser. The WebView does not grant file access or export private files.

## Enroll and capture a phone witness

1. Open **Phone witness** on the authorized phone.
2. Transfer `files/phone-public-key.json` through a trusted channel.
3. Enroll its `publicKeySec1Hex` in the coordinator's private phone-pin configuration.
4. Approve a work order after key enrollment.
5. Start a capture attempt at the commissioning station.
6. Enter its capture identifier in the companion.
7. Select **Load request from station**.
8. Select **Arm one photo**.
9. Grant camera permission if requested.
10. Select **Capture requested photo** before the deadline.
11. Select **Send signed envelope to station**.

The public pin also appears on screen. For an authorized debug export, `adb -s EXPLICIT_ADB_SERIAL shell run-as com.proofofready.seeker cat files/phone-public-key.json` reads it. The file contains public data only. Preserve private JPEGs and the request ledger. Do not use `pm clear`, reinstall with data deletion, or reset the ledger to repeat an interrupted request.

A SQLite reservation commits before camera dispatch. Another request with the same identifier rejects. Capture failure, pause, changed geometry, deadline expiry, and restart consume the original request. A new coordinator attempt supplies a new challenge. A completed envelope can be resent after an uncertain upload. The coordinator owns duplicate-delivery handling.

Private files use `files/photos/REQUEST_ID.jpg` and `files/photos/REQUEST_ID.json`. The phone retains at most 500 request records. No deletion operation exists in the app. Uninstalling it destroys its local key and replay history. The coordinator still owns its original request records and enrolled key.

## Coordinator interface

`POST /api/commissioning/sessions/:id/phone-challenge` takes `{}` and returns the original challenge. Its exact fields are:

```json
{
  "schema": "proof-of-ready/phone-challenge/v1",
  "work_order_digest": "0x plus 64 lowercase hexadecimal characters",
  "session_id": "16 lowercase hexadecimal characters",
  "request_id": "16 lowercase hexadecimal characters",
  "provider": "seeker-inspector",
  "nonce": 1,
  "requested_at": 1000,
  "expires_at": 1060
}
```

This shape is explanatory. Its timestamps are expired example values. A challenge lasts at most 60 seconds. Its nonce ranges from 1 through 2147483647. Never construct a replacement challenge locally.

`POST /api/commissioning/sessions/:id/phone-evidence` takes the flat signed envelope. It retains the challenge fields and changes `schema` to `proof-of-ready/phone-photo/v1`. It adds `image_sha256`, `captured_at`, `public_key_sec1_hex`, `key_security_level`, and `receipt_signature`.

The signature covers these UTF-8 fields joined by `|`, with no trailing separator:

```text
proof-of-ready-phone-photo-v1|work_order_digest|session_id|request_id|provider|nonce|image_sha256|requested_at|expires_at|captured_at|key_security_level
```

The signature uses SHA-256/P-256/P1363. `receipt_signature` contains `v3:` followed by canonical Base64 for 64 signature bytes. The public key uses uncompressed SEC1 hexadecimal encoding. All digests and identifiers use lowercase hexadecimal.

`src/phone-evidence.mjs` exports `validatePhoneChallenge`, `phoneEvidenceMessage`, and `verifyPhoneEvidence`. The verifier requires `{envelope,challenge,publicKey,now?,imageBytes?}`. `now` uses Unix seconds. Use the saved ingestion time for historical reconstruction. The caller supplies the independently enrolled `publicKey`.

Without original JPEG bytes, verification returns `imageBytesVerified:false`. With matching original bytes, it returns `true`. Neither result establishes scene truth, authenticated camera origin, physical installation, or remote hardware attestation. Key security metadata is a signed application claim. The phone envelope does not replace planar placement or optical evidence.

## Android-only verification

`CompanionInstrumentation` tests real Android SQLite reservation, restart, concurrent writers, request boundaries, and the Java wire string. The APK compiles this instrumentation. No instrumentation, emulator, installation, physical camera, or BLE test ran during this lane.

After targeted emulator authorization and APK installation, run:

```sh
adb -s EXPLICIT_EMULATOR_SERIAL shell am instrument -w com.proofofready.seeker/.CompanionInstrumentation
```

The instrumentation creates and deletes only its own uniquely named test database. It never opens the production request database or uses camera/BLE permissions. A successful report includes its assertion count. Native lifecycle, camera permissions, Seeker camera quality, WebView camera support, and BLE compatibility still need device testing.

## Provenance and API basis

The offline packaging approach follows the sibling capmesh Seeker inspector as a read-only local reference. The runtime uses Android platform APIs only. The Node verifier uses built-in cryptography only.

The implementation uses [Android Keystore](https://developer.android.com/privacy-and-security/keystore) for non-exportable key operations. It reports key security metadata without claiming remote attestation. The BLE reader uses the [API 33 byte-array callback](https://developer.android.com/reference/android/bluetooth/BluetoothGattCallback) and retains the older callback for API 28–32. Camera sessions use the [API 28 SessionConfiguration interface](<https://developer.android.com/reference/android/hardware/camera2/CameraDevice#createCaptureSession(android.hardware.camera2.params.SessionConfiguration)>). These sources were checked on October 30, 2026.
