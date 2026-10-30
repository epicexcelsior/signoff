# Masumi inspector and original-chain verification

The inspector returns deterministic commissioning findings. A useful paid REVIEW report does not establish physical acceptance. The worker keeps Task creation, escrow lock, result submission, delivery, and seller withdrawal as separate durable phases.

## Install and test

Use Node.js 24. Install the parent application's pinned dependencies before running the chain verifier:

```sh
cd application
npm ci
npm --prefix integrations/masumi ci --ignore-scripts
npm --prefix integrations/masumi run check
npm --prefix integrations/masumi test
```

The chain verifier uses the existing pinned `@x402/cardano` 2.29.0 datum parser. It requires no MPS checkout, MPS process, wallet mnemonic, account token, or new dependency.

## Verify original on-chain input and result commitments

Use the original published proof JSON, exact report text, and original inspector request. The evidence manifest identifies those artifacts. Keep the report text unchanged. An added newline changes its commitment.

Load a Cardano Preprod Blockfrost key through a private env file outside source. From `application/integrations/masumi/`, run:

```sh
node --env-file=/absolute/private/reader.env scripts/verify-chain.js PROOF_JSON ORIGINAL_REPORT_TXT ORIGINAL_REQUEST_JSON
```

This command performs only public chain reads. It never creates a Task, signs a transaction, submits a transaction, or writes a payment ledger.

The command checks these properties:

- The original request recreates the exact hosted input commitment.
- The original report bytes recreate the on-chain result commitment.
- Both transactions exist in their recorded blocks and have at least one confirmation.
- Each transaction contains exactly one escrow output for the original identifier digest.
- The datum matches the seller, registered agent, input, result, state, and all four deadlines.
- Each escrow output contains the quoted 1,000,000 atomic units of test USDM.

The command returns its read timestamp and confirmation depth. A changed request, edited report, wrong datum, wrong token amount, or duplicate matching output fails verification.

The output explicitly sets `sellerReceiptVerified=false`. These lock and result proofs do not establish seller payment. Verify the original confirmed withdrawal and positive seller-net token amount separately. The worker performs that check through Core's seller receipt, original MPS history, and independent Blockfrost transaction inputs and outputs.

## Recover without another payment

Keep the original private Task ledger, registration, signed terms, and operation claims. Run `scripts/worker.js reconcile ID` with the original private configuration. Reconciliation reads existing identifiers. It does not create another Task or payment.

An uncertain write requires review of its original response and ledger stage. Do not replace the original nonce, remove a claim, generate another signed quote, or reset the ledger to retry.

The private MPS service uses a dedicated database. Its background jobs remain separate from adapter write authorization. Read the canonical engineering guide before starting that service or changing automatic-withdrawal flags.
