# Proof of Ready — product and implementation plan

Build agent-orchestrated commissioning for a networked monitoring installation. Bind an approved work order, fresh physical evidence, useful paid inspection, and authenticated software policy.

This document defines goals and completion criteria. [README](README.md#current-execution-index) owns next actions. [Engineering](docs/ENGINEERING.md) owns implemented interfaces. [Evidence](research/EVIDENCE.md) owns verified results and gaps.

## Product outcome

An operator delegates installation checks to an agent. The agent proposes structured requirements, coordinates evidence providers, buys specialist inspection, and explains the result. Deterministic checks decide READY, REWORK, or REVIEW.

The first specimen is a marked monitoring station with a button-contact test and a camera-observed LED. ESP32 is the first adapter. The next available camera is a webcam or the confirmed Solana Mobile Seeker. The Seeker browser camera now supplies a real physical-station measurement and a verified negative packet. Full tracked optical commissioning remains incomplete.

The customer hypothesis is an operator accepting subcontracted monitoring installations. Demand, pricing, and revisit savings remain unvalidated. They do not block authorized engineering.

## Implemented behavior and remaining goals

| Capability            | Current implementation                                                                           | Goal and completion evidence                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Planning              | Operator supplies an asset name. Coordinator instantiates a fixed immutable template             | Agent proposes structured checks. Approval binds requirements before capture                                 |
| Camera                | Worker detects markers and measures planar geometry. Browser tests pass                          | Measured physical accuracy and real-time throughput                                                          |
| Physical function     | Signed contact protocol and durable claims exist                                                 | Reviewed wiring, enrolled board, fresh OPEN/CLOSED sequence, and defect rejection                            |
| Optical binding       | Signed execution and tracked optical evaluation are integrated and fixture-tested                | Camera observes the complete challenge from the enrolled device assembly                                     |
| Receiving application | Local monitor records matching receipts and states                                               | Separate delivery evidence when an independent or remote receiver is required                                |
| Inspection            | Useful paid REVIEW, exact bindings, confirmed withdrawal and positive seller receipt             | Paid inspection of an actual physical installation, plus recovery evidence                                   |
| Software policy       | Genuine NVD, five deployed source checks and mined REJECTED decision bind the paid REVIEW        | Installed-build provenance and physical acceptance. Historical policy evaluation does not renew a work order |
| Phone witness         | Seeker APK builds. Photo verifier and read-only BLE preflight exist                              | Authorized install, Android SQLite instrumentation, lifecycle, camera, and BLE checks                        |
| Acceptance            | Packets reconstruct evidence. Fresh reader commitments control acceptance in tests               | Complete physical and paid installation reaches a contract-bound decision                                    |
| Agent orchestration   | Station is deterministic and operator-driven. Optional model helper is not wired into the worker | Agent coordinates approved steps and explanations without repeating consequential actions                    |

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

Photos match a documented SuperMini layout, with onboard WS2812 GPIO8 and GPIO2 as the later contact candidate. The board's maker and revision remain unmarked. Chip identity alone does not establish pin safety. Read [Available hardware](research/EVIDENCE.md#available-hardware) before hardware work. Compiler-coverage pins must never reach hardware.

## Owner decisions and preparation

| Input or grant     | Current state                                                                              | Required before                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Product and camera | Proof of Ready selected. Real Seeker browser camera inspection returned REWORK                     | Correct physical marker/LED geometry and complete bound optical capture                                        |
| Physical specimen  | USB-only C6 SuperMini layout matched. Private backup and GPIO8 optical-only flash complete | Correct marker/LED geometry, bound optical capture, and later button-terminal/wiring review        |
| Printing           | Supplied target exists. Physical dimensions remain unmeasured                              | Metric placement claim                                                                |
| Firmware           | Both build profiles compiled. Reviewed image flashed. Signed diagnostic and 72/72 recorded symbols verified | Continuous tracked station capture bound to an approved work order                            |
| Seeker             | APK compiled. Native app uninstalled. Browser camera tested                                                | Explicit install, forwarding, and native checks                                       |
| Sokosumi           | Personal grant, useful paid REVIEW and positive seller receipt verified                    | Actual physical inspection input                                                      |
| Blockfrost         | Preprod key passes authenticated latest-block check                                        | Dedicated payment resource configuration                                              |
| Masumi payment     | Original paid Task completed and seller collection confirmed                               | Preserve original Task, transactions and receipt. No new purchase is needed           |
| API3 wallet        | Two NVD calls settled. Historical valid finalization mined REJECTED                        | Preserve 0.001 ETH. The 0.02 aUSD ceiling is consumed                                 |
| API3 client        | Five source checks passed against deployed code. Mined rejection verified                  | Source-dependent terminal decision, physical evidence, and installed-build provenance |
| Publication        | Private development continues                                                              | Explicit public-release and submission approval                                       |

Use [README's owner actions](README.md#owner-actions-on-the-critical-path) and [private setup](docs/ENGINEERING.md#private-credentials-and-test-funding). Keep credentials, wallet addresses, and runtime records in private configuration. No model key is required for deterministic inspection.

The approved budget prices two CVE requests at 0.02 test aUSD. Both requests settled. The five deployed source checks and mined rejection used the second response inside its freshness window. Preserve the original block for replay. No paid-access budget remains.

Local implementation and private reviewed commits are authorized. Routine funded testnet transactions are authorized with a 0.001 ETH reserve. Public release/submission remain separate. Resolve electrical details before hardware actions.

## Documentation maintenance

Update behavior in engineering, verified findings in evidence, next actions in README, and target criteria here. Keep the handoff short and link to those sources. Regenerate the private overview after changes.

Preserve original inputs and archived research. They do not override current code, owner steering, or verified evidence. Do not create another status, summary, plan, or audit collection.

## After the submission baseline

Defer these goals until the four submission priorities have genuine evidence:

- Agent-proposed work orders and repeated autonomous workflows.
- Independent remote owner delivery.
- Native Seeker installation, camera and BLE evidence.
- Broader work orders, device providers and vulnerability policies.

Keep current claims bounded to deterministic operator-driven commissioning, one supported CVE policy, and actual observed evidence. Do not trade required paid/physical proof for more features.
