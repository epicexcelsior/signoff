# Proof of Ready — implementation plan

Status: selected product heading. Software implementation proceeds alongside documentation. Hardware connection comes later. Commercial validation does not block engineering. This plan replaces the earlier conditional feasibility scope. The original draft remains in Git history.

## Current implementation checkpoint

The local commissioning station, immutable work orders, durable capture claims, fresh signed transitions, local receiving checks, camera guidance, deterministic inspection, and packet verification now run. The original observation lab remains at `/observation.html`.

The integrated verification passed 39 application tests, 23 Masumi tests, ten API3 Node tests, 29 Foundry tests, and one local Anvil deployment/read test. The camera tests use generated genuine markers. Paid lifecycle tests use fixtures. The API3 CVE tests use local signer fixtures. These results do not establish live settlement or physical acceptance.

The current optical predicate stays REVIEW. The coordinator also lacks live paid-report and deployed-contract reconciliation. Correct rehearsals remain REVIEW. Demonstrated placement, contact, or delivery defects produce REWORK. No client shortcut can produce READY.

Next: identify the actual board/components, measure camera performance, implement the board-specific signed optical record, and connect authorized live inspection and contract evidence. The owner decisions below remain current. README records the shortest runnable path.

## 1. Build the complete commissioning experience

Proof of Ready lets an operator delegate equipment commissioning to an agent. The agent turns approved requirements into executable checks, coordinates evidence, buys a useful specialist inspection, and produces an evidence-bound acceptance decision.

The flagship job commissions a networked monitoring station. It checks placement, device identity, physical function, delivery to the owner's application, and a declared software policy. The ESP32 is the first device adapter. The product supports other devices through explicit capability and evidence contracts.

The full target includes camera guidance, a fresh optical challenge, signed contact tests, an actual Masumi-paid inspection, authenticated API3 security data, and a contract decision honored by the coordinator. These are implementation goals, not claims of completion.

The first customer story is an operator accepting subcontracted monitoring installations. Pricing, demand, and revisit savings remain hypotheses. We will build the product path without waiting for customer interviews.

## 2. The user journey

1. The operator describes the equipment, installation target, required function, and software policy.
2. The planning agent proposes structured checks and highlights missing requirements.
3. The operator approves an immutable work order before capture.
4. The technician opens the camera view. Target and device markers show position and orientation guidance.
5. The coordinator starts a fresh session. The enrolled device supplies job-bound signed contact readings.
6. A board-specific optical challenge connects the signed session with the camera-observed device assembly.
7. The operator's receiving application records the expected physical-state sequence within the approved deadline.
8. The paid inspector evaluates the immutable evidence, explains defects, and recommends an approved corrective test.
9. API3-authenticated vulnerability data controls the declared software policy in the commissioning contract.
10. The coordinator honors the contract decision and returns READY, REWORK, or REVIEW with a verifiable acceptance record.

Wrong placement, an unresponsive circuit, missing delivery, and an unacceptable declared build must change the result. Correcting a defect starts an explicit new acceptance attempt. It cannot rewrite the previous evidence or silently buy another inspection.

The model plans and explains. Deterministic checks control acceptance. A useful FAIL or REVIEW report completes paid inspection. It does not approve contractor work.

## 3. Build on the existing application

Keep application/ as the source boundary. Reuse its Node/Express application, SQLite ledger, P-256 verifier, original challenge format, browser interface, direct x402 adapter, and recovery tests. Do not start a replacement platform or introduce an unrelated chain.

The components are:

| Component | Role |
|---|---|
| Coordinator and SQLite | Work orders, immutable policy, capture claims, evidence, paid jobs, contract commitments, exports |
| Operator/technician interface | Work-order approval, live guidance, diagnostic actions, report and acceptance state |
| Vision Worker | Locally served OpenCV, marker detection, target-relative measurements, calibration identity, optical samples |
| Device adapter | Existing BLE contact observation plus a separate optical challenge capability |
| Masumi integration | Useful Coworker inspection, durable task/payment recovery, result commitment and seller receipt |
| Dedicated MPS runtime | PostgreSQL-backed Masumi payment service with isolated credentials and runtime |
| API3 consumer | Exact source request, native verification, bounded policy evaluation, unsigned transaction preparation |
| Commissioning contract | Immutable enrolled manifests, work-order commitments, inspection prerequisite, oracle policy, terminal decision |

