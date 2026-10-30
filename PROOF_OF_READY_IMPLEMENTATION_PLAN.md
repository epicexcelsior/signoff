# PROOF OF READY — Implementation and Verification Plan (Draft v1)

**Purpose:** An executable specification for an autonomous coding-agent team building a TUM Blockchain & AI Hackathon submission. This document directs engineering execution, product design, customer validation, technical research, tests, evidence, documentation, and presentation. **Start work immediately; no artificial timeboxes, team-size quotas, or arbitrary restrictions on ambition.** Progress is measured by working verified outcomes, not elapsed hours or generated code. The event's actual submission deadline remains binding: **Saturday 31 October 2026, 15:00 CET**.

**Status:** Product direction chosen for implementation, technical integrations and demand still to be verified. This is a first draft, not evidence that code, payments, deployed contracts, hardware, or customer validation have occurred.

**Project:** **Proof of Ready** — a programmable acceptance layer for independently executed physical work.

**One-sentence pitch:** *A business hires someone to install or repair connected equipment; Proof of Ready converts the work order into executable acceptance tests, hires an independent verification agent, and issues an auditable commissioning certificate only after the right physical device demonstrably meets the agreed conditions and an Airnode-authenticated security policy permits activation.*

**Customer-facing headline:** **"Before you pay for a machine installation, prove it works."**

**User-facing product promise:** Get a clear, inspectable answer to "Is the right device installed, functioning, and allowed under our declared acceptance policy?" across contractor and organizational boundaries. Never assert that prototype measurements certify universal safety or that a firmware-reported version is a tamper-resistant measurement.

## 0. Operating contract: apply these instructions throughout

- **Build the product, not an architecture diagram.** Prioritize a complete, delightful customer journey with real verified integrations. Have agents do the research, implementation, tests, docs, and direct inspection, rather than returning plans alone.
- **Explore implementation approaches intelligently.** This is a product and proof specification, not a mandate for a particular framework, model, algorithm, or device. An alternate design is welcome when evidence shows it is safer, more compelling, more robust, or easier to validate; document the decision and implement it. Do not silently pivot the product into an unrelated agent marketplace, smart vending machine, oracle logger, or generic sensor API.
- **Parallelize aggressively where work is independent.** Use available agents, skills, MCP servers, repo search, independent reviewers, test runners, browser automation, and hardware interfaces. The coordinator owns integration and acceptance. Do not equate the number of agents with progress.
- **Do not wait for workshops or responses to start.** Work around external account/funding/real-device constraints in parallel using clearly marked fixtures and adapter contracts; replace those with real execution as soon as possible.
- **No invented evidence.** Label live, previously recorded, fixture, replay, and simulated paths separately. Never claim a genuine Cardano payment, API3 source, CVE-device match, camera-origin proof, safe commissioning, escrow release, or hardware measurement without independent verification.
- **Keep the captain informed.** Send compact state updates when a workstream passes an evidence gate, faces a real blocker, discovers a materially better approach, or needs owner action. State precisely: `WORKING | FAILED | UNVERIFIED`, links/artifacts, next action. Mark decisions `CAPTAIN DECISION REQUIRED` and show recommendation, alternatives, consequence of silence, and exact action needed.
- **Use frequent granular LOCAL Git commits in this NEW project repository.** Commit tested cohesive changes with descriptive messages and small diffs. Separate parallel work through feature branches/worktrees when useful. No public push, repo visibility change, external deployment, Devfolio submission, testnet funds transfer, account creation/registration, or other externally consequential mutation without the captain's approval. **The captain's current request supersedes the older 'no commits' instruction for this new repo only; do not rewrite or commit into the pre-existing The Buyer checkout or FieldProof repo as a side effect.**
- **Security:** do not expose wallet keys, API credentials, site locations, cameras, personal photos, secrets, private source, or raw proof material. Least-privilege agent tools, bounded spending grants, validated external inputs, allowlisted contract addresses and chain IDs, encrypted/local secret storage, redacted logs. Testnet funds are still spending and require authorization.
- **Privacy:** collect and retain the minimum evidence. Prefer site-scoped hashed identifiers and private evidence; store on chain only necessary digests/authorization results. Do not claim zero-knowledge or end-to-end privacy if not implemented.
- **No meaningless limits, no feature theater.** Do not introduce arbitrary ceilings on ambition or scheduled work blocks. Nevertheless preserve a reliable main path and decide additions by whether they measurably improve customer utility, technical originality, sponsor fit, or judge comprehension. Fail-securely, not optimistically.

## 1. Product and market hypothesis — verify, then build for it

### 1.1 First buyer, user, and paid outcome

