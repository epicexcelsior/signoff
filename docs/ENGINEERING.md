# Proof of Ready engineering

## Runtime and state

The existing Node.js/Express process serves the commissioning station at `/` and the retained observation lab at `/observation.html`. Native browser modules need no compilation. Node.js 24 supplies SQLite. The optional Python reader accesses one configured Bluetooth contact. No hardware actuator exists.

`Service` owns the existing observation/payment workflow and `CommissioningService`. Both use the same SQLite connection. `commissioning_orders` stores immutable approved documents and unique intents. `commissioning_sessions` stores capture claims, signed observations, receiving records, sealed evidence, reports, and decisions. WAL, FULL synchronization, immediate transactions, and unique constraints serialize writers.

The ledger pins the original provider, public key, mode, recipient, and payment requirements. A changed configuration requires a separate state directory. Runtime files default outside source. Credentials and private data must remain outside tracked files.

An idempotency key binds one normalized input. Changed input under the same key rejects. Each collection has a 1,000-record limit. The list API returns the latest 30 records. Work orders expire after 24 hours. Capture attempts expire after two minutes. No reset endpoint deletes financial history.

## Commissioning protocol

`src/artifacts.js` defines canonical off-chain encoding: sorted object keys, preserved array order, finite JSON values, and UTF-8. SHA-256 digests use lowercase `0x` plus 64 hexadecimal characters. Undefined values, sparse arrays, nonplain objects, and nesting beyond 32 levels reject. This encoding differs from Masumi transport hashes and the contract's ABI/Keccak acceptance hash.

The work order binds the asset, enrolled contact/key, marker policy, transition count, receiving destination/deadline, required evidence classes, software-enrollment status, source mode, and approval/expiry times. The current template fixes marker IDs 0/10, reference size 60 mm, target `(100,0)` mm, position tolerance 8 mm, and angle tolerance 8 degrees. Software enrollment remains unresolved.

The coordinator selects an alternating three-state sequence after capture starts. Each read receives an original nonce and a 30-second challenge. Its 16-character signed request identifier derives from the work-order digest, session identifier, and step. A receipt cannot move into another session while retaining valid device/session predicates.

The coordinator saves the read claim before calling the observer. Concurrent calls in one process share the same operation. Another connection or process sees the durable pending claim and cannot repeat it. An interrupted read remains pending. An explicit new attempt creates a different challenge domain. Inspection cannot close a session while a read remains pending.

The configured observer returns the unchanged FieldProof receipt. The coordinator verifies its pinned P-256 key, original challenge, supported fields, five stable samples, timestamps, and age at capture. The local owner monitor then records the matching receipt digest and state. This receiving application shares the coordinator trust boundary. It does not establish delivery to a remote owner system.

Inspection seals the evidence. It reconstructs receipt validity at the saved verification time. Later inspection does not turn an old observation into a current reading. The original ten-second live-dispatch expiry belongs to the retained lab, not historical inspection validity.

The deterministic inspector consumes normalized verified predicates through `integrations/masumi/src/inspector.js`. This entry point has no external package dependency. Missing evidence returns REVIEW. A demonstrated defect returns FAIL. The inspector trusts the coordinator's normalized checks and states that limit in its report.

Acceptance is separate from inspection. FAIL produces REWORK. Other current reports produce REVIEW. The coordinator currently lacks paid-report and deployed-contract reconciliation. It cannot return READY through a client-supplied flag. Physical optical binding, verified seller receipt, installed-build enrollment, and a pinned contract decision remain integration gates.

## Commissioning HTTP interface

All routes bind to `127.0.0.1`. Every POST requires JSON and `X-FieldProof-Token` from `GET /api/config`. The high-entropy capability rotates on restart. Host/Origin checks, a 48 KB request limit, no-store responses, safe text rendering, and disabled proxy trust protect the local boundary.

| Route | Contract |
|---|---|
| `GET /api/commissioning` | Latest work orders and attempts |
| `POST /api/commissioning/work-orders` | `{idempotency_key,asset}` approves one immutable template |
| `POST /api/commissioning/work-orders/:id/sessions` | `{idempotency_key,scenario?}` starts or retrieves one attempt |
| `GET /api/commissioning/sessions/:id` | Read the durable capture/report state |
| `POST /api/commissioning/sessions/:id/contact` | `{step:0..2}` claims one signed read |
| `POST /api/commissioning/sessions/:id/vision` | Save `{frame,frameDigest,source,camera?}` once |
| `POST /api/commissioning/sessions/:id/fixture-vision` | Generate marker corners in simulation only |
| `POST /api/commissioning/sessions/:id/inspect` | Seal evidence and evaluate it once |
| `GET /api/commissioning/sessions/:id/packet` | Download work order, evidence, report, decision, and digests |
| `POST /api/commissioning/verify` | `{packet,expectedWorkOrderDigest?}` reconstructs the packet |

Supported rehearsal scenarios are `correct`, `misplaced`, `stuck`, and `missing-delivery`. Physical mode rejects synthetic scenario selection and generated camera evidence. The camera upload accepts a bounded measurement, not raw frames. The server recomputes geometry from corners. It does not trust a browser PASS field.

Packet verification checks internal consistency. An independently obtained work-order digest additionally pins the operator policy and device key. The packet alone does not authenticate the operator or coordinator. The device receipt does not sign camera frames, firmware identity, or physical mounting.

## Camera and optical interfaces

