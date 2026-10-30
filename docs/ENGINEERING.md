# Proof of Ready engineering

This reference describes implemented behavior, configuration, operation, and recovery. [README](../README.md) is the execution index. [The plan](../PROOF_OF_READY_IMPLEMENTATION_PLAN.md) defines goals. [Evidence](../research/EVIDENCE.md) owns verified results and hardware state.

## Source and documentation boundaries

| Path                                              | Responsibility                                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `application/src/`                                | Coordinator, immutable artifacts, SQLite, acceptance readers, retained observation/payment workflow, and local HTTP boundary |
| `application/public/`                             | Commissioning UI, retained lab, camera Worker/controller, mobile setup page, and generated overview                          |
| `application/protocol/`                           | Shared signed optical wire schema and vectors                                                                                |
| `application/integrations/masumi/`                | Isolated useful inspector, Coworker runtime, payment state machine, and durable Task ledger                                  |
| `application/api3/`                               | Native source verification, bounded NVD policy, unsigned contract calls, and pinned acceptance reader                        |
| `application/contracts/`                          | Solidity policies, pinned dependencies, and local Foundry tests                                                              |
| `application/firmware/` and `application/device/` | ESP32 reference firmware, shared Python BLE transport, and device drivers                                                    |
| `application/mobile/`                             | Native Seeker companion, photo-envelope verification, offline build, and USB preparation                                     |
| `application/scripts/` and `application/test/`    | Local commands and observable application/browser checks                                                                     |
| `research/`                                       | Verified external facts, original public source fixtures, and provenance                                                     |

The current station accepts an asset name and instantiates a fixed work-order template. It has no integrated requirements-planning model or autonomous orchestration loop. The optional Masumi model helper is not called by the current worker. Do not describe planned agent behavior as implemented.

Keep document locations stable. README routes readers. Engineering owns interfaces and procedures. Evidence owns dated verification. The plan owns target behavior and completion gates. The handoff routes continuation. Device guides own their build and device-specific recovery details.

## Runtime and state

The existing Node.js/Express process serves the commissioning station at `/` and the retained observation lab at `/observation.html`. Native browser modules need no compilation. Node.js 24 supplies SQLite. The contact and optical readers share `device/ble_transport.py`. Contact transport negotiates advertised chunks and receipt pages. Legacy manifests retain a single compact raw write and direct receipt. The optional Python readers access one configured Bluetooth contact and an explicitly authorized optical emitter. No equipment actuator exists. Firmware and Android have isolated source/build paths.

`Service` owns the existing observation/payment workflow and `CommissioningService`. Both use the same SQLite connection. `commissioning_orders` stores immutable approved documents and unique intents. `commissioning_sessions` stores capture claims, signed observations, receiving records, sealed evidence, reports, and decisions. WAL, FULL synchronization, immediate transactions, and unique constraints serialize writers.

The ledger pins the original provider, public key, mode, recipient, and payment requirements. A changed configuration requires a separate state directory. The coordinator defaults to `$HOME/.local/state/fieldproof-cardano`. `FIELDPROOF_STATE_DIR` selects another directory. Credentials and private data must remain outside tracked files.

An idempotency key binds one normalized input. Changed input under the same key rejects. Each collection has a 1,000-record limit. The list API returns the latest 30 records. Work orders expire after 24 hours. Capture attempts expire after two minutes. No reset endpoint deletes financial history.

## Commissioning protocol

`src/artifacts.js` defines canonical off-chain encoding: sorted object keys, preserved array order, finite JSON values, and UTF-8. SHA-256 digests use lowercase `0x` plus 64 hexadecimal characters. Undefined values, sparse arrays, nonplain objects, and nesting beyond 32 levels reject. This encoding differs from Masumi transport hashes and the contract's ABI/Keccak acceptance hash.

The work order binds the asset, enrolled contact/key, marker policy, transition count, receiving destination/deadline, required evidence classes, software-enrollment status, source mode, and approval/expiry times. The current template fixes marker IDs 0/10, reference size 60 mm, target `(100,0)` mm, position tolerance 8 mm, and angle tolerance 8 degrees. Optional software enrollment binds an operator-declared compiled artifact and its SHA-256 manifest. It does not establish the firmware installed on the board. Optional phone enrollment fixes the independent Seeker public key before approval. The work order also fixes an optical ROI at `(1.1,0.25)`, size `(0.35,0.35)` in device-marker coordinates.

The coordinator selects an alternating three-state sequence after capture starts. Each read receives an original nonce and a 30-second challenge. Its 16-character signed request identifier derives from the work-order digest, session identifier, and step. A receipt cannot move into another session while retaining valid device/session predicates.

The coordinator saves the read claim before calling the observer. Concurrent calls in one process share the same operation. Another connection or process sees the durable pending claim and cannot repeat it. An interrupted read remains pending. An explicit new attempt creates a different challenge domain. Inspection cannot close a session while a read remains pending.

The configured observer returns the unchanged FieldProof receipt. The coordinator verifies its pinned P-256 key, original challenge, supported fields, five stable samples, timestamps, and age at capture. The local owner monitor then records the matching receipt digest and state. This receiving application shares the coordinator trust boundary. It does not establish delivery to a remote owner system.