- **Economic buyer:** equipment manufacturer, building automation integrator, managed industrial IoT operator, or field-service platform responsible for accepting third-party installations across sites. The commercial contract and invoice remain with that operator, not the device itself.
- **End user:** facility manager/work-order dispatcher who specifies acceptance policy; field technician who physically completes the work; external verifier/inspector; reviewer who signs off exceptions.
- **Initial vertical:** commissioning networked building/industrial IoT devices installed by independent field technicians. Pick an exemplar such as a smart-building door/contact sensor or connected gateway where we can demonstrate physical position, liveness, one functional check, and software-component policy.
- **Problem:** a photo and a technician's checkbox do not reliably establish correct device, installation position, fresh function, or permitted software version; remote acceptance requires follow-up calls, revisits, or independent field inspection. Faster acceptance plus a standard evidence receipt reduces dispute/rework burden.
- **Paid agent job:** a verification service converts a work order and actual evidence into a structured, reproducible acceptance report (pass/fail/review with evidence digests, predicates, exact exceptions and source links); the customer pays for that completed inspection on Cardano Preprod. **A legitimate negative result is still a successful paid inspection.** Do not equate a paid verification fee with automatic payment of the physical contractor.
- **Commercial models to investigate:** premium per-asset commissioning fee and enterprise workflow/API integration for high-value sites; usage-based verification for high-volume deployments. Collect real comparable inspection/revisit prices, workflows, liability constraints, and willingness-to-pay; present pricing as hypothesis until validated.

### 1.2 Why a market could become possible

Today, remote physical acceptance often depends on shared organizational trust or expensive human inspection. A portable, cross-organization **machine-readable acceptance artifact** could let an operator hire an independent field technician or verification provider it has never worked with, while still enforcing pre-agreed evidence requirements. The protocol is most defensible across organizational trust boundaries (OEM ↔ field-service platform ↔ technician ↔ customer), not merely as an internal corporate checklist. A distributed network of specialist verification agents is an optional natural extension; do not simulate fake network liquidity or fake contractors.

### 1.3 Business validation, autonomously performed where possible

Research ServiceNow Field Service Management, equipment OEM commissioning software, remote visual assistance, industrial service QA, safety/firmware compliance tools, blockchain-based milestone payouts, camera/fiducial installation guidance, and machine identity attestations. Find the strongest five alternatives and specifically assess what they already do. Sources must be linked and findings must be recent where relevant. Establish whether the paying customer needs cryptographic receipts and third-party inspection as opposed to a conventional SaaS checklist.

Produce `docs/PRODUCT.md` containing exact buyer, payer, job-to-be-done, existing workflow, actual alternatives, first wedge, purchasing trigger, willingness-to-pay assumptions, differentiation and limits. Produce `docs/COMPETITION.md` with direct prior art rather than promotional claims. Produce `docs/PRICING.md` with honest unit economics (estimated human review/revisit costs vs proposed fee), sensitivity, confidence, and validation questions. Use no fabricated interviews or conversion evidence.

**Product red-team:** ask whether a trusted company could solve this more cheaply with photos, QR labels, and a database. If yes, narrow the product to the cross-organizational, independently verified use case that needs stronger integrity, or provide a compelling workflow-specific reason it is worth building. Also challenge: does "working" require a site-specific sensor/contact wiring that we can genuinely measure? Is vulnerability data actually important to commissioning? Do not hide these objections.

### 1.4 Differentiation test

The demonstration's novelty must come from the combination of **executable acceptance predicates, live physical co-presence, explicit device identity, independent paid inspection, and evidence-bound commissioning authority**, not from generic AI, QR codes, a servo moving, or the mere fact that a payment has a hash. Claim original integration and product wedge only where research supports it; never claim first-ever.

## 2. Reverse-engineer the judge experience before adding code

**Customer story:** "I hired an unfamiliar contractor to install equipment at a remote site. Instead of relying on a photo and invoice, I receive a machine-checkable acceptance report before approving the work."

**One continuous demonstration, ideally filmed in a single logical journey:**

1. Operator enters an ordinary-language requirement: "Install sensor S-04 at this marked location, upright, and prove the contact changes when the door closes. It must satisfy our declared software-security policy."
2. AI **proposes** structured acceptance criteria and flags ambiguities; operator approves the schema. AI may coordinate specialist services but **cannot invent policies, independently assert physical truth, or release money**.
3. Physical hardware is installed incorrectly: the camera/marker measurement shows exactly which geometric predicate failed. No certification.
4. A replayed reading or wrong enrolled device is rejected; distinguish signed data from valid job-bound evidence.
5. A live enrolled device is positioned correctly and challenged. The real contact/button/sensor changes, the enrolled device signs the nonce-bound measurement, and (if implemented and tested) a visual LED challenge aligns camera observation with the device.
6. The independent inspection agent is genuinely hired and paid on Cardano Preprod. Its structured report includes evidence integrity, measured conditions, and limitations. Show the actual transaction hash and result; a failed inspection can still be a legitimate fulfilled inspection job.
7. The AirnodeHub-signed NVD record is checked by an EVM commissioning-policy contract. Demonstrate that an enrolled *test* software configuration is rejected under a specific, real CVE/security-policy rule; then demonstrate an approved corrected configuration. The contract verifies original signed data and issues a meaningful `Certified`/`Rejected` state or certificate bound to the job and inspection. **Do not claim NVD confirms installed firmware or universal safety.**
8. Judge-ready tamper panel: valid timely signed response changes state, then edited data, stale signature, other-request response, and unexpected signer each fail without changing authorization. Demonstrate a separate replay/idempotency case if helpful.
9. Final screen: what was checked, which trust authorities supplied each claim, Cardano payment receipt, EVM contract/certificate, and evidence the judge can reproduce. One clear business implication: independent contractors can be commissioned and inspected remotely.