Import `createVisionController` from `/vision/controller.js`. Supply `{video,canvas?,policy,onState,onMeasurement}`. The controller exposes `start()`, `stop()`, `capture({sessionId})`, and `getState()`. State uses `phase`, including `ACTIVE`, `STOPPED`, `STARTING`, and `ERROR`.

A capture includes explicit browser-camera source, SHA-256 of RGBA pixel bytes, bounded marker corners, capture time, resolution, camera/calibration identities, planar pose, quality, and predicates. Raw camera/device identifiers and frames remain in the browser. Changed camera, crop, resolution, or zoom invalidates the active calibration and releases the stream. The detector permits one outstanding frame and frees native matrices.

OpenCV.js 4.13.0 is pinned under `public/vendor/`. Preserve its exact bytes, license, and provenance. Exclude that folder from Prettier. The parent page keeps self-only scripts. Only `/vision/detector-worker.js` receives this policy:

```text
default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'
```

The upstream build embeds WASM and requires dynamic function creation. The Worker receives pixel buffers and detector commands. It receives no session capability, wallet keys, or network client.

`/vision/target.svg` contains reference marker 0 at 60 mm, device marker 10 at 30 mm, and a 100 mm target offset. Print at actual size and verify the ruler. Planar guidance assumes a measured reference, coplanar markers, and unmodeled lens distortion. Calibrated physical accuracy remains unverified.

`encodeOpticalChallenge({bits,halfSymbolMs})` and `evaluateOpticalChallenge({challenge,samples,startAtMs,captureStartedAtMs,captureEndedAtMs})` live in `public/vision/optical.js`. The evaluator checks ordered tracked brightness samples and complete unambiguous Manchester symbols. It does not authenticate the emitter, camera, or clocks. No board-specific emitter, signed optical record, or coordinator optical-evidence route exists yet. The commissioning optical predicate remains REVIEW.

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

`application/contracts/` contains `CommissioningPolicy` and `NvdPolicy`, with licensed pinned dependencies. The operator enrolls immutable build manifests, opens jobs, and records the inspection and Cardano payment assertion. Permissionless finalization checks the pinned Airnode signer/request, source freshness, job deadline, inspection prerequisite, policy, and terminal-state guard. Accepted, rejected, and REVIEW decisions are terminal. No contract holds or releases funds.

The ABI adapters expose `prepareEnrollBuild`, `prepareOpenJob`, `prepareRecordInspection`, and `prepareFinalize`. They return unsigned calls only. Record inspection once the final seller receipt exists. A false seller-receipt assertion cannot later be overwritten.

`readAcceptance({client,chainId,contract,jobId,expected,...})` checks actual chain, contract code, oracle configuration, terminal state, inspection prerequisites, five digest commitments, and the ABI acceptance hash. Missing RPC, wrong commitments, or failed reads return REVIEW. Supply expected work-order, build-manifest, inspection, payment-evidence, and source-response digests from trusted server state. Runtime-code hash, deadline, policy threshold, and acceptance hash can also be pinned.

The contract's Cardano payment evidence is an operator assertion. It does not verify Cardano consensus. Source signatures are portable across chains. The consumer supplies chain/job/contract binding. The coordinator's final live acceptance integration remains pending actual evidence and configuration.

## Retained direct-payment observation workflow

The original `jobs` ledger and `/api/jobs` routes remain available. They preserve unique intents, unique transactions, exact signed payloads, configuration pins, payment recovery, and one observation claim. States remain `AWAITING_PAYMENT`, `PAYMENT_VERIFYING`, `PAYMENT_REJECTED`, `PAYMENT_UNKNOWN`, `PAID`, `OBSERVING`, `OBSERVATION_FAILED`, and `COMPLETE`.

Direct Preprod x402 costs 2 tADA plus fees. The buyer `prepare` command signs but does not submit. `send` submits the saved bytes once. `reconcile` checks the original transaction. `observe` requests a fresh reading after independent chain confirmation. Use the configured receipt-pin JSON, BLE address, board secret, Blockfrost Preprod project, and dedicated seller/buyer resources described in `.env.example`.

The server checks inclusion, confirmation depth, recipient, and amount before observation. Direct payment has no automatic refund. Unknown submission preserves the original transaction. Restart does not resubmit payments or repeat observations. Keep unresolved records. Simulation cannot establish a Cardano transaction.

The observation verifier uses the original `fieldproof-observation-v1` wire string, SHA-256/P-256, canonical Base64, and P1363 signatures. HMAC authorizes the BLE read. It does not replace the receipt signature. Open circuit cannot distinguish an open contact from a broken wire. No read or software decision actuates hardware.

## Verification commands

From `application/`, run `npm run format:check`, `npm run check`, `npm test`, and `npm audit --omit=dev --audit-level=high`.

After isolated installs, run each integration's `format:check`, `check`, `test`, and production dependency audit. `npm run test:integrations` runs both Node integration suites. Masumi fixture/setup commands verify the prepared unexecuted path.

Run Foundry `fmt --check` and `test` from `application/contracts/`. The local Anvil deployment/read integration runs with `FIELDPROOF_FOUNDRY_BIN=/path/to/foundry/bin npm run test:contract` from `application/`. The variable names a directory containing genuine `forge` and `anvil` binaries. Bare `forge` on this host is unrelated.

Browser tests use installed Chrome at desktop and phone widths. They test the commissioning journey, keyboard approval, changed evidence, history, camera-controller shape, actual generated marker detection, print-target detection, and stream cleanup. Subprocess tests cover persistent read claims and the original application's process death/restart. No fixture establishes physical accuracy, live settlement, deployed sponsor evidence, or safety certification.
