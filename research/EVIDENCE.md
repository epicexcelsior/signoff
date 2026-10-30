# FieldProof evidence

Checked October 30, 2026. Local implementation evidence and external availability evidence have separate scopes. No live payment or board read ran through this port.

## Cardano and Masumi

The [official Cardano developer portal](https://developers.cardano.org/x402/) documents direct address payments, Masumi escrow, and arbitrary script locks. It explicitly promotes Masumi for escrow, identity, and discovery. It states that x402 ends at the lock. Subsequent result delivery, refund, and dispute operations belong to Masumi.

The [Cardano exact-scheme specification](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_cardano.md) defines facilitator-submitted signed transactions. The client signs without broadcasting. A Masumi settlement establishes escrow lock, not seller payout. Direct address settlement supplies no automatic refund.

The [Masumi x402 documentation](https://www.masumi.network/dev/masumi/core-concepts/x402) distinguishes cheap direct calls from escrow-backed jobs. The [payment lifecycle](https://www.masumi.network/dev/masumi/core-concepts/payments) distinguishes FundsLocked, ResultSubmitted, Completed, RefundRequested, RefundAuthorized, and Disputed. The [refund documentation](https://www.masumi.network/dev/masumi/core-concepts/refunds-and-disputes) requires a buyer refund request before unlock and a subsequent resolution process. The application does not implement these escrow operations yet.

### Reproduced availability

`npm run check:masumi` queried the [hosted Preprod facilitator's supported methods](https://x402.preprod.dev.ecosyseng.cf-deployments.org/supported) without a wallet or payment. Its response advertised:

- x402 version 2, exact scheme, `cardano:preprod`.
- Transfer methods `default`, `masumi`, and `script`.
- Unsponsored fees and confirmation bounds from 0 through 20.

The installed SDK derived this canonical Preprod Masumi escrow address:

```text
addr_test1wzs4e6wc95hkwezlccjw9mdvq0r0rsgx6zk34avptga3ftgn37w4g
```

This check establishes advertised support and SDK address derivation. It does not establish a successful lock, result submission, collection, refund, registry entry, or sponsor qualification.

The installed `@x402/cardano` 2.29.0 declarations expose `issueMasumiRequirements`, `toMasumiSellerSigner`, input commitments, and seller-signed terms. An omitted or empty agent identifier represents an unregistered seller. A mandatory registry cannot be inferred for this SDK quote path.

Source constants require minimum intervals of 5 minutes from pay-by to submit-result, 15 minutes from submit-result to unlock, and 15 minutes from unlock to dispute deadline. Submit-result also needs at least 15 minutes of lead. These are policy constraints, not observed settlement or refund durations.

### Dependencies and security

The initial scaffold used x402 2.26.0. Its dependency tree included Zod 3.25.76. The [reviewed Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) identifies uncontrolled memory consumption and specifies 4.6.6 as patched.

The application now pins `@x402/core` and `@x402/cardano` to 2.29.0. That core release declares Zod `^4.6.6`. The lockfile records the installed artifacts. The install audit reported zero vulnerabilities after this change. Run `npm audit --omit=dev --audit-level=high` to reproduce the current registry check. An audit result does not establish comprehensive security.

Earlier payment findings came from the [official Cardano starter at revision 56c6c95](https://github.com/cardano-foundation/developer-portal/tree/56c6c959044e0fd9e6082d02fbc5b1af1e3f2e65/examples/templates/x402-express). That starter used 2.26.0. Its archived audits are historical source evidence, not proof that every behavior remains unchanged in 2.29.0.

## FieldProof protocol and local checks

Read-only inspection used sibling FieldProof revision `3094135718e7aa88fcc33c9df3c7cbd9b723c3e7`. The relevant sources are `host/capmesh/protocol/auth.py`, `host/capmesh/protocol/models.py`, and `host/capmesh/transport/ble.py`. They establish the observation wire message, HMAC request authorization, P-256 receipt verification, Bluetooth characteristic identifiers, and configured-device flow.

The port implements that wire message and a separate bounded reader. The sibling project remains unchanged by this implementation. Its existing recorded board evidence does not establish current hardware compatibility with this port. The current reader does not reproduce two-observer policy or independent physical truth.

The local tests exercise:

- Open and closed decisions, exact wire serialization, edited data, stale data, another request, another key, future timestamps, malformed fields, and unstable samples.
- Unpaid rejection, one immutable intent, one transaction per local job, concurrent callers, failed verification, failed observations, unresolved settlement, and restart recovery.
- Confirmation depth, recipient, and amount through mocked chain responses. No test fixture proves a live transaction.
- Local capability, Host, Origin, body-size, and content-type enforcement.
- Desktop and phone browser interactions, keyboard activation, tamper rejection, cached expiry during stalled requests, and retained history.
- Actual server process death and restart, persistent identity and evidence, rotated session capability, and no repeated observation.

The final local run passed all 21 tests. `npm ci`, `npm run format:check`, and `npm run check` passed. `npm audit --omit=dev --audit-level=high` reported zero vulnerabilities. The local server returned HTTP 200 in simulation mode with spending disabled. Desktop and phone screenshots received visual inspection.

Verification commands and implementation limits live in [README](../README.md) and [engineering](../docs/ENGINEERING.md). No fixture or upstream example proves the finished product's sponsor qualification.

## Track requirements and excluded directions

The organizer source previously checked was revision `f61c409acb3242facaac6fdf9a25a91adc34bb52`. Its [prize criteria](https://github.com/TUM-Blockchain-Club/hackathon-website/blob/f61c409acb3242facaac6fdf9a25a91adc34bb52/src/content/prizes.ts) permit useful deterministic Cardano services. An LLM is not mandatory. The supplied checklist requires a genuine paid Preprod job or request. No such transaction exists for this port yet.

API3 is not entered through an irrelevant price feed. Its supplied checklist requires a deployed verifier and valid, edited, stale, other-request, and wrong-key authenticated-data cases. The local device rejection tests do not satisfy that API3 requirement. Custom AirnodeHub onboarding remains unverified.

Buyer, reality-compiler, and learning-machine research no longer defines the implementation. Prior-art findings remain historical research. No peaq, Solana, Colosseum discovery, additional rail, or registry integration is necessary for the current direct-paid observation path.

Original workbook SHA-256: `ffd736a58e6803e30fe818c538448c7e3e05b1253f5f3eaadb43eecb3963fd19`. Preserve the workbook, supplied handoff, archive, and sibling project. Keep publication and submission preparation outside this work.
