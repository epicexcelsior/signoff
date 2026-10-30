# FieldProof on Cardano

An agent buys a fresh gate-contact observation before it makes a dispatch decision. The service checks the device signature, original request, sample agreement, and observation age. An open contact permits a dispatch decision. A closed, invalid, missing, or expired observation keeps the decision at WAIT. No decision actuates hardware.

The local application is in [application/](application/). Simulation runs without credentials or hardware. The Preprod adapter and Bluetooth reader exist, but no live payment or physical observation passed through this port yet.

**Direction under review:** Proof of Ready proposes acceptance of contractor commissioning work. The [implementation proposal](PROOF_OF_READY_IMPLEMENTATION_PLAN.md) and [execution proposal](PROOF_OF_READY_AGENT_HANDOFF.md) are supplied drafts. They do not establish implemented features, validated demand, or permission for payments and public deployments. This README, engineering, and evidence remain the current sources of truth.

The private GitHub backup contains reviewed source, tests, current documentation, and both supplied proposals. It excludes credentials, runtime files, historical private notes, the original workbook, and the original handoff. Those original inputs remain local and unchanged. Do not change repository visibility without explicit authorization.

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

Cardano is the primary track. API3 and peaq are not integrated. Buyer, reality-compiler, and learning-machine concepts do not govern this implementation. Preserve the sibling FieldProof project and original inputs. Do not commit, publish, deploy publicly, spend, or prepare submission materials without explicit instructions.

Read [engineering](docs/ENGINEERING.md) for interfaces and recovery behavior. Read [evidence](research/EVIDENCE.md) for sources, versions, and verification limits.