Inspection seals the evidence. It reconstructs receipt validity at the saved verification time. Later inspection does not turn an old observation into a current reading. The original ten-second live-dispatch expiry belongs to the retained lab, not historical inspection validity.

The deterministic inspector consumes normalized verified predicates through `integrations/masumi/src/inspector.js`. This entry point has no external package dependency. Missing evidence returns REVIEW. A demonstrated defect returns FAIL. The inspector trusts the coordinator's normalized checks and states that limit in its report.

Acceptance is separate from inspection. FAIL produces REWORK. READY requires a PASS report, physical source, verified original paid inspection, and matching pinned contract decision. Missing evidence or unavailable services produce REVIEW. Client flags cannot supply external outcomes. Current physical and external evidence remains incomplete.

Reconciliation reads existing services only. It checks the original prepared request, exact delivered text/hashes, independent deterministic report, original Task scope/completion event, confirmed withdrawal and positive seller receipt. It then checks chain, contract runtime-code hash, oracle configuration, terminal state, all five digests, severity threshold, job deadline and acceptance hash.

Concurrent refreshes carry durable unique identifiers. A superseded refresh cannot overwrite a newer result. READY is current only for the successful reader instance and 30 seconds. Restart and expiry demote the current view to REVIEW. Packets preserve recorded acceptance and external digests. Offline verification returns REVIEW for recorded READY and `externalRevalidated:false`.

## Commissioning HTTP interface

All routes bind to `127.0.0.1`. Every POST requires JSON and `X-FieldProof-Token` from `GET /api/config`. The high-entropy capability rotates on restart. Host/Origin checks, a 48 KB default request limit, no-store responses, safe text rendering, and disabled proxy trust protect the local boundary.

