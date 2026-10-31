import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildMasumiLockDatum,
  encodeBlockchainIdentifier,
  addressCredentials,
  parseMasumiLockDatum,
} from "@x402/cardano";
import { Data } from "@evolution-sdk/evolution";
import { verifyEscrowOutput, verifyReportBytes } from "../src/chain-proof.js";
import { TEST_USDM } from "../src/payment.js";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const address =
  "addr_test1qzxudu6thv9fcxj95w20u4dlsesq22a2fk7wwea7sdq4cwzjepd5yxzwfe4uxx02shxr92jdqwpj2hzqvk0jtpfvqdns884a4m";
const contract =
  "addr_test1wzs4e6wc95hkwezlccjw9mdvq0r0rsgx6zk34avptga3ftgn37w4g";
const deadlines = {
  payByTime: "1000",
  submitResultTime: "2000",
  unlockTime: "3000",
  externalDisputeUnlockTime: "4000",
};
function fixture() {
  const input = {
    buyerAddress: address,
    sellerAddress: address,
    referenceKey: "aa",
    referenceSignature: "bb",
    sellerNonce: "cc".repeat(32),
    buyerNonce: "dd".repeat(10),
    agentIdentifier: "ee".repeat(60),
    collateralReturnLovelace: 0n,
    inputHash: "11".repeat(32),
    ...Object.fromEntries(
      Object.entries(deadlines).map(([k, v]) => [k, BigInt(v)]),
    ),
  };
  const datum = Data.toCBORHex(buildMasumiLockDatum(input));
  const identifier = encodeBlockchainIdentifier({
    ...input,
    contractAddress: contract,
  });
  const transaction = "22".repeat(32),
    block = "33".repeat(32);
  const expected = {
    smartContractAddress: contract,
    sellerVkey: addressCredentials(address).payment.hash,
    agentIdentifier: input.agentIdentifier,
    inputHash: input.inputHash,
    resultHash: "44".repeat(32),
    blockchainIdentifierSha256: digest(identifier),
    deadlines,
    records: { lock: { transaction, block, blockHeight: 100 } },
  };
  const bundle = {
    transaction: {
      hash: transaction,
      block,
      block_height: 100,
      valid_contract: true,
    },
    utxos: {
      hash: transaction,
      outputs: [
        {
          address: contract,
          output_index: 0,
          inline_datum: datum,
          amount: [{ unit: TEST_USDM, quantity: "1000000" }],
        },
      ],
    },
  };
  return { expected, bundle };
}
test("existing pinned Cardano decoder checks exact original datum and rejects changed evidence, token and duplicate outputs", () => {
  const { expected, bundle } = fixture();
  assert.ok(parseMasumiLockDatum(bundle.utxos.outputs[0].inline_datum));
  assert.equal(verifyEscrowOutput(bundle, expected, "lock").state, "0");
  assert.throws(
    () =>
      verifyEscrowOutput(
        bundle,
        { ...expected, inputHash: "55".repeat(32) },
        "lock",
      ),
    { code: "CHAIN_PROOF_MISMATCH" },
  );
  assert.throws(
    () =>
      verifyEscrowOutput(
        bundle,
        { ...expected, blockchainIdentifierSha256: "66".repeat(32) },
        "lock",
      ),
    { code: "CHAIN_PROOF_MISMATCH" },
  );
  const wrong = structuredClone(bundle);
  wrong.utxos.outputs[0].amount[0].quantity = "999999";
  assert.throws(() => verifyEscrowOutput(wrong, expected, "lock"));
  const duplicate = structuredClone(bundle);
  duplicate.utxos.outputs.push(duplicate.utxos.outputs[0]);
  assert.throws(() => verifyEscrowOutput(duplicate, expected, "lock"));
  const other = structuredClone(bundle);
  other.transaction.hash = "77".repeat(32);
  assert.throws(() => verifyEscrowOutput(other, expected, "lock"));
});
test("report verification hashes exact original transport and rejects even a trailing newline", () => {
  const request = {
    inspectionId: "original",
    workOrderHash: "0x" + "11".repeat(32),
    evidenceBundleHash: "0x" + "22".repeat(32),
    inputText: "Missing optical evidence",
    idempotencyKey: "original-intent",
  };
  const report = JSON.stringify({
    workOrderHash: request.workOrderHash,
    evidenceBundleHash: request.evidenceBundleHash,
    outcome: "REVIEW",
  });
  const exact = JSON.stringify({
    schema: "proof-of-ready-inspection-request-v1",
    inspectionId: request.inspectionId,
    workOrderHash: request.workOrderHash,
    evidenceBundleHash: request.evidenceBundleHash,
    inputText: request.inputText,
  });
  const expected = { inputHash: digest(exact), resultHash: digest(report) };
  assert.equal(
    verifyReportBytes(report, JSON.stringify(request), expected).outcome,
    "REVIEW",
  );
  assert.throws(() =>
    verifyReportBytes(report + "\n", JSON.stringify(request), expected),
  );
  assert.throws(() =>
    verifyReportBytes(
      report,
      JSON.stringify({ ...request, inputText: "Changed" }),
      expected,
    ),
  );
});
