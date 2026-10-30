# Proof of Ready and FieldProof evidence

Checked October 30, 2026. Local implementation evidence and external availability evidence have separate scopes. No live payment or authenticated physical contact/optical test ran through this port. A USB chip-identity query ran without a flash write.

[README](../README.md) owns execution order. [Engineering](../docs/ENGINEERING.md) owns implemented interfaces and procedures. [The plan](../PROOF_OF_READY_IMPLEMENTATION_PLAN.md) owns goals. This document owns dated findings, check results, hardware state, and evidence gaps.

## Current local implementation evidence

The local commissioning path now connects work orders, signed contact/optical/photo records, tracked camera samples, useful inspector input/result binding, pinned contract reads, and portable evidence packets. Actual physical acceptance and genuine external settlement remain incomplete. Current demonstrations return REVIEW or REWORK.

The current station is deterministic and operator-driven. Its work-order route instantiates a fixed template from an asset name. Agent-generated requirements and autonomous orchestration remain goals. The optional model helper is not called by the current worker. The local receiving monitor shares coordinator trust.

| Check                              | Observed result                                                                | Scope and limit                                                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application and Chrome             | 58 tests passed                                                                | Device/phone signature fixtures, raw optical reconstruction, lifecycle, concurrent claims, restart, external-reader contracts and responsive overview, standalone offline export, and exact Markdown/ZIP preservation. No physical acceptance |
| Masumi                             | 23 tests passed                                                                | Exact-text bindings, Task/payment recovery, seller-receipt and refund fixtures. No hosted execution or settlement                                                                                                                             |
| API3 Node                          | 10 tests passed                                                                | Exact signed bytes, bounded CVE policy, unsigned calls and pinned commitment reader. Unintegrated paid-access draft excluded                                                                                                                  |
| Foundry                            | 29 tests passed, including two 256-case fuzz checks                            | Local operator, freshness, policy, replay, terminal-state and oracle rejection behavior                                                                                                                                                       |
| Anvil                              | One actual local deployment/read test passed                                   | Local chain with disposable keys and source fixtures. No external deployment                                                                                                                                                                  |
| ESP32 firmware host                | Four grouped C checks passed under ASan/UBSan                                  | Parser, HMAC wire vectors, replay restoration/capacity, chunks, ownership, timeout, waveform accounting and failure cleanup                                                                                                                   |
| Python device drivers              | 19 tests passed                                                                | Legacy and paged contacts, small-MTU chunks, original request/receipt binding, Node/Python signature interoperability, authorization and uncertain-write fences                                                                               |
| Seeker host                        | Six tests passed, including 256 Java signature conversions                     | Actual Java-to-Node signature interoperability, URL limits and USB plan. No phone installation or native runtime claim                                                                                                                        |
| Firmware builds                    | ESP-IDF 6.1 default-disabled and compiler-coverage ESP32-C6 builds passed      | No flash, GPIO execution, installed-firmware provenance or physical NVS/timing evidence                                                                                                                                                       |
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

A read-only USB chip query identified **ESP32-C6FH4 revision 0.2, 4 MB embedded flash, 40 MHz crystal**. The query loaded the standard RAM stub and reset the board back to its existing firmware. It wrote no flash. Carrier-board model, kit components, safe GPIO, enrolled device key and installed build remain unverified. Unique device identifiers stay outside source.

OpenCV.js 4.13.0 detected genuine generated markers and the printable target. Its SHA-256 remains `63366510248adf3a7eddf3e793dd825404efb7df3749f4d6f8557c7fa4ca8aa0`. The optical browser test detected and measured 391 synthetic canvas frames through the actual Worker. Accelerated callbacks represent an 18-second waveform. They do not establish real-time throughput, webcam accuracy or actual emitter execution. [OpenCV provenance](../application/public/vendor/opencv-4.13.0/provenance.json) records its source and license.

A Node-to-Python protocol test reproduced and corrected a receipt-tag mismatch. A separate 483-byte signed contact fixture reproduced a paging mismatch in the retained reader. The shared transport now supports negotiated chunks and hash-verified pages while preserving legacy raw writes. Firmware, Python and Node now use the exact `protocol` field. The shared schema lists every receipt field.

External reconciliation now checks the original prepared inspection, exact delivered result, pinned service configuration, confirmed withdrawal, positive seller net, original source-response digest and contract commitments. Missing readers return REVIEW. A superseded refresh cannot overwrite a newer result. READY loses current authorization after 30 seconds or restart. Offline packets never revalidate external state. Successful trusted-reader tests use disposable fixtures, not genuine settlement.

[Masumi provenance](../application/integrations/masumi/PROVENANCE.json) and [API3 provenance](../application/api3/provenance.json) retain their exact upstream sources and limitations. MPS terms remain trusted without independent COSE verification. Contract Cardano records remain operator assertions rather than consensus verification. The bounded software policy covers CVE-2025-62235 only. Compiled artifacts do not prove installation or general software security.

