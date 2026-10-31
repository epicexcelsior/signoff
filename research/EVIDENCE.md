# Proof of Ready and FieldProof evidence

Checked October 31, 2026 (CET). The original paid Cardano REVIEW reached confirmed seller collection. Two paid NVD calls settled. Five deployed source cases passed and the valid transaction finalized REJECTED. The original inspection input is synthetic. No complete camera-observed physical commissioning test ran through this port. The owner-approved optical-only flash completed successfully. USB startup exposed its valid receipt public key. One later diagnostic optical challenge returned a verified signature and the owner observed blinking. A later Seeker diagnostic recording matched all 72 optical symbols. Continuous tracked commissioning capture remains incomplete.

[README](../README.md) owns execution order. [Engineering](../docs/ENGINEERING.md) owns implemented interfaces and procedures. [The plan](../PROOF_OF_READY_IMPLEMENTATION_PLAN.md) owns goals. This document owns dated findings, check results, hardware state, and evidence gaps.

## Current local implementation evidence

The local commissioning path now connects work orders, signed contact/optical/photo records, tracked camera samples, useful inspector input/result binding, pinned contract reads, and portable evidence packets. Actual physical acceptance remains incomplete. Genuine paid inspection and historical deployed-policy evidence are recorded separately below. Current demonstrations return REVIEW or REWORK.

The current station is deterministic and operator-driven. Its work-order route instantiates a fixed template from an asset name. Agent-generated requirements and autonomous orchestration remain goals. The optional model helper is not called by the current worker. The local receiving monitor shares coordinator trust.

| Check                              | Observed result                                                                | Scope and limit                                                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application and Chrome             | 71 tests passed                                                                | Device/phone signature fixtures, raw optical reconstruction, lifecycle, concurrent claims, restart, external-reader contracts and responsive overview, standalone offline export, and exact Markdown/ZIP preservation. No physical acceptance |
| Masumi                             | 32 tests passed                                                                | Exact-text bindings, current CLI compatibility, Task naming/recovery, seller-receipt and refund fixtures. These local fixtures do not prove paid settlement. Live seller collection is verified separately                                    |
| API3 Node                          | 35 tests passed                                                                | Exact signed bytes, bounded CVE policy, unsigned calls and pinned commitment reader. Includes durable paid access and deployed-judge preparation                                                                                              |
| x402 inspector                     | Five tests passed                                                              | Loopback paid-inspection HTTP boundary, original-request binding, concurrent payment claims, and restart recovery. These fixtures do not prove live settlement.                                                                               |
| Foundry                            | 29 tests passed, including two 256-case fuzz checks                            | Local operator, freshness, policy, replay, terminal-state and oracle rejection behavior                                                                                                                                                       |
| Anvil                              | One actual local deployment/read test passed                                   | Local chain with disposable keys and source fixtures. This local Anvil check is separate from the later Base Sepolia deployment                                                                                                               |
| ESP32 firmware host                | Six grouped C checks passed under ASan/UBSan                                   | Parser, HMAC wire vectors, replay restoration/capacity, chunks, ownership, timeout, waveform accounting and failure cleanup                                                                                                                   |
| Python device drivers              | 37 tests passed                                                                | Legacy and paged contacts, small-MTU chunks, original request/receipt binding, Node/Python signature interoperability, authorization and uncertain-write fences                                                                               |
| Seeker host                        | Six tests passed, including 256 Java signature conversions                     | Actual Java-to-Node signature interoperability, URL limits and USB plan. No phone installation or native runtime claim                                                                                                                        |
| Firmware builds                    | ESP-IDF 6.1 default-disabled and compiler-coverage ESP32-C6 builds passed      | Build checks alone establish no physical timing or NVS behavior. The separately approved flash/startup is recorded below                                                                                                                      |
| Android build                      | API 36 debug APK built and apksigner verification passed                       | Android SQLite instrumentation compiles but remains unexecuted. No emulator, USB forwarding, camera or BLE operation                                                                                                                          |
| Integrated inspector demonstration | Four useful reports delivered, original requests reused, packet edits rejected | Actual local coordinator/inspector bridge with fixture Tasks. Correct REVIEW, three defect REWORK results, sellerPaid false. Repeated after restoring the documented npm command                                                              |

Reproduce from `application/`:

```sh
npm run format:check
npm run check
npm test
npm run test:integrations
npm --prefix mobile test
npm --prefix mobile run build
npm run demo:integration
npm run overview:check
npm run submission:check
FIELDPROOF_FOUNDRY_BIN=/path/to/foundry/bin npm run test:contract
```

Run each isolated package's formatting/syntax checks after installation. Run Foundry `fmt --check` and `test` from `application/contracts/`. Bare `forge` on this host names an unrelated tool. Node 24.10.0, Foundry 1.8.7 and Solidity 0.8.37 were used. Production audits reported zero vulnerabilities for the base, Masumi and API3 packages.

From the repository root, run `python3 application/firmware/test/run.py --sanitize` and `python3 -m unittest discover -s application/device/test -v`. [Firmware provenance](../application/firmware/PROVENANCE.json) pins ESP-IDF, its NimBLE fork, compiler and cJSON. The ESP-IDF fork is not automatically an Apache NimBLE 1.9.0 reference build. [The Seeker guide](../application/mobile/README.md) defines its offline toolchain and unexecuted runtime checks.

A read-only USB chip query identified **ESP32-C6FH4 revision 0.2, 4 MB embedded flash, 40 MHz crystal**. The query loaded the standard RAM stub and reset the board back to its existing firmware. It wrote no flash. The later photo-based layout review and approved optical-only flash are recorded under Available hardware. Runtime enrollment and physical behavior remain unverified. Unique device identifiers stay outside source.

OpenCV.js 4.13.0 detected genuine generated markers and the printable target. Its SHA-256 remains `63366510248adf3a7eddf3e793dd825404efb7df3749f4d6f8557c7fa4ca8aa0`. The optical browser test detected and measured 391 synthetic canvas frames through the actual Worker. Accelerated callbacks represent an 18-second waveform. They do not establish real-time throughput, webcam accuracy or actual emitter execution. [OpenCV provenance](../application/public/vendor/opencv-4.13.0/provenance.json) records its source and license.

A Node-to-Python protocol test reproduced and corrected a receipt-tag mismatch. A separate 483-byte signed contact fixture reproduced a paging mismatch in the retained reader. The shared transport now supports negotiated chunks and hash-verified pages while preserving legacy raw writes. Firmware, Python and Node now use the exact `protocol` field. The shared schema lists every receipt field.

External reconciliation now checks the original prepared inspection, exact delivered result, pinned service configuration, confirmed withdrawal, positive seller net, original source-response digest and contract commitments. Missing readers return REVIEW. A superseded refresh cannot overwrite a newer result. READY loses current authorization after 30 seconds or restart. Offline packets never revalidate external state. Successful trusted-reader tests use disposable fixtures, not genuine settlement.

[Masumi provenance](../application/integrations/masumi/PROVENANCE.json) and [API3 provenance](../application/api3/provenance.json) retain their exact upstream sources and limitations. MPS terms remain trusted without independent COSE verification. Contract Cardano records remain operator assertions rather than consensus verification. The bounded software policy covers CVE-2025-62235 only. Compiled artifacts do not prove installation or general software security.