**The 2.5-minute video is a product deliverable, not an afterthought.** Make the first ~20 seconds problem/customer, then visually prove the physical acceptance and paid useful job, then show meaningful signed Airnode contract action + four tamper rejections, end with real customer/monetization and limitation. Do not allocate on-screen time to unrelated architectural decoration. Record a clean backup of each verified live path as it becomes available; clearly mark recorded/pre-staged transactions.

**Live judging:** the product should work without a judge touching hardware, and allow optional judge interaction if the event format permits. Provide one-click reproducible evidence test, reset operation, and clear live/recorded indicators. Do not depend on venue Wi-Fi, a third-party model response, or live chain confirmation for every replay of an already proven successful path.

## 3. The contract between modules

Prefer reuse of existing system conventions after inspection. A practical default is **TypeScript/React frontend + TypeScript application/coordinator + small persistent SQLite ledger + a Sokosumi/Masumi Coworker/worker + Foundry/Solidity API3 policy contract + device adapters**. A different repo stack is acceptable if it lowers risk and is justified. Avoid a custom cross-chain bridge, novel wallet provider, Kubernetes, or an unnecessary microservices fleet.

Suggested new repo layout (adapt to existing setup):

```text
README.md
AGENTS.md
apps/web/                      # operator and technician mobile experience
services/coordinator/          # work orders, auth, event log, orchestration, receipts
services/inspector/            # callable paid specialist, Sokosumi/Masumi or x402
services/device-gateway/       # FieldProof-derived ESP32 BLE, Pico W or software adapter
packages/shared/               # Zod/type schemas, typed state machine, canonical hashes
packages/vision/               # camera marker detection, calibration, evidence envelope
contracts/                     # Foundry; official Airnode v2 verifier, CommissioningPolicy
scripts/                       # replay, integration tests, deployment, tamper runner, demo reset
docs/                          # market, architecture, ADRs, threat model, sponsor setup
  PROGRESS.md
  DECISIONS.md
  BLOCKERS.md
  EVIDENCE.md
  PRODUCT.md
  SECURITY.md
  SOURCES.md
  DEMO.md
  SUBMISSION.md
  POSTMORTEM.md
fixtures/                       # explicitly labeled, sanitized, reproducible
.local/                        # gitignored secrets, device captures, account state
```

### 3.1 Canonical types and invariants

Define schema, semantics, required signatures, and ownership before splitting repositories/worktrees:

- `CustomerAccount`, `Site` (salted site reference), `OperatorPolicy`, `DeviceEnrollment` (public key, capabilities, firmware identity claim and its trust class, approved sensor tests).
- `WorkOrder`: immutable `{id, customerId, specificationHash, policyVersion, targetMarker, allowedPosition/orientation tolerance, expectedDeviceId, requiredCapability, validationRules, expiresAt, approvedBy}`.
- `InspectionRequest`: immutable input digest, job-bound challenge, agent/service identifier, signed operator authorization and economic authorization.
- `GeometryEvidence`: marker ID, board-relative/target-relative measured pose, calibration identity/confidence/reprojection error, capture timestamp, image digest (private image optional), camera-source trust classification. Do not assert precise millimeters without an actual calibrated method.
- `DeviceEvidence`: `{workOrderId, deviceId, keyId, nonce, monotonicSequence, sensorType, measuredValue, timestamp, firmwareClaim, sampleDigest, signature}`; use a deterministic typed canonical encoding and domain-separated signature (existing FieldProof format preferred if verifiable).
- `SecurityEvidence`: `{airnodeSigner, requestHash, responseTimestamp, signedUtf8Data, signature, valueTimestamp, cveId, securityPolicyDigest}`. Preserve **original exact signed UTF-8 bytes** for EVM verification; don't parse and reserialize before submitting.
- `InspectionReport`: signed/hashed evidence references, predicate results with human-readable reasons, `PASS | FAIL | REVIEW`, uncertainty/unsupported claims, inspector agent identity, verifier version; never let raw LLM response be the payment/contract authority.
- `PaidTask`: Cardano network, service/workspace, buyer/seller role, job ID, amount+asset atomic units, unique immutable intent, transaction ID, settlement state, agent result digest, independent on-chain receipt. Separate `pending`, `confirmed`, `ambiguous`, `failed`, `refunded` where applicable.
- `CommissioningCertificate`: contract/network/address, job ID and enrollment hash, exact oracle policy, inspection digest, status, nonce, expiry, EVM tx/event, issue/revoke authority; never represent contract authorization as Cardano escrow release.