Remaining evidence: carrier-board/wiring review, mounted function, measured camera accuracy and throughput, actual signed optical execution, remote owner delivery, authorized phone install/native checks, hosted Task execution, genuine paid CVE response, actual seller receipt/refund collection, installed-build provenance, and deployed sponsor rejection cases. No fixture proves sponsor qualification.

## Live access and private setup

The previous session supplied two credentials: a Sokosumi account API key and a Blockfrost Cardano Preprod project key. It supplied no separate API3 API key. Both are saved in `$HOME/.config/proof-ready/credentials.env`, outside source. The directory mode is `0700`. Credential and wallet files use `0600`. No credential value or personal account field belongs in this document.

| Check                   | Observed result                                                                                              | Meaning and remaining gap                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Sokosumi account        | Authenticated `GET /v1/users/me` returned HTTP 200 at 16:07 UTC, October 30                                  | Supplied key works against Preprod. Identity response contains no credit balance                                                         |
| Pinned Sokosumi CLI     | `auth whoami --json` succeeded with the private env loaded                                                   | Account access only. Worker subprocesses strip this key and need separate account/vault setup                                            |
| Personal Workspace      | `GET /v1/users/me/workspace-access` returned HTTP 404                                                        | The pinned CLI's access route did not work. Workspace eligibility and credits remain unverified. This does not prove no workspace exists |
| Blockfrost Preprod      | Authenticated `GET /api/v0/blocks/latest` returned HTTP 200, height 5,353,775, at 16:07 UTC                  | Supplied project key works. No wallet, seller, escrow, or settlement follows                                                             |
| API3 wallet             | Dedicated local EVM key/address created. Chain 84532 confirmed. ETH and aUSD balances both zero at 16:07 UTC | Wallet exists outside source. Funding, minting, payment, and deployment remain pending                                                   |
| API3 client integration | Main contains verifier, policy, unsigned-call, and reader modules                                            | Paid-fetch implementation remains an unfinished separate-worktree draft. Draft commands and tests are excluded from main results         |

Private `access-check.json`, `api3/wallet.json`, and `api3/balance-check.json` preserve timestamps and public check metadata. Private `api3/api3.env` keeps `PROOFREADY_API3_PAYMENTS_AUTHORIZED=false`. Its access configuration proposes 20,000 atomic aUSD units for later review. A proposed ceiling is not a spending grant.

Read-only resource discovery at 16:17 UTC returned zero organizations and zero Vendor memberships. `/v1/coworkers/me` returned HTTP 403. The account therefore lacks the verified organization/Vendor/Coworker setup required for the current hosted path. These reads created no resources. They do not establish Personal Workspace credit balance.

A fresh free `searchCpes` request returned HTTP 200 at **16:15:12 UTC, October 30, 2026**. The main package's native verifier authenticated the original response against the pinned NVD signer and request hash. It rejected edited data, another request, and another expected key. No payment header was sent. Private `api3/live-check/` preserves discovery, request, exact response text, and result metadata. This check establishes live free-response authenticity only. It does not establish paid CVE retrieval, freshness at later use, contract deployment, or sponsor qualification.

