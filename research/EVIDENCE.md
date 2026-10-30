# Proof of Ready and FieldProof evidence

Checked October 30, 2026. Local implementation evidence and external availability evidence have separate scopes. No live payment or board read ran through this port.

## Proof of Ready feasibility review

The implementation plan and handoff are supplied proposals. Current research supports one bounded acceptance workflow. It does not validate broad autonomous outsourcing, commercial demand, or a mandatory two-chain product.

### Existing alternatives

| Primary source | Established capability | Product consequence |
|---|---|---|
| [CxAlloy documentation](https://support.cxalloy.com/article/419-welcome) | Collaborative commissioning, asset records, installation tracking, checklists, and tests | Cross-company commissioning alone is insufficient differentiation |
| [Facility Grid AI questionnaires](https://facilitygrid.com/kb/tests/generate-questionnaires-with-ai/) | Generates commissioning forms from instructions, equipment context, and manuals, with review | AI-generated acceptance criteria are already an existing feature |
| [Siemens commissioning documentation](https://sid.siemens.com/api/khub/documents/oBkSnjzHLaHU8eoyqVBabw/content) | Live wiring and function tests for supported equipment | A sensor transition alone does not establish a novel category |
| [Buildots installation/payment review](https://pages.buildots.com/completed-quantities-webinar) | Site imagery and installed quantities support payment applications | Visual evidence before payment has direct commercial prior art |
| [Dynamics 365 inspections](https://learn.microsoft.com/en-us/dynamics365/field-service/inspections-overview) | Asset-bound pass/fail forms, attachments, offline operation, versions, and dispatcher review | A normal SaaS workflow remains a strong alternative |

Vendor documentation establishes available features, not comparative effectiveness or demand for this proposal. The proposed distinction is portable, independently reproducible evaluation of a fresh physical function test under an explicit evidence policy. No evidence establishes that this combination is first-ever or defensible against incumbents.

The recommended buyer hypothesis is an integrator accepting subcontracted, non-safety monitoring retrofits across unattended sites. No interviews, willingness-to-pay evidence, measured revisit reduction, or commercial pricing validation exists. Per-report fees and enterprise integration remain business hypotheses.

### Physical evidence limits

Read-only firmware inspection found an input-to-ground contact circuit that cannot distinguish an open contact from a broken wire. Five samples span approximately 40 milliseconds. The receipt key uses persistent software-backed NVS storage. No secure element or enabled remote firmware attestation was established.

The current application maps open contact to DISPATCH. That demonstration policy cannot establish physical safety or installation acceptance. A proposed commissioning test requires both physical states, timing, the owner's receiving endpoint, and adequate asset-side evidence.

[RFC 9334 freshness semantics](https://www.rfc-editor.org/rfc/rfc9334.html#section-10.4) distinguish generating fresh signed evidence from when its underlying claims were collected. A nonce alone does not prove that an untrusted program measured its values afterward. [Espressif Secure Boot](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c6/security/secure-boot-v2.html) checks authorized boot code. It does not establish an implemented remote measured-attestation flow for this board.

An owner-controlled witness can support mounting and observed motion. A contractor-controlled camera does not establish independent physical truth. [OpenCV ArUco](https://docs.opencv.org/4.13.0/d5/dae/tutorial_aruco_detection.html) supplies marker geometry under calibration and dimension assumptions. It does not authenticate the marker, camera, asset, or physical location.

The user confirms an ESP32 is available for connection when needed. Contact/magnet availability, mounted wiring, actual board firmware, and a physical end-to-end test remain unverified. No hardware action occurred in this review.

### API3/NVD experiment

The [NVD Airnode listing](https://airnodehub.api3.org/explore/nvd) identifies an API3-operated wrapper over NVD. Its signature is from the configured Airnode, not NIST. The current [machine-readable schema](https://airnode-nvd.fly.dev/) exposes free `searchCpes` and `listSources` operations. CVE lookup and match operations are priced at 0.01 aUSD.

A genuine free NimBLE CPE response signed at **2026-10-30 11:37:09 UTC** passed the unmodified official native verifier at revision `52933ae1fb9371446a927338473466c3d320e19a`. Its pinned signer is `0x41dd84D5B6503D9aA3c374a49F546e335423a1b8`. Its request hash is `0xcb527c8b970e9d8bc2db6d2432e280011142b21f7749619c83956a41215f1276`.

The [request](fixtures/nvd-cpe-request.json) and [original signed response](fixtures/nvd-cpe-signed-response.json) are saved as public research fixtures. The response identifies a product entry. It does not provide vulnerability severity or establish installed software.

With the official starter's dependencies installed at the pinned revision, run this from the project root:

```sh
node research/verify-nvd-fixture.mjs PATH_TO_PINNED_API3_STARTER
```

Replace `PATH_TO_PINNED_API3_STARTER` with the checkout path. The script rejects a changed verifier source. It checks signature and request binding, then checks rejection of edited data and another expected request. It uses no wallet or network. It deliberately makes no freshness, Solidity, product acceptance, or sponsor-qualification claim.

Two CVE requests returned HTTP 402 without payment. The [saved candidate request](fixtures/nvd-cve-candidate-request.json) for CVE-2025-62235 also returned 402. Its request hash is `0xf28aed06e9cbf7d70e5bedbfd4c36c54c12e3f36e04914a276c864cc08a7dd06`. No signed CVE projection was obtained. One early free CPE call returned upstream HTTP 503. Later requests succeeded. Availability remains an operational dependency.

The [Apache vulnerability table](https://mynewt.apache.org/cve/) identifies NimBLE through 1.8.0 as affected by CVE-2025-62235 and 1.9.0 as fixed. The [direct NVD record](https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2025-62235) supplied a secondary CISA CVSS 3.1 score of 8.1 and an affected range ending before 1.9.0. This direct response is not API3 attestation evidence. No evidence establishes that the available board contains the affected code or configuration.

The candidate request selects one applicability branch and one metric. It is not proof of complete applicability semantics. Missing KEV fields cannot be projected as signed false values. Product policy must validate the complete relevant context or return REVIEW.

The [attestation specification](https://airnodehub-docs.api3.org/airnode/attestation) binds the operation, parameters, projection, signing time, and exact response bytes. Job, contract, and chain binding require separate consumer state and authorization. The starter does not itself enforce product freshness or terminal-job semantics. Source signatures are portable across chains. NVD response generation, CVE publication, and CVE modification are different timestamps.

Verdict: API3 protocol feasibility is established at native-verifier level. Mandatory NVD product scope is not established. Enable it only with credible software-build provenance, a genuine signed CVE response, a consequential product contract, and all required deployed rejection cases.

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
