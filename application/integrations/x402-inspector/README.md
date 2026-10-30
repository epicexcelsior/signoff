# Cardano x402 inspection fallback

This local service sells one useful commissioning-evidence inspection for **2 test ADA plus transaction fees**. It reuses the application's payment adapter, durable payment ledger, and buyer signer. It uses the deterministic Masumi inspector and the original immutable artifact bridge. It does not operate hardware.

A report preserves the source evidence mode. Missing optical or contact evidence returns REVIEW. A genuine payment for a synthetic capture remains a genuine paid inspection of synthetic data. It does not establish physical acceptance.

This is a prepared fallback. The original Masumi inspection reached FundsLocked and delivered its report. Do not send this fallback payment while the original purchase remains unresolved.

## Install and test

Use Node.js 24. From `application/`, install the existing application and Masumi dependencies:

```sh
npm ci
npm --prefix integrations/masumi ci --ignore-scripts
npm --prefix integrations/x402-inspector test
```

This package adds no dependency. It uses the parent application's pinned Express and Cardano x402 packages.

## Prepare private configuration

Keep private env files and runtime state outside the repository. Copy variable names from `.env.example`. Keep signing disabled until the original purchase has a resolved outcome and the fallback receives authorization.

Set `INSPECTION_BRIDGE_MODULE` to the absolute path of `application/src/inspection-bridge.js`. Set `PROOFREADY_LEDGER_FILE` to the original commissioning ledger. Use the original exported inspector request. The bridge rejects substituted input.

Set `SELLER_ADDRESS` to the dedicated Cardano Preprod seller. Load the existing Preprod Blockfrost key privately. Set separate absolute private directories for server and buyer state. Only the buyer process needs `MNEMONIC`.

From this directory, load the private server env and start the service:

```sh
node --env-file=/absolute/private/server.env src/main.js
```

The service binds `127.0.0.1:4024`. It exposes no public listener. Creation and payment writes require the current local token. The buyer reads that token from `/api/config`.

## Run one original paid request

Run each command once. Replace the private env path, request path, and returned inspection ID.

```sh
node --env-file=/absolute/private/buyer.env scripts/buyer.js create /absolute/private/original-request.json
node --env-file=/absolute/private/buyer.env scripts/buyer.js prepare INSPECTION_ID
node --env-file=/absolute/private/buyer.env scripts/buyer.js send INSPECTION_ID
node --env-file=/absolute/private/buyer.env scripts/buyer.js reconcile INSPECTION_ID
node --env-file=/absolute/private/buyer.env scripts/buyer.js inspect INSPECTION_ID
node --env-file=/absolute/private/buyer.env scripts/buyer.js show INSPECTION_ID
```

Before preparation or submission, both processes must set `X402_INSPECTOR_SPEND_AUTHORIZED=true`. The signer pins the seller, Cardano Preprod, lovelace asset, exact transfer method, and 2-ADA quote. Preparation saves the signed transaction without submission. Submission writes an exclusive marker before calling the facilitator.

After a lost response, run `reconcile` for the original ID. It checks the original transaction independently. It never signs or submits another payment. Preserve the ledger, `.intent` file, signed payload, and `.send` file. Do not remove those files to retry. A crash during preparation requires review of the original intent.

The report returns only after chain confirmation. Save the exact `resultText`, SHA-256 `resultHash`, original request, transaction hash, facilitator receipt, and independent chain outputs. This direct ADA transfer has no escrow or automatic refund. It does not produce a Sokosumi seller receipt.

## Source references

[Cardano's official x402 guide](https://developers.cardano.org/x402/) describes direct address payments and Masumi escrow as separate transfer methods. [The official Express starter](https://developers.cardano.org/templates/x402-express/) supplies the hosted Preprod facilitator and client/server pattern. This package reuses this repository's existing implementation and pinned packages. It does not vendor the starter.
