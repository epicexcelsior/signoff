import { createHash } from "node:crypto";
import { AppError } from "./store.js";
import { artifactDigest, canonicalJson, isDigest } from "./artifacts.js";

const textHash = (text) =>
  createHash("sha256").update(text, "utf8").digest("hex");
export const inspectionJobId = (session) =>
  artifactDigest({
    domain: "proof-of-ready/contract-job/v1",
    workOrderDigest: session.workOrderDigest,
    sessionId: session.id,
  });

export function makeInspectionRequest(session, artifact) {
  return {
    inspectionId: `por-${session.id}`,
    workOrderHash: session.workOrderDigest,
    evidenceBundleHash: artifact.evidenceBundleHash,
    inputText: canonicalJson(artifact),
    idempotencyKey: `por-inspection-${session.id}`,
  };
}

export function inspectionTransportText(request) {
  return JSON.stringify({
    schema: "proof-of-ready-inspection-request-v1",
    inspectionId: request.inspectionId,
    workOrderHash: request.workOrderHash,
    evidenceBundleHash: request.evidenceBundleHash,
    inputText: request.inputText,
  });
}

export function bindInspectionResult({ state, receipt, request, report }) {
  const fail = (reason) => {
    throw new AppError("INSPECTION_BINDING_MISMATCH", reason, 422);
  };
  if (
    !state ||
    canonicalJson(state.request) !== canonicalJson(request) ||
    state.exactInput !== inspectionTransportText(request) ||
    state.inputHash !== textHash(state.exactInput)
  )
    fail("The external inspection differs from the original prepared input.");
  if (state.report && canonicalJson(state.report) !== canonicalJson(report))
    fail(
      "The paid inspector report differs from the independently reconstructed report.",
    );
  if (state.resultText) {
    let delivered;
    try {
      delivered = JSON.parse(state.resultText);
    } catch {
      fail("The delivered inspector result is not valid JSON.");
    }
    const { explanation: _explanation, ...deliveredReport } = delivered;
    if (
      canonicalJson(deliveredReport) !== canonicalJson(report) ||
      state.resultHash !== textHash(state.resultText)
    )
      fail("The exact delivered result text or its commitment changed.");
  }
  const delivered = Boolean(
    state.report &&
      state.resultText &&
      ["COMPLETE", "AWAITING_WITHDRAWAL", "SELLER_PAID"].includes(state.stage),
  );
  const settled =
    delivered &&
    state.transportMode === "sokosumi-preprod" &&
    state.paid === true &&
    state.sellerPaid === true &&
    state.stage === "SELLER_PAID" &&
    receipt?.verified === true;
  if (!settled)
    return {
      outcome: "REVIEW",
      delivered,
      stage: state.stage,
      reason:
        "The report is bound. A freshly verified Preprod seller receipt is still required.",
      evidence: null,
    };
  if (
    !/^[a-f0-9]{64}$/.test(receipt.transaction ?? "") ||
    !/^[1-9][0-9]{0,79}$/.test(receipt.netAtomicUnits ?? "") ||
    receipt.blockchainIdentifier !== state.terms?.blockchainIdentifier ||
    receipt.unit !== state.receipt?.unit ||
    receipt.transaction !== state.receipt?.transaction ||
    receipt.unit !==
      "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d"
  )
    fail(
      "The seller receipt identifies another transaction, payment, or token.",
    );
  const evidence = {
    schema: "proof-of-ready/paid-inspection/v1",
    network: "cardano:preprod",
    taskId: state.taskId,
    remoteTaskId: state.remoteTaskId,
    workOrderDigest: request.workOrderHash,
    evidenceBundleDigest: request.evidenceBundleHash,
    inspectionDigest: artifactDigest(report),
    inputHash: state.inputHash,
    resultHash: state.resultHash,
    blockchainIdentifier: receipt.blockchainIdentifier,
    transaction: receipt.transaction,
    netAtomicUnits: receipt.netAtomicUnits,
    unit: receipt.unit,
    trust:
      "Configured Masumi services, confirmed withdrawal, and chain-provider token outputs.",
  };
  return {
    outcome: "PASS",
    delivered,
    stage: state.stage,
    reason:
      "The exact inspection result binds a freshly verified Preprod seller receipt.",
    evidence,
    evidenceDigest: artifactDigest(evidence),
  };
}

export function contractExpectations(
  workOrder,
  session,
  paid,
  sourceResponseDigest,
) {
  const buildManifestDigest = workOrder.software?.manifestDigest;
  if (
    paid?.outcome !== "PASS" ||
    !paid.evidence ||
    paid.evidenceDigest !== artifactDigest(paid.evidence) ||
    paid.evidence.inspectionDigest !== artifactDigest(session.report) ||
    paid.evidence.workOrderDigest !== session.workOrderDigest ||
    paid.evidence.evidenceBundleDigest !== artifactDigest(session.evidence) ||
    !isDigest(buildManifestDigest) ||
    !isDigest(sourceResponseDigest) ||
    !isDigest(paid?.evidenceDigest)
  )
    return null;
  return {
    workOrderDigest: session.workOrderDigest,
    buildManifestDigest,
    inspectionDigest: artifactDigest(session.report),
    paymentEvidenceDigest: paid.evidenceDigest,
    sourceResponseDigest,
    deadline: Math.floor(workOrder.expiresAt / 1000),
    ...(workOrder.software.maxCvssTenths !== undefined
      ? { maxCvssTenths: workOrder.software.maxCvssTenths }
      : {}),
  };
}

export function externalAcceptance(report, sourceMode, external = null) {
  const check = (id, outcome, reason, evidenceRefs = []) => ({
    id,
    outcome,
    reason,
    evidenceRefs,
  });
  const paid = external?.paid;
  const contract = external?.contract;
  const predicates = [
    check(
      "inspection",
      report.outcome,
      `Local inspection returned ${report.outcome}.`,
      [artifactDigest(report)],
    ),
    check(
      "physical-origin",
      sourceMode === "physical" ? "PASS" : "REVIEW",
      sourceMode === "physical"
        ? "The configured physical adapter supplied the reads."
        : "Fixture evidence cannot approve a physical installation.",
    ),
    check(
      "paid-inspection",
      paid?.outcome ?? "REVIEW",
      paid?.reason ??
        "No verified Masumi seller receipt binds this inspection.",
      paid?.evidenceDigest ? [paid.evidenceDigest] : [],
    ),
    check(
      "software-policy",
      contract?.verdict ?? "REVIEW",
      contract?.reason ??
        "No pinned deployed contract decision binds this work order and inspection.",
    ),
  ];
  return {
    schema: "proof-of-ready/acceptance/v1",
    decision: predicates.some((p) => p.outcome === "FAIL")
      ? "REWORK"
      : predicates.every((p) => p.outcome === "PASS")
        ? "READY"
        : "REVIEW",
    predicates,
    liveSettlement: paid?.outcome === "PASS",
    contractVerified: contract?.verdict === "PASS",
  };
}
