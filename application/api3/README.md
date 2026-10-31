# API3 data access and policy

This package verifies the exact signed NVD projection, prepares unsigned contract calls, and supplies a bounded paid-fetch client. It uses Node.js 24 and pinned viem. It adds no wallet or network dependency beyond the existing package.

## Check locally

```sh
npm ci
npm run check
npm run format:check
npm test
```

`npm run test:contract` uses genuine Foundry `forge` and `anvil` executables selected by `FIELDPROOF_FOUNDRY_BIN`. It deploys only to a temporary local chain. Tests use disposable local signatures and mocked payment receipts. They do not prove paid API access or sponsor qualification.

## Inspect an unpaid quote

This command sends the pinned NVD request without wallet credentials or a payment header:

```sh
npm run access -- probe
```

To preserve the original quote, add an absolute private output path. Existing files are never overwritten:

```sh
npm run access -- probe /private/proof-ready/api3/nvd-probe.json
```

The live unpaid probe on October 30, 2026 returned HTTP 402. The approved `getCve` projection costs **0.01 aUSD**, or 10,000 atomic units. Payments use Base Sepolia, chain 84532. The pinned token is `0xbeA34973e5f67F18F656A2C6070C64326C791808`. The recipient is `0x1505FD562AC2Fb4307B85BC6c672FfeafB4d57A7`.

The EIP-712 domain is `AirnodeHub USD`, version `1`. The supported transfer method is EIP-3009. Changed amounts, recipients, assets, network, domain, timeout, endpoint or operation reject. The full request hash remains `0x3f0881fb062ac6b989c133e0b5651d19947e38aebe4d94750627fa612f447d15`.

`test/fixtures/nvd-payment-required.json` preserves the actual unpaid quote. It contains public terms, not a signed payment or paid source response.

## Owner prerequisites