**Authority map:** operator approves work order, device reports measurements, camera reports geometry, inspector computes acceptance, Airnode signs external NVD data, EVM contract checks signer/request/freshness/security predicate, coordinator correlates Cardano and EVM results. None of these alone proves all physical facts. No public user or LLM can choose signing key, RPC, payout recipient, required test, CVE, chain, or spending policy.

**Work-order lifecycle:** `DRAFT → OPERATOR_APPROVED → ASSIGNED → MEASURING → INSPECTION_REQUESTED → INSPECTION_PAID/CONFIRMED → EVIDENCE_SUBMITTED → VERIFIED_PASS | VERIFIED_FAIL | MANUAL_REVIEW → CERTIFIED | REJECTED | EXPIRED`. Use independent persisted `PaymentAttempt` and `OracleAttempt` state machines; no double-charge on retry. Backwards moves forbidden except explicit operator correction/new job version.

**Idempotency:** all operations bind immutable job/policy version/nonce; conflict on changed payload under reused IDs; unique job+attempt constraints; persist transaction intent/hash before send; unknown outcome reconciled against network before retry. Do not claim atomic Cardano/EVM settlement. Clock drift, delayed data, and network outages must produce truthful pending/fail states.

## 4. Parallel engineering workstreams (dynamic number of agents)

### A. Product/UX and customer demonstration

Build a truly usable operator/technician experience, ideally one continuous workflow on phone + laptop. Operator creates/approves work order; technician scans QR/marker, performs real installation check; verifier pane shows what passed/failed and why; customer sees report/payment/certificate. Include camera-permission UX, keyboard fallback, loading/errors, accessible semantics, responsive layout, privacy notices and clear live vs recorded badges.

UX defaults: use ordinary language; hide chain jargon behind expandable "Proof / inspect transactions" panels; visually show the ghost target, distance/angle when accurately calibrated, live signal trace, verified identity, security block/remediation, actual evidence chain, and final certificate. Use an outstanding polished but restrained design rather than dashboards full of fake data. Demonstrate wrong placement, valid placement, wrong device, changed sensor, stale proof. Use genuine screen recording and direct mobile inspection, not screenshots alone.

Deliver `docs/UX.md`, screenshots/gifs from actual running UI (not synthetic representations), user journey, browser compatibility facts, direct visual QA, fallback interactive replay without camera/hardware.

### B. Physical evidence and hardware adapters

Start by inspecting **https://github.com/epicexcelsior/fieldproof**: README, protocol, actual firmware, device enrollment, test vectors, BLE integration, original tests and limitations. Reuse code where legal/appropriate with explicit attribution and meaningful new work; never overwrite the original repo. Record source commit/version, which components are reused, modifications and tests.

Probe available device adapters in this order of *availability*, not prestige: available Raspberry Pi Pico W / kit; laptop-based reference device and phone camera; ESP32-C6 when physically obtained. The strongest real hardware path is the already-tested FieldProof ESP32 P-256 key and contact reading. The Pico W may provide an LED, button/contact and software-held key; state its different security properties. Don't assume a specific servo, temperature probe, gyroscope, or camera exists. Enumerate actual USB/BLE/serial peripherals before writing board-specific firmware.

Geometry: use printed ArUco/AprilTag-style markers, measured pose and target calibration; use deterministic geometry and image reprojection error, not an LLM deciding whether the picture looks right. Derive a test from a fixed reference photo/marker placement if true 6-DoF tracking is unreliable. If 3D overlay is only illustrative, label it; do not claim guaranteed millimeter precision or spatial integrity from uncalibrated video.

Liveness: sample a genuine physical input with a fresh challenge; verify job ID, device public key, nonce, counters, sample hash and signature. Optional **synchronized random LED flash** provides camera-observed co-presence; verify feasibility with camera frame rate and timing. Static photos, recorded old challenge responses and wrong-device keys must fail. Don't claim the LED proves secure enclosure installation, protected keys, unmodified firmware or impossibility of advanced relay/video-injection attacks.

Hardware safety: low voltage only; never connect improvised devices to mains, access-control locks, medical/industrial safety equipment, or irreversible microcontroller eFuses; inspect pinout before flashing; save firmware and recoverability path. Implement safe-off behavior for actuators, watchdog and timeouts. Board reboot mid-job gives `UNKNOWN/REVIEW` not a fabricated pass.

