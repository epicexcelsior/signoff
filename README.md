# Proof of Ready

Proof of Ready coordinates equipment commissioning. An operator approves a work order. A technician supplies camera measurements and signed contact tests. An inspector explains defects and missing evidence.

The goal is agent-orchestrated commissioning with a useful paid inspector and an evidence-bound acceptance decision. **The current station is deterministic and operator-driven.** It uses a fixed work-order template. Agent-generated requirements and autonomous orchestration remain planned.

**Current demonstrations return REVIEW or REWORK.** READY requires complete physical evidence, a freshly checked seller receipt, an enrolled declared build, and a matching pinned contract decision. No complete physical installation or live paid acceptance exists through this port.

## Submission checkpoint

**The project is not submission-complete.** The local software baseline works. The original paid inspection and deployed source checks are verified. Physical evidence and the complete video remain incomplete.

| Area       | Complete now                                                                                              | Still missing                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Cardano    | Useful paid REVIEW, confirmed escrow/result, withdrawal and positive seller net receipt                   | Physical inspection input and installation acceptance                                           |
| API3       | Two settled NVD responses, five deployed source checks and mined REJECTED decision                        | Installed-build provenance and physical acceptance                                              |
| Hardware   | GPIO8 image and startup verified. Signed diagnostic and 72/72 recorded optical symbols verified                            | Continuous station camera capture, approved work-order binding, and reviewed button wiring/test |
| Submission | Setup README, original live API3 artifacts, evidence manifest, Devfolio draft, 150-second video procedure | Physical evidence, complete video, approved public release, actual Devfolio submission          |

Next: integrate the verified Seeker optical diagnostic into continuous station capture, then review the button circuit and record the complete video. The original paid REVIEW now binds all five deployed source checks and a mined REJECTED decision. Its synthetic input cannot authorize a physical installation. Both approved NVD calls settled. The 0.02 aUSD ceiling is consumed.

The Seeker companion already builds. The Seeker is connected and supplied the recorded optical diagnostic. Native installation, forwarding, camera/BLE tests, and Android instrumentation remain unexecuted. They do not replace the immediate button/LED/camera baseline.

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
| [API3 guide](application/api3/README.md)                     | Paid NVD access, deployment preparation, deployed judge checks, and payment recovery        |
| [AGENTS.md](AGENTS.md)                                       | Repository instructions, permissions, and file ownership                                    |

The private HTML overview embeds all nine current Markdown documents and its styling. It is a generated snapshot, not another source of truth. Original inputs and archived notes remain historical references. Check current code and observable behavior when documents conflict with them.

## Export documentation offline

From `application/`, run `npm run overview`. The command generates three private local artifacts:

| Artifact                                 | Contents                                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `application/public/overview.html`       | Standalone overview, embedded styling, complete text of all nine documents, and original Markdown downloads                       |
| `application/public/overview.md`         | Combined Markdown context for processing or export                                                                                |
| `application/public/overview-export.zip` | HTML, combined Markdown, nine original Markdown files with repository paths, linked local reference files, and a SHA-256 manifest |

Copy `overview.html` alone to read the overview and full document text offline. Select **Export Markdown** for combined context. Expand a full document to download its original Markdown. External services and the running application remain separate. The ZIP preserves referenced local files but does not contain the complete application or archived originals.

Run `npm run overview:check` to verify every generated artifact against current source. Exports contain no private credentials or runtime state. They remain outside Git. Regenerate them after document changes.

## Run the commissioning station

Use a Git checkout, Node.js 24 and npm. Browser tests require installed Google Chrome, or `FIELDPROOF_BROWSER_EXECUTABLE`.

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

| Priority   | Current evidence                                                                             | Next required result                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cardano    | Original paid REVIEW and positive seller net receipt verified                                | Preserve the original paid REVIEW and verified seller receipt. No replacement purchase is needed              |
| API3       | Two genuine paid NVD responses settled. Five deployed cases and mined rejection verified     | Preserve the original five-case block and mined rejection. Do not spend beyond the consumed 0.02 aUSD ceiling |
| Hardware   | GPIO8 image and startup verified. Signed diagnostic and 72/72 recorded optical symbols verified               | Enroll the runtime, approve one camera-observed optical challenge, then review and test the button circuit    |
| Submission | Public-safe setup instructions, evidence manifest, Devfolio draft, and video procedure exist | Fill missing real evidence, record video, then obtain public-release/submission authorization                 |

