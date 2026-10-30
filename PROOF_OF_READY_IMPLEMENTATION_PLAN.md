# Proof of Ready — product and implementation plan

Build agent-orchestrated commissioning for a networked monitoring installation. Bind an approved work order, fresh physical evidence, useful paid inspection, and authenticated software policy.

This document defines goals and completion criteria. [README](README.md#current-execution-index) owns next actions. [Engineering](docs/ENGINEERING.md) owns implemented interfaces. [Evidence](research/EVIDENCE.md) owns verified results and gaps.

## Product outcome

An operator delegates installation checks to an agent. The agent proposes structured requirements, coordinates evidence providers, buys specialist inspection, and explains the result. Deterministic checks decide READY, REWORK, or REVIEW.

The first specimen is a marked monitoring station with a button-contact test and a camera-observed LED. ESP32 is the first adapter. Laptop webcam comes first. The confirmed Android phone is Solana Mobile Seeker.

The customer hypothesis is an operator accepting subcontracted monitoring installations. Demand, pricing, and revisit savings remain unvalidated. They do not block authorized engineering.

## Implemented behavior and remaining goals

| Capability            | Current implementation                                                                              | Goal and completion evidence                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Planning              | Operator supplies an asset name. Coordinator instantiates a fixed immutable template                | Agent proposes structured checks. Approval binds requirements before capture              |
| Camera                | Worker detects markers and measures planar geometry. Browser tests pass                             | Measured physical accuracy and real-time throughput                                       |
| Physical function     | Signed contact protocol and durable claims exist                                                    | Reviewed wiring, enrolled board, fresh OPEN/CLOSED sequence, and defect rejection         |
| Optical binding       | Signed execution and tracked optical evaluation are integrated and fixture-tested                   | Camera observes the complete challenge from the enrolled device assembly                  |
| Receiving application | Local monitor records matching receipts and states                                                  | Separate delivery evidence when an independent or remote receiver is required             |
| Inspection            | Useful deterministic reports and original input/result bindings work locally                        | Useful hosted Task, authorized payment, positive seller receipt, and recovery evidence    |
| Software policy       | API3 verifier, bounded CVE evaluator, contracts, unsigned calls, and pinned reads pass local checks | Genuine paid CVE data, build provenance, deployed policy, and required rejection evidence |
| Phone witness         | Seeker APK builds. Photo verifier and read-only BLE preflight exist                                 | Authorized install, Android SQLite instrumentation, lifecycle, camera, and BLE checks     |
| Acceptance            | Packets reconstruct evidence. Fresh reader commitments control acceptance in tests                  | Complete physical and paid installation reaches a contract-bound decision                 |
| Agent orchestration   | Station is deterministic and operator-driven. Optional model helper is not wired into the worker    | Agent coordinates approved steps and explanations without repeating consequential actions |

These are product goals. Fixture demonstrations return REVIEW or REWORK. They do not establish physical truth, live payment, or sponsor qualification.

## Target user journey

1. The operator states the equipment, placement, required function, and software policy.
2. The agent proposes structured checks and identifies missing requirements.
3. The operator approves an immutable work order.
4. The technician aligns the reference and device markers with camera guidance.
5. The coordinator starts a fresh attempt and requests the signed contact sequence.
6. The enrolled device emits the approved optical challenge under camera observation.
7. The receiving application records the sequence within the approved deadline.
8. The inspector evaluates the immutable evidence and explains defects or missing evidence.
9. Authenticated API3 data controls the enrolled software policy in the contract.
10. The coordinator reads the pinned decision and exports a verifiable record.

A correction starts a new attempt. It never rewrites evidence or silently purchases another inspection. A useful negative report completes inspection but does not approve installation.

## Completion criteria

| Gate                  | Observable acceptance criteria                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Local workflow        | Correct rehearsal remains REVIEW. Placement, contact, and delivery defects produce REWORK. Packet edits reject                      |
| Persistence           | Concurrent requests share one claim. Restart never repeats an uncertain Task, payment, capture, or optical operation                |
| Physical capture      | Reviewed specimen supplies original key-bound receipts, measured camera evidence, complete optical matching, and receiving evidence |
| Useful paid service   | Original input and report match. Confirmed withdrawal and positive seller receipt establish payment separately                      |
| Software policy       | Original source bytes, expected signer/request, freshness, enrolled manifest, inspection commitments, and terminal state match      |
| Current READY         | Physical predicates, paid inspection, and contract pass through fresh readers. Expiry or restart removes authorization              |
| Deployed rejection    | Valid response succeeds. Edited, stale, other-request, and wrong-key responses reject in the deployed API3 flow                     |
| Agent behavior        | Agent coordinates approved work, explains refusals, and preserves bounded authority and uncertain-operation recovery                |
| Presentation recovery | Preserve reproducible commands, original packets, and an actual physical recording when available. Keep fixture labels visible      |

The optional autonomous-agent prize requires repeated core workflow execution. One paid call or fixture run does not establish that capability.

## Architecture and evidence boundaries

Keep `application/` as the source boundary. Reuse Node/Express, SQLite, P-256 verification, the camera Worker, retained payment ledger, and recovery tests. [Engineering](docs/ENGINEERING.md#source-and-documentation-boundaries) maps the implementation. [AGENTS.md](AGENTS.md) owns lane assignments.

The browser receives no payment or MPS administration keys. The vision Worker receives no session capability or network client. Claims persist before dispatch. Unknown outcomes require reconciliation of original identifiers and bytes.

The API3 policy covers CVE-2025-62235 for explicitly enrolled NimBLE reference builds. It does not establish general security or identify the installed build. Contract Cardano records are operator assertions, not consensus verification. Source signatures authenticate the configured Airnode response, not independent physical truth.

Carrier-board identity and safe GPIO remain unknown. Chip identity does not establish pin safety. Read [Available hardware](research/EVIDENCE.md#available-hardware) before hardware work. Compiler-coverage pins must never reach hardware.

## Owner decisions and preparation

| Input or grant     | Current state                                                                           | Required before                                                 |
| ------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Product and camera | Proof of Ready selected. Laptop webcam first. Seeker confirmed                          | Resolved choices                                                |
| Physical specimen  | USB-only ESP32-C6FH4. Button and LED available. Carrier board and resistor unidentified | Wiring or GPIO selection                                        |
| Printing           | Supplied target exists. Physical dimensions remain unmeasured                           | Metric placement claim                                          |
| Firmware           | Both build profiles compiled                                                            | Reviewed provisioning, flash, recovery, and optical grant       |
| Seeker             | APK compiled. Phone not installed or tested                                             | Explicit install, forwarding, and native checks                 |
| Sokosumi           | Account key passes identity check. Personal Workspace endpoint returns 404              | Workspace execution, credits, resources, and worker vault setup |
| Blockfrost         | Preprod key passes authenticated latest-block check                                     | Dedicated payment resource configuration                        |
| Masumi payment     | Seller, registration, scoped keys, and fees unresolved                                  | Bounded paid-task grant for one test USDM plus fees             |
| API3 wallet        | Dedicated wallet exists. Last ETH and aUSD balances are zero                            | ETH funding, reviewed mint, and paid-data grant                 |
| API3 client        | Paid-access draft remains outside main                                                  | Review, tests, and integration before live retrieval            |
| Publication        | Private development continues                                                           | Explicit public-release and submission approval                 |

Use [README's owner actions](README.md#owner-actions-on-the-critical-path) and [private setup](docs/ENGINEERING.md#private-credentials-and-test-funding). Keep credentials, wallet addresses, and runtime records in private configuration. No model key is required for deterministic inspection.

The unpaid quote prices two CVE requests at 0.02 test aUSD. Minting and contract transactions need separately estimated gas. Cardano escrow can outlast API3 freshness. Obtain fresh CVE evidence near finalization.

Local implementation, dependencies, fixtures, test keys, and private reviewed backup are authorized. External resources, payments, hardware actions, public deployment, publication, and submission require targeted authorization.

## Documentation maintenance

Update behavior in engineering, verified findings in evidence, next actions in README, and target criteria here. Keep the handoff short and link to those sources. Regenerate the private overview after changes.

Preserve original inputs and archived research. They do not override current code, owner steering, or verified evidence. Do not create another status, summary, plan, or audit collection.
