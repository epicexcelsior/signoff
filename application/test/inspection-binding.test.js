import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { artifactDigest } from "../src/artifacts.js";
import {
  makeInspectionRequest,
  inspectionTransportText,
  bindInspectionResult,
  contractExpectations,
} from "../src/inspection-binding.js";
import { inspectVerifiedChecks } from "../integrations/masumi/src/inspector.js";

const hash = (text) => createHash("sha256").update(text).digest("hex");
function inspection() {
  const workOrderDigest = artifactDigest({ order: "disposable fixture" });
  const evidence = { capture: "disposable fixture" };
  const artifact = {
    mode: "simulation",
    workOrderHash: workOrderDigest,
    evidenceBundleHash: artifactDigest(evidence),
    requiredChecks: ["function"],
    checks: [
      {
        id: "function",
        outcome: "FAIL",
        reason: "The disposable contact fixture is stuck.",
      },
    ],
  };
  const session = { id: "0123456789abcdef", workOrderDigest, evidence };
  const request = makeInspectionRequest(session, artifact);
  const report = inspectVerifiedChecks(artifact);
  session.report = report;
  const exactInput = inspectionTransportText(request);
  const resultText = JSON.stringify({
    ...report,
    explanation: "A useful negative inspection is delivered work.",
  });
  const state = {
    request,
    report,
    exactInput,
    inputHash: hash(exactInput),
    resultText,
    resultHash: hash(resultText),
    stage: "COMPLETE",
    transportMode: "fixture",
    paid: false,
    sellerPaid: false,
    taskId: "local-inspector-id",
    remoteTaskId: "remote-inspector-id",
  };
  return { state, request, report, session };
}
test("inspector binding preserves exact transport text, deterministic report and useful negative delivery", () => {
  const input = inspection();
  const bound = bindInspectionResult(input);
  assert.equal(bound.delivered, true);
  assert.equal(bound.outcome, "REVIEW");
  for (const state of [
    { ...input.state, exactInput: input.state.exactInput + " " },
    { ...input.state, inputHash: hash("changed") },
    { ...input.state, resultHash: hash("changed") },
    { ...input.state, report: { ...input.report, outcome: "PASS" } },
  ])
    assert.throws(() => bindInspectionResult({ ...input, state }), {
      code: "INSPECTION_BINDING_MISMATCH",
    });
});
test("only a freshly verified exact Preprod seller receipt establishes a paid delivered report", () => {
  const input = inspection();
  const unit =
    "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d";
  const receipt = {
    verified: true,
    transaction: "a".repeat(64),
    blockchainIdentifier: "original-payment",
    netAtomicUnits: "900000",
    unit,
  };
  const state = {
    ...input.state,
    stage: "SELLER_PAID",
    transportMode: "sokosumi-preprod",
    paid: true,
    sellerPaid: true,
    terms: { blockchainIdentifier: receipt.blockchainIdentifier },
    receipt,
  };
  const paid = bindInspectionResult({ ...input, state, receipt });
  assert.equal(paid.outcome, "PASS");
  assert.equal(paid.evidence.inspectionDigest, artifactDigest(input.report));
  assert.equal(paid.evidenceDigest, artifactDigest(paid.evidence));
  assert.equal(input.report.outcome, "FAIL");
  for (const changed of [{ ...receipt, verified: false }, undefined])
    assert.equal(
      bindInspectionResult({ ...input, state, receipt: changed }).outcome,
      "REVIEW",
    );
  assert.equal(
    bindInspectionResult({
      ...input,
      state: { ...state, transportMode: "fixture" },
      receipt,
    }).outcome,
    "REVIEW",
  );
  for (const changed of [
    { ...receipt, transaction: "b".repeat(64) },
    { ...receipt, netAtomicUnits: "0" },
    { ...receipt, unit: "lovelace" },
    { ...receipt, blockchainIdentifier: "other-payment" },
  ])
    assert.throws(
      () => bindInspectionResult({ ...input, state, receipt: changed }),
      { code: "INSPECTION_BINDING_MISMATCH" },
    );
});
test("contract expectations require the exact paid report and evidence and preserve approved policy", () => {
  const { session } = inspection();
  const order = {
    software: {
      manifestDigest: artifactDigest({ build: "reference" }),
      maxCvssTenths: 70,
    },
    expiresAt: 1700000000000,
  };
  const source = artifactDigest({ source: "fixture" });
  const evidence = {
    inspectionDigest: artifactDigest(session.report),
    workOrderDigest: session.workOrderDigest,
    evidenceBundleDigest: artifactDigest(session.evidence),
  };
  const paid = {
    outcome: "PASS",
    evidence,
    evidenceDigest: artifactDigest(evidence),
  };
  const expected = contractExpectations(order, session, paid, source);
  assert.equal(expected.deadline, 1700000000);
  assert.equal(expected.maxCvssTenths, 70);
  assert.equal(expected.sourceResponseDigest, source);
  assert.equal(
    contractExpectations(
      order,
      session,
      { ...paid, outcome: "REVIEW" },
      source,
    ),
    null,
  );
  const changed = {
    ...evidence,
    evidenceBundleDigest: artifactDigest({ other: true }),
  };
  assert.equal(
    contractExpectations(
      order,
      session,
      { ...paid, evidence: changed, evidenceDigest: artifactDigest(changed) },
      source,
    ),
    null,
  );
});