Run full real-hardware tests when the device is actually accessible. Until then, use isolated fixtures to develop all application/vision/coordinator logic and keep real-hardware acceptance explicitly pending. Produce firmware setup + wiring diagrams, `docs/HARDWARE.md`, captured raw evidence, test vectors, and recovery steps.

### C. Independent inspection agent + paid Cardano job

**Official source of truth:** https://www.masumi.network/tum-hackathon and its agent-guide.md and SKILL.md; https://github.com/masumi-network/tum-hackathon-quickstart with its README and AGENTS.md; Cardano x402 documentation and example templates; official Cardano developer skills https://github.com/cardano-foundation/cardano-dev-skills; Sokosumi CLI skills / Masumi skills. Read the installed skills rather than guessing commands. The official TUM quickstart currently documents Node 24+, Sokosumi CLI 1.0.4, a Personal Workspace trial, then TUM Workspace, plus separate optional payment setup. Respect exact pinned versions unless there is a demonstrated incompatibility.

The **useful specialist job** isn't a trivial paid text response. It accepts a scoped immutable work order, provisioned device/geometry proofs, configured policy, and optional authenticated API3 certificate and returns a reproducible JSON inspection result: each predicate, source evidence digest, finding, explicit uncertainty, acceptance/rejection reason, and required human intervention. A reasonable AI role is translating requirements into candidate tests, explaining defects, selecting which accredited specialist checks are needed, and coordinating one or more independent tools. Deterministic validation owns the final machine-checkable acceptance result. Include at least one actual tool-dependent judgment that changes output when evidence changes; don't sell an LLM merely repeating booleans as premium work.

Implement the complete supported Sokosumi/Masumi Coworker path: authenticated account checks, coworker provisioning/authorization, local worker execution, real completed Task, and **actual paid Preprod job** with saved transaction hash and verified seller receipt. Follow starter guidance on `PAID_TASKS_ENABLED`, wallet funding, unique project resources and author registration. For faster proof, evaluate Cardano x402 paid endpoint as alternative: use official starter, genuine Preprod funds, real HTTP 402 settlement and job-linked receipt. Choose based on which best supports paid inspection and real customer experience; don't misstate x402 as Masumi escrow. If both useful, implement both after one path is verified.

Separate **payment for inspection service** from **payment for the physical contractor**. Masumi escrow result handling follows its actual lifecycle, dispute windows, and supported semantics; an EVM certificate is not automatically a Cardano payout condition. If adding operator-controlled contractor acceptance/payment, disclose the trusted coordinator and implement explicit authorization. Never pretend cross-chain settlement is atomic or trustless.

Test: valid report; failure still yields useful completed paid job; altered evidence digest; unauthorized new wallet; replay; duplicate client requests; ambiguous send; settlement before service; service crashes after payment; failed output; expired task; wrong network, wrong merchant recipient; owner account restrictions; customer-supplied prompt injection; catastrophic model hallucination bounded by validator. Record real explorer URL, exact result digest, task ID, chain ID/network, amount/asset and actual state transitions. Never put signing secrets in browser UI or logs.

### D. AirnodeHub + Solidity security-policy engine

**Official source:** https://github.com/api3dao/airnodehub-hackathon-starter and challenge docs https://api3dao.github.io/airnodehub-hackathon/docs/ ; recommended integrations https://api3dao.github.io/airnodehub-hackathon/docs/integrations ; catalogue https://airnodehub.api3.org/explore/nvd ; AirnodeHub MCP instructions https://airnodehub-docs.api3.org/api-consumers/mcp and endpoint https://airnodehub.api3.org/mcp . The official starter supports Airnode v2 attestation, request-hash derivation from operation+parameters+response projection, `AirnodeV2Attestation.verify`, `ProjectedJson`, local and deployed contracts, and negative-test patterns. Read exact source and pin versions; don't reimplement signing algorithms or parse signed JSON into a new string before contract submission.

**Initial semantic policy:** a commissioning job identifies one explicitly enrolled software product/component and version and one **real relevant** CVE with an NVD applicability rule. AirnodeHub returns authenticated CVE-related security data. The contract verifies pinned Airnode address, exact request hash, source and signature timestamps where relevant, exact signed bytes and source value, and job/policy binding. It evaluates a narrow policy such as "if this component/version is known affected by this CVE above the declared severity threshold, do not issue an acceptance certificate." It must act on the signed value, not merely log it. A test correction to a demonstrably non-affected version can pass only when its identity/version evidence meets the declared trust model. No unsupported universal-security promise.