| Route                                                       | Contract                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET /api/commissioning`                                    | Latest work orders and attempts                                      |
| `POST /api/commissioning/work-orders`                       | `{idempotency_key,asset}` approves one immutable template            |
| `POST /api/commissioning/work-orders/:id/sessions`          | `{idempotency_key,scenario?}` starts or retrieves one attempt        |
| `GET /api/commissioning/sessions/:id`                       | Read the durable capture/report state                                |
| `POST /api/commissioning/sessions/:id/contact`              | `{step:0..2}` claims one signed read                                 |
| `POST /api/commissioning/sessions/:id/vision`               | Save `{frame,frameDigest,source,camera?}` once                       |
| `POST /api/commissioning/sessions/:id/fixture-vision`       | Generate marker corners in simulation only                           |
| `POST /api/commissioning/sessions/:id/optical-challenge`    | Prepare one original 45-second challenge, no hardware call           |
| `POST /api/commissioning/sessions/:id/optical-execution`    | Claim before executing the authorized emitter once                   |
| `POST /api/commissioning/sessions/:id/optical`              | Save `{capture}` raw camera samples once, maximum 1 MB               |
| `POST /api/commissioning/sessions/:id/phone-challenge`      | Prepare one enrolled Seeker challenge, maximum 60 seconds            |
| `POST /api/commissioning/sessions/:id/phone-evidence`       | Save the flat signed photo envelope, retry identical delivery safely |
| `POST /api/commissioning/sessions/:id/inspection-request`   | Prepare the original immutable worker request, no external Task      |
| `POST /api/commissioning/sessions/:id/reconcile-acceptance` | Recheck paid report and contract through private configured readers  |
| `POST /api/commissioning/sessions/:id/contract-plan`        | Reconcile and return unsigned contract calls only                    |
| `POST /api/commissioning/sessions/:id/inspect`              | Seal evidence and evaluate it once                                   |
| `GET /api/commissioning/sessions/:id/packet`                | Download work order, evidence, report, decision, and digests         |
| `POST /api/commissioning/verify`                            | `{packet,expectedWorkOrderDigest?}` reconstructs the packet          |

Supported rehearsal scenarios are `correct`, `misplaced`, `stuck`, and `missing-delivery`. Physical mode rejects synthetic scenario selection and generated camera evidence. The camera upload accepts a bounded measurement, not raw frames. Optical upload and packet verification permit 1 MB bodies. All other routes retain 48 KB. The optical object itself is limited to 1,000,000 JSON characters. No JPEG upload route exists. The server recomputes geometry from corners. It does not trust a browser PASS field.

Packet verification checks internal consistency. An independently obtained work-order digest additionally pins the operator policy and device key. The packet alone does not authenticate the operator or coordinator. The device receipt does not sign camera frames, firmware identity, or physical mounting.

## Camera and optical interfaces

Import `createVisionController` from `/vision/controller.js`. Supply `{video,canvas?,policy,opticalRoi?,onState,onMeasurement}`. The optional `opticalRoi` draws the same marker-relative region used by optical sampling. Missing/wrong markers, unusable geometry, or out-of-frame projection suppress the guide. This overlay does not establish a measured LED response. The controller exposes `start()`, `stop()`, `capture({sessionId})`, and `getState()`. State uses `phase`, including `ACTIVE`, `STOPPED`, `STARTING`, and `ERROR`.

A capture includes explicit browser-camera source, SHA-256 of RGBA pixel bytes, bounded marker corners, capture time, resolution, camera/calibration identities, planar pose, quality, and predicates. Raw camera/device identifiers and frames remain in the browser. Changed camera, crop, resolution, or zoom invalidates the active calibration and releases the stream. The detector permits one outstanding frame and frees native matrices.

OpenCV.js 4.13.0 is pinned under `public/vendor/`. Preserve its exact bytes, license, and provenance. Exclude that folder from Prettier. The parent page keeps self-only scripts. Only `/vision/detector-worker.js` receives this policy:

```text
default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'
```

The upstream build embeds WASM and requires dynamic function creation. The Worker receives pixel buffers and detector commands. It receives no session capability, wallet keys, or network client.

`/vision/target.svg` contains reference marker 0 at 60 mm, device marker 10 at 30 mm, and a 100 mm target offset. Print at actual size and verify the ruler. Planar guidance assumes a measured reference, coplanar markers, and unmodeled lens distortion. Calibrated physical accuracy remains unverified.

`encodeOpticalChallenge({bits,halfSymbolMs})` and `evaluateOpticalChallenge({challenge,samples,startAtMs,captureStartedAtMs,captureEndedAtMs})` live in `public/vision/optical.js`. The evaluator checks ordered tracked brightness samples and complete unambiguous Manchester symbols. It does not authenticate the emitter, camera, or clocks. The integrated controller exposes asynchronous `startOpticalCapture({sessionId,challenge,roi,maxDurationMs,onSample})`. It returns `{ready,getState,finish,cancel}`. Await `ready` before requesting emission. Await `finish()` after the signed execution returns. Stop, permission failure, changed camera geometry, page hiding, dropped frames, processing overrun and tracking loss invalidate the capture.

`alignOpticalChallenge` reconstructs phase and period from the observed preamble and complete transition sequence. The server reevaluates every sample under the approved marker policy. It ignores the browser-proposed verdict. It checks fixed ROI, work-order/session IDs, original random bits, same camera/calibration, complete tracked geometry, sequential frame numbers, monotonic elapsed time, bounded gaps, and receipt interval. Captures contain at most 1,500 samples over 45 seconds.

`src/optical.js` verifies the exact P-256/P1363 execution wire message from `protocol/optical-v1.json`. The original challenge lasts 45 seconds. The waveform has 72 symbols at 250 ms and lasts 18 seconds. Signed timestamps constrain the camera search interval within two seconds. Observed transitions determine phase.

The coordinator persists EXECUTING before dispatch. Concurrent callers share one operation. Another process, restart, or lost reply cannot repeat that emission. Failed execution remains recorded. An interrupted emission blocks sealing. Start an explicit new attempt for another execution. The Python driver uses bounded BLE chunks and exact receipt pages. [Firmware](../application/firmware/README.md) defines transport, NVS claims, provisioning and build commands. Actual GPIO and optical throughput remain unverified.

## Masumi inspection adapter

`application/integrations/masumi/` is an isolated package. Install it with `npm ci --ignore-scripts`. It pins Sokosumi CLI 1.0.4 and Zod 4.6.6. The pure inspector entry point remains usable from the base application without that installation.

`createInspectionService({ledger,runtime,evaluate,loadArtifact,registration,mps,readUtxos,paymentsAuthorized})` exposes create, advance, reconcile, get, recoverTerms, requestRefund, and authorizeRefund operations. Inspect its exported implementation for exact optional adapters. Creation binds inspection ID, work-order/evidence digests, exact input text, and idempotency key. The source loader returns the immutable artifact. The evaluator returns useful PASS, FAIL, or REVIEW predicates.

The SQLite adapter saves external-write claims before dispatch. Unknown Task creation, completion, payment terms, or result submission requires reconciliation against the original identifiers and exact bytes. It cannot silently create another Task or payment. Refund intent follows the same durable-claim rule.

Coworker hashes commit exact UTF-8 task/result text. Standard API hashes retain purchaser-nonce framing. These hashes are separate from canonical artifact digests. Wrong Workspace/Coworker, input/result bindings, seller, token, amount, source, and deadlines prevent advancement.

Execution, lock confirmation, result delivery, Task completion, withdrawal, and positive seller receipt remain separate phases. A useful FAIL is delivered work. An absent report is a service failure. A fixture cannot establish seller payment. Receipt verification requires matching original withdrawal and a positive seller net amount in the exact token.

The configured local Masumi Payment Service is trusted for signed terms. This adapter does not independently verify their COSE signature. Dedicated MPS runtime, PostgreSQL, wallets, registration, vault credentials, and account/resource grants remain external setup. The current MPS source requires a newer Node 24 release than the base application's 24.10.0 host. Keep its runtime isolated.

From `application/integrations/masumi/`, run `npm run setup:plan` for an unexecuted setup plan and `npm run fixture` for a useful negative report. Neither command creates resources or moves funds. The worker requires separately configured authorization before external writes.

## API3 consumer and commissioning contract

`application/api3/` pins viem 2.57.3. Its native verifier preserves exact signed data bytes. The bounded evaluator supports CVE-2025-62235, complete approved NimBLE applicability structure, approved CVSS provenance, timestamp bounds, and explicit unsupported-shape REVIEW. Declared 1.8.0 and 1.9.0 are reference builds. They are not claims about the current board or general software security.

The bounded paid-fetch client is integrated. `application/api3/README.md` defines `npm run access` and `npm run judge`. It preserves original signing/submission claims, source bytes, and transfer/nonce reconciliation. One real paid NVD request settled. The deployed policy matches its signer/request/freshness pins. Five deployed judge cases remain pending genuine paid-inspection commitments. Unsigned judge preparation never substitutes fixture inspection records.

`application/contracts/` contains `CommissioningPolicy` and `NvdPolicy`, with licensed pinned dependencies. The operator enrolls immutable build manifests, opens jobs, and records the inspection and Cardano payment assertion. Permissionless finalization checks the pinned Airnode signer/request, source freshness, job deadline, inspection prerequisite, policy, and terminal-state guard. Accepted, rejected, and REVIEW decisions are terminal. No contract holds or releases funds.

The ABI adapters expose `prepareEnrollBuild`, `prepareOpenJob`, `prepareRecordInspection`, and `prepareFinalize`. They return unsigned calls only. Record inspection once the final seller receipt exists. A false seller-receipt assertion cannot later be overwritten.

`readAcceptance({client,chainId,contract,jobId,expected,...})` checks actual chain, contract code, oracle configuration, terminal state, inspection prerequisites, five digest commitments, and the ABI acceptance hash. Missing RPC, wrong commitments, or failed reads return REVIEW. Supply expected work-order, build-manifest, inspection, payment-evidence, and source-response digests from trusted server state. Runtime-code hash, deadline, policy threshold, and acceptance hash can also be pinned.

The contract's Cardano payment evidence is an operator assertion. It does not verify Cardano consensus. Source signatures are portable across chains. The consumer supplies chain/job/contract binding. The coordinator reader checks these commitments against original server state. Actual paid evidence and pinned live configuration remain pending.

## Physical mode and Seeker

`FIELDPROOF_MODE=physical` requires the enrolled receipt pins, BLE address, and board authorization secret. It does not require seller, Blockfrost, or wallet configuration. The paid observation lab rejects creation in this mode. `preprod` retains the original direct-payment path. Keep separate state directories for different modes and identities.

The connected USB chip is ESP32-C6FH4 revision 0.2 with 4 MB flash. Chip identification does not select safe GPIO, identify the carrier board, or authenticate installed firmware. Both ESP32-C6 compile profiles pass. Default firmware initializes no GPIO. The compiler-coverage profile contains synthetic pins and must never be flashed.

`PROOFREADY_PHONE_PUBLIC_KEY_FILE` selects the private copy of the companion's public JSON export. Its `publicKeySec1Hex` uses uncompressed P-256 SEC1 encoding. New work orders bind that key and require the phone predicate. An existing approved order cannot change its key.

The coordinator durably reserves one phone challenge. It verifies the flat envelope with `mobile/src/phone-evidence.mjs`, pins its original request and key, and saves ingestion time. Identical delivery retries return the original envelope, including after expiry or sealing. Changed envelopes reject. Historical packet checks use the saved ingestion time.

The signed phone claim binds an image digest, not independently inspected JPEG bytes. The phone keeps the JPEG in private storage. Key-security metadata remains a signed application claim, not hardware attestation. Phone evidence supplements planar placement and optical evidence. [The Seeker guide](../application/mobile/README.md) defines build, USB, installation, native instrumentation, and recovery.

## Private acceptance-reader configuration

`PROOFREADY_EXTERNAL_CONFIG` names an absolute private JSON path. The file uses schema `proof-of-ready/external-config/v1`. Each provider is optional. Omitted providers leave the corresponding predicate at REVIEW. Relative credential paths reject. The example below uses explanatory paths and placeholder hashes.

```json
{
  "schema": "proof-of-ready/external-config/v1",
  "masumi": {
    "ledgerFile": "/private/proof-ready/masumi/tasks.sqlite",
    "configurationDigest": "0x plus the initialized ledger configuration SHA-256",
    "coworkerId": "dedicated-coworker",
    "organizationId": null,
    "organizationSlug": null,
    "registrationFile": "/private/proof-ready/registration.json",
    "sellerTokenFile": "/private/proof-ready/mps-seller-token",
    "mpsUrl": "http://127.0.0.1:38127"
  },
  "build": {
    "manifestFile": "/private/proof-ready/build-manifest.json",
    "binaryFile": "/private/proof-ready/enrolled.bin",
    "maxCvssTenths": 70
  },
  "contract": {
    "chainId": 31337,
    "address": "0x plus the pinned 20-byte contract address",
    "runtimeCodeHash": "0x plus the pinned Keccak-256 runtime code hash",
    "rpcUrl": "http://127.0.0.1:8545",
    "responseFile": "/private/proof-ready/original-signed-cve.json"
  }
}
```

Run `node scripts/inspector-pin.js ABSOLUTE_PRIVATE_TASKS_LEDGER` from `application/` to print only the configuration digest. The reader additionally matches runtime, paid mode, and registration identity. It opens the existing ledger read only. It never creates a Task or signs a payment. `BLOCKFROST_API_KEY_PREPROD` supplies the separate chain-output reader.

The manifest uses schema `proof-of-ready/build-manifest/v1`, component `apache-nimble`, a three-part version, lowercase `binarySha256`, and provenance `operator-enrolled`. Startup hashes the actual binary and rejects mismatches. The version is an operator declaration. Do not label the ESP-IDF NimBLE fork as Apache NimBLE 1.9.0 without supporting provenance. No installed-board provenance follows from compilation.

The Masumi worker imports absolute `INSPECTION_BRIDGE_MODULE` pointing to `src/inspection-bridge.js`. `PROOFREADY_LEDGER_FILE` selects the coordinator SQLite file. Otherwise the bridge uses `FIELDPROOF_STATE_DIR/ledger.sqlite`. It loads only a sealed session with an exactly matching prepared request. The worker retains its separate write/payment grants and private ledger.

Unsigned plans derive the contract job ID from the work-order digest and capture ID. The deadline equals the approved order's expiry in Unix seconds. Calls include build enrollment and job creation. Verified paid results add inspection recording and finalization. No signing or broadcast occurs. Inspect the target's existing terminal state before using calls.

## Local overview and demonstration

`npm run overview` generates standalone `/overview.html`, combined `/overview.md`, and `/overview-export.zip` from nine explicitly selected current Markdown documents. `npm run overview:check` verifies all three reproducible artifacts, including ZIP bytes. The ZIP preserves original document paths, linked unignored repository reference files, and a SHA-256 manifest. It excludes archived originals and private runtime files. The page embeds full document text, exact Markdown downloads, styling, printable target, and source hashes. Reading and Markdown export require no server or network. Links to external services and the running station remain optional. All three generated artifacts are ignored by Git. Keep the generator, CSS, and canonical source documents in source control. `npm test` regenerates exports before browser checks. Only the overview route permits its exact embedded style through a SHA-256 CSP hash. The parent script policy remains unchanged. The offline browser check copies only HTML to a temporary directory, disables networking, and checks original Markdown bytes and layout. `/project-docs/:name` serves only explicitly allowed current documents. It cannot expose arbitrary repository files.

`npm run demo:integration` connects the actual coordinator SQLite bridge to four fixture inspector Tasks. It checks original input/report binding, useful defects, duplicate creation, packet reconstruction, and edit rejection. It saves ledgers and packets in a new private user-state directory. It performs no network writes, hardware operations, or payments.

## Private credentials and test funding

Private setup uses `$HOME/.config/proof-ready/`. The directory mode is `0700`. Credential, wallet, and configuration files use `0600`. Do not copy their contents into documentation, logs, Git, or the browser.

| Private file              | Contents and authority                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `credentials.env`         | Supplied `SOKOSUMI_API_KEY`, `BLOCKFROST_API_KEY_PREPROD`, and matching `BLOCKFROST_PROJECT_ID` alias. No payment grant |
| `access-check.json`       | Timestamped read-only credential checks. No keys or personal identity fields                                            |
| `api3/test-wallet-key`    | Dedicated local EVM test private key. Never print it                                                                    |
| `api3/wallet.json`        | Public address, Base Sepolia chain ID 84532, purpose, and private-key file reference                                    |
| `api3/api3.env`           | Private isolated-client paths with `PROOFREADY_API3_PAYMENTS_AUTHORIZED=false`                                          |
| `api3/access-config.json` | Dedicated payer, private ledger path, public RPC, and proposed 20,000-atomic-unit aUSD ceiling                          |
| `api3/balance-check.json` | Timestamped read-only ETH and aUSD balances                                                                             |

The existing access ledger pins a 20,000-atomic-unit total ceiling. One 10,000-unit call settled. The owner authorizes routine funded testnet transactions while preserving a 0.001 ETH reserve. Isolated API3 CLI commands consume their own env variables. The station does not sign these payments. Preserve the original access ledger and its settled first request. Do not replace a key or unresolved ledger to repeat an operation.

The supplied Sokosumi account key passed `GET https://api.preprod.sokosumi.com/v1/users/me`. The Blockfrost key passed the authenticated Preprod `/api/v0/blocks/latest` read. The existing Personal Workspace and usable credits are verified. CLI 1.0.4 used the removed `/v1/users/me/workspace-access` route. The application now pins published CLI 1.1.0, which uses `/v1/users/me/workspaces`.

