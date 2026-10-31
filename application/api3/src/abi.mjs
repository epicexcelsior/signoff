import {
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  keccak256,
  sha256,
  stringToHex,
} from "viem";
import abi from "./commissioning-abi.json" with { type: "json" };
import { NVD_SIGNER, NVD_REQUEST_HASH } from "./index.mjs";

export const commissioningAbi = abi;
export const DECISIONS = Object.freeze([
  "MISSING",
  "OPEN",
  "ACCEPTED",
  "REJECTED",
  "REVIEW",
]);
const commitmentFields = [
  "workOrderDigest",
  "buildManifestDigest",
  "inspectionDigest",
  "paymentEvidenceDigest",
  "sourceResponseDigest",
];
const digest = (value) =>
  typeof value === "string" &&
  /^0x[0-9a-f]{64}$/.test(value) &&
  !/^0x0{64}$/.test(value);

export function sourceResponseDigest(response) {
  return sha256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "bytes" },
        { type: "bytes" },
      ],
      [
        response.requestHash,
        BigInt(response.timestamp),
        stringToHex(response.data),
        response.signature,
      ],
    ),
  );
}

export function acceptanceHash({ chainId, contract, jobId, job }) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
        ...commitmentFields.map(() => ({ type: "bytes32" })),
        { type: "uint8" },
      ],
      [
        BigInt(chainId),
        getAddress(contract),
        jobId,
        ...commitmentFields.map((field) => job[field]),
        Number(job.decision),
      ],
    ),
  );
}

export function prepareCall({ chainId, contract }, functionName, args) {
  if (!Number.isSafeInteger(chainId) || chainId < 1)
    throw new Error("A pinned chain ID is required");
  return {
    chainId,
    to: getAddress(contract),
    data: encodeFunctionData({ abi, functionName, args }),
    value: "0x0",
    authorization: "UNSIGNED",
  };
}

export function prepareEnrollBuild(config, { manifestDigest, version }) {
  if (!digest(manifestDigest)) throw new Error("Invalid build manifest digest");
  return prepareCall(config, "enrollBuild", [manifestDigest, version]);
}
export function prepareOpenJob(
  config,
  { jobId, workOrderDigest, buildManifestDigest, deadline, maxCvssTenths = 70 },
) {
  if (![jobId, workOrderDigest, buildManifestDigest].every(digest))
    throw new Error("Invalid job commitments");
  return prepareCall(config, "openJob", [
    jobId,
    {
      workOrderDigest,
      buildManifestDigest,
      deadline: BigInt(deadline),
      maxCvssTenths,
    },
  ]);
}
export function prepareRecordInspection(
  config,
  { jobId, inspectionDigest, paymentEvidenceDigest, passed, sellerReceived },
) {
  if (
    ![jobId, inspectionDigest, paymentEvidenceDigest].every(digest) ||
    typeof passed !== "boolean" ||
    typeof sellerReceived !== "boolean"
  )
    throw new Error("Invalid inspection commitments");
  return prepareCall(config, "recordInspection", [
    jobId,
    inspectionDigest,
    paymentEvidenceDigest,
    passed,
    sellerReceived,
  ]);
}
export function prepareFinalize(config, { jobId, response }) {
  if (!digest(jobId) || response.requestHash !== NVD_REQUEST_HASH)
    throw new Error("Invalid finalization request");
  return prepareCall(config, "finalize", [
    jobId,
    BigInt(response.timestamp),
    stringToHex(response.data),
    response.signature,
  ]);
}

// The caller supplies the trusted server-side configuration, never values from
// an untrusted evidence packet. RPC errors produce REVIEW without cached PASS.
export async function readAcceptance({
  client,
  chainId,
  contract,
  jobId,
  expected,
  signer = NVD_SIGNER,
  requestHash = NVD_REQUEST_HASH,
  runtimeCodeHash,
}) {
  const review = (reason) => ({
    verdict: "REVIEW",
    reason,
    source: "contract-read",
  });
  if (
    !client ||
    !digest(jobId) ||
    !expected ||
    !commitmentFields.every((field) => digest(expected[field]))
  )
    return review("Missing pinned contract configuration or commitments");
  try {
    if ((await client.getChainId()) !== chainId)
      return review("Wrong contract chain");
    const address = getAddress(contract);
    const code = await client.getBytecode({ address });
    if (
      !code ||
      code === "0x" ||
      (runtimeCodeHash && keccak256(code) !== runtimeCodeHash)
    )
      return review("Missing or unexpected contract code");
    const read = (functionName, args = []) =>
      client.readContract({ address, abi, functionName, args });
    const [actualSigner, actualRequestHash, job] = await Promise.all([
      read("airnode"),
      read("requestHash"),
      read("getJob", [jobId]),
    ]);
    if (
      getAddress(actualSigner) !== getAddress(signer) ||
      actualRequestHash !== requestHash
    )
      return review("Wrong contract oracle configuration");
    if (!commitmentFields.every((field) => job[field] === expected[field]))
      return review("Contract commitments do not match the evidence");
    if (
      expected.deadline !== undefined &&
      BigInt(expected.deadline) !== job.deadline
    )
      return review("Wrong contract job deadline");
    if (
      expected.maxCvssTenths !== undefined &&
      expected.maxCvssTenths !== job.maxCvssTenths
    )
      return review("Wrong contract severity policy");
    if (![2, 3, 4].includes(Number(job.decision)))
      return review("Contract decision is not terminal");
    if (
      !job.inspectionRecorded ||
      !job.sellerReceived ||
      (Number(job.decision) === 2 && !job.inspectionPassed)
    )
      return review("Contract inspection prerequisite is incomplete");
    const commitment = acceptanceHash({
      chainId,
      contract: address,
      jobId,
      job,
    });
    if (
      commitment !== job.acceptanceHash ||
      (expected.acceptanceHash && expected.acceptanceHash !== commitment)
    )
      return review("Wrong contract acceptance commitment");
    return {
      verdict:
        Number(job.decision) === 2
          ? "PASS"
          : Number(job.decision) === 3
            ? "FAIL"
            : "REVIEW",
      decision: DECISIONS[Number(job.decision)],
      reason: "Pinned contract state matches the evidence commitments",
      source: "contract-read",
      chainId,
      contract: address,
      jobId,
      acceptanceHash: commitment,
      job,
    };
  } catch {
    return review("Contract read failed");
  }
}