The browser never receives payment keys or MPS administration credentials. The vision Worker never receives the local session capability, signing keys, or network clients.

## 4. Hardware and camera setup

Confirmed owner inputs:

- An ESP32 and a full starter kit are available.
- Laptop webcam is the first camera.
- Android comes later.
- Equipment connection can wait while software progresses.

The kit name and board name were unclear in voice transcription. Do not infer their model or inventory. Exact board model, sensor parts, LED type, camera availability, and Android model remain to be recorded after inspection. No family or unrelated voice-transcription content belongs in project records.

No USB serial device or video device was visible during the initial host inventory. This is a snapshot, not a claim that the owner lacks equipment.

Start with a marked installation panel and a contact/button function. A mounted contact and magnet support the cabinet-door specimen. A button alone supports a device-function rehearsal. Both use the same work-order engine with different declared evidence requirements.

Use the laptop camera through getUserMedia. Use the same capture page on Android later through USB forwarding to localhost. A native Android app is unnecessary for this path. Confirm the actual phone before adding device-specific features.

Use a printable reference and a rigid device marker. Planar mode reports target-relative alignment under a common-plane and known-reference-size assumption. Calibrated pose additionally needs measured target dimensions, camera intrinsics, distortion, capture resolution, and independent measurement checks. A changed camera, crop, resolution, or zoom invalidates the relevant calibration.

The camera lane starts with reference marker 0 and device marker 10. The operator approves target position and tolerances. A printable calibration board can extend the same controller. Printer access or an accurately measured alternative target remains an owner input.

### Optical challenge

Do not reuse the legacy led.blink receipt as optical proof. That implementation toggles a GPIO, uses HMAC, and checks electrical readback. The available board's visible LED driver is not identified yet.

Prepare a separate capability that accepts a fresh sequence, emits a preamble and slow encoded symbols, and signs the execution record with P-256. Capture starts before dispatch. The camera evaluator compares recorded optical samples with the signed sequence after capture closes.

A proposed starting configuration uses 250-millisecond Manchester half-symbols. Thirty-two bits take approximately sixteen seconds plus preamble. Tune from measured camera delivery. Reject incomplete tracking and ambiguous symbols. This is camera-observed challenge matching under ordinary camera/software trust.

Implement the generic optical protocol and evaluator before board access. Select and test the physical driver after exact board identification. Present firmware changes and the low-voltage test before requesting flash or actuation authorization. Do not alter security fuses.

## 5. Shared contracts and state

The root integrator owns the shared schemas and database. Every artifact has a schema version. Canonical off-chain artifacts use SHA-256 over sorted JSON and carry lowercase 0x-prefixed 32-byte digests. Never mix those digests with Masumi transport hashes or an ABI-encoded on-chain acceptance hash.

| Artifact | Required binding |
|---|---|
| WorkOrder | Owner approval, asset, enrolled device, marker/target policy, function sequence, evidence classes, software policy, expiry |
| CaptureSession | Work-order digest, unique session, original challenges, capture window, camera/calibration identity |
| VisionEvidence | Marker identities/corners, measured pose, quality, capture time, frame digest, source class |
| DeviceEvidence | Original challenge, unchanged signed receipt, configured key, verified capture-time result |
| DeliveryEvidence | Expected destination, original observation reference, received state and timing |
| InspectionInput | Immutable work order and evidence bundle, exact input text, transport identity |
| InspectionReport | PASS/FAIL/REVIEW, predicate outcomes, evidence references, limitations, remediation, evaluator version |
| PaidInspection | Task IDs, original signed terms, exact input/result bytes, hashes, chain evidence and settlement phase |
| AcceptanceRecord | Job/work-order/build/inspection/payment/source commitments, chain/contract, terminal decision and evidence digest |

Capture-time freshness differs from report validity. A physical receipt must pass its original challenge and age checks when captured. The later inspection evaluates that saved historical event. It cannot refresh its capture time or describe an old reading as current. The ten-second live-dispatch rule must not invalidate an otherwise valid historical inspection after escrow collection takes longer.

