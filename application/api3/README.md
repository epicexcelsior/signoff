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

The facilitator pays the access-transfer gas. Application deployment/finalization and faucet minting have separate gas requirements. The approved mint, first genuine paid NVD request, and CommissioningPolicy deployment now confirmed on Base Sepolia. [The evidence manifest](../submission/evidence-manifest.json) records their actual transactions. Five deployed judge cases remain pending genuine paid-inspection commitments.

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

These commands are instructions for a later authorized operation. The first approved request used the existing live test wallet and settled. Preserve its original ledger. Remaining calls require the budget and reserve checks.

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

The checker pins actual chain, runtime bytecode, source, freshness policy, and an open original job with recorded inspection and seller-receipt assertion. It authenticates the source inputs before testing. It checks valid success plus edited, stale, other-request, and wrong-key rejection through `eth_call`. Fresh negative cases isolate signature/request failures from expiry. RPC failures never count as successful rejection.

The output states `mode:ETH_CALL_ONLY`. It preserves the source commitment and returns the unsigned valid finalization call. These deployed-code simulations do not send transactions or change contract state. Submit the approved valid call separately, preserve its transaction hash, and read the actual terminal decision. No judge result exists until the command runs against the genuine prepared deployment. Local tests inject verifier/client fixtures and never establish sponsor qualification.
