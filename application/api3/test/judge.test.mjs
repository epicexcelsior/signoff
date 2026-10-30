import test from "node:test";
import assert from "node:assert/strict";
import { keccak256, decodeFunctionData } from "viem";
import {
  prepareDeployment,
  estimateDeployment,
  judgeReadOnly,
  verifyFinalization,
} from "../src/judge.mjs";
import { commissioningAbi, acceptanceHash } from "../src/abi.mjs";
import { NVD_SIGNER, NVD_REQUEST_HASH } from "../src/index.mjs";
const account = "0x1111111111111111111111111111111111111111";
const code = "0x1234";
const digest = `0x${"ab".repeat(32)}`;
const artifact = { abi: commissioningAbi, bytecode: { object: code } };
test("deployment plan binds approved operator/source and includes separate Base L1/operator estimates", async () => {
  const plan = prepareDeployment({ artifact, operator: account });
  assert.equal(plan.authorization, "UNSIGNED");
  assert.equal(plan.airnode, NVD_SIGNER);
  assert.equal(plan.requestHash, NVD_REQUEST_HASH);
  const client = {
    getChainId: async () => 84532,
    estimateGas: async () => 100n,
    estimateFeesPerGas: async () => ({
      maxFeePerGas: 3n,
      maxPriorityFeePerGas: 1n,
    }),
    getTransactionCount: async () => 2,
    getBalance: async () => 10000n,
    getBlock: async () => ({ timestamp: 1000n, number: 100n, hash: digest }),
  };
  const estimated = await estimateDeployment({
    client,
    plan,
    l1Fee: async () => 5n,
    operatorFee: async () => 7n,
  });
  assert.equal(estimated.transaction.gas, "120");
  assert.equal(estimated.fees.l2ExecutionCapWei, "360");
  assert.equal(estimated.fees.estimatedTotalWithExecutionCapWei, "372");
  assert.equal(estimated.transaction.nonce, 2);
  await assert.rejects(
    estimateDeployment({
      client: { ...client, getChainId: async () => 1 },
      plan,
    }),
  );
  assert.throws(() =>
    prepareDeployment({
      artifact: { ...artifact, abi: [] },
      operator: account,
    }),
  );
});
function fixture() {
  const job = {
    decision: 1,
    inspectionRecorded: true,
    sellerReceived: true,
    inspectionPassed: true,
    deadline: 2000n,
    workOrderDigest: digest,
    buildManifestDigest: digest,
    inspectionDigest: digest,
    paymentEvidenceDigest: digest,
    maxCvssTenths: 70,
  };
  const signed = {
    airnode: NVD_SIGNER,
    requestHash: NVD_REQUEST_HASH,
    timestamp: "1000",
    data: "{}",
    signature: `0x${"ab".repeat(65)}`,
  };
  const client = {
    getChainId: async () => 84532,
    getBytecode: async () => code,
    getBlock: async () => ({ timestamp: 1000n, number: 100n, hash: digest }),
    readContract: async ({ functionName }) =>
      ({
        airnode: NVD_SIGNER,
        requestHash: NVD_REQUEST_HASH,
        maxAttestationAge: 300n,
        maxSourceAge: 300n,
        getJob: job,
        builds: [true, 1009000],
      })[functionName],
    simulateContract: async ({ args, blockNumber }) => {
      assert.equal(blockNumber, 100n);
      if (
        args[1] !== 1000n ||
        args[2] !== "0x7b7d" ||
        args[3] !== signed.signature
      ) {
        const error = new Error("fixture revert");
        error.name = "ContractFunctionRevertedError";
        error.data = {
          errorName: args[1] !== 1000n ? "InvalidOracle" : "NotSignedByAirnode",
        };
        throw error;
      }
    },
  };
  return {
    client,
    job,
    contract: account,
    runtimeCodeHash: keccak256(code),
    jobId: digest,
    validResponse: signed,
    staleResponse: { ...signed, timestamp: "699" },
    wrongRequestResponse: {
      ...signed,
      requestHash: `0x${"cd".repeat(32)}`,
      signature: `0x${"cd".repeat(65)}`,
    },
    wrongKeyResponse: {
      ...signed,
      airnode: account,
      signature: `0x${"ef".repeat(65)}`,
    },
    verifyResponse: async (_response, options) => {
      assert.equal(options.buildVersion, 1009000);
      assert.equal(options.sourceMaxAgeSeconds, 300);
      return { authenticated: true, verdict: "PASS" };
    },
    verifySignature: async () => {},
  };
}
test("judge reports all five deployed eth_call outcomes and returns unsigned finalization", async () => {
  const input = fixture();
  const result = await judgeReadOnly(input);
  assert.equal(result.mode, "ETH_CALL_ONLY");
  assert.equal(result.results.length, 5);
  assert.equal(
    result.results.every((x) => x.passed),
    true,
  );
  assert.equal(result.expectedTerminalDecision, "ACCEPTED");
  assert.equal(input.job.decision, 1);
  assert.equal(
    decodeFunctionData({
      abi: commissioningAbi,
      data: result.unsignedValidCall.data,
    }).functionName,
    "finalize",
  );
  assert.equal(result.unsignedValidCall.authorization, "UNSIGNED");
});
test("judge never counts RPC failure, missing prerequisites, wrong code or ineffective negative cases as rejection evidence", async () => {
  let f = fixture();
  f.client.simulateContract = async () => {
    throw Error("network unavailable");
  };
  await assert.rejects(judgeReadOnly(f), /network unavailable/);
  f = fixture();
  f.client.simulateContract = async () => {};
  await assert.rejects(judgeReadOnly(f), { code: "JUDGE_CASE_FAILED" });
  f = fixture();
  f.job.sellerReceived = false;
  await assert.rejects(judgeReadOnly(f), { code: "JUDGE_JOB_NOT_READY" });
  f = fixture();
  f.runtimeCodeHash = digest;
  await assert.rejects(judgeReadOnly(f), { code: "JUDGE_CODE_MISMATCH" });
  f = fixture();
  f.wrongKeyResponse.timestamp = "1001";
  await assert.rejects(judgeReadOnly(f), { code: "JUDGE_NEGATIVE_NOT_FRESH" });
  f = fixture();
  f.wrongRequestResponse = { ...f.validResponse };
  await assert.rejects(judgeReadOnly(f), {
    code: "JUDGE_OTHER_REQUEST_REQUIRED",
  });
});

