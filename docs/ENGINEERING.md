# FieldProof engineering

## System boundary

One Node.js process serves the local interface and observation service. SQLite stores immutable job inputs, payment bindings, challenges, receipts, decisions, and events. The buyer CLI holds its own signed-payment files. The optional Python reader accesses one configured Bluetooth contact. No broker, registry, third chain, or hardware actuator exists in this port.

Node.js 24 supplies SQLite. Express serves the API and static assets. Browser JavaScript needs no build. Dependencies are pinned in `application/package.json` and `package-lock.json`. The x402 packages use 2.29.0. Evolution uses 0.5.14. These versions supersede the earlier 2.26.0 research assumptions.

## Sources of truth and concurrency

The seller ledger is the source of truth for local job ownership. SQLite uses WAL, FULL synchronous writes, immediate transactions, and unique intent and transaction identifiers. Conditional state changes permit one payment-submission claim and one observation claim. In-process coalescing reduces duplicate concurrent work. Database constraints also apply across connections.

One idempotency key identifies one immutable observation input. Reusing it with changed input rejects. One transaction belongs to one job within this database. Direct address payments do not cryptographically bind the payment to a job across independent sellers.

Configuration is pinned to the ledger. A changed mode, provider, key, recipient, or requirement rejects startup. Use separate state directories for separate configurations. Runtime files and secrets stay outside tracked source. Browser responses omit signed transaction bytes and private credentials.

| State | Meaning and permitted recovery |
|---|---|
| `AWAITING_PAYMENT` | No signed payment is bound |
| `PAYMENT_VERIFYING` | Exact payload is saved. Verification does not submit. The same payload can resume verification |
| `PAYMENT_REJECTED` | Verification rejected. No observation runs |
| `PAYMENT_UNKNOWN` | Submission intent is durable. Submission or settlement can remain uncertain. Reconcile the original hash |
| `PAID` | Simulation accepted, or independent Preprod chain checks passed |
| `OBSERVING` | Challenge is durable. One observation can be running or interrupted. Do not repeat automatically |
| `OBSERVATION_FAILED` | Payment remains recorded. Decision stays WAIT. No automatic repeat or refund exists |
| `COMPLETE` | Original receipt and verification are durable. The decision still expires |

Restart does not resubmit payments or repeat observations. An interrupted observation remains fenced. This trades automatic recovery for avoiding duplicate device calls. A new authorized check needs a new intent.

## Direct x402 payment

`POST /api/jobs/:id/payment` returns HTTP 402 with `PAYMENT-REQUIRED` when no signature is attached in Preprod mode. A paid retry supplies `PAYMENT-SIGNATURE`. The public SDK encodes and decodes the protocol headers. The service validates the exact accepted requirements and canonical transaction hash before binding the payment.

The seller persists the signed payload before verification. It persists submission intent before calling the facilitator. Only independently checked chain inclusion, one newer block, correct recipient, and sufficient lovelace permit observation. A facilitator response alone cannot permit observation. The chain provider and facilitator remain trusted external dependencies. Cardano confirmation is probabilistic and subject to rollback.

The buyer's `prepare` command requires the configured seller, exact Preprod network, lovelace, 2 tADA amount, and direct transfer method. It uses the SDK's spend control. Network fees are additional. It saves an exclusive preparation marker and the signed transaction before `send`. A send marker prevents accidental resubmission after a lost response. The CLI has no automatic paid-fetch recovery wrapper.

The buyer writes files with restrictive permissions and synchronizes file contents. The ledger uses SQLite's durability guarantees. This implementation does not claim a transactional guarantee across buyer files, seller storage, HTTP, and Cardano.

If `send` fails, inspect the stored job and reconcile its original hash. Do not remove markers to force another send. If the seller reached `PAYMENT_VERIFYING`, the same payload can resume through the authenticated payment API. If the seller never received the request, submission remains a manual recovery operation. The CLI deliberately supplies no marker-reset command.

## Observation protocol

After payment confirmation, the service creates a fresh nonce, timestamp, and 30-second challenge deadline for the original job identifier. It saves the challenge before invoking the reader. The receipt must match that challenge and the configured provider, location, and sensor.

