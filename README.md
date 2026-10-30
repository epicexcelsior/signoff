# Proof of Ready review and FieldProof prototype

The existing prototype lets an agent buy a fresh gate-contact observation before a software dispatch decision. The service checks the device signature, original request, sample agreement, and observation age. Its current example maps an open contact to DISPATCH. That mapping does not establish installation acceptance or safe physical dispatch. The contact circuit cannot distinguish an open contact from a broken wire. No decision actuates hardware.

The local application is in [application/](application/). Simulation runs without credentials or hardware. The Preprod adapter and Bluetooth reader exist, but no live payment or physical observation passed through this port yet.

**Direction under review:** Proof of Ready proposes acceptance of contractor commissioning work. The [implementation proposal](PROOF_OF_READY_IMPLEMENTATION_PLAN.md) and [execution proposal](PROOF_OF_READY_AGENT_HANDOFF.md) are supplied drafts. They do not establish implemented features, validated demand, or permission for payments and public deployments. This README, engineering, and evidence remain the current sources of truth.

The private GitHub backup contains reviewed source, tests, current documentation, and both supplied proposals. It excludes credentials, runtime files, historical private notes, the original workbook, and the original handoff. Those original inputs remain local and unchanged. Do not change repository visibility without explicit authorization.

## Feasibility verdict

**Conditional go for one remote functional-acceptance workflow. Do not build the full draft as written.** The broad commissioning market already has collaborative tests, AI-generated forms, visual installation evidence, and payment-review workflows. These are established features. The possible distinction is a portable acceptance record backed by fresh, work-order-bound execution of an actual physical test. Demand and durable differentiation remain unvalidated.

Recommended first buyer: an IoT integrator that subcontracts non-safety monitoring retrofits across unattended storage sites. The operations lead needs evidence that an installation reaches the owner's monitoring system before accepting a batch. The proposed paid deliverable is an inspectable acceptance report. A useful FAIL or REVIEW report still completes the inspection service.

The first specimen is a cabinet-door contact monitor. The business product is the acceptance workflow and verifier API. The ESP32 supplies one evidence adapter. A board is available, but a mounted contact, magnet, actual firmware state, and end-to-end function remain unverified.

| Judge's objection | Required repair |
|---|---|
| Existing commissioning software already does this | Integrate a machine-executed evidence check into existing work orders. Do not sell another checklist platform |
| A detached sensor can sign convincing readings | Require an owner-controlled witness or trusted asset-side evidence for mounting and physical action |
| The founder controls every role | Disclose prototype role control. Offer verification outside the service. Separate keys do not establish independent organizations |
| A CVE signature proves nothing about installed firmware | Require credible enrolled-build provenance. Otherwise return REVIEW for that predicate or omit the security gate |
| Blockchains add friction | Keep physical acceptance useful independently. Cardano pays for the inspection. It does not prove physical truth |
| An enormous platform will obscure the result | Complete one functional test and portable report before geometry, more device types, or extra services |

The proposed interaction is concrete:

1. The owner approves the device, asset reference, physical test, monitoring destination, timeout, and witness requirement.
2. The verifier starts a session and selects an unpredictable open/close sequence.
3. An owner-controlled witness observes the mounted contact and actual door motion.
4. Each settled state receives a fresh challenge and signed reading.
5. The owner's monitoring endpoint must receive the matching state within the approved deadline.
6. A stuck contact, missing transition, wrong key, stale receipt, or missing witness prevents acceptance.
7. The service returns PASS, FAIL, or REVIEW with exact predicates and an independently verifiable evidence package.

This workflow is proposed, not implemented. It verifies witnessed function during the inspection. It does not defeat collusion, prove permanent mounting, certify safety, or establish continuing operation.

**Cardano:** retain one useful paid inspection and verified settlement as the primary sponsor path. Masumi adds value when result delivery, collection, and failed-service recovery are actually reproduced. An escrow lock alone is insufficient.

**API3:** the protocol is feasible, but NVD is conditional product scope. A genuine free signed product lookup and native rejection checks passed. The candidate CVE lookup returned HTTP 402. No signed CVE projection, deployed policy contract, affected installed build, or product acceptance gate exists yet. A CVE lookup is not firmware attestation. See [the verified findings and competitors](research/EVIDENCE.md).

The next direction gate is one real mounted-contact acceptance test and a report that another verifier can reproduce. The commercial gate is an operator with an actual handover problem that this evidence resolves. No customer interview, price validation, or savings measurement exists yet. Do not claim a winning business from a working tabletop test.

## Run locally

Use Node.js 24 or later. Browser tests also require installed Google Chrome, or a compatible executable set through `FIELDPROOF_BROWSER_EXECUTABLE`. Python 3 is necessary for the syntax check and physical reader.

