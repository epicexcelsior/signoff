import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, stringToHex } from "viem";
import {
  MAX_CANDIDATE_DATA_BYTES,
  MAX_CANDIDATE_FILE_BYTES,
  parseCandidate,
  submissionCandidateSnapshot,
  judgeCandidate,
} from "../src/candidate.mjs";
import { NVD_SIGNER, NVD_REQUEST_HASH } from "../src/index.mjs";

const code = "0x1234",
  hash = `0x${"ab".repeat(32)}`;
const original = (name) =>
  JSON.parse(
    readFileSync(new URL(`../../submission/evidence/${name}`, import.meta.url)),
  );
const realSnapshot = () =>
  submissionCandidateSnapshot({
    deployment: original("deployment.json"),
    check: original("api3-five-deployed-cases.json"),
    evaluation: original("api3-policy-evaluation.json"),
  });
const response = () => ({
  airnode: NVD_SIGNER,
  requestHash: NVD_REQUEST_HASH,
  timestamp: "1000",
  data: ' { "value": 1 }\n',
  signature: `0x${"ab".repeat(65)}`,
});
function fixture() {
  const snapshot = {
    ...realSnapshot(),
    contract: "0x1111111111111111111111111111111111111111",
    runtimeCodeHash: keccak256(code),
    blockNumber: "100",
    blockHash: hash,
    deadline: 2000,
  };
  const job = {
    ...snapshot.commitments,
    deadline: 2000n,
    maxCvssTenths: snapshot.maxCvssTenths,
    inspectionPassed: snapshot.inspectionPassed,
    inspectionRecorded: true,
    sellerReceived: true,
    decision: 1,
  };
  const calls = [];
  const client = {
    getChainId: async () => 84532,
    getBlock: async ({ blockNumber }) => {
      assert.equal(blockNumber, 100n);
      return { number: 100n, hash, timestamp: 1000n };
    },
    getBytecode: async ({ blockNumber }) => {
      assert.equal(blockNumber, 100n);
      return code;
    },
    readContract: async ({ functionName, blockNumber }) => {
      assert.equal(blockNumber, 100n);
      return {
        airnode: NVD_SIGNER,
        requestHash: NVD_REQUEST_HASH,
        maxAttestationAge: 300n,
        maxSourceAge: 300n,
        getJob: job,
        builds: [true, 1009000],
      }[functionName];
    },
    simulateContract: async (args) => {
      calls.push(args);
    },
  };
  return { client, snapshot, candidate: response(), calls, job };
}
const revert = (name) => {
  const error = new Error("test contract revert");
  error.name = "ContractFunctionRevertedError";
  error.data = { errorName: name };
  return error;
};

test("candidate parser preserves exact inner bytes and rejects malformed or ambiguous envelopes", () => {
  const candidate = response();
  assert.equal(
    parseCandidate(Buffer.from(JSON.stringify(candidate))).data,
    candidate.data,
  );
  for (const value of [
    null,
    [],
    {},
    { ...candidate, timestamp: 1000 },
    { ...candidate, timestamp: "01" },
    { ...candidate, timestamp: (1n << 256n).toString() },
    { ...candidate, data: "\ud800" },
    { ...candidate, requestHash: "0x00" },
    { ...candidate, signature: "0xa" },
    { ...candidate, signature: `0x${"ab".repeat(1025)}` },
    { ...candidate, extra: true },
    { ...candidate, data: "a".repeat(MAX_CANDIDATE_DATA_BYTES + 1) },
  ]) {
    assert.throws(() => parseCandidate(Buffer.from(JSON.stringify(value))), {
      code: "CANDIDATE_INPUT",
    });
  }
  const duplicate = JSON.stringify(candidate).replace(
    "{",
    '{"data":"replacement",',
  );
  assert.throws(() => parseCandidate(Buffer.from(duplicate)), {
    code: "CANDIDATE_INPUT",
  });
  const escapedDuplicate = JSON.stringify(candidate).replace(
    "{",
    '{"d\\u0061ta":"replacement",',
  );
  assert.throws(() => parseCandidate(Buffer.from(escapedDuplicate)), {
    code: "CANDIDATE_INPUT",
  });
  for (const bytes of [
    Buffer.from("{"),
    Buffer.from([0xff]),
    Buffer.alloc(MAX_CANDIDATE_FILE_BYTES + 1),
  ])
    assert.throws(() => parseCandidate(bytes), { code: "CANDIDATE_INPUT" });
});

