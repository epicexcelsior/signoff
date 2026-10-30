# Proof of Ready

Proof of Ready coordinates equipment commissioning. An operator approves a work order. A technician supplies camera measurements and signed contact tests. An inspector explains defects and missing evidence.

The goal is agent-orchestrated commissioning with a useful paid inspector and an evidence-bound acceptance decision. **The current station is deterministic and operator-driven.** It uses a fixed work-order template. Agent-generated requirements and autonomous orchestration remain planned.

**Current demonstrations return REVIEW or REWORK.** READY requires complete physical evidence, a freshly checked seller receipt, an enrolled declared build, and a matching pinned contract decision. No complete physical installation or live paid acceptance exists through this port.

## Documentation map

Start here, then open the document for your task. Keep each fact in its canonical document.

| Document                                                     | Purpose and source of truth                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| [README](README.md)                                          | Run the project, find context, and select the next action                                   |
| [Implementation plan](PROOF_OF_READY_IMPLEMENTATION_PLAN.md) | Product goals, completion criteria, and owner decisions                                     |
| [Engineering reference](docs/ENGINEERING.md)                 | Implemented architecture, interfaces, configuration, operating procedures, and recovery     |
| [Evidence](research/EVIDENCE.md)                             | Verified checks, dated external findings, hardware inventory, provenance, and evidence gaps |
| [Agent handoff](PROOF_OF_READY_AGENT_HANDOFF.md)             | Resume work with the correct boundaries and reading order                                   |
| [Firmware guide](application/firmware/README.md)             | ESP32 builds, provisioning boundaries, BLE transport, and device recovery                   |
| [Seeker guide](application/mobile/README.md)                 | Android build, phone enrollment, USB preparation, and native test procedures                |
| [AGENTS.md](AGENTS.md)                                       | Repository instructions, permissions, and file ownership                                    |

The private HTML overview embeds all eight current Markdown documents and its styling. It is a generated snapshot, not another source of truth. Original inputs and archived notes remain historical references. Check current code and observable behavior when documents conflict with them.

## Export documentation offline

From `application/`, run `npm run overview`. The command generates three private local artifacts:

| Artifact                                 | Contents                                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `application/public/overview.html`       | Standalone overview, embedded styling, complete text of all eight documents, and original Markdown downloads                       |
| `application/public/overview.md`         | Combined Markdown context for processing or export                                                                                 |
| `application/public/overview-export.zip` | HTML, combined Markdown, eight original Markdown files with repository paths, linked local reference files, and a SHA-256 manifest |

Copy `overview.html` alone to read the overview and full document text offline. Select **Export Markdown** for combined context. Expand a full document to download its original Markdown. External services and the running application remain separate. The ZIP preserves referenced local files but does not contain the complete application or archived originals.

Run `npm run overview:check` to verify every generated artifact against current source. Exports contain no private credentials or runtime state. They remain outside Git. Regenerate them after document changes.

## Run the commissioning station

Use Node.js 24 and npm. Browser tests require installed Google Chrome, or `FIELDPROOF_BROWSER_EXECUTABLE`.

```sh
cd application
npm ci
npm run overview
npm start
```

Open <http://127.0.0.1:4021>. The private overview is at <http://127.0.0.1:4021/overview.html>.

1. Enter the installation reference.
2. Select **Approve work order**.
3. Select a rehearsal condition.
4. Select **Run rehearsal**.
5. Inspect the predicates and installation decision.
6. Select **Verify packet** or **Test an edited packet**.
7. Select **Export evidence packet** to save the original evidence.

A correct rehearsal returns REVIEW because optical and external evidence remain incomplete. Misplacement, a stuck contact, or missing delivery returns REWORK. A corrected attempt preserves the previous record. Rehearsals move no funds and make no hardware calls.

The fixed policy uses markers 0 and 10, a 60 mm reference, and a target 100 mm to the right. Tolerances are 8 mm and 8 degrees. The receiving destination is a local monitor with a five-second deadline. This monitor shares the coordinator's trust boundary.