Use immutable inputs and atomic state transitions. Claim each device capture before dispatch. Save signed payment data and external-write intent before send. Reconcile ambiguous outcomes. Do not regenerate quotes, repurchase work, repeat hardware operations, or reset financial records automatically.

## 6. Parallel implementation ownership

| Lane | Exclusive ownership | First deliverable |
|---|---|---|
| Root | Shared schemas, SQLite, coordinator/API, existing page/CSS, configuration, integration and current docs | Work-order and evidence engine with an executable commissioning interface |
| Camera | public/vision/, public/vendor/opencv-4.13.0/, vision-specific tests | Real marker detection, camera controller, planar guidance and printable target |
| Masumi | application/integrations/masumi/ | Useful inspection adapter, exact hashing, durable recovery and seller receipt checks |
| API3 | application/contracts/ and application/api3/ | Local commissioning contract, bounded NVD evaluator, native verifier and unsigned calls |

Use separate managed worktrees. Each lane commits tested cohesive changes locally. The root reviews and integrates them, then pushes the reviewed result to the private repository. Shared protocol and database changes stay with the root. Reassign completed capacity to firmware, richer vision, UX, or independent verification as dependencies open.

## 7. Camera implementation

Pin the official OpenCV.js 4.13.0 artifact and license. Serve it locally. The runtime probe detected generated marker 10 in Chrome. It exposes ArUco, ChArUco, homography, PnP, and calibration bindings.

Run it in a dedicated same-origin Worker. The parent keeps self-only scripts. Only the Worker response permits unsafe-eval because the upstream build needs dynamic function creation. The Worker has no network access. Do not broaden the whole application's script policy.

The controller exposes start, stop, capture, and state. It returns measured pose, corners, quality, calibration identity, and proposed predicates. The coordinator owns final acceptance. Permit one outstanding geometry frame and release native matrices. Do not blindly await the OpenCV non-Promise thenable.

Test generated genuine markers, wrong identities, missing references, misplaced/rotated markers, poor quality, capture cleanup, and camera changes. Physical accuracy remains a separate measured check when equipment is connected.

## 8. Masumi paid inspection

Use the official TUM Coworker paid-task route as the primary new integration. Retain direct x402 as a separate saved baseline. Masumi is not a transfer-method flag on that baseline.

Pin the quickstart and current payment-service source. Use project-local Sokosumi CLI 1.0.4. The current MPS manifest requires Node >=24.22.1 <25 and pnpm 10.30.2. The existing application uses Node 24.10.0. Isolate MPS with its own runtime or local container and dedicated PostgreSQL storage.

The lane first implements useful deterministic inspection and an optional bounded model explanation. Then it verifies an execution-only Personal Workspace Task. Paid execution follows account/resource authorization and secure setup.

Provision dedicated Vendor/Coworker, MPS database, encryption key, selling wallet, and actual registered source. Reuse resources on resume. Import the worker credential once through the supported CLI vault. Adapt the starter's example service metadata before registration. Do not assume source index zero.

The official paid route requests one test USDM and separates confirmed lock, execution, result submission, Task completion, withdrawal, and positive seller receipt. Its deadline offsets are approximately +5/+20/+36/+52 minutes. Show truthful pending phases while other work continues.

Preserve exact transport text. Coworker commitments hash exact task/result text. Standard API commitments use nonce-prefixed hashes. The root's artifact digests remain separate fields.

Required local checks include useful negative reports, duplicate requests, restart during uncertain writes, wrong resource selection, altered input/result, incorrect seller or token, and refund recovery. A FAIL inspection is delivered work. An absent or corrupt report is a service failure.

## 9. API3 commissioning policy

Implement operator-provisioned software acceptance. Use Apache NimBLE CVE-2025-62235 with explicitly enrolled reference manifests for 1.8.0 and 1.9.0. Reproduce source/build artifacts before claiming their hashes. Keep the live ESP32's actual build separate until its provenance is established.

Project the CVE identifier, complete configurations, complete CVSS 3.1 array, source-generation time, modification metadata, status, and totalResults. The approved request hash is 0x3f0881fb062ac6b989c133e0b5651d19947e38aebe4d94750627fa612f447d15. The pinned signer is recorded in EVIDENCE.md.

