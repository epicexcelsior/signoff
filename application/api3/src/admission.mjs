import { createHash } from "node:crypto";
import {
  encodeDeployData,
  encodeFunctionData,
  getAddress,
  keccak256,
  stringToHex,
} from "viem";
import abi from "./admission-abi.json" with { type: "json" };
import { NVD_SIGNER, NVD_REQUEST_HASH } from "./index.mjs";
import { sourceResponseDigest } from "./abi.mjs";
import { validateCandidate } from "./candidate.mjs";
import { contractRevertName } from "./judge.mjs";

export const admissionAbi = abi;
const digest = (v) => /^0x[0-9a-f]{64}$/i.test(v ?? "");
const hash = (v) => createHash("sha256").update(v).digest("hex");

export function prepareAdmissionDeployment({ artifact, operator }) {
  if (
    JSON.stringify(artifact?.abi) !== JSON.stringify(abi) ||
    !/^0x[0-9a-f]+$/i.test(artifact?.bytecode?.object ?? "")
  )
    throw new Error(
      "Build the reviewed SourceGatedCommissioningPolicy artifact.",
    );
  operator = getAddress(operator);
  return {
    schema: "proof-of-ready/api3-admission-deployment/v1",
    authorization: "UNSIGNED",
    chainId: 84532,
    operator,
    airnode: NVD_SIGNER,
    requestHash: NVD_REQUEST_HASH,
    maxAttestationAge: 300,
    maxSourceAge: 300,
    bytecodeHash: keccak256(artifact.bytecode.object),
    transaction: {
      from: operator,
      data: encodeDeployData({
        abi,
        bytecode: artifact.bytecode.object,
        args: [operator, NVD_SIGNER, NVD_REQUEST_HASH],
      }),
      value: "0x0",
    },
  };
}

export function prepareAdmissionCall(snapshot, candidate) {
  validateCandidate(candidate);
  if (
    snapshot?.chainId !== 84532 ||
    !digest(snapshot.jobId) ||
    !digest(snapshot.spec?.workOrderDigest) ||
    !digest(snapshot.spec?.buildManifestDigest) ||
    !Number.isSafeInteger(snapshot.spec?.deadline) ||
    snapshot.spec.deadline < 1 ||
    !Number.isInteger(snapshot.spec?.maxCvssTenths) ||
    snapshot.spec.maxCvssTenths < 0 ||
    snapshot.spec.maxCvssTenths > 100
  )
    throw new Error("Use the pinned source-gated work-order and build policy.");
  return {
    authorization: "UNSIGNED",
    chainId: 84532,
    to: getAddress(snapshot.contract),
    value: "0x0",
    data: encodeFunctionData({
      abi,
      functionName: "openJobWithSource",
      args: [
        snapshot.jobId,
        { ...snapshot.spec, deadline: BigInt(snapshot.spec.deadline) },
        BigInt(candidate.timestamp),
        stringToHex(candidate.data),
        candidate.signature,
      ],
    }),
  };
}

export async function judgeAdmissionCandidate({ client, snapshot, candidate }) {
  const plan = prepareAdmissionCall(snapshot, candidate);
  if (
    !digest(snapshot.runtimeCodeHash) ||
    !digest(snapshot.blockHash) ||
    !/^[0-9]+$/.test(snapshot.blockNumber ?? "") ||
    !Number.isInteger(snapshot.buildVersion) ||
    (await client.getChainId()) !== 84532
  )
    throw new Error("Use the original Base Sepolia admission context.");
  const pinned = { blockNumber: BigInt(snapshot.blockNumber) };
  const block = await client.getBlock(pinned);
  const code = await client.getBytecode({ address: plan.to, ...pinned });
  if (
    block.hash !== snapshot.blockHash ||
    !code ||
    keccak256(code) !== snapshot.runtimeCodeHash
  )
    throw new Error("The original admission block or deployed code differs.");
  const read = (functionName, args = []) =>
    client.readContract({
      address: plan.to,
      abi,
      functionName,
      args,
      ...pinned,
    });
  const [
    operator,
    signer,
    request,
    attestationAge,
    sourceAge,
    build,
    job,
    admission,
  ] = await Promise.all([
    read("operator"),
    read("airnode"),
    read("requestHash"),
    read("maxAttestationAge"),
    read("maxSourceAge"),
    read("builds", [snapshot.spec.buildManifestDigest]),
    read("getJob", [snapshot.jobId]),
    read("admissions", [snapshot.jobId]),
  ]);
  if (
    getAddress(operator) !== getAddress(snapshot.operator) ||
    getAddress(signer) !== getAddress(NVD_SIGNER) ||
    request !== NVD_REQUEST_HASH ||
    attestationAge !== 300n ||
    sourceAge !== 300n ||
    !build[0] ||
    Number(build[1]) !== snapshot.buildVersion ||
    Number(job.decision) !== 0 ||
    admission[0] !== `0x${"00".repeat(32)}` ||
    BigInt(snapshot.spec.deadline) <= block.timestamp
  )
    throw new Error(
      "The saved operator, source, build, deadline, or unopened job differs.",
    );
  let observed = "SUCCEEDED",
    observedRevert = null;
  try {
    await client.simulateContract({
      address: plan.to,
      abi,
      account: operator,
      functionName: "openJobWithSource",
      args: [
        snapshot.jobId,
        { ...snapshot.spec, deadline: BigInt(snapshot.spec.deadline) },
        BigInt(candidate.timestamp),
        stringToHex(candidate.data),
        candidate.signature,
      ],
      ...pinned,
    });
  } catch (error) {
    observedRevert = contractRevertName(error);
    if (
      !["NotSignedByAirnode", "InvalidOracle", "SoftwareNotEligible"].includes(
        observedRevert,
      )
    )
      throw error;
    observed = "REVERTED";
  }
  if ((await client.getBlock(pinned)).hash !== block.hash)
    throw new Error("The admission block changed during verification.");
  return {
    schema: "proof-of-ready/api3-admission-candidate/v1",
    chainId: 84532,
    contract: plan.to,
    jobId: snapshot.jobId,
    blockNumber: snapshot.blockNumber,
    blockHash: snapshot.blockHash,
    blockTimestamp: String(block.timestamp),
    runtimeCodeHash: snapshot.runtimeCodeHash,
    observed,
    observedRevert,
    networkWrites: false,
    mode: "HISTORICAL_ETH_CALL_ONLY",
    dataSha256: hash(Buffer.from(candidate.data)),
    calldataSha256: hash(Buffer.from(plan.data.slice(2), "hex")),
    scope:
      "Software admission before inspection. Declared build only. No physical acceptance or current freshness claim.",
  };
}

