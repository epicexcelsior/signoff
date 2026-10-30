# Proof of Ready and FieldProof evidence

Checked October 30, 2026. Local implementation evidence and external availability evidence have separate scopes. No live payment or board read ran through this port.

## Current local implementation evidence

The selected Proof of Ready direction now has an implemented local commissioning workflow. The full paid physical acceptance target remains incomplete. The implementation plan and execution directive now describe the authorized target and decision register.

The integrated run passed **39 application tests**, **23 Masumi tests**, **10 API3 Node tests**, **29 Foundry tests**, and **one actual local Anvil deployment/read test**. Both Foundry fuzz tests ran 256 cases. The application count includes the original 21 tests, ten commissioning tests, and eight vision tests.

Reproduction commands:

```sh
cd application
npm run format:check
npm run check
npm test
npm run test:integrations
FIELDPROOF_FOUNDRY_BIN=/path/to/foundry/bin npm run test:contract
```

Install each isolated integration package first. Run the selected Foundry executable with `fmt --check` and `test` from `application/contracts/`. The verified toolchain used Node 24.10.0, Foundry 1.8.7, and Solidity 0.8.37. Bare `forge` on this host names an unrelated tool.

Formatting and syntax checks passed for the base application and both isolated packages. Production dependency audits reported zero vulnerabilities in all three packages. The Masumi fixture returned a useful FAIL report with `networkWrites:false` and `sellerPaid:false`. Its setup plan returned `executed:false`.

The commissioning tests verify immutable approval, changed-input rejection, serialized capture claims across connections, subprocess recovery fences, session-bound signed requests, historical capture-time verification, malformed camera input, exact timing boundaries, packet edits, and all rehearsal defects. A real server process-death/restart test also preserves the commissioning packet. A receipt cannot retain a valid device predicate after substitution into another session.

Desktop and 390-pixel Chrome flows passed approval, defect inspection, correction, packet verification/tampering, history, reload, and overflow checks. Desktop and phone screenshots received visual inspection. The legacy observation lab remains at `/observation.html`.

OpenCV.js 4.13.0 detected genuine generated markers and the rendered printable target. Its pinned SHA-256 is `63366510248adf3a7eddf3e793dd825404efb7df3749f4d6f8557c7fa4ca8aa0`. [Artifact provenance](../application/public/vendor/opencv-4.13.0/provenance.json) records the official URL and license. Camera tests cover stream cleanup, late permission completion, changed resolution, concurrent capture, wrong/missing markers, and planar geometry. Optical tests evaluate complete synthetic Manchester captures. No physical accuracy or emitter execution passed.

The API3 contract and consumer now implement bounded policy, operator authority, immutable commitments, source freshness, paid-inspection assertion, replay rejection, terminal decisions, unsigned calls, and pinned state reads. The full approved request hash is `0x3f0881fb062ac6b989c133e0b5651d19947e38aebe4d94750627fa612f447d15`. [API3 provenance](../application/api3/provenance.json) records source revisions, licenses, hashes, fixture scope, and the exact supported shape. Signed CVE tests use disposable local keys. The genuine saved CPE response remains an authenticity smoke test only.

[Masumi provenance](../application/integrations/masumi/PROVENANCE.json) pins the official TUM quickstart and MPS sources. The adapter checks exact Coworker/Standard commitments, uncertain writes, result bindings, withdrawal, positive seller receipt, and refund fixtures. It trusts configured MPS terms and does not independently verify their COSE signature. No hosted Task or actual settlement ran.

A correct station rehearsal passes available function, delivery, device, and placement predicates. Optical binding remains REVIEW. Fixture origin, missing seller receipt, and absent deployed policy keep acceptance at REVIEW. Demonstrated defects produce REWORK. The coordinator does not yet consume live Masumi and deployed-contract outcomes.

Remaining evidence: exact kit/board identification, mounted function, measured camera accuracy, signed optical execution, remote owner delivery, external Task execution, genuine paid CVE data, live seller receipt/refund collection, enrolled installed-build provenance, and deployed sponsor rejection cases. No fixture establishes sponsor qualification.

## Product research context

Research supports a bounded acceptance workflow. It does not validate broad autonomous outsourcing, commercial demand, or a mandatory two-chain product. These commercial hypotheses do not block authorized engineering.

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

The retained observation lab maps open contact to DISPATCH. That demonstration policy cannot establish physical safety or installation acceptance. The commissioning workflow now tests both signed states and local receiving delivery. Real mounting, remote owner delivery, and optical binding remain unverified.

