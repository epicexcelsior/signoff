# Verify software admission and the paid inspection

The current API3 proof uses a mandatory source gate before a work order opens. Fresh authenticated NVD data admitted a declared NimBLE 1.9.0 reference build. The same source blocks a vulnerable 1.8.0 reference build. The unsigned opening route always rejects.

Software admission precedes inspection. It does not identify firmware installed on the ESP32 or approve the physical installation. The original actual-camera installation remains REWORK, with a paid FAIL report.

- Network: Base Sepolia, chain ID 84532.
- Contract: [SourceGatedCommissioningPolicy](https://sepolia.basescan.org/address/0x1ed0ebc0c5104702e688eccc567d84b66107e60b).
- Valid action: [NVD-authorized work-order opening](https://sepolia.basescan.org/tx/0xbcba0ba8a582c06cc72351290de98a2bcabc03b6fe2916f6dbac6e237ef92798).
- Evidence: `application/submission/evidence/api3-admission-qualification-audit.json`.

## Replay the actual deployed proof

These commands read the original block and transaction. They require internet and a historical Base Sepolia RPC. They sign no transaction and spend no funds.

From the repository root:

```sh
npm --prefix application/api3 ci
npm --prefix application/api3 run judge:admission:submission
```

The replay verifies all five cases, vulnerable-build rejection, and the mined admission before inspection. The response was fresh at the actual action. Historical replay does not renew its freshness.

## Supply your own copied response

The first argument pins the reviewed deployment, block, and declared build. The second argument is your response file. Relative paths resolve from `application/api3/`.

```sh
npm --prefix application/api3 run judge:admission -- ../submission/evidence/api3-admission-context.json RESPONSE_FILE
```

Run the supplied valid and negative inputs:

```sh
npm --prefix application/api3 run judge:admission -- ../submission/evidence/api3-admission-context.json ../submission/evidence/nvd-admission-original.json
npm --prefix application/api3 run judge:admission -- ../submission/evidence/api3-admission-context.json ../submission/evidence/api3-admission-edited-deliberate-test.json
npm --prefix application/api3 run judge:admission -- ../submission/evidence/api3-admission-context.json ../submission/evidence/nvd-paid-final-original.json
npm --prefix application/api3 run judge:admission -- ../submission/evidence/api3-admission-context.json ../submission/evidence/api3-other-request-original.json
npm --prefix application/api3 run judge:admission -- ../submission/evidence/api3-admission-context.json ../submission/evidence/api3-wrong-key-deliberate-test.json
```

| Input                   | Result             |
| ----------------------- | ------------------ |
| Original valid response | SUCCEEDED          |
| Edited CVSS value       | NotSignedByAirnode |
| Original older response | InvalidOracle      |
| Another request         | NotSignedByAirnode |
| Another signing key     | NotSignedByAirnode |

The script passes exact candidate bytes to deployed code. It does not authenticate the response in place of the contract. RPC failures are inconclusive. Files named `deliberate-test` are negative-test inputs, not genuine source responses.

## Preserve the original five cases

The earlier deployment remains at [CommissioningPolicy](https://sepolia.basescan.org/address/0x98023c425670a9690ab362c00fbea1bc11dce2cb). Its original five cases and mined REJECTED decision remain unchanged. That rejection alone did not establish source dependence because its inspection prerequisite was false.

```sh
npm --prefix application/api3 run judge:submission
npm --prefix application/api3 run judge:candidate -- RESPONSE_FILE
```

The current source gate closes that gap without changing the failed inspection to PASS. [The evidence index](EVIDENCE.md) also links the actual camera packet, paid Cardano FAIL report, and positive seller receipt.
