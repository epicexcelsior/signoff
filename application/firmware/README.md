# ESP32 commissioning reference firmware

This package prepares signed contact reads and challenge-bound optical emission for an ESP32. The default build initializes no GPIO. It advertises no operation until a secret and an explicitly reviewed hardware profile exist.

A read-only USB query identified the connected chip as **ESP32-C6FH4, revision 0.2, with 4 MB embedded flash**. The owner identifies an ESP32-C6 SuperMini carrier. Three supplied photos show Super Mini / ESP32-C6 markings and a layout matching the seller schematic below. No maker or revision appears. The owner-approved optical-only image is flashed. USB startup/public-key validation passed. Its first boot sent an OFF pixel. No signed optical challenge or contact test ran.

## Check without hardware

From the repository root, run:

```sh
python3 application/firmware/test/run.py --sanitize
python3 -m unittest discover -s application/device/test -v
```

The C harness compiles the actual parser, replay storage, request transport, and optical encoder. AddressSanitizer and UndefinedBehaviorSanitizer check those host paths. Grouped checks cover malformed input, exact wire vectors, time boundaries, replay restoration, capacity, concurrent transport ownership, and emission cleanup. Python tests cover the drivers, receipt paging, binding rejection, authorization, uncertain writes, and private flash-review records. [Evidence](../../research/EVIDENCE.md#current-local-implementation-evidence) owns current check counts and observed results.

These checks use host functions and fake Bluetooth clients. They do not establish NVS durability on a physical board, actual GPIO timing, receipt signing on that board, or optical accuracy.

## Compile without flashing

Use ESP-IDF 6.1 and its matching tools. This package compiled with IDF revision `fff9895c82d744c7237be8847347bdd1b07c6643` and RISC-V GCC 15.2.0. The official [NimBLE sequence](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32c6/api-reference/bluetooth/nimble/index.html) supplies the startup order.

After activating the SDK, select an external build directory:

```sh
cd application/firmware
idf.py -B /tmp/proofready-c6-build \
  -D SDKCONFIG=/tmp/proofready-c6-build/sdkconfig \
  -D IDF_TARGET=esp32c6 build
```

Expected result: `proof_of_ready_device.bin` exists in that external directory. The default build disables contact input and optical emission. Its authorization secret is empty. Building does not identify installed firmware or establish provenance for the connected board.

`test/compile-only.defaults` exercises enabled contact and active-low optical branches. It contains synthetic pins for compiler coverage. **Do not flash that profile.** Both that profile and the default profile passed compilation. Physical profile review must select actual pins independently.

Keep binaries, build directories, SDK configuration, and provisioned secrets outside tracked source. A separately authorized build can use `-D PROOFREADY_AUTH_SECRET_FILE=/absolute/private/path`. That file contains 16–128 exact UTF-8 secret bytes without a trailing newline. CMake rejects files inside this repository. Firmware embeds those bytes, then provisions them into NVS only when no secret exists. An existing secret remains unchanged. Firmware binaries therefore require private storage.

Flashing, GPIO enablement, and security-fuse changes require targeted authorization. No command here flashes or changes security fuses. No default GPIO is inferred.

## Prepare the first physical test

The selected optical-only candidate uses the matching layout's onboard WS2812-compatible RGB LED on GPIO8. The owner approved that exact image and its first boot. The full camera-observed challenge still requires a separate bounded grant. An onboard LED needs no external LED wiring.

The firmware now supports one WS2812-compatible LED through ESP-IDF RMT. Plain GPIO writes cannot drive this addressable LED. The default build keeps both optical and contact capabilities disabled. The external button comes after the first optical test.

Keep external wiring disconnected until the carrier and button terminals receive review. Use the printed camera target for the optical test.

### Resolve the hardware inputs

| Stage                               | Required evidence                                                    | Review decision                                                            |
| ----------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Before onboard optical test         | Clear front/back carrier photos, silkscreen, and onboard LED routing | Match the actual carrier and confirm the WS2812 GPIO8 route.               |
| Before flash                        | USB power documentation and actual image configuration               | Preserve USB, storage, identity, and unused pins. Select WS2812 mode.      |
| Before external button test         | Reviewed input header, ground, and button terminal layout            | Identify the two contacts that close only during a press.                  |
| Optional discrete-LED fallback only | LED type, polarity, forward voltage, and rated current               | Review an external indicator circuit if the onboard LED proves unsuitable. |
| Optional discrete-LED fallback only | Resistor markings or measured resistance                             | Calculate current and compare it with LED and GPIO limits.                 |

External LED and resistor identification do not block the onboard WS2812 test. Keep the button disconnected until its later wiring review.

[Espressif's GPIO reference](https://docs.espressif.com/projects/esp-idf/en/v6.1/esp32c6/api-reference/peripherals/gpio.html) identifies USB and flash restrictions. The [C6 datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-c6_datasheet_en.pdf) identifies the strapping pins. The exact carrier can add restrictions.

| C6FH4 pins                     | Restriction for this commissioning profile                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| GPIO4, 5, 8, 9, 15             | Boot straps. Do not attach the contact button. GPIO9 commonly connects to BOOT.                            |
| GPIO8                          | Permit optical output only in WS2812 mode after carrier confirmation. Do not add external loads.           |
| GPIO12, 13                     | Preserve native USB Serial/JTAG. Firmware rejects these pins.                                              |
| GPIO10, 11 and flash GPIO24–30 | Not exposed on C6FH4. Firmware rejects these pins.                                                         |
| GPIO2                          | Candidate contact input at chip level. Confirm the actual carrier header and absence of other loads first. |

The firmware checks all selected pins before configuring any GPIO. It rejects pin sharing between contact and optical functions. These checks enforce chip restrictions. They do not prove carrier routing.

Espressif's [generic C6 Arduino variant](https://github.com/espressif/arduino-esp32/blob/master/variants/esp32c6/pins_arduino.h) selects RGB GPIO8. Its [DevKitM schematic](https://dl.espressif.com/dl/schematics/esp32-c6-devkitm-1-schematics.pdf) connects a WS2812B to GPIO8. These are independent references for the candidate circuit. They do not identify the owner's SuperMini carrier.

The [Nologo manufacturer repository](https://github.com/NologoTech/ESP32C6-SuperMIni/tree/b9f64e2d7dda5d768b8afeb66f9465d22c7304ae) contains only a README heading. Its [Chinese product guide](https://www.nologo.tech/product/esp32/esp32c6/esp32c6supermini/ESP32C6_SuperMini_Getting_Started.html) states that documentation is under update. Neither Nologo source supplies a schematic or board revision. The later matching seller schematic below supplies the reviewed candidate routing. The English page's [served content asset](https://www.nologo.tech/assets/ESP32C6_SuperMini_Getting_Started.html-CJAPcTds.js) contains Seeed XIAO instructions. Do not apply its GPIO3/GPIO14 antenna assignments to this SuperMini.

[TinyTronics' Nologo listing](https://www.tinytronics.nl/en/development-boards/microcontroller-boards/with-wi-fi/esp32-c6-supermini-development-board) describes a black 26 × 18 mm carrier with 4 MB flash, WS2812B, and battery pads. Its linked pinout and schematic downloads returned HTTP 403 locally. Their diagrams remain visually unverified. Keep battery pads disconnected for this USB-only test.

The [Hobby Components seller guide](https://forum.hobbycomponents.com/viewtopic.php?f=134&p=9078&t=3163) names RGB GPIO8 and separately demonstrates an ordinary LED on GPIO15. These are separate candidate LED circuits. The GPIO15 blink program cannot drive the GPIO8 WS2812. The selected physical profile uses GPIO8 for the onboard RGB LED and GPIO2 for the button only after carrier/header confirmation. Keep BOOT GPIO9, ordinary LED GPIO15, and USB GPIO12/13 unused by external wiring. No physical header position is approved yet.

The supplied front/back photos match the [direct seller schematic](https://hobbycomponents.com/images/forum/HCDVBD/HCDVBD0051/HCDVBD0051_Schematic.png). The recovered PNG shows WS2812 DIN on GPIO8, BOOT on GPIO9, ordinary LED on GPIO15, and native USB on GPIO12/13. Header labels, battery pads and component positions match. Hidden routing remains an inference from the matching layout. Do not infer a maker or revision from the C6FH4 chip label.

Chip identity does not resolve these inputs. An ESP32-C6 chip label is not a carrier-board model. Never copy GPIO 2/3 from `test/compile-only.defaults` into a physical profile.

The onboard optical path uses the carrier's existing WS2812 data and power traces. Add no external LED or resistor. The later button path connects a reviewed input to ground through a normally-open switch.

Only the optional discrete-LED fallback uses this logical circuit. It is not a pin-to-pin wiring instruction:

```text
reviewed optical output -- current-limiting resistor -- discrete LED -- reviewed GND
```

That fallback assumes an active-high output and correct polarity. Review its actual circuit before setting `CONFIG_PROOFREADY_OPTICAL_ACTIVE_LOW`.

After carrier/header confirmation, connect the normally-open button between the reviewed GPIO2 header and GND. Confirm the switch terminal pairs with a continuity meter first. Disconnect USB power before wiring. This is a candidate circuit, not authorization to wire it.

The contact input enables its internal pull-up. A released button means OPEN. A pressed button connects the reviewed input to ground and means CLOSED. Never connect an external voltage to that input. For an external LED, calculate `I = (V_GPIO - V_LED) / R` using documented limits and the actual parts. Never connect an LED directly to a GPIO without its reviewed current-limiting circuit.

After review, record the carrier references, physical header labels, GPIO numbers, power source, and a wiring photo. Record resistor value and polarity only for a discrete-LED fallback. Keep those details with the physical evidence. Disconnect power before changing wires.

### Prepare provisioning and the private build

Use one private authorization secret of 16–128 exact UTF-8 bytes. A 64-character hexadecimal secret provides a simple printable form. Keep its exact bytes without a trailing newline. Create it outside source with mode `0600`. Never print it or place it in a command argument.

For the first onboard optical test, a reviewed private SDK defaults file uses this shape:

```text
CONFIG_PROOFREADY_PROVIDER="your-enrolled-provider"
CONFIG_PROOFREADY_BOARD_REVIEWED=y
CONFIG_PROOFREADY_CONTACT_ENABLED=n
CONFIG_PROOFREADY_OPTICAL_ENABLED=y
CONFIG_PROOFREADY_OPTICAL_GPIO=REVIEWED_OPTICAL_GPIO
# CONFIG_PROOFREADY_OPTICAL_ACTIVE_LOW is not set
```

For a carrier-confirmed onboard WS2812, add `CONFIG_PROOFREADY_OPTICAL_WS2812=y` and `CONFIG_PROOFREADY_OPTICAL_BRIGHTNESS=32`. Select the confirmed GPIO8 route. Keep active-low disabled. Keep the contact capability disabled for the initial optical profile. After button review, add `CONFIG_PROOFREADY_CONTACT_ENABLED=y` and `CONFIG_PROOFREADY_CONTACT_GPIO=REVIEWED_CONTACT_GPIO`. Changing this profile requires a new image review and explicit flash approval. Reuse the original authorization secret, identity, partition layout, and current replay state. Do not repeat flashing to troubleshoot uncertainty.

The WS2812 backend uses a 10 MHz RMT clock, one 24-bit equal-channel GRB pixel, and a 300 µs low latch. It sends dim white for ON and zero for OFF. ESP-IDF's [official RMT example](https://github.com/espressif/esp-idf/blob/fff9895c82d744c7237be8847347bdd1b07c6643/examples/peripherals/rmt/led_strip/main/led_strip_encoder.c) supplies the bit timing reference. The backend waits for each transfer. A missed symbol deadline invalidates emission. An uncertain RMT completion blocks later writes until reviewed recovery. Disconnect USB if an emitter remains lit after a failure.

`test/ws2812-compile-only.defaults` exercises this backend with synthetic pins. Never flash it. Host vectors and compilation do not prove LED compatibility or physical timing.

This shape is explanatory. The GPIO placeholders are not compilable values. Replace them only after board review. The active-high example does not establish the actual LED polarity.

Build from the repository root after activating the matching SDK:

```sh
idf.py -C application/firmware -B "${PRIVATE_BUILD_DIR:?}" \
  -D "SDKCONFIG=${PRIVATE_BUILD_DIR:?}/sdkconfig" \
  -D IDF_TARGET=esp32c6 \
  -D "SDKCONFIG_DEFAULTS=sdkconfig.defaults;${REVIEWED_DEFAULTS_FILE:?}" \
  -D "PROOFREADY_AUTH_SECRET_FILE=${PRIVATE_SECRET_FILE:?}" build
```

All three variables name absolute private paths outside source. This command builds only. The firmware image contains the embedded provisioning secret. Protect binaries, generated headers, SDK configuration, and build logs accordingly.

An existing NVS authorization secret remains unchanged after flashing. A new embedded secret does not rotate it. Preserve any existing receipt identity and replay claims. Do not erase NVS to make a mismatched configuration work.

### Inspect the actual artifacts before requesting flash approval

From the repository root, run:

```sh
python3 application/device/firmware_plan.py \
  "${PRIVATE_BUILD_DIR:?}" "${PRIVATE_FLASH_REVIEW_FILE:?}"
```

The output file must be an unused absolute private path outside source. The command reads `project_description.json`, `sdkconfig`, `flasher_args.json`, and mapped binaries. It saves actual SHA-256 hashes, byte lengths, offsets, and profile settings. It rejects another target, missing/empty files, overlapping ranges, or files outside the build directory. It never reads the secret file or opens a serial/BLE connection.

Without a current device backup, the record reports `storagePreservation.status:UNVERIFIED`. After a separately authorized full backup, add `--backup-image /absolute/private/current-backup.bin`. The offline check verifies partition-table checksums, identical data-partition layouts, flash bounds, and write-sector exclusion from all data partitions. It rejects a truncated backup, moved NVS, and writes that erase stored data. This check never opens a device.

The backup must belong to the connected board and reflect its current state. Compare its hash and acquisition record before approval. The check cannot establish that identity from bytes alone. An older NVS backup can roll back consumed replay claims.

The record always returns `flashAuthorized:false`, `hardwareEvidence:false`, and `boardReviewVerified:false`. A Kconfig `BOARD_REVIEWED=y` value does not prove a hardware review. The compiler-coverage profile remains unsuitable for flashing even when this inspection succeeds.

The current default and coverage builds use **DIO, 2 MB, 80 MHz** flash settings. The USB chip query found 4 MB flash. Review these configured settings and the partition table against the exact carrier before approving a physical image. Compilation does not establish electrical suitability.

### Request the concrete hardware approvals

| Action            | Exact information required before approval                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Backup and reset  | One serial port, confirmed chip/flash size, private backup path, bootloader/reset behavior, and storage protection        |
| Flash             | Reviewed carrier/wiring profile, provisioned image hashes, mapped offsets, flash settings, target port, and recovery path |
| Wire and power    | Pin-to-pin diagram, supply/ground, resistor, polarity, and approved GPIO functions                                        |
| Optical execution | Enrolled provider/key, session/challenge, one 18-second LED emission, and camera readiness                                |

Do not combine approval for one action with permission for another. No action in this guide authorizes equipment actuation, security-fuse changes, or payments.

The USB chip query established a 4 MB flash capacity. After separate backup/reset authorization, the matching esptool supports this full read:

```sh
umask 077
python -m esptool --chip esp32c6 --port "${REVIEWED_SERIAL_PORT:?}" \
  read-flash 0x0 0x400000 "${PRIVATE_BACKUP_FILE:?}"
```

The owner-approved full read completed once and its private hash is preserved in the hardware inventory. For another explicitly authorized backup, select an unused filename. It enters the bootloader and can reset the device. [Espressif's esptool reference](https://docs.espressif.com/projects/esptool/en/latest/esp32c6/esptool/basic-commands.html) defines flash read/write semantics. The local esptool 5.6.0 help confirms the `read-flash ADDRESS SIZE OUTPUT` arguments. Preserve the backup hash and the existing firmware's provenance. The backup can contain credentials and device identity.

Before flash approval, compare the current backup with the actual proposed partition table. Preserve the original backup, its hash, provisioned key, NVS authorization secret, and replay state. A different partition layout requires a reviewed migration. Never erase storage to bypass this check.

For failed boot, disconnect external wiring and power. Enter the ROM downloader with the carrier's reviewed BOOT/RESET sequence. Preserve GPIO8's required strap state. Do not drive USB pins. Request review before any recovery write. A full backup restore can roll back replay claims, so preserve the latest state first.

After explicit flash authorization, use the command from the private review record with the actual reviewed port. Its generic form is:

```sh
idf.py -C application/firmware -B "${PRIVATE_BUILD_DIR:?}" \
  -p "${REVIEWED_SERIAL_PORT:?}" flash
```

The reviewed optical-only flash completed once with three explicit image writes. This generic command does not authorize another flash. Do not add `erase-flash`. Do not flash `test/compile-only.defaults`. A recovery write requires another review. Restoring an old image or NVS snapshot can destroy newer identity or replay evidence.

After authorized flashing, inspect the USB startup log through the trusted port. Enroll its `P256_PUBLIC_KEY` value before approving a physical work order. No private signing key belongs in a receipt-pin file. Confirm the manifest's provider, enabled capabilities, current boot identifier, and remaining claims.

### Capture one real attempt

The coordinator issues a three-state contact sequence. Follow each requested state instead of assuming its initial state. A successful attempt uses three original contact requests and one original optical request.

1. Start the station with the independently enrolled provider, public key, BLE address, and exact authorization secret.
2. Check that the station shows **Physical adapter**.
3. Approve the work order for the actual specimen.
4. Start the available camera and align both measured markers.
5. Start one capture attempt.
6. Save the camera measurement.
7. Follow each requested button state and select **Read contact**.
8. Hold the state until that read returns.
9. Select **Capture signed optical test** after camera readiness.
10. Keep the LED and both markers visible for the complete emission.
11. Close the capture and inspect every predicate.
12. Export the original evidence packet and preserve its hashes.

The capture window lasts two minutes. The optical waveform lasts 18 seconds. A contact sample uses five reads over approximately 40 ms. Camera throughput and physical timing remain unverified until this real attempt succeeds.

The firmware has 64 persistent, non-evicting claims shared by contact and optical operations. One complete attempt consumes four claims. A fresh identity therefore permits at most 16 complete attempts. An admitted operation consumes its claim before measurement, including a later execution failure. Check `remaining_claims` before an attempt. Reserve at least four claims for the complete path. Do not erase claims to repeat a demonstration.

A lost reply never authorizes another execution of that request. Preserve the original uncertain record. Start a new coordinator attempt only after inspecting the previous operation. An optical failure or camera tracking loss invalidates that attempt. No physical result exists until the actual receipts and tracked capture pass their original bindings.

## Interface and recovery

The reference keeps the existing `capmesh/0.1` `state.observe` message and P-256 observation signature. Its input-to-ground circuit treats low as closed. Five samples span about 40 ms. Open contact and broken wire remain indistinguishable.

Optical requests use `optical.emit`. Parameters contain `work_order_digest`, `session_id`, `bits`, `half_symbol_ms:250`, and `sensor:"optical-led"`. The request also includes the manifest's 16-hex-digit `boot_id`. The HMAC commits:

```text
proof-of-ready-optical-auth-v1|request_id|provider|boot_id|work_order_digest|session_id|bits|250|nonce|timestamp|expiration
```

HMAC-SHA256 uses the exact provisioned secret. The request lifetime is at most 45 seconds. Admission requires at least 19 seconds remaining. The first authenticated request sets a local epoch offset. The firmware has no independent trusted clock. A new optical request must bind the current random boot identity.

The encoder emits an eight-symbol preamble and 32 Manchester bits. Each half-symbol lasts 250 ms. The complete sequence has 72 symbols and lasts 18 seconds. The emitter returns to idle after completion or a driver failure. The receipt follows the shared [optical protocol](../protocol/optical-v1.json). It binds the work order, capture attempt, challenge, timing, and complete symbol count.

The BLE service uses these Bluetooth-base UUID suffixes:

| Characteristic | Operation                                                                       |
| -------------- | ------------------------------------------------------------------------------- |
| `cb01`         | Read manifest, current boot identity, capability availability, remaining claims |
| `cb02`         | Write one request or sequential request chunks                                  |
| `cb03`         | Read receipt or page index, subscribe for completion signal                     |
| `cb04`         | Select and read exact receipt pages                                             |

The optical JSON exceeds BLE's 512-byte attribute limit. Each request chunk starts with `50 52 01 00`, total length as uint16 big-endian, and offset as uint16 big-endian. The remaining bytes contain UTF-8 JSON. Each write is at most 512 bytes. Total input is at most 1,536 bytes. The manifest identifies this framing as `proof-of-ready/request-chunks/v1`.

Chunks require sequential offsets from one connection. An incomplete transfer expires after five seconds. Another connection or a dispatched operation returns busy. A disconnect discards incomplete input. It does not cancel or repeat a dispatched operation. Existing contact JSON of at most 512 bytes remains accepted directly.

For receipts longer than 480 bytes, `cb03` returns `proof-of-ready/receipt-pages/v1` with `request_id`, `length`, and `sha256`. Write `{request_id,offset}` to `cb04`, then read up to 384 bytes. Verify the complete length and SHA-256 before parsing. Notifications signal completion. They do not carry acceptance evidence.

The firmware commits each request ID and nonce to NVS before sampling or emission. Replay claims persist across restart. There are 64 claims and no eviction. At capacity, new operations reject. Corrupt storage and unavailable keys fail closed. Initialization never erases NVS or replaces an existing identity. Preserve unresolved claims for investigation. Reprovisioning or erasure requires a separate recovery decision.

The P-256 key uses software-backed PSA persistent storage. The public key appears on the trusted USB console for enrollment. No secure element, secure boot, flash encryption, or remote firmware attestation is established. A valid receipt authenticates this key's execution claim. It does not authenticate camera origin, mounting, or physical truth.

## BLE driver

[The optical driver](../device/optical.py) accepts private environment variables:

- `PROOFREADY_OPTICAL_REQUEST`: JSON with `{challenge,contact:{provider}}`.
- `FIELDPROOF_BLE_ADDRESS`: the independently pinned board address.
- `FIELDPROOF_DEVICE_SECRET`: the exact provisioned secret.
- `PROOFREADY_OPTICAL_AUTHORIZED=true`: explicit authorization for one emission.

The challenge contains `work_order_digest`, `session_id`, `request_id`, `nonce`, `bits`, `half_symbol_ms`, `requested_at`, and `expires_at`. The last two fields use Unix seconds. The driver validates all bindings before discovery and again after connection. It reads the current boot identity before computing the HMAC.

Without hardware, validate an already prepared private request:

```sh
python3 application/device/optical.py --prepare
```

For separately authorized physical execution, install `application/device/requirements.txt` in a private virtual environment. Invoke the same script without `--prepare`. It emits exactly one JSON receipt on success. It returns nonzero on failure. The coordinator must verify its P-256 signature against the enrolled key.

The driver sends one request sequence. A disconnect or uncertain write never starts another sequence. It polls the original receipt and verifies page commitments. An absent receipt requires inspection of the original operation. No automatic retry or GPIO fallback exists.

[Provenance](PROVENANCE.json) records the vendored parser, reused local reference revision, SDK revision, and source hashes. The root [engineering reference](../../docs/ENGINEERING.md) defines coordinator integration.