[RFC 9334 freshness semantics](https://www.rfc-editor.org/rfc/rfc9334.html#section-10.4) distinguish generating fresh signed evidence from when its underlying claims were collected. A nonce alone does not prove that an untrusted program measured its values afterward. [Espressif Secure Boot](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c6/security/secure-boot-v2.html) checks authorized boot code. It does not establish an implemented remote measured-attestation flow for this board.

An owner-controlled witness can support mounting and observed motion. A contractor-controlled camera does not establish independent physical truth. [OpenCV ArUco](https://docs.opencv.org/4.13.0/d5/dae/tutorial_aruco_detection.html) supplies marker geometry under calibration and dimension assumptions. It does not authenticate the marker, camera, asset, or physical location.

The user confirms an ESP32 and full starter kit. Exact models and parts remain unknown. Laptop webcam comes first. Android and equipment connection come later. Mounted wiring, actual firmware, and physical end-to-end function remain unverified.

### API3/NVD experiment

The [NVD Airnode listing](https://airnodehub.api3.org/explore/nvd) identifies an API3-operated wrapper over NVD. Its signature is from the configured Airnode, not NIST. The current [machine-readable schema](https://airnode-nvd.fly.dev/) exposes free `searchCpes` and `listSources` operations. CVE lookup and match operations are priced at 0.01 aUSD.

A genuine free NimBLE CPE response signed at **2026-10-30 11:37:09 UTC** passed the unmodified official native verifier at revision `52933ae1fb9371446a927338473466c3d320e19a`. Its pinned signer is `0x41dd84D5B6503D9aA3c374a49F546e335423a1b8`. Its request hash is `0xcb527c8b970e9d8bc2db6d2432e280011142b21f7749619c83956a41215f1276`.

The [request](fixtures/nvd-cpe-request.json) and [original signed response](fixtures/nvd-cpe-signed-response.json) are saved as public research fixtures. The response identifies a product entry. It does not provide vulnerability severity or establish installed software.

With the official starter's dependencies installed at the pinned revision, run this from the project root:

```sh
node research/verify-nvd-fixture.mjs PATH_TO_PINNED_API3_STARTER
```

Replace `PATH_TO_PINNED_API3_STARTER` with the checkout path. The script rejects a changed verifier source. It checks signature and request binding, then checks rejection of edited data and another expected request. It uses no wallet or network. It deliberately makes no freshness, Solidity, product acceptance, or sponsor-qualification claim.

Earlier CVE requests returned HTTP 402 without payment. The [saved candidate request](fixtures/nvd-cve-candidate-request.json) for CVE-2025-62235 also returned 402. Its request hash is `0xf28aed06e9cbf7d70e5bedbfd4c36c54c12e3f36e04914a276c864cc08a7dd06`. No signed CVE projection was obtained. One early free CPE call returned upstream HTTP 503. Later requests succeeded. Availability remains an operational dependency.

The [Apache vulnerability table](https://mynewt.apache.org/cve/) identifies NimBLE through 1.8.0 as affected by CVE-2025-62235 and 1.9.0 as fixed. The [direct NVD record](https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2025-62235) supplied a secondary CISA CVSS 3.1 score of 8.1 and an affected range ending before 1.9.0. This direct response is not API3 attestation evidence. No evidence establishes that the available board contains the affected code or configuration.

That historical candidate request selects one applicability branch and one metric. The implemented request now projects complete configurations and CVSS arrays, source-generation time, and metadata. It is not proof of complete applicability semantics. Missing KEV fields cannot be projected as signed false values. Product policy must validate the complete relevant context or return REVIEW.

The [attestation specification](https://airnodehub-docs.api3.org/airnode/attestation) binds the operation, parameters, projection, signing time, and exact response bytes. Job, contract, and chain binding require separate consumer state and authorization. The starter does not itself enforce product freshness or terminal-job semantics. Source signatures are portable across chains. NVD response generation, CVE publication, and CVE modification are different timestamps.

Native verification and local contract policy now pass. Live enablement still requires credible build provenance, a genuine signed CVE response, deployed policy, and deployed rejection evidence. The 1.9.0 reference outcome covers this CVE only and does not establish general security.

## Cardano and Masumi

The [official Cardano developer portal](https://developers.cardano.org/x402/) documents direct address payments, Masumi escrow, and arbitrary script locks. It explicitly promotes Masumi for escrow, identity, and discovery. It states that x402 ends at the lock. Subsequent result delivery, refund, and dispute operations belong to Masumi.

The [Cardano exact-scheme specification](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_cardano.md) defines facilitator-submitted signed transactions. The client signs without broadcasting. A Masumi settlement establishes escrow lock, not seller payout. Direct address settlement supplies no automatic refund.

The [Masumi x402 documentation](https://www.masumi.network/dev/masumi/core-concepts/x402) distinguishes cheap direct calls from escrow-backed jobs. The [payment lifecycle](https://www.masumi.network/dev/masumi/core-concepts/payments) distinguishes FundsLocked, ResultSubmitted, Completed, RefundRequested, RefundAuthorized, and Disputed. The [refund documentation](https://www.masumi.network/dev/masumi/core-concepts/refunds-and-disputes) requires a buyer refund request before unlock and a subsequent resolution process. The isolated Coworker adapter now implements and fixture-tests the subsequent lifecycle. The direct x402 adapter remains separate. Live operations remain unverified.

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

The original baseline passed 21 tests before extension. The integrated counts and reproduction commands appear above. The new local station runs in simulation with spending disabled. Original and new browser layouts received visual inspection.

Verification commands and implementation limits live in [README](../README.md) and [engineering](../docs/ENGINEERING.md). No fixture or upstream example proves the finished product's sponsor qualification.

## Track requirements and excluded directions

The organizer source previously checked was revision `f61c409acb3242facaac6fdf9a25a91adc34bb52`. Its [prize criteria](https://github.com/TUM-Blockchain-Club/hackathon-website/blob/f61c409acb3242facaac6fdf9a25a91adc34bb52/src/content/prizes.ts) permit useful deterministic Cardano services. An LLM is not mandatory. The supplied checklist requires a genuine paid Preprod job or request. No such transaction exists for this port yet.

API3 is not entered through an irrelevant price feed. Its supplied checklist requires a deployed verifier and valid, edited, stale, other-request, and wrong-key authenticated-data cases. The local device rejection tests do not satisfy that API3 requirement. Custom AirnodeHub onboarding remains unverified.

Buyer, reality-compiler, and learning-machine research no longer defines the implementation. Prior-art findings remain historical research. No peaq, Solana, Colosseum discovery, additional rail, or registry integration is necessary for the current direct-paid observation path.

Original workbook SHA-256: `ffd736a58e6803e30fe818c538448c7e3e05b1253f5f3eaadb43eecb3963fd19`. Preserve the workbook, supplied handoff, archive, and sibling project. Private source backup and local demonstration preparation are authorized. Public release, submission, payments, and externally consequential actions remain gated.