The API3 paid-access client and deployed judge tooling are integrated. The first paid response supplied the stale case. The second paid response supplied the valid finalization. Historical replay preserves their original freshness window. [The evidence manifest](application/submission/evidence-manifest.json) distinguishes confirmed live artifacts from missing requirements.

Owner-confirmed hardware and wiring state live in [Available hardware](research/EVIDENCE.md#available-hardware). Local engineering continues while external actions remain pending.

## Integration status

| Component               | Verified behavior                                                                                                                                   | Remaining evidence                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Coordinator             | Immutable approval, signed contact/optical/photo records, durable claims, original inspector bindings, pinned contract reads, packet reconstruction | Complete physical installation with its own original external evidence                                     |
| Camera                  | OpenCV marker detection, planar guidance, tracked optical sampling, phase reconstruction, cleanup, printable target                                 | Physical accuracy, real-time throughput, and camera/emitter matching                                       |
| Masumi                  | Useful paid REVIEW, exact transport hashes, hosted execution, confirmed withdrawal and positive seller receipt                                      | Actual physical inspection input and live refund recovery                                                  |
| API3                    | Native verifier, bounded CVE evaluator, durable paid-fetch client, genuine paid CVE response, deployed policy, pinned reader                        | Installed-build provenance and physical installation acceptance. Historical paid REVIEW finalized REJECTED |
| ESP32                   | ESP32-C6 builds, signed protocol, persistent replay claims, reviewed optical-only flash and USB startup                                             | Runtime enrollment, reviewed button wiring, and actual optical/contact/camera tests                        |
| Seeker                  | API 36 debug APK, signed photo claims, request reservation, restricted WebView, read-only BLE preflight                                             | Authorized install, Android SQLite instrumentation, lifecycle, camera, and BLE checks                      |
| Direct Cardano baseline | Retained x402 adapter, payment ledger, and restart checks                                                                                           | Live Preprod settlement and physical-board compatibility                                                   |

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

Use **Judge evidence** to inspect saved original chain records and download their exact-byte hashes. **Reset presentation** clears the screen and stops the camera. It preserves saved attempts, device state and financial records. The manifest records all five deployed source checks and the mined rejection. They describe the historical paid REVIEW, not the selected attempt. After API3 dependency installation, run `npm --prefix api3 run judge:submission` for credential-free historical chain replay.

After isolated dependency installation, run `npm run test:integrations`. [Engineering](docs/ENGINEERING.md#verification-commands) lists package, Foundry, firmware, Python, and Android commands. [Evidence](research/EVIDENCE.md#current-local-implementation-evidence) records observed results and their limits. `submission:check` checks tracked artifact boundaries. It does not publish or establish submission readiness.

## Owner actions on the critical path

1. Connect the webcam or Seeker by data USB when ready. No camera is available yet.
2. Review one 18-second optical challenge after the camera and runtime are ready. The approved backup and flash are complete.
3. Supply a button-terminal photo or continuity result before the later GPIO2-to-GND wiring review.

The supplied front/back photos match the documented SuperMini layout. GPIO8 drives its onboard RGB LED. This path needs no external LED or resistor. Keep the battery pads and external wires disconnected. The board has no visible maker or revision marking. Pin labels take precedence over counting header positions.

For Seeker, enable USB debugging and accept this laptop's authorization prompt when connected. Installation and USB forwarding still need targeted approval. The existing APK and loopback setup are ready. Phone witness photos do not replace the browser's complete optical waveform capture.

The existing inspector has GRANTED access to the Personal Workspace, and its original runtime key remains valid. The installed CLI 1.0.4 used a removed endpoint. Published CLI 1.1.0 uses the current workspace endpoint and resolves the Personal setup. The application pins CLI 1.1.0 and preserves exact Task input through explicit context opt-outs. One hosted execution-only Task completed REVIEW. It consumed zero credits and used synthetic evidence. It proves hosted transport, not payment or physical acceptance.

Normal paid Sokosumi Tasks debit the Task owner's Personal credits and use Core's managed buyer. Do not fund the separate local buyer wallet for this route. Both dedicated wallets received test funds. The seller registration confirmed. The original paid inspection delivered REVIEW and its escrow/result transactions confirmed. Seller collection confirmed with a positive 1,000,000-atomic-unit test USDM net receipt. No further funding or purchase is needed.

The shared TUM access request remains pending. It matters only when choosing organization Tasks. Reuse the existing Coworker and runtime key. Do not register another inspector.

The EVM wallet is funded. An approved mint supplied 0.02 test aUSD. Two 0.01 aUSD NVD requests settled. The 0.02 aUSD ceiling is consumed. [The deployed contract](https://sepolia.basescan.org/address/0x98023c425670a9690ab362c00fbea1bc11dce2cb) has the expected NVD signer, exact request, and 300-second limits. All five deployed source checks passed at one pinned block. The valid finalization mined REJECTED for the original paid REVIEW.

Routine funded testnet transactions are authorized. Keep at least 0.001 ETH in reserve. Stop before a new action threatens that reserve. Public release, Devfolio submission, and electrically unverified hardware actions remain separate.

[Private setup](docs/ENGINEERING.md#private-credentials-and-test-funding) defines credentials, scoped worker resources, and recovery. [Evidence](research/EVIDENCE.md#live-access-and-private-setup) records actual transactions and remaining gaps. The original useful paid Preprod inspection, positive seller receipt, five deployed source checks, and mined rejection are preserved. `npm --prefix application/api3 run judge:candidate -- RESPONSE_FILE` lets judges test their own copied response without credentials. Physical acceptance remains missing. The existing rejection does not demonstrate the CVE value changing the terminal decision, so complete API3 qualification remains unconfirmed.

## Prepare submission

Use [the evidence manifest](application/submission/evidence-manifest.json) and [the Devfolio draft](application/submission/devfolio-draft.json). Both explicitly mark missing evidence. [The submission and video procedure](docs/ENGINEERING.md#submission-and-video-procedure) defines the final review and 150-second recording.

The deadline is **October 31, 2026 at 15:00 CET**. The organizer requires a public repository and a video no longer than 2.5 minutes. Preparation does not authorize publication or submission. Higher-ambition work remains in [the product plan](PROOF_OF_READY_IMPLEMENTATION_PLAN.md#after-the-submission-baseline).

## Camera, hardware, and external acceptance

Use [the camera and physical procedure](docs/ENGINEERING.md#operate-the-camera-and-physical-station) after reading its prerequisites. Print [the marker target](application/public/vision/target.svg) at actual size. Use the reviewed onboard RGB path first. No external LED or resistor is required. Keep external wiring disconnected until its separate review.

[The firmware guide](application/firmware/README.md) defines safe builds and transport. [The Seeker guide](application/mobile/README.md) defines phone preparation. Open `/mobile/` for the local setup page. Neither compiled artifact establishes installed hardware behavior.

Select **Export inspector request** after sealing a capture. **Check external acceptance** reads configured original inspection and contract evidence. **Export unsigned contract calls** prepares calls without signing or broadcasting. [Engineering](docs/ENGINEERING.md#private-acceptance-reader-configuration) defines private reader configuration.

## Verify a packet or use the retained lab

From `application/`, verify an exported packet with an independently trusted approved work-order digest:

```sh
npm run verify:packet -- /path/to/packet.json APPROVED_WORK_ORDER_DIGEST
```

Without that digest, verification establishes internal consistency only. Offline verification turns recorded READY into REVIEW. Current external evidence requires another configured reader check.

The original paid-observation lab remains at <http://127.0.0.1:4021/observation.html>. Its direct Preprod route costs 2 tADA plus fees. Simulation moves no funds. Its DISPATCH result does not establish commissioning acceptance or physical safety. See [the retained workflow](docs/ENGINEERING.md#retained-direct-payment-observation-workflow).

Keep runtime state, keys, wallets, camera images, and receipt pins outside tracked source. The station defaults to laptop loopback. Local implementation and private reviewed backup are authorized. Routine funded testnet transactions follow the approved reserve. Physical wiring/flash operations require resolved electrical review. Public release and submission require separate authorization.