Remaining evidence: carrier-board/wiring review, mounted function, measured camera accuracy and throughput, actual signed optical execution, remote owner delivery, authorized phone install/native checks, paid inspection tied to physical input, live refund recovery, and installed-build provenance. No fixture proves sponsor qualification.

## Live access and private setup

The previous session supplied two credentials: a Sokosumi account API key and a Blockfrost Cardano Preprod project key. It supplied no separate API3 API key. Both are saved in `$HOME/.config/proof-ready/credentials.env`, outside source. The directory mode is `0700`. Credential and wallet files use `0600`. No credential value or personal account field belongs in this document.

| Check                   | Observed result                                                                             | Meaning and remaining gap                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Sokosumi account        | Authenticated `GET /v1/users/me` returned HTTP 200 at 16:07 UTC, October 30                 | Supplied key works against Preprod. Identity response contains no credit balance                       |
| Pinned Sokosumi CLI     | `auth whoami --json` succeeded with the private env loaded                                  | Account access only. Worker subprocesses strip this key and need separate account/vault setup          |
| Personal Workspace      | Current `/v1/users/me/workspaces` returned the existing Personal Workspace                  | Personal grant and credits verified. Older CLI 1.0.4 used a removed endpoint. See the correction below |
| Blockfrost Preprod      | Authenticated `GET /api/v0/blocks/latest` returned HTTP 200, height 5,353,775, at 16:07 UTC | Supplied project key works. No wallet, seller, escrow, or settlement follows                           |
| API3 wallet             | Funded with 0.0019 ETH. Mint supplied 0.02 aUSD. Both 0.01 aUSD NVD requests settled        | Both NVD calls settled. The 0.02 aUSD ceiling is consumed. Keep 0.001 ETH reserve                      |
| API3 client integration | Bounded paid access and deployed judge tooling integrated                                   | Both paid CVEs settled. Five deployed cases and mined REJECTED decision bind the actual paid REVIEW    |

Private `access-check.json`, `api3/wallet.json`, and `api3/balance-check.json` preserve timestamps and public check metadata. Private `api3/api3.env` retains a default false payment grant. Approved commands explicitly enable the grant in their process. The durable ledger pins a 20,000-atomic-unit total budget. Both 10,000-unit requests settled. No paid-access budget remains.

Historical discovery, superseded by the Personal correction below: read-only resource discovery at 16:17 UTC returned zero organizations and zero Vendor memberships. `/v1/coworkers/me` returned HTTP 403. At that time, the organization/Vendor/Coworker setup was absent. A 20:36 UTC recheck still found zero organization and Vendor memberships. These reads created no resources. They do not establish Personal Workspace credit balance.

A fresh free `searchCpes` request returned HTTP 200 at **16:15:12 UTC, October 30, 2026**. The main package's native verifier authenticated the original response against the pinned NVD signer and request hash. It rejected edited data, another request, and another expected key. No payment header was sent. Private `api3/live-check/` preserves discovery, request, exact response text, and result metadata. This check establishes live free-response authenticity only. It does not establish paid CVE retrieval, freshness at later use, contract deployment, or sponsor qualification.

