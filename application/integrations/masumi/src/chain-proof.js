import { createHash } from "node:crypto";
import {
  parseMasumiLockDatum,
  encodeBlockchainIdentifier,
} from "@x402/cardano";
import { TEST_USDM } from "./payment.js";
import { IntegrationError } from "./errors.js";
const digest = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const fail = (message) => {
  throw new IntegrationError("CHAIN_PROOF_MISMATCH", message);
};
export function verifyEscrowOutput(bundle, expected, stage) {
  if (!["lock", "result"].includes(stage))
    fail("Select the original lock or result transaction.");
  const record = expected.records[stage];
  if (
    bundle.transaction?.hash !== record.transaction ||
    bundle.transaction?.block !== record.block ||
    bundle.transaction?.block_height !== record.blockHeight ||
    bundle.transaction?.valid_contract !== true ||
    bundle.utxos?.hash !== record.transaction ||
    !Array.isArray(bundle.utxos.outputs)
  )
    fail(
      "The chain transaction differs from the original recorded transaction.",
    );
  const matches = [];
  for (const output of bundle.utxos.outputs) {
    if (
      output.address !== expected.smartContractAddress ||
      !output.inline_datum
    )
      continue;
    const datum = parseMasumiLockDatum(output.inline_datum);
    if (!datum) continue;
    const identifier = encodeBlockchainIdentifier({
      sellerNonce: datum.sellerNonce,
      agentIdentifier: datum.agentIdentifier,
      buyerNonce: datum.buyerNonce,
      referenceSignature: datum.referenceSignature,
      referenceKey: datum.referenceKey,
      contractAddress: expected.smartContractAddress,
    });
    if (digest(identifier) !== expected.blockchainIdentifierSha256) continue;
    const fieldsMatch =
      datum.seller.payment.hash === expected.sellerVkey &&
      !datum.seller.payment.isScript &&
      datum.inputHash === expected.inputHash &&
      datum.resultHash === (stage === "result" ? expected.resultHash : "") &&
      datum.agentIdentifier === expected.agentIdentifier &&
      datum.state === (stage === "result" ? 1n : 0n) &&
      [
        "payByTime",
        "submitResultTime",
        "unlockTime",
        "externalDisputeUnlockTime",
      ].every((field) => datum[field].toString() === expected.deadlines[field]);
    const token = output.amount?.filter((a) => a.unit === TEST_USDM);
    if (!fieldsMatch || token?.length !== 1 || token[0].quantity !== "1000000")
      fail(
        "The escrow datum or quoted token amount differs from the original inspection.",
      );
    matches.push({
      transaction: record.transaction,
      block: record.block,
      blockHeight: record.blockHeight,
      outputIndex: output.output_index,
      state: datum.state.toString(),
      sellerMatches: true,
      inputMatches: true,
      resultMatches: true,
      identifierMatches: true,
      amountAtomicUnits: token[0].quantity,
      unit: TEST_USDM,
    });
  }
  if (matches.length !== 1)
    fail("Exactly one original escrow output must match.");
  return matches[0];
}
export function verifyReportBytes(reportText, requestText, expected) {
  const report = JSON.parse(reportText),
    request = JSON.parse(requestText);
  const input = JSON.stringify({
    schema: "proof-of-ready-inspection-request-v1",
    inspectionId: request.inspectionId,
    workOrderHash: request.workOrderHash,
    evidenceBundleHash: request.evidenceBundleHash,
    inputText: request.inputText,
  });
  if (
    digest(reportText) !== expected.resultHash ||
    digest(input) !== expected.inputHash ||
    report.workOrderHash !== request.workOrderHash ||
    report.evidenceBundleHash !== request.evidenceBundleHash
  )
    fail(
      "The original report or request bytes do not match the on-chain commitments.",
    );
  return {
    exactInputSha256: expected.inputHash,
    exactResultSha256: expected.resultHash,
    workOrderHash: report.workOrderHash,
    evidenceBundleHash: report.evidenceBundleHash,
    outcome: report.outcome,
  };
}