**Research blocker to solve immediately:** Is the exact NVD operation available under AirnodeHub, and can its response be projected to on-chain-readable `CVE ID`, `affected product/version predicate`, `severity/metric` and relevant timestamps without unsigned backend preprocessing? Which actual signed fields drive the predicate? Obtain a *fresh genuine response* and source metadata, inspect signed projection, and run official off-chain and Solidity verifier against it. Use a nontrivial real CVE and precisely matched demo software component; avoid inventing a vulnerability or using a genuine CVE against an unrelated ESP32 firmware. If it doesn't work, report a blocking fact and propose a **different genuinely core Airnode use case**, e.g. authenticated external contractor/company eligibility or external incident-triggered inspection, only if that changes a real contract decision and fits the customer. Don't bolt on prices/weather as decoration. If API3 cannot be made essential, preserve a strong Cardano-only product and report API3 as unqualified rather than fake it.

**Solidity:** adapt official Airnode v2 verifier + projected JSON parser; typed policy bound to immutable job, registered allowed Airnode signer, request hash, per-job evidence hash and version, allowed data age, nonce and terminal-state guard; authorization and certificate issuance/rejection; admin controls audited and events visible. Explicitly check original response `timestamp`, relevant *source value* timestamp, not-in-future, wrong request and signer, signed field binding, policy overflow, unavailable/null fields, duplicate execution, attempts to substitute a different CVE/firmware/job, unauthorized certifier, and reentrancy if holding funds. Avoid representing certificate as actual safety certification or insurer compliance.

**Mandatory judge-runnable tamper panel:** a genuine valid response triggers `Certified` or meaningful `SecurityPolicySatisfied`; then real response with edited value, stale real signed response, real response to wrong operation/parameters/projection, and different signer must each fail *before* any authorized state change. Supply a deployed contract address + chain/network, a documented script and/or app path where a judge can supply their own response, and evidence of on-chain state invariants before/after. The wrong-key test must be genuinely signed by an unexpected key, not a malformed signature that fails for unrelated reasons. Expired test may use a real old fixture with demonstrably outdated timestamp, not simply a synthetic timestamp edit. Also test duplicate/replay, future timestamp, signed valid response to wrong CVE, arbitrary JSON reserialization, stale underlying source data, wrong chain, and revoked certifier.

**State change must matter:** certificate issuance, on-chain access/activation authorization, or deposit release *under a justified local contract*; not a logger or a badge. Demonstrate a downstream coordinator actually honoring that contract state. If an actual machine control gate is simulated, label it and keep safety interlocks off real equipment.

### E. Coordinator, security, quality and evidence integration

Own the shared schemas, reliable job/payment/oracle state machines, integration tests, UI end-to-end, merge/rebase conflicts, dependency inventory/licenses, performance/recovery, and continuous status. Use current stack conventions, typed schemas, structured error classes, consistent UTC on wire, traceable event/transaction IDs, explicit user-approval gates for spending and account mutations, deterministic test fixtures, and privacy-preserving logs.

Run unit, type, lint, formatting, dependency/security, Foundry fuzz/property tests, regression, integration tests, browser E2E, visual mobile QA and actual hardware tests where available. Never claim passing tests without command/result. Ask an independent red-team agent to attempt invalid signer/request, forged sensor, replay, prompt injection, payment duplication, operator privilege escalation, leaking raw camera frames, and false certification. Separate upstream starter tests from actual product tests. Build a demo-reset script that cannot delete live financial history or blindly repeat payments.

## 5. Mandatory end-to-end acceptance test matrix

| Gate | Test | Evidence to save |
|---|---|---|
| Product | Nontechnical user understands problem and can complete operator/technician flow | Live screen recording, reproducible steps |
| Physical spatial | Wrong placement/orientation → fail; correctly placed → pass | Original capture, calibration info, predicate trace |
| Device identity | Correct enrolled key and fresh nonce pass; other key/replay/expired challenge fails | Verified signed bytes, public-key fingerprint, negative tests |
| Function | Actual button/contact/sensor changes and job-bound reading updates report | Hardware capture, raw sample hash, result |
| Privacy | Private photo/site coordinates absent from contract/public export | Repo scan, chain event inspection, export review |
| Useful inspection | Change material evidence; inspector result changes with explainable reasons | Report A/B, factual evidence references |
| Cardano paid result | Real paid Preprod job/request yields useful inspector result and real tx hash | Explorer link, seller receipt, job ID, amount and state |
| Payment recovery | Duplicate request/restart/unknown receipt does not blindly charge again | DB event trace + simulated crash/recovery tests |
| API3 valid | Real AirnodeHub v2 signed response changes deployed contract state | Original response bytes, EVM tx, contract event/state |
| API3 edited data | One signed value changed → revert; state unchanged | Runnable script/test output |
| API3 stale | Genuine old response (not falsified timestamp) → revert; state unchanged | Saved real historical fixture and test |
| API3 wrong request | Real other-request response → revert; state unchanged | Original second request + signature |
| API3 wrong signer | Response actually signed by different key → revert; state unchanged | Controlled signer test fixture and recovered signer |
| API3 replay | Duplicate event or same response reused illegally → revert | Nonce / terminal-state proof |
| Cross-system | Airnode contract certificate tied to actual job and inspection digest | Contract+offchain hash matching evidence |
| Demo | Entire promised journey can be reset, rerun, narrated, filmed | Real 2.5-min video + live run instructions |
| Deployment | Deployed contract and Cardano job independently inspectable | Explorer URLs, scripts, README, source revision |
| Submission | Devfolio requirements + selected-track evidence, publicly runnable README | Final verified links + checklist |