export async function verifyAdmission({
  client,
  snapshot,
  candidate,
  transactionHash,
}) {
  const plan = prepareAdmissionCall(snapshot, candidate);
  if (!digest(transactionHash) || (await client.getChainId()) !== 84532)
    throw new Error("Use the original Base Sepolia admission transaction.");
  if (
    (await judgeAdmissionCandidate({ client, snapshot, candidate }))
      .observed !== "SUCCEEDED"
  )
    throw new Error(
      "The original source does not pass the pinned pre-admission check.",
    );
  const [receipt, transaction] = await Promise.all([
    client.getTransactionReceipt({ hash: transactionHash }),
    client.getTransaction({ hash: transactionHash }),
  ]);
  if (
    receipt.status !== "success" ||
    receipt.transactionHash !== transactionHash ||
    transaction.blockHash !== receipt.blockHash ||
    transaction.value !== 0n ||
    receipt.blockNumber <= BigInt(snapshot.blockNumber) ||
    getAddress(transaction.to) !== plan.to ||
    getAddress(transaction.from) !== getAddress(snapshot.operator) ||
    transaction.input !== plan.data
  )
    throw new Error(
      "The mined admission does not match the original signed-source call.",
    );
  const pinned = { blockNumber: receipt.blockNumber };
  const [block, job, admission, code] = await Promise.all([
    client.getBlock(pinned),
    client.readContract({
      address: plan.to,
      abi,
      functionName: "getJob",
      args: [snapshot.jobId],
      ...pinned,
    }),
    client.readContract({
      address: plan.to,
      abi,
      functionName: "admissions",
      args: [snapshot.jobId],
      ...pinned,
    }),
    client.getBytecode({ address: plan.to, ...pinned }),
  ]);
  if (
    block.hash !== receipt.blockHash ||
    !code ||
    keccak256(code) !== snapshot.runtimeCodeHash ||
    Number(job.decision) !== 1 ||
    job.inspectionRecorded ||
    job.workOrderDigest !== snapshot.spec.workOrderDigest ||
    job.buildManifestDigest !== snapshot.spec.buildManifestDigest ||
    job.deadline !== BigInt(snapshot.spec.deadline) ||
    job.maxCvssTenths !== snapshot.spec.maxCvssTenths ||
    admission[0] !== sourceResponseDigest(candidate) ||
    admission[1] !== BigInt(candidate.timestamp)
  )
    throw new Error(
      "The mined admission state differs from the approved software policy.",
    );
  return {
    schema: "proof-of-ready/api3-source-dependent-admission/v1",
    chainId: 84532,
    contract: plan.to,
    jobId: snapshot.jobId,
    transactionHash,
    blockNumber: String(receipt.blockNumber),
    blockHash: receipt.blockHash,
    decision: "SOFTWARE_ADMITTED",
    jobDecision: "OPEN",
    inspectionRecorded: false,
    sourceDependentAction: true,
    sourceResponseDigest: admission[0],
    signedAt: String(admission[1]),
    gasUsed: String(receipt.gasUsed),
    networkWrites: false,
    scope:
      "Authenticated NVD data authorized opening a work order before inspection. The build is declared, not measured on the ESP32. This is not physical installation acceptance.",
  };
}