[Base's official funding page](https://docs.base.org/get-started/get-funds#testnet-base-sepolia) lists Base Sepolia ETH faucets. [API3's official faucet](https://api3dao.github.io/airnodehub-hackathon/faucet/) requires ETH for mint gas and supports `mintFromFaucet(uint256)` without a browser wallet. Its served source names token `0xbeA34973e5f67F18F656A2C6070C64326C791808`. The subsequent approved mint confirmed. See the live transaction record below.

[The Masumi dispenser](https://dispenser.masumi.network/) requests a registration-email verification code and a receiver address. It supplies test ADA and USDM and offers separate five-ADA collateral. [Cardano's faucet](https://docs.cardano.org/cardano-testnets/tools/faucet) supplies test ADA. Dedicated seller and buyer wallets exist privately. The seller received test ADA and its registration confirmed. Normal paid Sokosumi Tasks use Personal credits and Core's managed buyer. The local buyer needs no funding for that route.

The complete local workflow and live account/chain reads do not establish a live end-to-end paid or physical installation. The original escrow and positive seller receipt are confirmed. Reviewed hardware and actual physical input remain necessary. Personal Workspace access and worker execution are now verified.

## Available hardware

Owner-confirmed inventory updated October 31, 2026. Flash, USB startup, and a camera-observed optical diagnostic are verified below. Full commissioning and contact behavior remain unverified.

| Resource             | Confirmed state                                                                                                                                                            | Selected role or next evidence                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ESP32 kit            | USB-only C6FH4, 4 MB. Front/back photos show Super Mini ESP32-C6. Layout matches the documented seller schematic. Optical-only image flashed and USB startup/key validated | GPIO8 onboard WS2812, contact disabled. Await camera and one signed optical test. Later GPIO2 button needs terminal/wiring review |
| LEDs and buttons     | Available in the starter kit. Exact part types are unknown                                                                                                                 | Onboard RGB needs no external LED/resistor. Identify button terminals before GPIO2-to-GND wiring. External LED is optional only   |
| Distance sensor      | Available. Model, supply and signal voltage are unknown                                                                                                                    | Later range-based function test after part identification and electrical review                                                   |
| Potentiometer        | Available. Resistance and pinout are unknown                                                                                                                               | Later measured analog-input adapter. No current acceptance claim                                                                  |
| Speakers             | Available. Driver, impedance and power requirements are unknown                                                                                                            | Optional later feedback. No current actuator or audio test                                                                        |
| Raspberry Pi Zero W  | Available. Power, storage, OS and network readiness are unknown                                                                                                            | Candidate separate owner receiving monitor. No deployment or device operation is authorized or verified                           |
| Laptop webcam        | Webcam returned an operator-facing frame. Connected Seeker rear-camera preview supplied the optical diagnostic                                                                           | Marker guidance and optical sampling. Physical accuracy and throughput remain unverified                                          |
| Solana Mobile Seeker | Owner prefers Seeker as likely camera. Not connected or installed yet. Existing Station WebView camera path needs device validation                                        | Built companion and setup guide are ready. Native instrumentation, camera, BLE, and lifecycle checks remain pending               |

Use the onboard LED for the first optical-only sequence, then add the reviewed button for a complete physical sequence. Preserve the rest of the inventory for explicit follow-up capabilities. Device ownership does not authorize flashing, GPIO changes, payments, public deployment, or new chain integration.

### Matched carrier and approved flash

Three private owner photos show both sides of a board marked “Super Mini / ESP32-C6.” Its maker and revision remain unmarked. Component positions, auxiliary pads and header labels match the [Hobby Components seller schematic](https://hobbycomponents.com/images/forum/HCDVBD/HCDVBD0051/HCDVBD0051_Schematic.png). Hidden routing on this particular board remains an inference from that match. The source SHA-256 is `91294a5e509d76d300d348b41cfc76c51fd3a0f4e42848b6522ac26fd9ac7c68`.

The schematic connects WS2812 DIN to GPIO8, BOOT to GPIO9, the ordinary LED to GPIO15, and native USB to GPIO12/13. It leaves GPIO2 available for the later button. With the component side toward you and USB at the top, GPIO2 is fifth from USB on the TX/RX/0/1 header. GND is second from USB on the power header. Read the printed labels before wiring. Keep B+/B− disconnected. [Espressif boot guidance](https://docs.espressif.com/projects/esptool/en/latest/esp32c6/advanced-topics/boot-mode-selection.html) requires GPIO8 high when GPIO9 is low for downloader entry.

The owner approved one full flash backup/reset, then separately approved the exact optical-only flash and first boot. The complete 4,194,304-byte private backup has SHA-256 `dd52ab54edcd2c4b9601f557e9865f43b32f86c1d0eb577fd4ae282cd96ddc0e`. Its original NVS and PHY data layouts passed checksum verification. The proposed partition table matches the original bytes. The offline review returned `BACKUP_LAYOUT_MATCHES_NO_DATA_WRITE`.

The approved build uses GPIO8 WS2812 at brightness 16, contact disabled, DIO/4MB/80MHz, and native USB Serial/JTAG console. Esptool verified all three image hashes after writing bootloader at 0x0, partition table at 0x8000 and application at 0x10000. [The sanitized flash proof](../application/submission/evidence/esp32-optical-flash-proof.json) records the actual artifact hashes, lengths, preserved ranges and startup scope. The application SHA-256 is `460b4b78b09d357b285a35096ddd48e3e62885a510a37f5f5aecdc0764ddbf1a`.

USB startup exposed a valid P-256 public key and BLE advertising logs. No initialization failure appeared. The key-generation log did not appear. This supports reuse of the persistent identity, but no independent pre-flash public-key comparison exists. The SEC1 public-key SHA-256 is `ec7398fb1fddd81a9ac4b70d5ad6fde87d3e7cd344709510ddc013c9b511d134`. The private USB pin, raw logs, provisioning secret and backup remain outside source. Startup sent only the approved OFF pixel. No 18-second challenge, signed physical test, external wire, erasure or restore ran.

The owner then authorized one diagnostic blink test and confirmed visible onboard RGB blinking. BLE advertised the expected provider, optical capability, provisioned authorization, and 64 remaining claims before execution. One original request returned 72 symbols over 18 seconds. The Node verifier checked its signature against the USB-enrolled public key and its original nonce, timing, and request bindings. This diagnostic uses a generated test binding, not an approved installation work order. No camera waveform or commissioning acceptance follows. The private original request, receipt, and observation remain in the hardware operation journal. One admitted optical request consumes one persistent claim. Remaining capacity requires a fresh manifest read before unattended execution. Bluetooth was software-blocked. Unblocking it restored the laptop adapter.

A later October 31 preflight used the connected Seeker rear-camera preview. The production OpenCV worker detected reference ID 0 and device ID 10 after the camera focus overlay moved away from the reference. One fresh diagnostic challenge returned a verified P-256 receipt for 72 symbols over 18 seconds. Offline analysis of the original phone screen recording matched all 72 symbols. This diagnostic searched video timing and sampled the LED region. It did not establish continuous marker tracking, calibrated placement, an approved work-order binding, or a commissioning packet. The post-test BLE manifest reported 62 remaining claims. Original video, challenge, receipt, and diagnostic results remain in the private hardware journal. The laptop webcam also returned a frame, but its view faced the operator rather than the target. The Seeker charged over authorized USB at 4 percent. Its companion app was absent. The station responded on loopback in simulation mode. Physical-station configuration and continuous phone capture remain overnight integration work.

An optical-only endurance run can follow a genuine camera-observed baseline and a bounded grant. A full unattended attempt still needs three alternating physical button states. No authorized actuator exists. Each complete attempt consumes four persistent claims. Each optical-only cycle consumes one. Negative or uncertain operations can also consume capacity. The runner must stop on failure, disconnect, restart or missing reply. It must never reset the 64-claim store or retry an uncertain operation.

## Product research context

Research supports a bounded acceptance workflow. It does not validate broad autonomous outsourcing, commercial demand, or a mandatory two-chain product. These commercial hypotheses do not block authorized engineering.

### Existing alternatives

| Primary source                                                                                                   | Established capability                                                                       | Product consequence                                               |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [CxAlloy documentation](https://support.cxalloy.com/article/419-welcome)                                         | Collaborative commissioning, asset records, installation tracking, checklists, and tests     | Cross-company commissioning alone is insufficient differentiation |
| [Facility Grid AI questionnaires](https://facilitygrid.com/kb/tests/generate-questionnaires-with-ai/)            | Generates commissioning forms from instructions, equipment context, and manuals, with review | AI-generated acceptance criteria are already an existing feature  |
| [Siemens commissioning documentation](https://sid.siemens.com/api/khub/documents/oBkSnjzHLaHU8eoyqVBabw/content) | Live wiring and function tests for supported equipment                                       | A sensor transition alone does not establish a novel category     |
| [Buildots installation/payment review](https://pages.buildots.com/completed-quantities-webinar)                  | Site imagery and installed quantities support payment applications                           | Visual evidence before payment has direct commercial prior art    |
| [Dynamics 365 inspections](https://learn.microsoft.com/en-us/dynamics365/field-service/inspections-overview)     | Asset-bound pass/fail forms, attachments, offline operation, versions, and dispatcher review | A normal SaaS workflow remains a strong alternative               |

Vendor documentation establishes available features, not comparative effectiveness or demand for this proposal. The proposed distinction is portable, independently reproducible evaluation of a fresh physical function test under an explicit evidence policy. No evidence establishes that this combination is first-ever or defensible against incumbents.

The recommended buyer hypothesis is an integrator accepting subcontracted, non-safety monitoring retrofits across unattended sites. No interviews, willingness-to-pay evidence, measured revisit reduction, or commercial pricing validation exists. Per-report fees and enterprise integration remain business hypotheses.

### Physical evidence limits

Read-only firmware inspection found an input-to-ground contact circuit that cannot distinguish an open contact from a broken wire. Five samples span approximately 40 milliseconds. The receipt key uses persistent software-backed NVS storage. No secure element or enabled remote firmware attestation was established.

The retained observation lab maps open contact to DISPATCH. That demonstration policy cannot establish physical safety or installation acceptance. The commissioning workflow now tests both signed states and local receiving delivery. Real mounting, remote owner delivery, and optical binding remain unverified.

[RFC 9334 freshness semantics](https://www.rfc-editor.org/rfc/rfc9334.html#section-10.4) distinguish generating fresh signed evidence from when its underlying claims were collected. A nonce alone does not prove that an untrusted program measured its values afterward. [Espressif Secure Boot](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c6/security/secure-boot-v2.html) checks authorized boot code. It does not establish an implemented remote measured-attestation flow for this board.

An owner-controlled witness can support mounting and observed motion. A contractor-controlled camera does not establish independent physical truth. [OpenCV ArUco](https://docs.opencv.org/4.13.0/d5/dae/tutorial_aruco_detection.html) supplies marker geometry under calibration and dimension assumptions. It does not authenticate the marker, camera, asset, or physical location.

The user confirms a full starter kit and Solana Mobile Seeker. USB identifies an ESP32-C6FH4 chip. Carrier-board model and kit parts remain unknown. Laptop webcam comes first. Mounted wiring, installed firmware, native phone behavior and physical end-to-end function remain unverified.

### API3/NVD experiment

The [NVD Airnode listing](https://airnodehub.api3.org/explore/nvd) identifies an API3-operated wrapper over NVD. Its signature is from the configured Airnode, not NIST. The current [machine-readable schema](https://airnode-nvd.fly.dev/) exposes free `searchCpes` and `listSources` operations. CVE lookup and match operations are priced at 0.01 aUSD.

A genuine free NimBLE CPE response signed at **2026-10-30 11:37:09 UTC** passed the unmodified official native verifier at revision `52933ae1fb9371446a927338473466c3d320e19a`. Its pinned signer is `0x41dd84D5B6503D9aA3c374a49F546e335423a1b8`. Its request hash is `0xcb527c8b970e9d8bc2db6d2432e280011142b21f7749619c83956a41215f1276`.

The [request](fixtures/nvd-cpe-request.json) and [original signed response](fixtures/nvd-cpe-signed-response.json) are saved as public research fixtures. The response identifies a product entry. It does not provide vulnerability severity or establish installed software.

With the official starter's dependencies installed at the pinned revision, run this from the project root:

```sh
node research/verify-nvd-fixture.mjs PATH_TO_PINNED_API3_STARTER
```

Replace `PATH_TO_PINNED_API3_STARTER` with the checkout path. The script rejects a changed verifier source. It checks signature and request binding, then checks rejection of edited data and another expected request. It uses no wallet or network. It deliberately makes no freshness, Solidity, product acceptance, or sponsor-qualification claim.

Earlier CVE requests returned HTTP 402 without payment. The [saved candidate request](fixtures/nvd-cve-candidate-request.json) for CVE-2025-62235 also returned 402. Its request hash is `0xf28aed06e9cbf7d70e5bedbfd4c36c54c12e3f36e04914a276c864cc08a7dd06`. No signed CVE projection came from those earlier unpaid probes. The later genuine paid projection is recorded below. One early free CPE call returned upstream HTTP 503. Later requests succeeded. Availability remains an operational dependency.

The [Apache vulnerability table](https://mynewt.apache.org/cve/) identifies NimBLE through 1.8.0 as affected by CVE-2025-62235 and 1.9.0 as fixed. The [direct NVD record](https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2025-62235) supplied a secondary CISA CVSS 3.1 score of 8.1 and an affected range ending before 1.9.0. This direct response is not API3 attestation evidence. No evidence establishes that the available board contains the affected code or configuration.

That historical candidate request selects one applicability branch and one metric. The implemented request now projects complete configurations and CVSS arrays, source-generation time, and metadata. It is not proof of complete applicability semantics. Missing KEV fields cannot be projected as signed false values. Product policy must validate the complete relevant context or return REVIEW.

The [attestation specification](https://airnodehub-docs.api3.org/airnode/attestation) binds the operation, parameters, projection, signing time, and exact response bytes. Job, contract, and chain binding require separate consumer state and authorization. The starter does not itself enforce product freshness or terminal-job semantics. Source signatures are portable across chains. NVD response generation, CVE publication, and CVE modification are different timestamps.

Native verification and local contract policy now pass. A genuine signed CVE response and policy deployment now exist. Genuine paid inspection and deployed rejection evidence now exist. Physical completion still requires credible installed-build provenance. The 1.9.0 reference outcome covers this CVE only and does not establish general security.

## Cardano and Masumi

The [official Cardano developer portal](https://developers.cardano.org/x402/) documents direct address payments, Masumi escrow, and arbitrary script locks. It explicitly promotes Masumi for escrow, identity, and discovery. It states that x402 ends at the lock. Subsequent result delivery, refund, and dispute operations belong to Masumi.

The [Cardano exact-scheme specification](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_cardano.md) defines facilitator-submitted signed transactions. The client signs without broadcasting. A Masumi settlement establishes escrow lock, not seller payout. Direct address settlement supplies no automatic refund.

The [Masumi x402 documentation](https://www.masumi.network/dev/masumi/core-concepts/x402) distinguishes cheap direct calls from escrow-backed jobs. The [payment lifecycle](https://www.masumi.network/dev/masumi/core-concepts/payments) distinguishes FundsLocked, ResultSubmitted, Completed, RefundRequested, RefundAuthorized, and Disputed. The [refund documentation](https://www.masumi.network/dev/masumi/core-concepts/refunds-and-disputes) requires a buyer refund request before unlock and a subsequent resolution process. The isolated Coworker adapter now implements and fixture-tests the subsequent lifecycle. The direct x402 adapter remains separate. Live operations remain unverified.

### Reproduced availability

`npm run check:masumi` queried the [hosted Preprod facilitator's supported methods](https://x402.preprod.dev.ecosyseng.cf-deployments.org/supported) without a wallet or payment. Its response advertised:

- x402 version 2, exact scheme, `cardano:preprod`.
- Transfer methods `default`, `masumi`, and `script`.
- Unsponsored fees and confirmation bounds from 0 through 20.

The installed SDK derived this canonical Preprod Masumi escrow address:

```text
addr_test1wzs4e6wc95hkwezlccjw9mdvq0r0rsgx6zk34avptga3ftgn37w4g
```

This check establishes advertised support and SDK address derivation. It does not establish a successful lock, result submission, collection, refund, registry entry, or sponsor qualification.

The installed `@x402/cardano` 2.29.0 declarations expose `issueMasumiRequirements`, `toMasumiSellerSigner`, input commitments, and seller-signed terms. An omitted or empty agent identifier represents an unregistered seller. A mandatory registry cannot be inferred for this SDK quote path.

Source constants require minimum intervals of 5 minutes from pay-by to submit-result, 15 minutes from submit-result to unlock, and 15 minutes from unlock to dispute deadline. Submit-result also needs at least 15 minutes of lead. These are policy constraints, not observed settlement or refund durations.

### Dependencies and security

The initial scaffold used x402 2.26.0. Its dependency tree included Zod 3.25.76. The [reviewed Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) identifies uncontrolled memory consumption and specifies 4.6.6 as patched.

The application now pins `@x402/core` and `@x402/cardano` to 2.29.0. That core release declares Zod `^4.6.6`. The lockfile records the installed artifacts. The install audit reported zero vulnerabilities after this change. Run `npm audit --omit=dev --audit-level=high` to reproduce the current registry check. An audit result does not establish comprehensive security.

Earlier payment findings came from the [official Cardano starter at revision 56c6c95](https://github.com/cardano-foundation/developer-portal/tree/56c6c959044e0fd9e6082d02fbc5b1af1e3f2e65/examples/templates/x402-express). That starter used 2.26.0. Its archived audits are historical source evidence, not proof that every behavior remains unchanged in 2.29.0.

## FieldProof protocol and local checks

Read-only inspection used sibling FieldProof revision `3094135718e7aa88fcc33c9df3c7cbd9b723c3e7`. The relevant sources are `host/capmesh/protocol/auth.py`, `host/capmesh/protocol/models.py`, and `host/capmesh/transport/ble.py`. They establish the observation wire message, HMAC request authorization, P-256 receipt verification, Bluetooth characteristic identifiers, and configured-device flow.

The port implements that wire message and a separate bounded reader. The sibling project remains unchanged by this implementation. Its existing recorded board evidence does not establish current hardware compatibility with this port. The current reader does not reproduce two-observer policy or independent physical truth.

The local tests exercise:

- Open and closed decisions, exact wire serialization, edited data, stale data, another request, another key, future timestamps, malformed fields, and unstable samples.
- Unpaid rejection, one immutable intent, one transaction per local job, concurrent callers, failed verification, failed observations, unresolved settlement, and restart recovery.
- Confirmation depth, recipient, and amount through mocked chain responses. No test fixture proves a live transaction.
- Local capability, Host, Origin, body-size, and content-type enforcement.
- Desktop and phone browser interactions, keyboard activation, tamper rejection, cached expiry during stalled requests, and retained history.
- Actual server process death and restart, persistent identity and evidence, rotated session capability, and no repeated observation.

The original baseline passed 21 tests before extension. The integrated counts and reproduction commands appear above. The new local station runs in simulation with spending disabled. Original and new browser layouts received visual inspection.

Verification commands and implementation limits live in [README](../README.md) and [engineering](../docs/ENGINEERING.md). No fixture or upstream example proves the finished product's sponsor qualification.

## Track requirements and excluded directions

The [current Cardano prize criteria](https://hackathon.tum-blockchain.com/prizes#cardano), rechecked October 30, require one genuine paid Cardano Preprod job or request. Useful deterministic services qualify without an LLM. The [Masumi setup guide](https://www.masumi.network/tum-hackathon) labels payment optional for its execution-only setup milestone. That milestone does not replace the organizer track requirement. The original useful paid REVIEW and confirmed positive seller collection now supply genuine transaction evidence. Its input remains synthetic.

The initial Sokosumi CLI query lacked credentials. The supplied account key now passes identity and explicit-env CLI checks. [Live access](#live-access-and-private-setup) records the unresolved Workspace result. The live unpaid NVD getCve probe returned HTTP 402 with Base Sepolia chain 84532, 10,000 atomic aUSD units at six decimals, and a 300-second timeout. The EIP-712 domain is AirnodeHub USD, version 1. That unpaid probe signed no authorization. The later approved payment is recorded below. The [API3 guide](https://api3dao.github.io/airnodehub-hackathon/) requires Base Sepolia aUSD for priced access and ETH for minting. Qualification includes a deployed verifier, valid-response success, and all four rejection cases. Public repository release remains separately gated.

API3 is not entered through an irrelevant price feed. Its supplied checklist requires a deployed verifier and valid, edited, stale, other-request, and wrong-key authenticated-data cases. The local device rejection tests do not satisfy that API3 requirement. Custom AirnodeHub onboarding remains unverified.

Buyer, reality-compiler, and learning-machine research no longer defines the implementation. Prior-art findings remain historical research. No peaq, Solana, Colosseum discovery, additional rail, or registry integration is necessary for the current direct-paid observation path.

Original workbook SHA-256: `ffd736a58e6803e30fe818c538448c7e3e05b1253f5f3eaadb43eecb3963fd19`. Preserve the workbook, supplied handoff, archive, and sibling project. Private source backup and local demonstration preparation are authorized. Public release, submission, payments, and externally consequential actions remain gated.

## Submission baseline and live transactions

The current organizer source remains revision `f61c409acb3242facaac6fdf9a25a91adc34bb52`. Its [submission rules](https://hackathon.tum-blockchain.com/prizes#how-to-submit) require Devfolio, a public repository with setup README, and a video no longer than 2.5 minutes. The deadline is October 31, 2026 at 15:00 CET. Cardano requires a genuine paid Preprod job/request and transaction hash. API3 requires a deployed meaningful policy, valid-response state change, and all four rejection cases.

The requested Masumi skill was downloaded, read, and installed locally. SHA-256: `9bdc7d32ed20edfb975164f560e74dfa6dd4dcc883b8db6cf98a5d8300d058fe`. The official API3 starter still matches revision `52933ae1fb9371446a927338473466c3d320e19a`. No verifier replacement was required.

| Actual action                       | Verified result                                                                                                                                                                                                       | Scope                                                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Base Sepolia funding                | Wallet received 0.0019 ETH                                                                                                                                                                                            | Testnet gas only                                                                                                                           |
| Approved aUSD mint                  | [0x28c410b46dd8952c2c5e76b658d929963f6840afe22239fb0109486fb36854b7](https://sepolia.basescan.org/tx/0x28c410b46dd8952c2c5e76b658d929963f6840afe22239fb0109486fb36854b7), block 52354681, 20,000 atomic aUSD credited | Funding, not NVD qualification                                                                                                             |
| First genuine paid NVD CVE response | [0x3181a67600791341a237df0b1131fe0da7ddae30b5206cdfb2c9ff821b16945f](https://sepolia.basescan.org/tx/0x3181a67600791341a237df0b1131fe0da7ddae30b5206cdfb2c9ff821b16945f),0.01 aUSD, state SETTLED                     | Exact original request/source verified at ingestion. Chain reconciliation matched payer, token, recipient, amount, and authorization nonce |
| CommissioningPolicy deployment      | [0x44eec5fc19615ad7d0060d1ec71dc47242a58e8e7fc297e5060bf0481ae16d3b](https://sepolia.basescan.org/tx/0x44eec5fc19615ad7d0060d1ec71dc47242a58e8e7fc297e5060bf0481ae16d3b), block 52355879                              | Actual Base Sepolia deployment. Constructor settings read back and matched                                                                 |

The deployed contract is `0x98023c425670a9690ab362c00fbea1bc11dce2cb`. Its runtime-code Keccak-256 is `0x4bb4ff98ff0dadd2bd529eb0330e84d8d0dcc8ad38ca51d2ede63b5b7d702366`. It pins the existing NVD signer/request and 300-second attestation/source limits. The historical paid REVIEW now binds five deployed source cases and a mined REJECTED decision. See the settled-evidence section below.

[The original paid response](../application/submission/evidence/nvd-paid-first-original.json) has SHA-256 `54ffd855925dc58cce9fb4f37680f0f4a5f8b740f60fe8f3175c3b1250324f4b`. Its bytes remain unchanged. It is preserved for authenticity and stale rejection. It is not indefinitely fresh. [Deployment metadata](../application/submission/evidence/deployment.json) contains public verification details only. [The manifest](../application/submission/evidence-manifest.json) separates confirmed live artifacts from missing physical and submission evidence.

The isolated local MPS backend built with Node 24.22.1, pnpm 10.30.2, and OpenSSL. Prisma generated and 169 migrations applied to a dedicated Unix-socket-only PostgreSQL 18 database. The later funded run started this isolated service and imported only the original Preprod wallets. Its database now contains the original seller registration and one paid inspection. Existing account keys now pass explicitly to CLI subprocesses while unrelated credentials remain stripped.

Dedicated Cardano buyer/seller wallets exist privately. Initial unfunded reads returned 404. The later reads confirmed funding, seller registration, paid escrow and hosted result delivery. Seller collection later confirmed. Upstream MPS starts chain jobs independently of adapter grants. Default withdrawal flags require review before startup with funded credentials.

Fresh ESP32-C6 disabled and compiler-coverage builds pass. Disabled app SHA-256: `38fdd20b33d57c912b71f87ef6969f672d97ebc1a2d223bef9f94f055fbbedd9`. Discrete coverage app SHA-256: `db74d7fc853affe8f6c385204a88a2b99ab5668b7ff7787ce8de3adfcfac9fa8`. WS2812 coverage app SHA-256: `a578b899e00132c24a9d20f5be8d7ff2a3b163e35e998d191c01d7b068f5bf70`. Generated settings are DIO, 2 MB, 80 MHz. These are compiler settings, not a reviewed carrier recommendation. No flash, backup/read-flash, GPIO, serial/BLE connection, or physical test ran. A complete attempt consumes four of 64 persistent claims, at most 16 full attempts from empty storage.

The owner now authorizes routine funded testnet actions while preserving at least 0.001 ETH. Public release/submission remain separately authorized. Carrier-board/component identification remains necessary before safe wiring or flashing.

## Earlier account and camera checks

The organization findings below are historical. The later Personal Workspace correction supersedes them for the selected route.

TUM organization membership now exists. The private Vendor and Inspector Coworker were created once through the supported CLI. Durable claims preceded each remote write. Coworker ID: `01a18ea5-25c9-7785-940c-20c977bfff2d`. Access request `01a18ea5-2622-774a-8e22-02c5a8801dd5` remains PENDING. The pinned CLI reports `taskSeatEligible:false`. A TUM Workspace admin must approve access and enable Task eligibility. Credits remain unverified.

One Coworker-scoped runtime key entered the supported OS vault after a readiness probe. Read-back authentication returned the original Coworker ID. It expires November 2, 2026 at 00:00 UTC. No key appears in tracked source or output. Private resource-journal and worker configuration retain original IDs. At this earlier checkpoint, no hosted Task or payment ran. The later execution-only Task does not establish payment.

A private execution-only request is ready from an original sealed local rehearsal. Its source remains explicitly `fixture`. The immutable bridge reconstructed the original input successfully. This preparation establishes no hosted execution, paid Cardano result, or physical test. Do not present it as those outcomes.

Latest OS enumeration found no `/sys/class/video4linux` devices and no `/dev/video*` nodes. USB lists the Espressif JTAG/serial unit. No camera capture, serial connection, reset, flash, or GPIO action ran during this enumeration. The owner must check camera availability and identify the carrier board and components.

[The deployed policy helper check](../application/submission/evidence/deployed-policy-helper.json) used the actual deployment block and unchanged genuine paid NVD data. Native authentication passed. The deployed `evaluate` helper returned FAIL for declared 1.8.0 and PASS for 1.9.0. This was a historical `eth_call` with no state override. The helper itself does not authenticate signatures. It changes no state and completes none of the five mandatory deployed judge cases.

Current role verification returned TUM Workspace role `member`, platform role `user`, and Task Seat `assigned:false`. These credentials cannot approve the pending organization access request. The owner needs a TUM Workspace administrator. No unauthorized approval request or role change ran.

The owner plans to connect the Seeker overnight. This is a future availability statement. No phone connection, installation, forwarding, instrumentation, camera, or BLE operation follows from it. Keep existing worktrees for continuation.

The camera worktree's remaining LED sampling guide is integrated. It projects the approved marker-relative optical region and keeps its label outside marker bounds. Generated-marker browser checks verify rendering and suppression for missing/wrong markers, out-of-frame regions, and omitted options. This is browser/canvas evidence, not a physical camera or LED test.

## Personal Workspace correction

The owner's Personal credits and the shared TUM authorization are separate. The current official API `GET /v1/users/me/workspaces` returned the existing Personal Workspace. Published Sokosumi CLI 1.1.0 uses that endpoint. Pinned CLI 1.0.4 used the removed `/v1/users/me/workspace-access` endpoint and returned 404. This was a client/API mismatch, not proof that Personal access was absent.

The original Coworker connected once to the verified Personal Workspace and returned GRANTED. The original OS-vault runtime key still authenticated. Personal credits were verified through `GET /v1/users/me/credits`; the exact balance remains in private local records. No pooled TUM administrator grant is required for Personal Tasks.

Current Core source charges paid Task purchases against the Task owner's Personal credits and uses Core's managed buyer. The separate local buyer wallet is not a prerequisite for the normal Sokosumi paid-Task route. Seller test ADA, registration and actual positive receipt remain necessary. Execution-only events without payment/credit fields do not enter that paid purchase branch.

Public website/repository/skill snapshots and their resource index are saved under ignored `.local/hackathon-resources/`. `.local/README.md` maps all local-only references, generated exports, preserved inputs, and links to original secure runtime locations. No local cache files are staged or committed.

One actual hosted Task, `01a18ec9-f3a1-73fc-8cc1-53c6413222d3`, completed REVIEW. Its completion event is `01a18ec9-fdf3-7599-b452-65017cde49c0`. A 21:50 UTC read independently matched original input/result hashes and both evidence commitments. Task credits and balance delta were zero. `fixtureInput:true`, `paid:false`, `sellerPaid:false`, and `physicalEvidence:false` remain explicit. Private original Task/events and binding records preserve the result. The raw JSON email contains the request, not a physical acceptance certificate.

The application pins CLI 1.1.0 and opts out of Core's automatic brand/briefing/memory context. Exact Task descriptions and result hashes remain required. Lost-start recovery recognizes Core's RUNNING status. New execution-only Task names identify rehearsal and no payment. Saved names preserve recovery, including older claims. Root integration passed 30 Masumi tests, syntax checks, formatting, and a production dependency audit with zero findings.

## Funded inspection and presentation verification

At 22:51 UTC, October 30, independent Blockfrost reads found 105 test ADA and 100 test USDM in each original dedicated wallet. No replacement wallet was created. The isolated official MPS imported only the original Preprod wallets. Auto-withdrawal and auto-refund started disabled.

Seller registration confirmed in block 5,354,856 with two confirmations. Transaction: `125819c7d184382c18c0d4acfae697dae7cc77a72c12411d434f4d1ee76f7b74`. Its fee was 276,826 lovelace. Registration is not the qualifying paid inspection transaction. The original paid Task is `01a18f06-3ca7-707b-b8d6-0db33451e754`. Its input is a synthetic commissioning capture. A useful paid REVIEW cannot establish physical acceptance. Original private records remain outside source.

The judge checker now requires the intended custom error for each negative case. All five simulations use one pinned block and detect a changed block hash. Historical replay preserves the original open job and freshness window. Mined finalization verification binds original calldata, source commitments, transaction and terminal state. Local checks passed 27 API3 Node tests, 29 Foundry tests and a real local Anvil deployment. None establishes deployed qualification.

The station exposes the reviewed manifest and explicit original-artifact downloads. SHA-256 hashes cover exact served bytes. No runtime-directory route exists. Desktop and 390-pixel browser checks verified missing evidence labels, five-case visibility, edited-packet rejection and reset without deleting attempts. The complete application suite passed 62 tests.

A private exact-secret scan checked 12 saved credential/wallet values against 217 tracked paths and 313 reachable Git blobs. It found no matches. This check does not discover unknown secrets or keys held only in an OS vault. Production npm audits reported zero vulnerabilities. The four-scenario integration demonstration still uses fixtures, moves no funds and returns REVIEW or REWORK.

At 23:00:50 UTC, the hosted paid Task was COMPLETED. Original input and result text matched their exact saved hashes. The Task charged 100 Personal credits. [The original REVIEW report](../application/submission/evidence/cardano-paid-report-original.json) has SHA-256 `25879a51e15c483be65468e50e3a68bb38ded3bda07007affcc1315868a83aea`. Its source capture is synthetic. Its original no-funds limitation describes that capture, not the paid inspection purchase. [Original binding metadata](../application/submission/evidence/cardano-paid-hosted-bindings.json) preserves the distinction.

The original escrow lock `f868a2406be729ffbbc57796f56f5ae61d82920bb3ac333aa5f67cef5fb6dfcd` confirmed in block 5,354,867. The result submission `405a406634d221ea635aff5e85b58928cf44fd181fde3048829b8d42108f6465` confirmed in block 5,354,869. These transactions establish paid delivery, not positive seller collection. Normal collection starts at 23:41:16 UTC under the original terms plus service slack. No duplicate payment or fallback request ran.

A clean local source export at `627a641` passed `npm ci`, formatting, syntax, all 61 application tests, overview verification and submission boundaries after an isolated Git index was supplied. The overview/test workflow requires a Git checkout. The first archive-only pretest failed because Git metadata was absent. No credentials were copied into that release rehearsal.

Three current ESP-IDF builds passed: disabled, discrete compiler coverage and WS2812 compiler coverage. Both coverage profiles use synthetic pins and must never be flashed. Six C sanitizer groups and 31 Python device tests passed after integration. The offline backup checker rejects data-partition changes, invalid write maps and overlapping erase sectors. No backup, serial open, reset, flash, GPIO operation or real camera test ran.

The independent public-source Cardano verifier passed at 23:06:37 UTC. It reconstructed the original hosted input, decoded the original V2 escrow and result datums through pinned `@x402/cardano` 2.29.0, and matched the report's exact bytes. Lock/result blocks had 20/18 confirmations. It explicitly returned `sellerReceiptVerified:false`. The isolated x402 inspector fallback passed five service/HTTP tests. It reuses the existing signer/payment ledger and remains unused. The original Masumi purchase later settled.

The current full application check passed 62 tests after adding edited-report refusal and recovery. The local Anvil check passed with `FIELDPROOF_FOUNDRY_BIN=/tmp/tbc-foundry-1.8.7 npm run test:contract`. A first invocation without that documented environment variable failed its toolchain precondition. No contract failure occurred.

A 20.28-second private video records the actual interface opening the historical paid report. Its visible source label states synthetic capture and real Preprod inspection purchase. The full report shows the missing optical evidence. `ffprobe` confirmed the duration, and the final screenshot received visual review. The old scope file states seller collection pending and no physical or deployed-five-case claim. That recording predates the later settlement and deployed checks. The recording remains under ignored `.local/release-checks/`. It is a partial recovery asset, not the full submission video.

Read-only camera diagnosis found `uvcvideo` and `videodev` loaded, an empty video-device class, no `/dev/video*`, and no webcam in USB enumeration. Framework keyboard/numpad devices identify the laptop family. This evidence points to a privacy-switch or connection issue before browser permissions. [Framework's official Laptop 16 manual](https://downloads.frame.work/manuals/Laptop16_Online%20user%20manual_English_251119%20.pdf) identifies the upper-bezel camera privacy switch as switch 2. The owner must enable the camera or attach a webcam. No camera hardware control changed.

## Settled inspection and deployed policy rejection

The original purchase reached `SELLER_PAID` at **23:44:21 UTC, October 30**. Fresh reads at **23:54:56 UTC** matched the completed Core Task, exact input/result text, settled Core receipt, confirmed MPS withdrawal, and Blockfrost token outputs.

[The seller withdrawal](https://preprod.cardanoscan.io/transaction/344fd5f6fd40f469ff72e0feac7b58ae9f9a100f472a29429e1082ae42aaa202) confirmed in block **5,354,974**. The read observed 29 confirmations, a 674,507-lovelace fee, and a positive seller net of **1,000,000 atomic test USDM**. Its inputs consume output 0 of the original result transaction. [The reviewed receipt artifact](../application/submission/evidence/cardano-seller-receipt.json) binds the original Task, report, escrow identifier, work order and evidence bundle. Private raw responses remain outside source. No duplicate purchase, fallback payment or original-operation replacement ran.

The second paid NVD request settled through [transaction 0x1774cd765ea09588d9731c02034f104c59f664949f59c17dc9444e2a47018396](https://sepolia.basescan.org/tx/0x1774cd765ea09588d9731c02034f104c59f664949f59c17dc9444e2a47018396). [Its exact original response](../application/submission/evidence/nvd-paid-final-original.json) supplied fresh finalization data. [Independent reconciliation](../application/submission/evidence/api3-final-access-settlement.json) matched the transfer and original authorization nonce. Both original access operations are SETTLED. The **0.02 aUSD ceiling is consumed**. A later balance read found 0 aUSD and **0.001872164895767491 ETH**, above the 0.001 ETH reserve. Another paid request requires a separately authorized budget.

[All five deployed source checks](../application/submission/evidence/api3-five-deployed-cases.json) passed at Base Sepolia block **52,413,566**, timestamp **23:56:22 UTC**. The valid case succeeded. Edited, other-request and wrong-key cases returned `NotSignedByAirnode`. The stale case returned `InvalidOracle`. The first paid response supplied the stale case. A fresh genuine [free CPE response](../application/submission/evidence/api3-other-request-original.json) supplied the other-request case. The [wrong-key signature](../application/submission/evidence/api3-wrong-key-deliberate-test.json) used a disposable test key and remains explicitly labeled deliberate negative-test input.

[The valid finalization](https://sepolia.basescan.org/tx/0xa94e48a5d72065ad46c4c558d26a7c3f618aa491fe46e6d012fd7aa7b1356eab) mined in block **52,413,614** and changed OPEN to **REJECTED**. [The mined proof](../application/submission/evidence/api3-finalization-proof.json) binds exact calldata, the original judge block, runtime code, all commitments and the terminal acceptance hash. Historical replay repeated the five checks and verified the mined proof without another payment or transaction.

The audit reproduced a judge-helper defect: a contract-encoded integer version reached the native evaluator, which requires a three-part string. The native helper returned REVIEW for the supported 1.9.0 reference. The correction decodes that version before evaluation. The focused test failed before the correction and passed afterward. Corrected historical replay returns native source-policy PASS. The mined REJECTED decision remains unchanged because the paid REVIEW has `inspectionPassed:false`. Original private reports remain preserved.

The declared Apache NimBLE 1.9.0 reference has no compiled or installed-device provenance. The separate historical policy-evaluation deadline does not renew the original work order. [The public evaluation context](../application/submission/evidence/api3-policy-evaluation.json) records those limits and all preparation transactions. The paid report evaluates synthetic input. These real payments and deployed checks establish no complete physical installation or current READY authorization.

From `application/api3/`, run `npm run judge:submission` to replay the public originals and verify the mined rejection. The command needs an RPC with historical reads. It reads no wallet or private credential and sends no transaction. Physical button/LED/camera evidence, the complete video, and authorized public release/submission remain unfinished.

The continuation reran the base formatter, syntax checks, complete application/Chrome suite, API3 formatter/syntax suite, API3 Node suite, and local Anvil integration. All passed. The application and API3 counts appear in the current check table above. The credential-free deployed replay also passed. Desktop and 390-pixel screenshots received visual review. The latest exact-value scan found no matches for eight saved secret values across 251 candidate source files. That scan excludes unknown secrets and OS-vault-only values. The current OS camera-device inventory remains empty. No firmware, GPIO, phone, public-release or submission action ran.

October 31 continuation: `npm run check`, `npm test` (63 passing), and `npm run demo:integration` passed. The integration command produced REVIEW for correct fixtures and REWORK for placement, contact, and delivery defects. It made no payments or hardware calls. The new original-receipt replay checks the actual P-256 signature at its historical verification time and rejects modified bits and nonce. The station started on loopback in simulation mode. A desktop Chrome screenshot confirmed the diagnostic record and download appear in Judge evidence. No additional device claims were consumed.

October 31 Seeker browser integration: USB localhost forwarding reached the existing station in simulation mode. Chrome opened the real rear camera at 1280×720 and reported 30 fps. Automatic selection used camera 6 and cropped the markers. Explicit camera 2 selection showed IDs 0 and 10 through the production detector. A real camera measurement saved through the station API after a short wait. Immediate capture rejected because the phone clock preceded the station clock by about one second. No LED challenge, button test, payment, or physical acceptance occurred. The camera stopped after capture. The optical guide region did not overlap the actual board LED, so emission remained inappropriate. Correct specimen geometry or an explicitly approved work order is still required.

After the camera selector change, `npm run check`, `npm test` (64 passing), `npm run format:check`, and `npm run overview:check` passed. The new camera test checks exact lens constraints and stream release. Existing browser workflow and camera lifecycle tests also passed.

October 31 submission recheck: isolated Masumi (32), API3 (35), and x402 inspector (5) tests passed. The local Anvil test passed with `FIELDPROOF_FOUNDRY_BIN=/tmp/tbc-foundry-1.8.7 npm run test:contract`. An initial invocation without that required variable failed its toolchain precondition. `npm --prefix application/api3 run judge:submission` replayed all five genuine deployed cases at original block 52413566 and checked the saved mined REJECTED proof. This read-only historical replay establishes neither current freshness nor source-dependent physical acceptance. A private 22-second diagnostic backup clip was generated from the original phone recording with an explicit scope caption. A decoded frame was visually checked. Original and derived hashes remain adjacent to the private clip.

October 31 camera timing repair: a focused browser test reproduced Save camera measurement remaining enabled when the camera clock was one second before the session start. The interface now disables capture until the raw camera clock enters the session window and explains persistent clock mismatch. No timestamp is rewritten and no backend freshness bound changed. The focused test passed after the change, including successful capture after the clock returns to the window.

The timing repair passed `npm run check`, `npm test` (64 passing), `npm run format:check`, and `npm run overview:check`. No hardware operation or payment ran.

October 31 presentation recording: the new `npm run demo:record` path ran an isolated simulation station and recorded the actual Chrome interface. It exercised REVIEW, packet verification, edited-packet refusal, REWORK, refresh recovery, and the saved original sponsor evidence. A private 96.7-second composite appends the real optical diagnostic with explicit scope captions. It contains no audio and proves no additional hardware operation or physical acceptance. Original segments, source hashes, derived hash, and FFmpeg argument array remain adjacent to the private output. Decoded interface and optical frames received visual inspection. Syntax, formatting, and overview checks passed. The artifact-boundary check passed for all 259 tracked paths after staging the recorder.

October 31 original-video tracking replay: the production OpenCV Worker detected IDs 0 and 10 in all 90 frames sampled at 5 Hz across the original 18-second optical sequence. FFmpeg selected source offset 10.49 seconds and applied `fps=5,crop=1200:1440:0:380,transpose=1,scale=640:-2`. The replay retained original video hash, transform, per-frame detections, and current-template evaluation in the private diagnostic backup directory. All 90 frames failed the current placement policy. The first frame estimated x=62.07 mm, y=3.75 mm, angle=-179.63 degrees under the declared 60 mm reference. Those estimates are guidance, not calibrated measurements. This confirms a physical setup mismatch that software must not silently approve. It does not establish live continuous tracking or approved commissioning capture.

The limited public-release credential check compared nine selected saved credential values against all 467 Git blobs reachable from local refs. No exact match occurred. The check does not cover unknown secrets, every private file, or arbitrary encodings. Public release remains unapproved.

October 31 recovery hardening: `npm run check`, `npm run format:check`, and `npm test` (67 passing) passed. New real-Chrome tests cover lost inspection response plus refresh without repeat execution, work-order retention after 31 newer empty orders, and cancellation of unresolved camera permission with late-stream cleanup. Camera guidance now gives offset/rotation corrections without changing saved geometry or packet encoding. The actual Seeker browser displayed approximately 37.8 mm offset and 179.0-degree angle difference, then stopped its camera. The local simulation station stopped cleanly with no pending operation and restarted with the new backend. An actual rehearsal returned REVIEW and restored the same attempt after browser reload. These checks made no payment or GPIO operation.

The final recovery revision passed `npm run check`, `npm run format:check`, and `npm test` (68 passing). Additional tests verify that delayed camera enumeration cannot revive stopped controls, and its error cannot overwrite the persistent OUTCOME_UNKNOWN recovery instruction. Work-order changes remain disabled during uncertain writes. Earlier development runs exposed a fixed-delay clock-test race and a mock camera stream that supplied no image. The test now waits for the observable state and paints the mock stream. The final suite reports no failure or skipped test.

October 31 morning preflight: `npm run demo:preflight` passed against the actual local simulation station. It reported four saved attempts with matching work-order bindings, matching original artifact hashes, positive saved seller collection, all five named historical source cases, matching saved contract commitments, and the original signed optical diagnostic. Payment and optical grants were false. Physical acceptance remained NOT_ESTABLISHED_BY_PREFLIGHT. Two new tests use real local HTTP responses to check success, changed artifact rejection, invalid-port rejection, GET-only behavior, and unchanged ledgers. `npm run check`, `npm run format:check`, `npm test` (70 passing), and `npm run overview:check` passed. A separate read-only Android check reported USB charging at 9 percent and an empty active-camera client list.

October 31 optical-dispatch UI guard: the browser now requires a passing saved placement measurement from the same active camera ID and calibration ID before preparing an optical challenge and again before requesting emission. A real-Chrome regression uses fixture hardware boundaries to verify camera restart rejection, stale queued-click rejection without any challenge request, recovery through a new bound measurement, and failed-placement rejection. It made no physical call. `npm run check`, `npm run format:check`, and `npm test` (71 passing) passed. This UI guard prevents operator mistakes. It does not authenticate a camera or replace server verification of the final capture.

October 31 optical reserve guard: the host driver reads a fresh remaining_claims count while holding a board-address lease. It rejects missing, malformed, out-of-range, or four-or-fewer counts before notification setup or request writes. Five claims permit one optical request. An OS file lock serializes cooperating optical clients using the same HOME, including separate processes. It covers discovery, manifest validation, the sole write sequence, and receipt handling. It does not control unrelated tools, users, contact clients, or direct BLE writers. Firmware remains unchanged. All 37 Python driver tests passed, including reserve boundaries and cross-process contention/release. Four Node optical protocol/evaluation tests and `npm run check` passed. Linux locking was exercised. The Windows locking branch was not exercised. No device discovery, GPIO operation, claim consumption, or flash occurred in these fake-client tests.