Where literal hardware, customer claims, or account actions cannot be verified, write `BLOCKED` or `NOT IMPLEMENTED` in the evidence matrix and accurately scope the demo. Never mark unexecuted tests passed.

## 6. External access, agent escalation and owner approvals

Agents should autonomously search official docs, inspect public repos and local project files, install dependencies in sandboxed project environment, run code, write tests, make local commits, run locally, and prepare transaction/deployment requests. Notify the captain **as soon as** any real dependency appears, while continuing unrelated work.

Typical external gates:

- **Sokosumi account:** captain authorizes/prepares Preprod sign-in, Personal Workspace access, event organization, Vendor/Coworker/agent registration, appropriate identity/`AGENT_AUTHOR`, worker credential storage.
- **Model/provider access:** captain supplies an approved provider's account/API key only through secure local vault/env, not chat. Agents should determine if model capability is needed for each paid service and use deterministic code when superior.
- **Cardano:** captain authorizes dedicated Preprod wallet/test funds and an explicit spending allowance before transactions; agent gives exact network, recipients, estimated amount, total budget, and purpose. Obtain Blockfrost Preprod key if required, securely.
- **API3:** query read-only catalogue and free docs immediately. Before any charged operation, EVM deployment, account changes, or gas spending, present precise chain, signer/key storage, RPC, contract scope, expected test cost and authorization request. Prefer sponsor-provided Base Sepolia test funds and official faucet when suitable.
- **Physical:** request exact board model and USB/serial access when needed, not prematurely. Captain can bring the ESP32 later. Pico W and browser-only adapter remain viable interim paths. Captain must approve any wiring with irreversible or electrical risk; do not do it.
- **Publication:** captain authorizes public repo and public-facing services when ready. Before release scan for `.env`, credentials, sample images, addresses, personal identity, internal notes, unreleased research, licensing and PII. The repository **must be public before Saturday 15:00 CET** under event rules. Prepare a reviewed publish script; do not let that deadline cause accidental secret exposure.

Escalation template:

```
CAPTAIN DECISION REQUIRED — <topic>
Why now: <blocked action and customer/demo impact>
Recommendation: <one action>
Alternatives: <only meaningful ones>
Needed from you: <exact click, approval, account, hardware, or value>
Safe work continuing without you: <independent tasks>
Evidence: <log/docs/commit, sanitized>
```

## 7. Progress, technical docs, local commits and coordination

A lead/coordinator agent shall maintain a single short `docs/PROGRESS.md` as ground truth, updated whenever a verification gate changes:

`WORKSTREAM | status | latest commit | tested behavior | command/result | blocker | captain action | next integration`.

Every research finding goes into `docs/SOURCES.md` with official URL, access date and whether verified in code. Every material design decision gets a short ADR in `docs/DECISIONS.md`: problem, alternatives, evidence, choice, rollback. `docs/BLOCKERS.md` lists reproducible errors and workarounds. `docs/EVIDENCE.md` contains an actual evidence manifest (chain IDs, addresses, tx hashes, stored original signed files, fixtures vs live, test results, screenshots, video clips). `docs/SECURITY.md` documents trust boundaries, threat model, unsupported proofs and attack results. Keep `docs/DEMO.md` synchronized with real UI labels and actions.

**Commit cadence:** whenever a meaningful small unit passes its tests, commit locally on the owning branch/worktree with a precise message, e.g. `feat(vision): reject wrong marker orientation`, `test(api3): reject wrong request hash`, `feat(cardano): persist confirmed paid task receipt`, `fix(payments): reconcile unknown settlement`. Prefer compact reviewable changes, not a giant final commit. Coordinator reviews/merges validated changes continuously. Run focused checks before each commit and broad checks after integration; do not rewrite unrelated user code.

**Updates:** concise, evidence-rich, proactive. Immediately surface critical blockers or owner decisions. For ordinary progress, provide a short checkpoint after a working vertical slice or merged feature, including actual tests and next step; do not drown captain in log dumps or constant pings. Avoid narrating code generation as achievement.

## 8. Judge-ready README, demonstration and submission

Write README from what actually exists, not what was planned. Include problem, primary buyer and fee hypothesis, why remote acceptance is currently difficult, product flow, architecture/trust diagram, reproducible local setup, board-specific optional wiring, offline fixtures clearly labeled, live Cardano path and actual transaction proof, deployed API3 contract/network address, test script for all five sponsor cases, payment limits, supported browsers, reset, known limitations, dependency provenance and what was newly built versus reused from FieldProof. Demonstrate no implicit security certification.

