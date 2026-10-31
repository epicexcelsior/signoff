# API3 deployed evidence and judge checks

**Qualification: NOT ESTABLISHED under the source-dependent-decision requirement.**

The original deployed transaction changed OPEN to REJECTED. Its inspection prerequisite was false. The contract therefore rejects regardless of the authenticated CVE verdict. Four valid tamper rejections do not close that qualification gap.

- Network: Base Sepolia, chain ID 84532.
- Contract: [CommissioningPolicy](https://sepolia.basescan.org/address/0x98023c425670a9690ab362c00fbea1bc11dce2cb).
- Original OPEN judge block: `52413566`.
- Mined finalization block: `52413614`.
- Transaction: [original REJECTED finalization](https://sepolia.basescan.org/tx/0xa94e48a5d72065ad46c4c558d26a7c3f618aa491fe46e6d012fd7aa7b1356eab).

These commands make read-only calls at the pinned historical block. They require internet access and an RPC with historical state. They sign no transaction and spend no funds.

From the repository root:

```sh
npm --prefix application/api3 ci
npm --prefix application/api3 run judge:submission
```

Run the valid response and each negative case:

```sh
npm --prefix application/api3 run judge:candidate -- ../submission/evidence/nvd-paid-final-original.json
npm --prefix application/api3 run judge:candidate -- ../submission/evidence/api3-edited-deliberate-test.json
npm --prefix application/api3 run judge:candidate -- ../submission/evidence/nvd-paid-first-original.json
npm --prefix application/api3 run judge:candidate -- ../submission/evidence/api3-other-request-original.json
npm --prefix application/api3 run judge:candidate -- ../submission/evidence/api3-wrong-key-deliberate-test.json
```

Expected results, in that order:

| Input | Result |
| --- | --- |
| Original valid response | SUCCEEDED |
| Edited response | NotSignedByAirnode |
| Original older response | InvalidOracle |
| Another request | NotSignedByAirnode |
| Another signing key | NotSignedByAirnode |

Files with `deliberate-test` in their names are explicit negative-test inputs. They are not genuine source responses. The two NVD original files retain their exact genuine paid response bytes.

The latest sanitized qualification audit is `application/submission/evidence/api3-qualification-audit.json`. It contains fresh replay results and the exact remaining gap. A future qualification claim needs a meaningful source-dependent on-chain decision with genuine prerequisites. Do not set a failed inspection to PASS or replace an original nonce to manufacture that result.
