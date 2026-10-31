import { createHash } from "node:crypto";
import { encodeFunctionData, stringToHex } from "viem";
import { commissioningAbi } from "./abi.mjs";
import { encodeVersion, NVD_SIGNER, NVD_REQUEST_HASH } from "./index.mjs";
import { readJudgeContext, contractRevertName } from "./judge.mjs";
import { ACCESS_CHAIN_ID, fail, sameAddress } from "./access-policy.mjs";

export const MAX_CANDIDATE_FILE_BYTES = 128 * 1024;
// Allow a bounded over-limit response to reach the contract's own size guard.
export const MAX_CANDIDATE_DATA_BYTES = 64 * 1024;
const fields = ["airnode", "requestHash", "timestamp", "data", "signature"];
const digest = (value) => /^0x[0-9a-f]{64}$/i.test(value ?? "");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const malformed = () =>
  fail(
    "CANDIDATE_INPUT",
    "Use one bounded signed-response JSON object with string airnode, requestHash, timestamp, data, and signature fields.",
  );

export function validateCandidate(candidate) {
  if (
    !candidate ||
    Object.getPrototypeOf(candidate) !== Object.prototype ||
    Object.keys(candidate).length !== fields.length ||
    !fields.every(
      (key) =>
        Object.hasOwn(candidate, key) &&
        typeof candidate[key] === "string" &&
        candidate[key].isWellFormed(),
    ) ||
    !/^0x[0-9a-f]{40}$/i.test(candidate.airnode) ||
    !digest(candidate.requestHash) ||
    !/^(0|[1-9]\d{0,77})$/.test(candidate.timestamp) ||
    BigInt(candidate.timestamp) >= 1n << 256n ||
    Buffer.byteLength(candidate.data) > MAX_CANDIDATE_DATA_BYTES ||
    !/^0x(?:[0-9a-f]{2}){0,1024}$/i.test(candidate.signature)
  )
    malformed();
  return candidate;
}

export function parseCandidate(bytes) {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength > MAX_CANDIDATE_FILE_BYTES
  )
    malformed();
  let text, candidate;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    candidate = JSON.parse(text);
  } catch {
    malformed();
  }
  validateCandidate(candidate);
  // Values are strings, so only top-level key positions need duplicate checks.
  const keys = new Set();
  let key = true;
  for (const [token] of text.matchAll(/"(?:[^"\\]|\\.)*"|[{},:]/g)) {
    if (token === ",") key = true;
    else if (key && token.startsWith('"')) {
      const name = JSON.parse(token);
      if (keys.has(name)) malformed();
      keys.add(name);
      key = false;
    }
  }
  return candidate;
}

export function submissionCandidateSnapshot({ deployment, check, evaluation }) {
  const context = evaluation?.context;
  if (
    deployment?.chainId !== ACCESS_CHAIN_ID ||
    check?.chainId !== ACCESS_CHAIN_ID ||
    check?.schema !== "proof-of-ready/api3-judge-read/v1" ||
    check.mode !== "ETH_CALL_ONLY" ||
    !sameAddress(deployment.contract, check.contract) ||
    deployment.runtimeCodeHash !== check.runtimeCodeHash ||
    context?.jobId !== check.jobId ||
    context?.sellerReceiptVerified !== true ||
    ![
      "workOrderDigest",
      "buildManifestDigest",
      "inspectionDigest",
      "paymentEvidenceDigest",
    ].every(
      (field) =>
        digest(check.commitments?.[field]) &&
        context[field] === check.commitments[field],
    )
  )
    fail(
      "CANDIDATE_SNAPSHOT",
      "Use the matching original deployment, open-block check, and policy-evaluation context.",
    );
  return {
    chainId: ACCESS_CHAIN_ID,
    contract: deployment.contract,
    runtimeCodeHash: deployment.runtimeCodeHash,
    jobId: check.jobId,
    blockNumber: check.blockNumber,
    blockHash: check.blockHash,
    commitments: check.commitments,
    deadline: context.deadline,
    maxCvssTenths: context.maxCvssTenths,
    buildVersion: encodeVersion(context.manifest.version),
    inspectionPassed: context.inspectionPassed,
  };
}