test("candidate simulation passes changed bytes and metadata to the deployed call without pre-authentication", async () => {
  const f = fixture();
  f.candidate.airnode = "0x2222222222222222222222222222222222222222";
  f.candidate.requestHash = `0x${"cd".repeat(32)}`;
  const result = await judgeCandidate(f);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].blockNumber, 100n);
  assert.deepEqual(f.calls[0].args, [
    f.snapshot.jobId,
    1000n,
    stringToHex(f.candidate.data),
    f.candidate.signature,
  ]);
  assert.equal(result.observed, "SUCCEEDED");
  assert.equal(result.evidenceRejected, false);
  assert.equal(result.networkWrites, false);
  assert.equal(result.advertisedMetadata.passedAsContractArguments, false);
  assert.equal(result.contractPins.requestHash, NVD_REQUEST_HASH);
});

test("candidate records only intended evidence reverts after one actual simulation", async () => {
  for (const name of ["NotSignedByAirnode", "InvalidOracle"]) {
    const f = fixture();
    f.client.simulateContract = async (args) => {
      f.calls.push(args);
      throw revert(name);
    };
    const result = await judgeCandidate(f);
    assert.equal(f.calls.length, 1);
    assert.equal(result.observed, "REVERTED");
    assert.equal(result.observedRevert, name);
    assert.equal(result.evidenceRejected, true);
  }
  const f = fixture();
  f.candidate.timestamp = "0";
  f.candidate.signature = "0x";
  f.candidate.data = "a".repeat(32769);
  await judgeCandidate(f);
  assert.equal(f.calls[0].args[1], 0n);
  assert.equal(f.calls[0].args[2].length, 2 + 32769 * 2);
});

test("candidate refuses changed code, wrong source, terminal jobs and mismatched original commitments before simulation", async () => {
  const cases = [
    (f) => {
      f.client.getChainId = async () => 1;
    },
    (f) => {
      f.snapshot.runtimeCodeHash = hash;
    },
    (f) => {
      f.snapshot.blockHash = `0x${"cd".repeat(32)}`;
    },
    (f) => {
      f.job.decision = 3;
    },
    (f) => {
      f.job.deadline = 999n;
    },
    (f) => {
      f.job.sellerReceived = false;
    },
    (f) => {
      f.job.inspectionRecorded = false;
    },
    (f) => {
      f.job.workOrderDigest = `0x${"cd".repeat(32)}`;
    },
    (f) => {
      f.snapshot.deadline = 2100;
    },
    (f) => {
      f.snapshot.maxCvssTenths = 100;
    },
    (f) => {
      f.snapshot.buildVersion = 1008000;
    },
    (f) => {
      const read = f.client.readContract;
      f.client.readContract = async (args) =>
        args.functionName === "requestHash"
          ? `0x${"cd".repeat(32)}`
          : read(args);
    },
  ];
  for (const mutate of cases) {
    const f = fixture();
    mutate(f);
    await assert.rejects(judgeCandidate(f));
    assert.equal(f.calls.length, 0);
  }
});

test("RPC failure, unrelated reverts and changed block hashes cannot count as candidate evidence rejection", async () => {
  for (const error of [
    new Error("RPC unavailable"),
    revert("InvalidState"),
    revert("Expired"),
    Object.assign(new Error("empty revert"), {
      name: "ExecutionRevertedError",
    }),
  ]) {
    const f = fixture();
    f.client.simulateContract = async () => {
      throw error;
    };
    await assert.rejects(judgeCandidate(f));
  }
  const f = fixture();
  let reads = 0;
  f.client.getBlock = async () => ({
    number: 100n,
    timestamp: 1000n,
    hash: reads++ ? `0x${"cd".repeat(32)}` : hash,
  });
  await assert.rejects(judgeCandidate(f), { code: "JUDGE_BLOCK_CHANGED" });
});

test("candidate snapshot rejects mismatched original source documents", () => {
  const input = {
    deployment: original("deployment.json"),
    check: original("api3-five-deployed-cases.json"),
    evaluation: original("api3-policy-evaluation.json"),
  };
  input.evaluation.context.jobId = `0x${"cd".repeat(32)}`;
  assert.throws(() => submissionCandidateSnapshot(input), {
    code: "CANDIDATE_SNAPSHOT",
  });
});

test("candidate CLI rejects malformed, oversized and non-file inputs without a network outcome", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "candidate-cli-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const malformed = join(directory, "malformed.json");
  const oversized = join(directory, "oversized.json");
  writeFileSync(malformed, "{", { mode: 0o600 });
  writeFileSync(oversized, Buffer.alloc(MAX_CANDIDATE_FILE_BYTES + 1), {
    mode: 0o600,
  });
  const script = fileURLToPath(
    new URL("../scripts/judge-candidate.mjs", import.meta.url),
  );
  for (const args of [
    [],
    [malformed],
    [oversized],
    [directory],
    [malformed, "extra"],
  ]) {
    const result = spawnSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    const error = JSON.parse(result.stderr);
    assert.equal(error.observed, "INCONCLUSIVE");
    assert.equal(error.networkWrites, false);
    assert.match(error.code, /^CANDIDATE_(INPUT|USAGE)$/);
  }
});