Write a 2.5-minute narrative and storyboard; rehearse the physical actions and retake any unclear footage. All sponsor-required evidence must be visible in the video without relying solely on judges inspecting the README. Provide a backup recorded evidence/replay path, clean live demo QR, and a direct manual checklist so an onsite judge can try the four Airnode tamper cases or watch deterministic test runs. Avoid private testnet keys in the public repository and demo.

### Official organizer checklist (complete only entered partner tracks)

**Universal**
- [ ] Devfolio description: customer, commercial problem, implementation, results and limitations.
- [ ] Video <= 2.5 minutes; actually playable, sound/captions checked.
- [ ] Public repository with clean reproducible README before Sat 31 October 15:00 CET.

**Cardano — planned**
- [ ] Actual Cardano Preprod payment transaction hash for a paid inspection job/request.
- [ ] Video shows who pays, why, delivered inspection result, on-chain paid flow end to end.
- [ ] Description explains specific Cardano tools, economics and operational deployment.

**API3 — conditional on verified essential integration; do not enter if unqualified**
- [ ] Real AirnodeHub-signed response is essential to deployed EVM contract action.
- [ ] Deployed EVM contract address and network; user/judge can submit own responses.
- [ ] Video shows valid timely response → state transition, plus four real invalid cases (edited value, old valid response, other-request valid response, unexpected signer), each rejected before action.
- [ ] Description explains who needs the data, damage from forgery, and which useful data AirnodeHub did not supply (if any).

**BSV — enter only if a genuine separately useful noncustodial DeFi product is added**
- [ ] BSV SDK/Wallet Toolbox integration, noncustodial wallet, actual BSV transaction, agent payment through real DeFi rail.
- [ ] WhatsOnChain URLs, video and customer/business case. An ordinary payment adapter is insufficient.

**TUM Blockchain Track:** automatically judged; deliver code serious enough to merit security review. No extra track checkbox.

### Sources agents must inspect first

- Official event repo `src/content/prizes.ts`, `src/content/faq.ts`, `src/content/agent-contexts.ts`: https://github.com/TUM-Blockchain-Club/hackathon-website/
- Cardano TUM guide and skill: https://www.masumi.network/tum-hackathon ; https://www.masumi.network/tum-hackathon/skill/SKILL.md
- Masumi official quickstart + AGENTS.md: https://github.com/masumi-network/tum-hackathon-quickstart
- Cardano x402: https://developers.cardano.org/x402/ ; official developer skills: https://github.com/cardano-foundation/cardano-dev-skills
- API3 Airnode v2 starter: https://github.com/api3dao/airnodehub-hackathon-starter
- API3 challenge/docs/integrations: https://api3dao.github.io/airnodehub-hackathon/ ; https://api3dao.github.io/airnodehub-hackathon/docs/integrations
- API3 NVD AirnodeHub listing: https://airnodehub.api3.org/explore/nvd
- FieldProof prior art and code: https://github.com/epicexcelsior/fieldproof

## 9. Definition of success / handoff completeness

1. Real prospective buyer and paid task articulated and objections documented, with no invented customer validation.
2. One complete delightful end-to-end customer workflow that can be demonstrated and replayed honestly, including failure cases.
3. Original product code, reusable libraries correctly attributed, documented protocols/schemas/architecture, and frequent granular local commits.
4. A genuine paid Cardano specialist with a verifiable useful report and actual Preprod explorer transaction.
5. If entering API3: Airnode v2 signed data verified by a deployed EVM contract, essential on-chain state action and all four genuine tamper cases with judge-runnable script.
6. Real physical measurement/placement verification if shown as real, otherwise explicit fixture labels; no evidence overclaim.
7. Explicit trust boundaries: hardware key ≠ sensor truth; camera pose ≠ tamper-resistant origin; NVD signed fact ≠ software measurement; dual-chain result ≠ atomic settlement; inspector report ≠ regulatory safety certification.
8. Automated + manual test evidence, security/adversarial checks, browser usability, transaction recovery, restart/replay and clean reset.
9. Signed-off privacy review, public repo, complete Devfolio submission text and 2.5-minute video.
10. Captain receives only unavoidable approval/access/hardware requests, concise evidence-backed updates, and material product decisions. Execute all other steps autonomously.

**Immediate action:** Start by reading the official requirements and previous FieldProof source, selecting the precise commissioning vertical/device/CVE combination, creating `docs/PROGRESS.md`, and launching independent implementation of physical acceptance, Cardano paid inspection, and Airnode policy verification while the coordinator integrates and verifies. Move directly from research to code and live evidence. Do not stop after producing a plan.