1. Select one dedicated EVM test wallet.
2. Obtain Base Sepolia ETH for faucet minting and application transactions.
3. Mint test aUSD through the [official API3 faucet](https://api3dao.github.io/airnodehub-hackathon/faucet/).
4. Preserve the public wallet address and private credentials outside source.
5. Review the exact recipient, token, request and total payment budget before authorizing payment.

The facilitator pays the access-transfer gas. Application deployment/finalization and faucet minting have separate gas requirements. The approved mint, both genuine paid NVD requests, and CommissioningPolicy transactions confirmed on Base Sepolia. [The evidence manifest](../submission/evidence-manifest.json) records the original five-case block and mined REJECTED decision. The actual paid REVIEW used synthetic input. It does not authorize a physical installation.

Cardano escrow can outlast the five-minute API3 source freshness window. Fetch fresh CVE data near contract finalization. An earlier response can test authenticity without satisfying later freshness. A 0.02 aUSD total budget covers two 0.01 aUSD requests. It does not include application gas.

## Prepare private configuration

Set `PROOFREADY_API3_ACCESS_CONFIG` to an absolute private JSON file. Use this explanatory shape with your actual wallet and paths:

```json
{
  "schema": "proof-of-ready/api3-access-config/v1",
  "payer": "0x plus the dedicated test wallet address",
  "ledgerFile": "/private/proof-ready/api3/access.sqlite",
  "budgetAtomicUnits": "20000",
  "rpcUrl": "https://sepolia.base.org"
}
```

Copy `.env.example` to private local configuration only when needed. Keep `PROOFREADY_API3_PAYMENTS_AUTHORIZED=false` until the exact payment receives authorization. The grant controls signing, external-signature import and submission. Wallet balance checks and reconciliation only read chain state.

```sh
npm run access -- wallet
npm run access -- prepare stable-request-id /private/proof-ready/api3/nvd-probe.json
```

Preparation saves one nonce and unsigned typed-data plan in SQLite. Review it before signing. Its validity lasts five minutes. Prepare only after the wallet and funding are ready. Reusing the same request identifier returns the original plan. Another unresolved authorization blocks a replacement.

The ledger pins wallet, endpoint, source signer, payment terms and total budget. It uses immediate transactions, unique intent/nonce constraints, WAL and FULL synchronization. Prepared authorizations reserve budget permanently. A changed budget or wallet requires a separately reviewed ledger. Do not delete or reset unresolved records.

## Separately authorized payment

After targeted authorization, set the explicit grant in private configuration. Use either a dedicated private-key file or import an external wallet's signature.

`PROOFREADY_API3_PRIVATE_KEY_FILE` names an absolute private file containing the dedicated test key. The sign command reads it only after checking authorization. A private key never appears in command arguments or output.

```sh
npm run access -- sign ORIGINAL_ACCESS_ID
npm run access -- send ORIGINAL_ACCESS_ID
npm run access -- reconcile ORIGINAL_ACCESS_ID
```

For an external wallet, sign the original saved typed-data plan. Import only its exact signature:

```sh
npm run access -- import-signature ORIGINAL_ACCESS_ID /private/proof-ready/api3/original-signature
```

These commands are instructions for a later authorized operation. All three approved requests used the existing wallet and settled. Preserve the original ledger. The owner-approved 30,000-atomic-unit ceiling is consumed. Another paid request requires a separately authorized budget. Keep at least 0.001 ETH in reserve.

The client commits SIGNING before invoking a signer. It commits SUBMITTING before sending the paid HTTP request. Another connection or restart cannot repeat either claim. A lost signing reply requires the original signature. A lost paid response remains UNRESOLVED. No automatic new quote, nonce, signature or HTTP retry exists.

`send` verifies exact delivered source bytes with the native API3 verifier and original request hash. It records the source at its actual ingestion time. Payment remains separate. `reconcile` checks the pinned chain, exact aUSD transfer, payer, recipient, amount, original `AuthorizationUsed` nonce and confirmation depth. A facilitator header alone cannot establish settlement.

If the original transaction hash is absent from the saved header, provide an independently obtained candidate hash:

```sh
npm run access -- reconcile ORIGINAL_ACCESS_ID ORIGINAL_TRANSACTION_HASH
```

The candidate must match the original nonce and transfer. This command never resends a payment. PAID_UNDELIVERED means the transfer passed but no valid original source response exists. Keep that distinction visible.

## Export original source bytes

```sh
npm run access -- show ORIGINAL_ACCESS_ID
npm run access -- export-response ORIGINAL_ACCESS_ID /private/proof-ready/api3/original-signed-cve.json
```

Export preserves the original HTTP response text. The signed inner `data` string is never parsed and rewritten. Point the coordinator's private `contract.responseFile` at that original file. A verified source response alone does not establish installed-build provenance or a completed policy decision.

## Sources and limits

[Airnode HTTP payments](https://airnodehub-docs.api3.org/airnode/http-interface) specify the payment headers and exact signed bytes. [The EVM exact scheme](https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md) specifies EIP-3009 payloads. [ERC-3009](https://eips.ethereum.org/EIPS/eip-3009) specifies the authorization fields and nonce event. Sources and the live quote were checked on October 30, 2026.

The payment authorization binds token, payer, payee, amount, validity and nonce. It does not bind the NVD request body. The Airnode signature separately binds that exact request and response. The server, token implementation and configured RPC remain trust dependencies. One newer block is a confirmation policy, not finality proof. Local fixtures establish code contracts only.

## Prepare deployment without signing

Compile the reviewed contract first. Use the genuine Foundry executable, not this host's unrelated bare `forge` command:

```sh
cd ../contracts
/path/to/foundry/bin/forge build
```

Create private `judge-config.json` outside source with this shape:

```json
{
  "schema": "proof-of-ready/api3-judge-config/v1",
  "rpcUrl": "https://sepolia.base.org",
  "operator": "0x plus the existing dedicated test wallet address",
  "artifactFile": "/absolute/path/application/contracts/out/CommissioningPolicy.sol/CommissioningPolicy.json"
}
```

From this package, run:

```sh
npm run judge -- deploy-plan /private/api3/judge-config.json /private/api3/deployment-plan.json
```

The command reads chain state and estimates fees. It never reads a private key, signs, or broadcasts. The plan pins Base Sepolia, the existing NVD signer/request, and 300-second attestation/source ages. Its bytecode hash identifies the compiler output. It records the pending nonce, predicted address, gas estimate, buffered execution limit, L1 data estimate, operator-fee estimate, and wallet balance.

The L2 execution cap uses estimated EIP-1559 maximum fees and a 20 percent gas buffer. L1 data and operator fees remain estimates. They are not enforced transaction caps. Re-estimate before targeted owner approval. Preserve original approved bytes and the resulting transaction hash if deployment later runs.

## Check all five judge cases against deployed code

First obtain the original paid CVE response and actual inspection/seller receipt. Enroll the reviewed declared build, open the original job, and record the genuine inspection commitments through separately approved transactions. This tool cannot create those records or manufacture payment evidence.

Prepare these original responses in private files:

- A fresh authentic CVE response for the approved request.
- An authentic earlier CVE response older than 300 seconds.
- A fresh authentic response to another request. The free NVD `searchCpes` operation supplies this case without another data payment.
- A fresh wrong-key negative case with the valid data/timestamp and a disposable test-key signature. Label that case as deliberate test input. Never use the real wallet key.

Extend private configuration with the deployed `contract`, independently pinned `runtimeCodeHash`, original `jobId`, and absolute `validResponseFile`, `staleResponseFile`, `wrongRequestResponseFile`, and `wrongKeyResponseFile` paths. Keep the original signed inner `data` bytes unchanged.

```sh
npm run judge -- check /private/api3/judge-config.json /private/api3/judge-check.json
```

The checker pins every read and simulation to one block. It records that block number and hash. It checks the runtime code, source, freshness policy, enrolled build, and open job prerequisites.

The valid case must succeed. Edited, other-request, and wrong-key cases must return `NotSignedByAirnode`. The stale case must return `InvalidOracle`. Other errors fail the check. Fresh negative cases isolate signature rejection from expiry. A finalized job, expired job, or RPC failure cannot satisfy a rejection case.

The output states `mode:ETH_CALL_ONLY`. It preserves the source commitment and returns the unsigned valid finalization call. These deployed-code simulations do not send transactions or change contract state. Submit the approved valid call separately, preserve its transaction hash, and read the actual terminal decision. The saved submission artifacts now contain actual deployed checks and a mined rejection. Freshness claims apply at their original block only. Local tests inject verifier/client fixtures and never establish sponsor qualification.

## Replay judge checks and verify mined finalization

After finalization, set `blockNumber` in private configuration to the original check's decimal block number. Preserve all four original response files. Run `check` again with a new output path. Historical replay uses the original open job and original source freshness window. It does not alter current chain state. The RPC must support historical reads at that block.

Set `finalizedTransactionHash` to the actual finalization transaction hash. Keep `blockNumber` at the original check block. Run:

```sh
npm run judge -- finalized /private/api3/judge-config.json /private/api3/finalization-proof.json
```

This command repeats the five historical checks. It then checks the mined transaction and terminal state at the receipt block. The transaction must match the original unsigned call exactly. The proof checks the block hashes, runtime code, all job commitments, source digest, terminal decision, and acceptance hash.

A successful proof states `mode:MINED_TRANSACTION_AND_PINNED_STATE`. An `ETH_CALL_ONLY` report alone does not establish a state change. The Cardano payment remains an independently verified operator assertion. The contract does not establish Cardano consensus or physical truth.

## Replay the saved submission evidence

From this package, run:

```sh
npm run judge:submission
```

The command reads the reviewed public originals under `application/submission/evidence/`. It repeats all five checks at block 52,413,566 and verifies the mined transaction at block 52,413,614. It compares every result with the saved proof. It needs historical Base Sepolia RPC access. It reads no wallet or private credential and sends no transaction.

The native source-policy verdict is PASS for declared Apache NimBLE 1.9.0. The actual terminal decision is REJECTED because the useful paid report returns REVIEW. The original inspection input is synthetic. The declared reference version has no installed-build provenance. A separate evaluation deadline does not renew the original work order.

The two original source requests settled within the original 0.02 aUSD ceiling. A separately approved third call settled within the expanded 0.03 aUSD ceiling. No paid-access budget remains. Preserve the original ledger and all three responses. Replaying their historical block needs no fresh paid request.

## Test a response you supply

From this package, run:

```sh
npm run judge:candidate -- RESPONSE_FILE
```

The command reads one signed-response JSON file with string `airnode`, `requestHash`, `timestamp`, `data`, and `signature` fields. It preserves the exact decoded `data` string. It never parses and rewrites the signed inner JSON. Input is limited to 128 KiB. Duplicate fields, invalid UTF-8, invalid field types, and malformed ABI values reject before any RPC call.

The command pins the original deployed runtime, block hash, open job, paid-inspection commitments, deadline, severity policy, and declared reference version. It then sends your timestamp, exact UTF-8 data bytes, and signature through one `eth_call` to `finalize`. It does not authenticate your candidate before that call. An edited response, another request, or another signing key reaches the deployed verifier.

Try the saved valid, stale, other-request, and deliberate wrong-key inputs:

```sh
npm run judge:candidate -- ../submission/evidence/nvd-paid-final-original.json
npm run judge:candidate -- ../submission/evidence/nvd-paid-first-original.json
npm run judge:candidate -- ../submission/evidence/api3-other-request-original.json
npm run judge:candidate -- ../submission/evidence/api3-wrong-key-deliberate-test.json
```

For the edited case, copy the valid original into an unused file outside the checkout. Change a value or append a space inside its `data` string. Preserve `timestamp` and `signature`. Submit that copy with `judge:candidate`. The original files must stay unchanged.

The result reports `SUCCEEDED` or the actual `NotSignedByAirnode` or `InvalidOracle` error. A response rejection is an observed result, so that result exits successfully. Malformed input, RPC failure, a different block, a terminal job, or another contract error returns `INCONCLUSIVE` and a nonzero exit code. Those failures never count as evidence rejection.

The outer `airnode` and `requestHash` fields are transport metadata. The contract uses its own pinned signer and request. Changing only those labels leaves the actual contract arguments unchanged. The output states that distinction and hashes the exact data bytes and calldata.

Freshness uses the original block timestamp, October 30, 2026 at 23:56:22 UTC. A newly fetched response can be in the future at that block and return `InvalidOracle`. Use historical response copies to isolate signature tampering. This command needs historical Base Sepolia RPC access. It reads no key, buys no data, and changes no current state. A successful historical call does not establish physical acceptance.

## Source-gated software admission

The original deployment and five historical cases remain unchanged. Its failed inspection fixes the final rejection regardless of NVD data.

`SourceGatedCommissioningPolicy` adds a mandatory authenticated NVD check before opening a work order. The inherited unsigned opening route rejects. A vulnerable or unsupported declared build cannot open a job. An eligible declared build opens a job before any physical inspection exists. Later failed inspection still rejects installation acceptance.

This gate checks a declared reference build. It does not identify firmware installed on the ESP32. The correction passed local contract and Anvil checks. It deployed on Base Sepolia, and a fresh paid NVD response opened a work order before inspection. All four deployed tamper cases reject. The owner-approved 0.03 aUSD access ceiling is consumed.

The read-only judge command accepts a reviewed admission context and a copied response:

```sh
npm run judge:admission -- CONTEXT_FILE RESPONSE_FILE
```

It verifies the original chain, runtime, operator, source, build, unopened job, and block before testing the candidate. RPC failures remain inconclusive. It signs no transaction and spends no funds. Only a mined admission with original source evidence can close the live qualification gap.

Run `npm run judge:admission:submission` to replay the complete actual source-gated proof. [The public judge guide](../submission/release/JUDGE.md) lists the valid response and all four negative inputs. The original `judge:submission` replay remains unchanged.