export async function judgeCandidate({ client, snapshot, candidate }) {
  validateCandidate(candidate);
  if (
    snapshot?.chainId !== ACCESS_CHAIN_ID ||
    !/^\d+$/.test(snapshot.blockNumber ?? "") ||
    !digest(snapshot.blockHash) ||
    !digest(snapshot.jobId) ||
    !Number.isSafeInteger(snapshot.deadline) ||
    !Number.isInteger(snapshot.maxCvssTenths) ||
    !Number.isInteger(snapshot.buildVersion) ||
    typeof snapshot.inspectionPassed !== "boolean"
  )
    fail(
      "CANDIDATE_SNAPSHOT",
      "Use the original pinned open-block and job context.",
    );
  const context = await readJudgeContext({
    client,
    contract: snapshot.contract,
    runtimeCodeHash: snapshot.runtimeCodeHash,
    jobId: snapshot.jobId,
    blockNumber: BigInt(snapshot.blockNumber),
  });
  const { contract, block, pinnedBlock, job, build } = context;
  if (
    block.number !== BigInt(snapshot.blockNumber) ||
    block.hash !== snapshot.blockHash ||
    ![
      "workOrderDigest",
      "buildManifestDigest",
      "inspectionDigest",
      "paymentEvidenceDigest",
    ].every(
      (field) =>
        digest(snapshot.commitments?.[field]) &&
        job[field] === snapshot.commitments[field],
    ) ||
    job.deadline !== BigInt(snapshot.deadline) ||
    job.maxCvssTenths !== snapshot.maxCvssTenths ||
    job.inspectionPassed !== snapshot.inspectionPassed ||
    Number(build[1]) !== snapshot.buildVersion
  )
    fail(
      "CANDIDATE_CONTEXT_MISMATCH",
      "The original block, job commitments, or declared policy differs from the saved context.",
    );
  const args = [
    snapshot.jobId,
    BigInt(candidate.timestamp),
    stringToHex(candidate.data),
    candidate.signature,
  ];
  let observed = "SUCCEEDED",
    observedRevert = null;
  try {
    // Deliberately do not authenticate or normalize candidate evidence first.
    await client.simulateContract({
      address: contract,
      abi: commissioningAbi,
      functionName: "finalize",
      ...pinnedBlock,
      args,
    });
  } catch (error) {
    observedRevert = contractRevertName(error);
    if (!observedRevert) throw error;
    if (!["NotSignedByAirnode", "InvalidOracle"].includes(observedRevert))
      fail(
        "CANDIDATE_UNRELATED_REVERT",
        `The contract returned ${observedRevert}. This is not an evidence rejection.`,
      );
    observed = "REVERTED";
  }
  if ((await client.getBlock(pinnedBlock)).hash !== block.hash)
    fail(
      "JUDGE_BLOCK_CHANGED",
      "The pinned block changed during the candidate check. No evidence result is valid.",
    );
  return {
    schema: "proof-of-ready/api3-candidate-check/v1",
    chainId: ACCESS_CHAIN_ID,
    contract,
    jobId: snapshot.jobId,
    blockNumber: snapshot.blockNumber,
    blockHash: block.hash,
    blockTimestamp: block.timestamp.toString(),
    runtimeCodeHash: snapshot.runtimeCodeHash,
    mode: "HISTORICAL_ETH_CALL_ONLY",
    networkWrites: false,
    observed,
    observedRevert,
    evidenceRejected: observed === "REVERTED",
    dataSha256: hash(Buffer.from(candidate.data)),
    calldataSha256: hash(
      Buffer.from(
        encodeFunctionData({
          abi: commissioningAbi,
          functionName: "finalize",
          args,
        }).slice(2),
        "hex",
      ),
    ),
    contractPins: { airnode: NVD_SIGNER, requestHash: NVD_REQUEST_HASH },
    advertisedMetadata: {
      airnode: candidate.airnode,
      requestHash: candidate.requestHash,
      passedAsContractArguments: false,
    },
    limitation:
      "One candidate was simulated at the original OPEN block. Freshness uses that historical timestamp. No current state changed. Advertised JSON metadata does not replace the contract's pinned signer or request. No physical acceptance follows.",
  };
}