```sh
cd application
npm ci
npm start
```

Open <http://127.0.0.1:4021>. Choose Open or Closed. Select **Run simulated check**. Inspect the receipt and test an edited copy. The decision expires after ten seconds, including when status requests stall.

Simulation uses a local P-256 signing key. It moves no funds and reads no physical contact. A simulated transaction identifier cannot establish a Cardano payment.

Runtime files default to the user state directory, outside source. `FIELDPROOF_STATE_DIR` selects another directory. The ledger survives restart. Use a separate directory when changing the provider, public key, payment recipient, or mode. Preserve unresolved payment records.

## Check the implementation

```sh
npm run format:check
npm run check
npm test
npm audit --omit=dev --audit-level=high
```

`check` checks JavaScript syntax, Python syntax, and package JSON. `test` includes browser, HTTP, evidence, concurrency, and process-restart tests. `test:browser` runs only the browser test. The application serves native browser modules and has no compilation step. No type checker or lint command is configured.

## Cardano payments and Masumi

The current Preprod adapter uses x402 direct payments at 2 tADA per observation, plus the transaction fee. The buyer saves one signed transaction before submission. The seller binds it to one job and checks chain inclusion, confirmation depth, recipient, and amount before observation.

Direct payment does not supply an automatic refund when observation fails. A timeout preserves the original payment as unresolved. It does not authorize a replacement payment.

**Masumi is the preferred escrow extension. It is not implemented in the application.** The hosted Preprod facilitator advertises the Masumi transfer method. Check availability without a wallet:

```sh
npm run check:masumi
```

The x402 Masumi request ends at escrow lock. Result submission, seller collection, and refunds require the subsequent Masumi lifecycle. A locked payment cannot be labeled as seller payout. Reproduce those operations before enabling a Masumi payment route. The SDK permits unregistered seller quotes, so registry integration is not a prerequisite for that investigation. See [verified evidence](research/EVIDENCE.md).

## Enable a physical Preprod check

Payment signing, payment submission, and hardware actuation require separate explicit authorization. No such operation ran during this implementation. The following configuration describes the supported direct-payment path for a separately authorized run.

Keep credentials outside tracked source. Use a dedicated Preprod buyer wallet, a separately controlled seller address, a Preprod Blockfrost project, and the provisioned board authorization secret. Set the variables in [the configuration example](application/.env.example). Both the server and buyer require `FIELDPROOF_SPEND_AUTHORIZED=true` before a payment can start.

Create a receipt-pin JSON file outside source:

```json
{
  "contact": {
    "provider": "YOUR_PROVISIONED_DEVICE_ID",
    "sensor": "gpio3-contact",
    "location": "demo-gate"
  },
  "publicKey": "YOUR_UNCOMPRESSED_P256_SEC1_PUBLIC_KEY"
}
```

Use the actual provisioned device identifier, sensor, and public key. Set `FIELDPROOF_RECEIPT_PINS` to that file. Set `FIELDPROOF_BLE_ADDRESS` and `FIELDPROOF_DEVICE_SECRET`. Discovery does not establish device identity.

Install the physical reader in an isolated Python environment:

```sh
python3 -m venv .venv-ble
.venv-ble/bin/python -m pip install -r requirements-ble.txt
```

Set `FIELDPROOF_PYTHON` to that environment's Python executable. Set `FIELDPROOF_MODE=preprod`. Load the private configuration and start the server. Select **Create paid check** and copy its identifier.

With the authorized buyer configuration loaded, use these separate commands:

```sh
npm run buyer -- prepare CHECK_ID
npm run buyer -- send CHECK_ID
npm run buyer -- reconcile CHECK_ID
npm run buyer -- observe CHECK_ID
```

Replace `CHECK_ID` with the created identifier. `prepare` signs but does not submit. `send` submits the saved bytes once. `reconcile` only checks the original transaction. `observe` requests one fresh reading after confirmed payment.

A failed or interrupted observation does not run again automatically. The reader has no actuation command. The current deployment is loopback-only and does not expose a public seller API.

## Current work and limits

The next payment extension is Masumi result submission, collection, and refund recovery. Live Cardano settlement, physical-board compatibility, and an end-to-end paid observation still require verification. Fixtures do not establish these outcomes or sponsor qualification.

Cardano is the primary track. API3 and peaq are not integrated. Buyer, reality-compiler, and learning-machine concepts do not govern this implementation. Preserve the sibling FieldProof project and original inputs. Local commits and pushes to this private repository are authorized. Public publication, spending, deployment, and submission preparation remain gated.

Read [engineering](docs/ENGINEERING.md) for interfaces and recovery behavior. Read [evidence](research/EVIDENCE.md) for sources, versions, and verification limits.