Support a bounded complete applicability shape. Check all relevant Boolean structure, exact NimBLE criteria, version bounds, unique approved metric source/type/version, and numeric ranges. Unsupported authenticated shapes map to REVIEW. Do not interpret absent KEV fields as signed false.

The contract exposes enrollBuild, openJob, recordInspection, finalize, and getJob. Operator authority controls enrollment and inspection commitments. Permissionless finalization verifies the configured source, exact request, timestamps, deadline, paid-inspection prerequisite, and software predicate. Accepted and rejected jobs are terminal.

The contract records an operator assertion about Cardano payment. It does not verify Cardano consensus. The coordinator reads the pinned contract and checks every commitment before acceptance. No RPC or hash match means REVIEW.

Local fixtures test both software outcomes and all authorization/state failures. Retain the genuine free CPE response as an authenticity smoke test. A genuine paid CVE response, deployed contract, and all four required deployed rejection cases remain external evidence gates.

## 10. Dependency order and completion gates

1. Lock interfaces and keep the current passing baseline recoverable.
2. Integrate work orders, evidence records, deterministic inspection, and the commissioning UI.
3. Integrate real browser vision and test it with generated markers.
4. Connect the board later. Identify it, obtain fresh signed readings, and verify the actual function sequence.
5. Add the correct optical driver and verify camera-observed challenge matching.
6. Run the useful execution-only inspector, then an authorized paid Masumi Task through actual seller receipt.
7. Integrate local API3 policy and tests. Obtain authorized genuine CVE data and deploy only after review.
8. Make one complete acceptance path consume the paid report and contract decision. Export a reproducible evidence packet.
9. Expand supported work orders and device providers through the established contracts. Improve diagnostics and presentation from the working system.

Each gate requires observable success and failure behavior. Local fixtures, browser-generated images, real hardware, and live settlement stay separately identified. The event deadline remains October 31, 2026 at 15:00 CET. It is not permission to publish or spend.

## 11. Owner decisions and preparation

| ID | Decision or input | Recommendation/current state | Needed when |
|---|---|---|---|
| D1 | Product heading | Proof of Ready selected. Build the full commissioning path | Resolved |
| D2 | Camera | Laptop webcam now, Android later | Resolved |
| D3 | Exact ESP32 and kit parts | Full kit available. Identify model and actual contact/LED components through read-only inspection | Before board driver or wiring |
| D4 | Physical specimen | Marked monitoring station with contact function. Use cabinet/door fixture when parts support it | Before physical assembly |
| D5 | Target printing | Print supplied reference at measured size, or provide a measured alternative | Before metric camera acceptance |
| D6 | Android model | Not confirmed. Do not guess from voice transcription | Before phone-specific testing |
| D7 | Model/provider and author identity | Use an approved account and chosen public agent author. Enter credentials locally | Before hosted agent execution/registration |
| D8 | Masumi account/resources and budget | Dedicated Preprod resources and a bounded paid-task grant after exact setup is prepared | Before external resource creation or payment |
| D9 | API3/deployment budget | Prepare two CVE calls, approximately 0.02 aUSD, plus separately estimated testnet gas | Before signing or broadcasting |
| D10 | Firmware and optical test | Review the actual board-specific change and low-voltage test first | Before flashing or LED actuation |
| D11 | Public release/submission | Private development continues. Prepare concrete release evidence for later approval | Before publication or submission |

These external decisions do not block local schemas, UI, vision fixtures, inspection logic, contracts, integration tests, or unsigned requests. The team owns ordinary framework, implementation, test, and integration choices.

## 12. Documentation and evidence

README.md is the execution index. This file is the detailed build plan. PROOF_OF_READY_AGENT_HANDOFF.md is the concise execution directive. docs/ENGINEERING.md records actual interfaces and recovery behavior. research/EVIDENCE.md records verified facts, versions, commands, and remaining evidence gaps.

Update these existing files. Do not create another competing status-document collection. Keep secrets and private camera/runtime data outside tracked source. Preserve the original workbook, historical handoff, and sibling FieldProof project. Private commits and pushes are authorized. Public release and externally consequential actions require targeted approval.