The verifier uses the existing FieldProof `fieldproof-observation-v1` wire message. It verifies SHA-256 with the pinned P-256 public key and a 64-byte P1363 signature encoded as `v3:` plus canonical Base64. HMAC authorization permits a board read. HMAC does not substitute for the receipt signature.

Acceptance requires five stable samples, supported fields and types, bounded timestamps, and capture age at most ten seconds. The verifier rejects edited data, stale data, another request, another key, future timestamps outside the two-second clock tolerance, changed nonces, and unstable sampling.

The Python reader requests only `state.observe`. It checks the configured provider manifest, subscribes to completion, sends one challenge, and reads the complete receipt. Missing notifications, connection errors, oversized receipts, or invalid data fail the check. No discovery fallback selects another board. The child receives the board secret and necessary environment values, not the buyer mnemonic or chain credentials.

The service recomputes freshness when reading a stored result. The browser also expires cached decisions without waiting for HTTP. A network error blocks dispatch. An open signed contact permits the software decision DISPATCH. A closed contact produces a valid WAIT decision. Neither output is hardware actuation or an independent physical witness.

## Local HTTP interface

All routes bind to `127.0.0.1`. Host and Origin checks protect the local boundary. Every POST requires a high-entropy session capability and JSON content type. The capability rotates on restart. Request bodies are limited to 48 KB. CSP, no-store responses, same-origin resource policy, safe text rendering, and disabled proxy trust constrain browser access.

| Route | Purpose |
|---|---|
| `GET /api/config` | Local session, mode, and public contact details |
| `GET /api/jobs` | Latest 30 checks |
| `POST /api/jobs` | Create or retrieve an immutable intent |
| `GET /api/jobs/:id` | Read receipt, current decision, payment summary, and events |
| `GET /api/jobs/:id/payment` | Read the Preprod payment quote |
| `POST /api/jobs/:id/payment` | Quote or process one signed payment |
| `POST /api/jobs/:id/reconcile` | Check the existing transaction without submitting |
| `POST /api/jobs/:id/observe` | Claim and request one observation after payment |
| `POST /api/jobs/:id/verify` | Verify a candidate receipt against the stored original challenge |

Candidate verification does not overwrite stored evidence or authorize a new observation. Rejection returns HTTP 422 and WAIT. The ledger retains at most 1,000 jobs. No destructive reset endpoint exists.

## Masumi extension

Masumi adds a concrete escrow lifecycle to Cardano x402. The hosted Preprod facilitator advertises it. The SDK can issue seller-signed terms with an input commitment and an unregistered seller. Registration is optional for that quote path. This project implements only a read-only availability check through `npm run check:masumi`.

The next implementation must bind the immutable observation task into the Masumi commitment. It must save and reuse the complete issued quote across retries and restart. It must distinguish escrow lock, result submission, collection, refund request, refund authorization, and dispute. A lock cannot be called a completed seller payment.

The installed SDK enforces minimum deadline intervals of 5, 15, and 15 minutes. It also requires a 15-minute minimum lead for result submission. These are source constants, not measured completion times. A successful receipt hash does not prove that a physical statement is true. Reproduce successful work and failed-work recovery before enabling any escrow lock.

Do not add an unverified escrow flag to the direct adapter. Do not claim automatic refunds from an x402 lock alone. See [evidence](../research/EVIDENCE.md) for the primary sources.

## Verification and remaining work

The declared checks cover formatting, syntax, signed observations, HTTP boundaries, payment confirmation decisions, idempotency, concurrency, interrupted work, and real process restart. Browser tests use installed Chrome with desktop and 390-pixel viewports. They exercise keyboard activation, edited receipts, stalled requests, expiry, reload, and history. Screenshots remain outside source.

Simulation and mocked chain responses establish local contracts. They do not establish live settlement, physical Bluetooth compatibility, escrow recovery, public availability, or sponsor qualification. Live Preprod payment and physical reader verification remain open. No public deployment, payment signature, hardware actuation, or submission preparation is authorized by this document.