An explicit private-env account check uses the installed CLI:

```sh
cd application/integrations/masumi
node --env-file="$HOME/.config/proof-ready/credentials.env" \
  node_modules/@masumi_network/sokosumi/dist/bin/sokosumi.js \
  --preprod auth whoami --json
```

This command returns personal account fields. Inspect them locally. Keep them out of shared output. The worker now forwards only an explicitly supplied `SOKOSUMI_API_KEY` to CLI subprocesses. It still strips unrelated keys. Task reads require a separately imported Coworker runtime credential in the supported vault. A successful account check does not configure that worker.

The inspector needs no model key. Dedicated Vendor/Coworker resources, workspace access, vault setup, seller wallet, registration, and scoped MPS keys remain separate prerequisites. Follow [the official setup guide](https://www.masumi.network/tum-hackathon). Routine private account setup and funded testnet transactions now have owner authorization within the task and reserve. Public release remains separate.

### Use the existing Personal Workspace

The original Inspector Coworker has GRANTED Personal access. Reuse its OS-vault runtime key and private worker configuration. Leave organization selectors blank for Personal Tasks. No pooled TUM grant or organization Task Seat is required for this route.

The worker creates Tasks through the pinned CLI's account HTTP client. It disables brand, briefing, and memory context. Core otherwise prepends context and changes the exact inspection input. Task reads and completion still use the separately scoped Coworker credential. Lost-start reconciliation recognizes Core's `RUNNING` status.

New execution-only Tasks have an explicit rehearsal/no-payment name. The ledger saves that name before dispatch. Older uncertain claims retain their original name during recovery. The exact request description remains unchanged for hash verification. Machine JSON in an email is Task input, not a human-readable acceptance report.

One hosted execution-only Task completed with a useful REVIEW and no credit debit. Its input used synthetic physical evidence. See [the dated evidence](../research/EVIDENCE.md#personal-workspace-correction) for its identifier and limits. Do not rerun it to prove paid settlement.

The original shared TUM access request remains PENDING. The current account is an organization member and cannot approve that request. A TUM administrator is required only if the owner chooses organization Tasks. Do not create a duplicate inspector or key to resolve that separate permission.

### Fund the API3 wallet

Read the public address from private `api3/wallet.json`. The wallet received 0.0019 ETH. The approved mint supplied 0.02 aUSD, and the first 0.01 aUSD NVD request settled. Reserve the remaining 0.01 aUSD for fresh finalization evidence. The previous session supplied no separate API3 API key. Priced Airnode access uses x402 with aUSD on Base Sepolia.

1. Open [a Base-listed testnet faucet](https://docs.base.org/get-started/get-funds#testnet-base-sepolia).
2. Select **Base Sepolia**.
3. Enter the dedicated public address.
4. Request test ETH and verify its receipt before minting.
5. Open [API3's aUSD faucet](https://api3dao.github.io/airnodehub-hackathon/faucet/).
6. Select the same wallet and network.
7. Review the mint amount and gas before authorizing the transaction.
8. Verify the aUSD balance before preparing a paid request.

The approved first mint confirmed. The dedicated wallet is a local key file, not an installed browser wallet. Browser minting requires the owner to import that test key locally. The faucet also documents `mintFromFaucet(uint256)` for a separately reviewed CLI transaction. Do not print or upload the key to obtain a mint.

The official faucet's token is `0xbeA34973e5f67F18F656A2C6070C64326C791808`. aUSD uses six decimals. The observed CVE quote requests 10,000 atomic units, or 0.01 aUSD. Two calls total 0.02 aUSD. Minting and contract transactions require ETH. Access-transfer gas is paid by the x402 facilitator. These amounts do not estimate deployment gas.

Cardano escrow collection can outlast API3's five-minute source freshness window. Obtain the final CVE response near policy finalization. An earlier authentic response cannot satisfy a later freshness check.

### Fund Cardano separately

Normal paid Sokosumi Tasks debit Personal credits. Core uses its managed buyer for the escrow purchase. Do not fund our separate local buyer wallet for this route. Both dedicated wallets are funded. Seller registration confirmed. The original paid Task and seller collection remain in progress. A Blockfrost key reads the chain. It does not create or fund a wallet.

The dedicated seller wallet already exists. Use its saved Cardano Preprod address from the private wallet record. Review registration and collateral requirements before requesting seller funds. Preserve the original wallet and registration identifiers.

[The Masumi dispenser](https://dispenser.masumi.network/) supplies test ADA and USDM. Select Testnet, enter the registration-email verification code, and use the dedicated Cardano Preprod receiver. The dispenser offers a separate five-ADA collateral option. [Cardano's faucet](https://docs.cardano.org/cardano-testnets/tools/faucet) supplies test ADA only. Neither faucet establishes a completed paid inspector job.

## Operate the camera and physical station

### Save a laptop-camera measurement

Print [the target](../application/public/vision/target.svg) at actual size. Measure its ruler and marker dimensions first. Keep both markers in the same plane.

1. Approve the work order.
2. Select **Start laptop camera**.
3. Select **Start capture attempt**.
4. Align the markers with the guidance.
5. Select **Save camera measurement**.
6. In rehearsal mode, select **Run rehearsal** to complete the simulated contacts.

Camera frames stay in the browser. The server receives corners, measurements, camera/calibration identities, and a frame digest. It recomputes geometry. Planar guidance does not establish calibrated physical accuracy or authenticated camera origin. Changed camera geometry invalidates capture.

### Run an authorized physical attempt

First identify the carrier board and resistor. Review wiring, GPIO, provisioning, installed-build enrollment, flash, and optical authorization. No pin-to-pin wiring plan exists yet. Keep the current board unwired until review.

1. Open the station and check **Physical adapter**.
2. Approve the actual button-contact work order.
3. Start the camera and align both markers.
4. Start a capture attempt.
5. Save the camera measurement.
6. Follow each OPEN or CLOSED request and select **Read contact**.
7. Hold each state until its read returns.
8. Select **Capture signed optical test**.
9. Keep both markers visible throughout emission.
10. Close the capture and inspect each predicate.
11. Export and verify the original packet.

With reviewed input-to-ground wiring, release means OPEN and press means CLOSED. A capture lasts two minutes. Optical emission lasts 18 seconds. An interrupted operation never repeats automatically. Start a new attempt after failure or expiry. Preserve the previous record.

Phone enrollment makes its photo predicate mandatory in new work orders. Complete basic contact and optical checks before that optional setup. External reconciliation follows capture and cannot refresh historical sensor timestamps.

### Verify an exported packet

From `application/`, run:

```sh
npm run verify:packet -- /path/to/packet.json APPROVED_WORK_ORDER_DIGEST
```

Obtain the approved digest through an independent trusted channel. Without it, verification checks internal consistency only. The verifier reconstructs contact, optical, optional phone, placement, inspection, acceptance limits, and artifact commitments at their saved capture times. It rejects edited commitments. Recorded READY becomes REVIEW with `externalRevalidated:false`. Recheck current external state through configured readers.

The packet alone does not authenticate owner approval, physical truth, live payment, or current contract state. Keep an actual successful physical recording when one exists. No current recording establishes that outcome.

## Retained direct-payment observation workflow

The original `jobs` ledger and `/api/jobs` routes remain available. They preserve unique intents, unique transactions, exact signed payloads, configuration pins, payment recovery, and one observation claim. States remain `AWAITING_PAYMENT`, `PAYMENT_VERIFYING`, `PAYMENT_REJECTED`, `PAYMENT_UNKNOWN`, `PAID`, `OBSERVING`, `OBSERVATION_FAILED`, and `COMPLETE`.

Direct Preprod x402 costs 2 tADA plus fees. The buyer `prepare` command signs but does not submit. `send` submits the saved bytes once. `reconcile` checks the original transaction. `observe` requests a fresh reading after independent chain confirmation. Use the configured receipt-pin JSON, BLE address, board secret, Blockfrost Preprod project, and dedicated seller/buyer resources described in `.env.example`.

The server checks inclusion, confirmation depth, recipient, and amount before observation. Direct payment has no automatic refund. Unknown submission preserves the original transaction. Restart does not resubmit payments or repeat observations. Keep unresolved records. Simulation cannot establish a Cardano transaction.

The observation verifier uses the original `fieldproof-observation-v1` wire string, SHA-256/P-256, canonical Base64, and P1363 signatures. HMAC authorizes the BLE read. It does not replace the receipt signature. Open circuit cannot distinguish an open contact from a broken wire. No read or software decision actuates hardware.

## Verification commands

From `application/`, run `npm run format:check`, `npm run check`, `npm test`, `npm run overview:check`, and `npm audit --omit=dev --audit-level=high`.

From the repository root, run `python3 application/firmware/test/run.py --sanitize` and `python3 -m unittest discover -s application/device/test -v`. From `application/mobile/`, run `npm test`, `npm run check`, `npm run format:check`, and `npm run build`. Firmware and Android use separate native toolchains. Their guides define actual compile commands and unexecuted device checks.

After isolated installs, run each integration's `format:check`, `check`, `test`, and production dependency audit. `npm run test:integrations` runs both Node integration suites. Masumi fixture/setup commands verify the prepared unexecuted path.

Run Foundry `fmt --check` and `test` from `application/contracts/`. The local Anvil deployment/read integration runs with `FIELDPROOF_FOUNDRY_BIN=/path/to/foundry/bin npm run test:contract` from `application/`. The variable names a directory containing genuine `forge` and `anvil` binaries. Bare `forge` on this host is unrelated.

Browser tests use installed Chrome at desktop and phone widths. They test the commissioning journey, keyboard approval, changed evidence, history, camera-controller shape, actual generated marker detection, print-target detection, and stream cleanup. Subprocess tests cover persistent read claims and the original application's process death/restart. No fixture establishes physical accuracy, live settlement, deployed sponsor evidence, or safety certification.

## Submission and video procedure

The submission baseline has four priorities: one real paid Cardano inspection, genuine NVD/deployed-policy judge evidence, actual physical commissioning, and a reproducible submission. Higher-ambition work stays deferred.

### Prepare the public release candidate

1. Run the checks in [Verification commands](#verification-commands).
2. Run the integrated local demonstration and preserve its fixture labels.
3. Update `application/submission/evidence-manifest.json` with actual artifact and transaction references.
4. Preserve exact original signed source bytes under `application/submission/evidence/` after a secret review.
5. Record the real Cardano Task, useful report, payment transaction, and positive seller receipt together.
6. Record the deployed network, contract, runtime-code hash, job commitments, and five actual judge results.
7. Export the original physical evidence packet and independently trusted work-order digest.
8. Check the README commands from a clean local checkout.
9. Review tracked files, Git history, and release artifacts for secrets and private runtime data.
10. Prepare the public repository and video links without publishing them.
11. Obtain owner authorization before public release and Devfolio submission.

The documentation ZIP contains private development context and is not the public source release. Never publish wallet mnemonics, private env files, runtime ledgers, signed payment authorizations, provisioned firmware, or raw private phone images. A path-boundary check is not a complete secret audit.

### Fill the Devfolio project

The official organizer source requires one team submission, selected partner tracks, a detailed description, public repository, and video. The deadline is October 31, 2026 at 15:00 CET. The video limit is 150 seconds. The TUM Blockchain Track applies automatically.

Use `application/submission/devfolio-draft.json` as draft content. Map it to the actual authenticated form. Field labels and owner/team metadata remain unverified until that form is opened. Enter Cardano and API3 only. Add the actual contract address, paid Cardano transaction, report, and evidence links. Keep any unfinished requirement explicit. Never present a local Anvil address or fixture Task as live evidence.

### Record a video no longer than 150 seconds

Before recording, complete the real paid and physical runs. Keep their original identifiers visible. Record the application window and cropped public CLI results. Hide credentials, account menus, private directories, and unrelated desktop content. Test microphone levels and readable text first.

| Time     | Capture and narration                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| 0–15s    | State the operator's commissioning problem and the useful inspection being purchased                          |
| 15–35s   | Show the approved work order, placement policy, actual markers, and camera guidance                           |
| 35–65s   | Show the real button sequence and complete 18-second LED challenge. Keep each required step visible           |
| 65–95s   | Show the original useful paid Cardano report, Task/request ID, transaction explorer, and seller receipt       |
| 95–130s  | Show the deployed API3 policy, valid state change, and edited/stale/other-request/wrong-key rejection results |
| 130–145s | Export and verify the physical packet. State the remaining evidence limits                                    |
| 145–150s | Close with the operator outcome and repository/demo references                                                |

Escrow collection can take longer than the video. Use the original completed paid record and a clear time caption. Do not imply that a previous transaction settled during a newly recorded request. Use cuts to shorten waiting, never to conceal required failures or substitute a fixture. If a live requirement remains incomplete, name it and leave its manifest gate incomplete.

### Recover presentation failures

Preserve a recording of the actual physical attempt, original packet, paid report/receipt, source response, and deployed judge output. Use those exact artifacts during recovery. Keep their capture times and source labels visible. A rehearsal can explain workflow, but it cannot replace missing live evidence.

### Judge evidence and presentation reset

`GET /api/submission-evidence` reads the canonical submission manifest and computes exact-byte SHA-256 hashes. Artifact downloads use an explicit server allowlist: `manifest`, `nvd-original`, `policy-helper`, `paid-inspection-report`, `paid-inspection-bindings`, `paid-inspection-chain-proof`, and `paid-inspection-request`. The route never exposes private configuration or runtime directories. These saved records do not authorize the current installation.

Select **Judge evidence** to inspect historical transactions, missing requirements and the five deployed policy cases. Select **Refresh evidence** after the canonical manifest changes. The panel performs no chain write or payment. Packet verification and edited-packet rejection apply to the selected attempt above.

Select **Reset presentation** to stop the camera and reload an empty work-order screen. The reset changes browser session state only. Saved attempts, NVS identity, replay claims, receipt pins and financial ledgers remain intact. The history selector can reopen any saved attempt.

### Capture plan with exact spoken copy

Use one work order for a complete installation journey. The current paid report covers a synthetic capture. It cannot authorize a later physical capture. Keep that distinction visible when recording the historical receipt. The physical segment remains blocked until the carrier review, camera and actual tests succeed.

| Time     | Screen and action                                                                                          | Spoken copy                                                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–15s    | Show the station and physical specimen. Keep the source label visible.                                     | “An equipment operator needs more than an installer's promise. Proof of Ready checks placement, fresh device response and the evidence behind acceptance.”                                                          |
| 15–35s   | Approve the actual work order. Show incorrect placement and its diagnostic.                                | “The operator fixes the requirements first. This marker is outside the target. The station rejects it and states the next action.”                                                                                  |
| 35–65s   | Show the actual requested button states and complete 18-second optical capture. Keep both markers visible. | “Each physical test receives a fresh challenge. The device signs its response. The camera must observe the complete light sequence from this installation.”                                                         |
| 65–95s   | Open Judge evidence and the original paid REVIEW report. Show its escrow, result and seller receipt.       | “This completed Cardano purchase paid an independent deterministic inspector. Its original capture was synthetic, so the useful report requests missing optical evidence. These saved transactions are historical.” |
| 95–130s  | Show the deployed policy and original five-case results with their block number and transaction.           | “The contract authenticates the NVD response. Edited, stale, other-request and wrong-key evidence must fail for their intended reason. The valid response finalizes the evidence-bound policy decision.”            |
| 130–145s | Export the original physical packet and verify it against the approved digest.                             | “The packet preserves the original work order and evidence. Missing physical evidence keeps acceptance blocked. A software declaration does not prove installed firmware.”                                          |
| 145–150s | Show the approved repository and video references.                                                         | “Proof of Ready. A clear decision, with proof you can inspect.”                                                                                                                                                     |

Do not record an unfinished row as successful. The current contract demonstration uses a paid REVIEW and must end REJECTED. Its failed inspection predicate determines that rejection regardless of the CVE result. The source signature and source commitments still gate finalization. Show the separate bounded policy helper to explain affected versus corrected reference versions.

For recovery, preserve the original recording and an adjacent scope file with its capture time, Task ID and evidence limits. The paid-delivery backup is a historical interface recording. It does not replace missing physical video or five deployed cases. Keep all recordings local until public-release approval.