[Base's official funding page](https://docs.base.org/get-started/get-funds#testnet-base-sepolia) lists Base Sepolia ETH faucets. [API3's official faucet](https://api3dao.github.io/airnodehub-hackathon/faucet/) requires ETH for mint gas and supports `mintFromFaucet(uint256)` without a browser wallet. Its served source names token `0xbeA34973e5f67F18F656A2C6070C64326C791808`. No faucet request or mint ran.

[The Masumi dispenser](https://dispenser.masumi.network/) requests a registration-email verification code and a receiver address. It supplies test ADA and USDM and offers separate five-ADA collateral. [Cardano's faucet](https://docs.cardano.org/cardano-testnets/tools/faucet) supplies test ADA. A dedicated reviewed seller wallet remains absent. Sokosumi credits, ADA, and USDM are separate setup requirements.

The complete local workflow and live account/chain reads do not establish a live end-to-end paid or physical installation. Funding, usable Workspace access, configured worker/payment resources, and reviewed hardware remain necessary.

## Available hardware

Owner-confirmed inventory, October 30, 2026. These are available resources, not tested capabilities.

| Resource             | Confirmed state                                                                                      | Selected role or next evidence                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| ESP32 kit            | Connected by USB only. No external wiring. USB query identifies ESP32-C6FH4 revision 0.2, 4 MB flash | First signed contact and optical test. Carrier-board marking, safe pins, provisioning and flash authorization remain pending |
| LEDs and buttons     | Available in the starter kit. Exact part types are unknown                                           | First button-contact fixture and camera-observed LED challenge. Confirm a current-limiting resistor before wiring            |
| Distance sensor      | Available. Model, supply and signal voltage are unknown                                              | Later range-based function test after part identification and electrical review                                              |
| Potentiometer        | Available. Resistance and pinout are unknown                                                         | Later measured analog-input adapter. No current acceptance claim                                                             |
| Speakers             | Available. Driver, impedance and power requirements are unknown                                      | Optional later feedback. No current actuator or audio test                                                                   |
| Raspberry Pi Zero W  | Available. Power, storage, OS and network readiness are unknown                                      | Candidate separate owner receiving monitor. No deployment or device operation is authorized or verified                      |
| Laptop webcam        | Selected first camera                                                                                | Marker guidance and optical sampling. Physical accuracy and throughput remain unverified                                     |
| Solana Mobile Seeker | Confirmed Android phone                                                                              | Built native companion, photo witness and read-only BLE preflight. Install and real-device checks remain pending             |

Use the button and LED for the first complete physical sequence. Preserve the rest of the inventory for explicit follow-up capabilities. Device ownership does not authorize flashing, GPIO changes, payments, public deployment, or new chain integration.

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

Earlier CVE requests returned HTTP 402 without payment. The [saved candidate request](fixtures/nvd-cve-candidate-request.json) for CVE-2025-62235 also returned 402. Its request hash is `0xf28aed06e9cbf7d70e5bedbfd4c36c54c12e3f36e04914a276c864cc08a7dd06`. No signed CVE projection was obtained. One early free CPE call returned upstream HTTP 503. Later requests succeeded. Availability remains an operational dependency.

The [Apache vulnerability table](https://mynewt.apache.org/cve/) identifies NimBLE through 1.8.0 as affected by CVE-2025-62235 and 1.9.0 as fixed. The [direct NVD record](https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2025-62235) supplied a secondary CISA CVSS 3.1 score of 8.1 and an affected range ending before 1.9.0. This direct response is not API3 attestation evidence. No evidence establishes that the available board contains the affected code or configuration.

That historical candidate request selects one applicability branch and one metric. The implemented request now projects complete configurations and CVSS arrays, source-generation time, and metadata. It is not proof of complete applicability semantics. Missing KEV fields cannot be projected as signed false values. Product policy must validate the complete relevant context or return REVIEW.

The [attestation specification](https://airnodehub-docs.api3.org/airnode/attestation) binds the operation, parameters, projection, signing time, and exact response bytes. Job, contract, and chain binding require separate consumer state and authorization. The starter does not itself enforce product freshness or terminal-job semantics. Source signatures are portable across chains. NVD response generation, CVE publication, and CVE modification are different timestamps.

Native verification and local contract policy now pass. Live enablement still requires credible build provenance, a genuine signed CVE response, deployed policy, and deployed rejection evidence. The 1.9.0 reference outcome covers this CVE only and does not establish general security.

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

The [current Cardano prize criteria](https://hackathon.tum-blockchain.com/prizes#cardano), rechecked October 30, require one genuine paid Cardano Preprod job or request. Useful deterministic services qualify without an LLM. The [Masumi setup guide](https://www.masumi.network/tum-hackathon) labels payment optional for its execution-only setup milestone. That milestone does not replace the organizer track requirement. No qualifying transaction exists for this port yet.

The initial Sokosumi CLI query lacked credentials. The supplied account key now passes identity and explicit-env CLI checks. [Live access](#live-access-and-private-setup) records the unresolved Workspace result. The live unpaid NVD getCve probe returned HTTP 402 with Base Sepolia chain 84532, 10,000 atomic aUSD units at six decimals, and a 300-second timeout. The EIP-712 domain is AirnodeHub USD, version 1. No authorization was signed. Terms and recipient remain subject to review before payment. The [API3 guide](https://api3dao.github.io/airnodehub-hackathon/) requires Base Sepolia aUSD for priced access and ETH for minting. Qualification includes a deployed verifier, valid-response success, and all four rejection cases. Public repository release remains separately gated.

API3 is not entered through an irrelevant price feed. Its supplied checklist requires a deployed verifier and valid, edited, stale, other-request, and wrong-key authenticated-data cases. The local device rejection tests do not satisfy that API3 requirement. Custom AirnodeHub onboarding remains unverified.

Buyer, reality-compiler, and learning-machine research no longer defines the implementation. Prior-art findings remain historical research. No peaq, Solana, Colosseum discovery, additional rail, or registry integration is necessary for the current direct-paid observation path.

Original workbook SHA-256: `ffd736a58e6803e30fe818c538448c7e3e05b1253f5f3eaadb43eecb3963fd19`. Preserve the workbook, supplied handoff, archive, and sibling project. Private source backup and local demonstration preparation are authorized. Public release, submission, payments, and externally consequential actions remain gated.
