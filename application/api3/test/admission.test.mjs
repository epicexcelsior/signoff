import test from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData } from "viem";
import {
  admissionAbi,
  prepareAdmissionDeployment,
  prepareAdmissionCall,
} from "../src/admission.mjs";
import { NVD_SIGNER, NVD_REQUEST_HASH } from "../src/index.mjs";

test("source-gated deployment pins the original NVD source and five-minute limits", () => {
  const operator = `0x${"11".repeat(20)}`;
  const artifact = { abi: admissionAbi, bytecode: { object: "0x1234" } };
  const plan = prepareAdmissionDeployment({ artifact, operator });
  assert.equal(plan.authorization, "UNSIGNED");
  assert.equal(plan.chainId, 84532);
  assert.equal(plan.airnode, NVD_SIGNER);
  assert.equal(plan.requestHash, NVD_REQUEST_HASH);
  assert.equal(plan.maxAttestationAge, 300);
  assert.equal(plan.maxSourceAge, 300);
  assert.throws(() =>
    prepareAdmissionDeployment({
      artifact: { ...artifact, abi: [] },
      operator,
    }),
  );
});

test("admission call binds the work order and exact candidate bytes without trusting advertised metadata", () => {
  const digest = `0x${"ab".repeat(32)}`;
  const snapshot = {
    chainId: 84532,
    contract: `0x${"11".repeat(20)}`,
    jobId: digest,
    spec: {
      workOrderDigest: digest,
      buildManifestDigest: digest,
      deadline: 1800000000,
      maxCvssTenths: 70,
    },
  };
  const candidate = {
    airnode: `0x${"22".repeat(20)}`,
    requestHash: `0x${"cd".repeat(32)}`,
    timestamp: "1793404581",
    data: '{ "a": 1 }',
    signature: `0x${"aa".repeat(65)}`,
  };
  const plan = prepareAdmissionCall(snapshot, candidate);
  const decoded = decodeFunctionData({ abi: admissionAbi, data: plan.data });
  assert.equal(decoded.functionName, "openJobWithSource");
  assert.equal(decoded.args[0], digest);
  assert.equal(decoded.args[2], BigInt(candidate.timestamp));
  assert.equal(decoded.args[3], "0x7b202261223a2031207d");
  assert.equal(decoded.args[4], candidate.signature);
  assert.throws(() =>
    prepareAdmissionCall({ ...snapshot, chainId: 1 }, candidate),
  );
  assert.throws(() =>
    prepareAdmissionCall(
      { ...snapshot, spec: { ...snapshot.spec, maxCvssTenths: 101 } },
      candidate,
    ),
  );
});
