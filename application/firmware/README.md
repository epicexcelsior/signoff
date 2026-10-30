# ESP32 commissioning reference firmware

This package prepares signed contact reads and challenge-bound optical emission for an ESP32. The default build initializes no GPIO. It advertises no operation until a secret and an explicitly reviewed hardware profile exist.

A read-only USB query identified the connected chip as **ESP32-C6FH4, revision 0.2, with 4 MB embedded flash**. The carrier board, starter-kit model, wiring, and safe pins remain unknown. No firmware from this package was flashed. No GPIO command from this package ran.

## Check without hardware

From the repository root, run:

```sh
python3 application/firmware/test/run.py --sanitize
python3 -m unittest discover -s application/device/test -v
```

The C harness compiles the actual parser, replay storage, request transport, and optical encoder. AddressSanitizer and UndefinedBehaviorSanitizer check those host paths. Four grouped checks cover malformed input, exact wire vectors, time boundaries, replay restoration, capacity, concurrent transport ownership, and emission cleanup. Eight Python tests cover the driver, receipt paging, binding rejection, authorization, and uncertain writes.

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

## Interface and recovery

The reference keeps the existing `capmesh/0.1` `state.observe` message and P-256 observation signature. Its input-to-ground circuit treats low as closed. Five samples span about 40 ms. Open contact and broken wire remain indistinguishable.

Optical requests use `optical.emit`. Parameters contain `work_order_digest`, `session_id`, `bits`, `half_symbol_ms:250`, and `sensor:"optical-led"`. The request also includes the manifest's 16-hex-digit `boot_id`. The HMAC commits:

```text
proof-of-ready-optical-auth-v1|request_id|provider|boot_id|work_order_digest|session_id|bits|250|nonce|timestamp|expiration
```

HMAC-SHA256 uses the exact provisioned secret. The request lifetime is at most 45 seconds. Admission requires at least 19 seconds remaining. The first authenticated request sets a local epoch offset. The firmware has no independent trusted clock. A new optical request must bind the current random boot identity.

The encoder emits an eight-symbol preamble and 32 Manchester bits. Each half-symbol lasts 250 ms. The complete sequence has 72 symbols and lasts 18 seconds. The emitter returns to idle after completion or a driver failure. The receipt follows the shared [optical protocol](../protocol/optical-v1.json). It binds the work order, capture attempt, challenge, timing, and complete symbol count.

The BLE service uses these Bluetooth-base UUID suffixes:

| Characteristic | Operation |
|---|---|
| `cb01` | Read manifest, current boot identity, capability availability, remaining claims |
| `cb02` | Write one request or sequential request chunks |
| `cb03` | Read receipt or page index, subscribe for completion signal |
| `cb04` | Select and read exact receipt pages |

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
