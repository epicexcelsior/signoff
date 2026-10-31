import test from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, keccak256 } from "viem";
import { NVD_SIGNER, NVD_REQUEST_HASH } from "../src/index.mjs";
import {
  commissioningAbi,
  acceptanceHash,
  sourceResponseDigest,
  prepareOpenJob,
  prepareEnrollBuild,
  prepareRecordInspection,
  prepareFinalize,
  readAcceptance,
} from "../src/abi.mjs";

const hash = (n) => `0x${n.toString(16).padStart(64, "0")}`;
const config = {
  chainId: 31337,
  contract: "0x1111111111111111111111111111111111111111",
};
const jobId = hash(1);
const expected = {
  workOrderDigest: hash(2),
  buildManifestDigest: hash(3),
  inspectionDigest: hash(4),
  paymentEvidenceDigest: hash(5),
  sourceResponseDigest: hash(6),
};
function fixture() {
  const job = {
    ...expected,
    deadline: 1793363803n,
    maxCvssTenths: 70,
    inspectionRecorded: true,
    inspectionPassed: true,
    sellerReceived: true,
    decision: 2,
  };
  job.acceptanceHash = acceptanceHash({ ...config, jobId, job });
  const client = {
    getChainId: async () => config.chainId,
    getBytecode: async () => "0x1234",
    readContract: async ({ functionName }) =>
      ({ airnode: NVD_SIGNER, requestHash: NVD_REQUEST_HASH, getJob: job })[
        functionName
      ],
  };
  return { job, client, ...config, jobId, expected: { ...expected } };
}
test("all writes are unsigned and preserve original argument commitments", () => {
  const transactions = [
    prepareEnrollBuild(config, {
      manifestDigest: expected.buildManifestDigest,
      version: 1009000,
    }),
    prepareOpenJob(config, { jobId, ...expected, deadline: 1793363803 }),
    prepareRecordInspection(config, {
      jobId,
      ...expected,
      passed: false,
      sellerReceived: true,
    }),
    prepareFinalize(config, {
      jobId,
      response: {
        requestHash: NVD_REQUEST_HASH,
        timestamp: "1793360203",
        data: "{}",
        signature: `0x${"12".repeat(65)}`,
      },
    }),
  ];
  assert.deepEqual(
    transactions.map(
      (tx) =>
        decodeFunctionData({ abi: commissioningAbi, data: tx.data })
          .functionName,
    ),
    ["enrollBuild", "openJob", "recordInspection", "finalize"],
  );
  for (const tx of transactions) {
    assert.equal(tx.authorization, "UNSIGNED");
    assert.equal(tx.value, "0x0");
    assert.equal(tx.chainId, config.chainId);
    assert.equal(tx.to, config.contract);
  }
  assert.throws(() =>
    prepareOpenJob(config, { jobId: hash(0), ...expected, deadline: 1 }),
  );
});
test("reader accepts only matching terminal state and all source commitments", async () => {
  const f = fixture();
  assert.equal((await readAcceptance(f)).verdict, "PASS");
  f.job.decision = 3;
  f.job.acceptanceHash = acceptanceHash({ ...config, jobId, job: f.job });
  assert.equal((await readAcceptance(f)).verdict, "FAIL");
});
test("reader fails closed for each altered digest, chain, source, prerequisite and unavailable RPC", async () => {
  for (const field of Object.keys(expected)) {
    const f = fixture();
    f.expected[field] = hash(99);
    assert.equal((await readAcceptance(f)).verdict, "REVIEW");
  }
  const cases = [
    (f) => (f.client.getChainId = async () => 1),
    (f) => (f.client.getBytecode = async () => "0x"),
    (f) => (f.runtimeCodeHash = keccak256("0x5678")),
    (f) =>
      (f.client.readContract = async () => {
        throw new Error("Offline");
      }),
    (f) => (f.job.inspectionPassed = false),
    (f) => (f.job.sellerReceived = false),
    (f) => (f.job.decision = 1),
    (f) => (f.job.acceptanceHash = hash(88)),
    (f) => (f.expected.deadline = 1),
    (f) => (f.expected.maxCvssTenths = 1),
    (f) => (f.signer = "0x2222222222222222222222222222222222222222"),
    (f) => (f.requestHash = hash(77)),
  ];
  for (const change of cases) {
    const f = fixture();
    change(f);
    assert.equal((await readAcceptance(f)).verdict, "REVIEW");
  }
  assert.equal(
    (await readAcceptance({ ...fixture(), client: undefined })).verdict,
    "REVIEW",
  );
});
test("source commitment binds original signed bytes and distinct hash domains", () => {
  const response = {
    requestHash: NVD_REQUEST_HASH,
    timestamp: "1793360203",
    data: "{}",
    signature: `0x${"12".repeat(65)}`,
  };
  assert.notEqual(
    sourceResponseDigest(response),
    sourceResponseDigest({ ...response, data: "{ }" }),
  );
  const f = fixture();
  assert.notEqual(
    acceptanceHash({ ...config, jobId, job: f.job }),
    acceptanceHash({ ...config, chainId: 1, jobId, job: f.job }),
  );
  assert.notEqual(
    acceptanceHash({ ...config, jobId, job: f.job }),
    acceptanceHash({ ...config, jobId: hash(99), job: f.job }),
  );
});