## Current execution index

| Workstream         | Next action                                                                              | Completion evidence                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Local workflow     | Run the integrated inspector demonstration and inspect exported packets                  | Original request/report binding, useful negative reports, duplicate handling, and edit rejection |
| Physical specimen  | Identify the carrier board, LED, button, and current-limiting resistor                   | Reviewed wiring and GPIO profile before authorized provisioning or flashing                      |
| Camera and optical | Measure webcam throughput, then run the signed optical sequence with authorized hardware | Complete tracked capture and matching original device receipt                                    |
| Seeker             | Prepare one explicit installation and forwarding plan                                    | Authorized install, native SQLite checks, camera lifecycle, and read-only BLE preflight          |
| Masumi             | Resolve Personal Workspace access, then prepare dedicated worker and payment resources   | Useful hosted Task, original paid request, and positive seller receipt                           |
| API3               | Fund the dedicated Base Sepolia test wallet and review the separate paid-access draft    | Genuine paid CVE response, approved deployed policy, and required rejection evidence             |

Main contains the API3 verifier, policy evaluator, unsigned calls, and contract reader. The unfinished paid-access client remains in a separate worktree. Its commands are unavailable in this checkout. Inspect Git state before integration. Preserve inherited uncommitted work.

Owner-confirmed hardware and wiring state live in [Available hardware](research/EVIDENCE.md#available-hardware). Local engineering continues while external actions remain pending.

## Integration status

| Component               | Verified local behavior                                                                                                                             | Remaining evidence                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Coordinator             | Immutable approval, signed contact/optical/photo records, durable claims, original inspector bindings, pinned contract reads, packet reconstruction | Complete physical installation and genuine external evidence                                          |
| Camera                  | OpenCV marker detection, planar guidance, tracked optical sampling, phase reconstruction, cleanup, printable target                                 | Physical accuracy, real-time throughput, and camera/emitter matching                                  |
| Masumi                  | Useful deterministic inspector, exact transport hashes, durable Task/payment recovery, seller-receipt and refund fixtures                           | Worker/account resources, hosted execution, settlement, seller receipt, and refund collection         |
| API3                    | Native verifier, bounded CVE evaluator, commissioning contract, unsigned calls, pinned reader, actual local Anvil deployment                        | Integrated paid-access client, genuine paid CVE response, external deployment, and rejection evidence |
| ESP32                   | Default-disabled and compiler-coverage ESP32-C6 builds, signed protocol, persistent replay claims, bounded BLE transport                            | Carrier board, safe wiring, authorized flash, installed-build enrollment, and physical tests          |
| Seeker                  | API 36 debug APK, signed photo claims, request reservation, restricted WebView, read-only BLE preflight                                             | Authorized install, Android SQLite instrumentation, lifecycle, camera, and BLE checks                 |
| Direct Cardano baseline | Retained x402 adapter, payment ledger, and restart checks                                                                                           | Live Preprod settlement and physical-board compatibility                                              |

Masumi remains separate from direct x402. Its fixtures do not establish seller payment. The API3 policy covers **CVE-2025-62235 only** for explicitly enrolled NimBLE reference builds. It does not establish general security or identify the installed ESP32 build.

## Run the integrated local demonstration

From `application/`, install the isolated Masumi dependencies and run:

```sh
npm --prefix integrations/masumi ci --ignore-scripts
npm run demo:integration
```

The command creates four local attempts and fixture inspector Tasks through the actual coordinator bridge. Correct evidence remains REVIEW. Placement, contact, and delivery defects return REWORK. It checks duplicate requests, delivered reports, packet commitments, and edit rejection. It creates no hosted resource or payment. Ledgers and packets stay outside source.

## Check locally

From `application/`:

```sh
npm run format:check
npm run check
npm test
npm run overview:check
npm run submission:check
npm audit --omit=dev --audit-level=high
```

Tests run serially to isolate browser lifecycle checks. Browser modules require no compilation. No base-application type-check command exists.

After isolated dependency installation, run `npm run test:integrations`. [Engineering](docs/ENGINEERING.md#verification-commands) lists package, Foundry, firmware, Python, and Android commands. [Evidence](research/EVIDENCE.md#current-local-implementation-evidence) records observed results and their limits. `submission:check` checks tracked artifact boundaries. It does not publish or establish submission readiness.

## Owner actions on the critical path

The supplied Sokosumi and Blockfrost Preprod keys are saved outside source in a private env file. Live identity and block checks returned HTTP 200. Personal Workspace access returned HTTP 404 and remains unresolved. Valid account credentials do not establish a configured worker or paid execution.

Read-only discovery found no organization or Vendor memberships. Coworker access returned HTTP 403. Complete account setup before hosted Task testing.

1. Check Personal Workspace access and test credits in [Sokosumi Preprod](https://preprod.sokosumi.com/).
2. Use the TUM invitation in [the official Masumi setup guide](https://www.masumi.network/tum-hackathon).
3. Request Base Sepolia ETH for the dedicated wallet from [a Base-listed faucet](https://docs.base.org/get-started/get-funds#testnet-base-sepolia).
4. Review test aUSD minting through [API3's official faucet](https://api3dao.github.io/airnodehub-hackathon/faucet/).
5. Identify the ESP32 carrier-board marking and current-limiting resistor.

The wallet exists locally. Its last balance check found zero ETH and zero aUSD. Its address and private key remain in private runtime files. API3 uses wallet-based x402 access. No separate API3 API key was supplied in the previous session.

[Private setup](docs/ENGINEERING.md#private-credentials-and-test-funding) explains env loading, faucets, and the separate Cardano funding path. No model key is required for the deterministic inspector.

The [Cardano track](https://hackathon.tum-blockchain.com/prizes#cardano) requires a real paid Preprod job or request. The prepared Masumi route requests one test USDM plus unestimated fees. Its escrow deadlines span approximately 36–52 minutes.

The live unpaid NVD quote charges 0.01 test aUSD per CVE request. Two requests total 0.02 test aUSD, excluding gas. [API3's challenge](https://api3dao.github.io/airnodehub-hackathon/) also requires an externally deployed verifier, valid-response acceptance, four rejection cases, and a public repository. Publication remains a separate owner decision.

## Camera, hardware, and external acceptance

Use [the camera and physical procedure](docs/ENGINEERING.md#operate-the-camera-and-physical-station) after reading its prerequisites. Print [the marker target](application/public/vision/target.svg) at actual size. Keep the board unwired until its carrier and resistor are identified.

[The firmware guide](application/firmware/README.md) defines safe builds and transport. [The Seeker guide](application/mobile/README.md) defines phone preparation. Open `/mobile/` for the local setup page. Neither compiled artifact establishes installed hardware behavior.

Select **Export inspector request** after sealing a capture. **Check external acceptance** reads configured original inspection and contract evidence. **Export unsigned contract calls** prepares calls without signing or broadcasting. [Engineering](docs/ENGINEERING.md#private-acceptance-reader-configuration) defines private reader configuration.

## Verify a packet or use the retained lab

From `application/`, verify an exported packet with an independently trusted approved work-order digest:

```sh
npm run verify:packet -- /path/to/packet.json APPROVED_WORK_ORDER_DIGEST
```

Without that digest, verification establishes internal consistency only. Offline verification turns recorded READY into REVIEW. Current external evidence requires another configured reader check.

The original paid-observation lab remains at <http://127.0.0.1:4021/observation.html>. Its direct Preprod route costs 2 tADA plus fees. Simulation moves no funds. Its DISPATCH result does not establish commissioning acceptance or physical safety. See [the retained workflow](docs/ENGINEERING.md#retained-direct-payment-observation-workflow).

Keep runtime state, keys, wallets, camera images, and receipt pins outside tracked source. The station defaults to laptop loopback. Local implementation and private reviewed backup are authorized. Payments, external resources, flashing, GPIO actions, public deployment, publication, and submission require targeted authorization.