test("judge rejects wrong-cause reverts and pins all five checks to the same historical block", async () => {
  let f = fixture();
  const simulate = f.client.simulateContract;
  f.client.simulateContract = async (args) => {
    try {
      return await simulate(args);
    } catch (error) {
      error.data.errorName = "InvalidState";
      throw error;
    }
  };
  await assert.rejects(judgeReadOnly(f), { code: "JUDGE_CASE_FAILED" });
  f = fixture();
  let reads = 0;
  f.blockNumber = 100n;
  f.client.getBlock = async ({ blockNumber }) => {
    assert.equal(blockNumber, 100n);
    reads++;
    return { number: 100n, timestamp: 1000n, hash: digest };
  };
  const read = f.client.readContract;
  f.client.readContract = async (args) => {
    assert.equal(args.blockNumber, 100n);
    return read(args);
  };
  const result = await judgeReadOnly(f);
  assert.equal(reads, 2);
  assert.equal(result.blockHash, digest);
  assert.equal(result.blockNumber, "100");
  assert.equal(result.historical, true);
  assert.deepEqual(
    result.results.map((x) => x.observedRevert),
    [
      null,
      "NotSignedByAirnode",
      "InvalidOracle",
      "NotSignedByAirnode",
      "NotSignedByAirnode",
    ],
  );
});
test("judge rejects reorganization and empty revert data", async () => {
  let f = fixture();
  let reads = 0;
  f.client.getBlock = async () => ({
    number: 100n,
    timestamp: 1000n,
    hash: reads++ ? `0x${"cd".repeat(32)}` : digest,
  });
  await assert.rejects(judgeReadOnly(f), { code: "JUDGE_BLOCK_CHANGED" });
  f = fixture();
  f.client.simulateContract = async () => {
    const error = new Error("unknown revert");
    error.name = "ExecutionRevertedError";
    throw error;
  };
  await assert.rejects(judgeReadOnly(f), /unknown revert/);
});

test("mined proof binds original calldata, block, source, commitments and terminal decision", async () => {
  const f = fixture();
  const check = await judgeReadOnly(f);
  const hash = `0x${"de".repeat(32)}`;
  const blockHash = `0x${"ee".repeat(32)}`;
  const job = {
    ...f.job,
    decision: 2,
    sourceResponseDigest: check.sourceResponseDigest,
  };
  job.acceptanceHash = acceptanceHash({
    chainId: 84532,
    contract: account,
    jobId: digest,
    job,
  });
  const receipt = {
    status: "success",
    transactionHash: hash,
    blockNumber: 101n,
    blockHash,
    gasUsed: 150000n,
  };
  const transaction = {
    hash,
    to: account,
    input: check.unsignedValidCall.data,
    value: 0n,
    blockHash,
  };
  const client = {
    ...f.client,
    getTransaction: async () => transaction,
    getTransactionReceipt: async () => receipt,
    getBlock: async ({ blockNumber }) => ({
      number: blockNumber,
      hash: blockNumber === 100n ? digest : blockHash,
    }),
    readContract: async ({ blockNumber }) => {
      assert.equal(blockNumber, 101n);
      return job;
    },
  };
  const result = await verifyFinalization({
    client,
    check,
    transactionHash: hash,
  });
  assert.equal(result.mode, "MINED_TRANSACTION_AND_PINNED_STATE");
  assert.equal(result.decision, "ACCEPTED");
  assert.equal(result.acceptanceHash, job.acceptanceHash);
  transaction.input += "00";
  await assert.rejects(
    verifyFinalization({ client, check, transactionHash: hash }),
    { code: "JUDGE_FINALIZATION_MISMATCH" },
  );
  transaction.input = check.unsignedValidCall.data;
  job.inspectionDigest = `0x${"cd".repeat(32)}`;
  await assert.rejects(
    verifyFinalization({ client, check, transactionHash: hash }),
    { code: "JUDGE_FINAL_STATE_MISMATCH" },
  );
  job.inspectionDigest = digest;
  job.sourceResponseDigest = digest;
  await assert.rejects(
    verifyFinalization({ client, check, transactionHash: hash }),
    { code: "JUDGE_FINAL_STATE_MISMATCH" },
  );
  receipt.status = "reverted";
  await assert.rejects(
    verifyFinalization({ client, check, transactionHash: hash }),
    { code: "JUDGE_FINALIZATION_MISMATCH" },
  );
});
