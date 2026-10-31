import { IntegrationError } from "./errors.js";

const digest = (value) =>
  typeof value === "string" && /^0x[a-f0-9]{64}$/.test(value);
const reference = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 160 &&
  /^[A-Za-z0-9_.:-]+$/.test(value);
const text = (value) => typeof value === "string" && value.length <= 2000;
const outcomes = new Set(["PASS", "FAIL", "REVIEW"]);
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const array = (value, limit) => Array.isArray(value) && value.length <= limit;

// The coordinator owns raw-evidence authentication. This boundary accepts only its bounded, normalized checks.
export function inspectVerifiedChecks(artifact) {
  if (
    !object(artifact) ||
    !["simulation", "physical"].includes(artifact.mode) ||
    !digest(artifact.workOrderHash) ||
    !digest(artifact.evidenceBundleHash) ||
    !array(artifact.requiredChecks, 100) ||
    artifact.requiredChecks.length === 0 ||
    !artifact.requiredChecks.every(reference) ||
    !array(artifact.checks, 100) ||
    (artifact.limitations !== undefined &&
      (!array(artifact.limitations, 98) || !artifact.limitations.every(text)))
  ) {
    throw new IntegrationError(
      "INVALID_INSPECTION_INPUT",
      "Supply bounded approved checks, artifact digests, and an explicit evidence mode.",
    );
  }
  const checks = artifact.checks.map((check) => {
    if (
      !object(check) ||
      !reference(check.id) ||
      !outcomes.has(check.outcome) ||
      !text(check.reason) ||
      check.reason.length === 0 ||
      (check.evidenceRefs !== undefined &&
        (!array(check.evidenceRefs, 100) || !check.evidenceRefs.every(digest)))
    ) {
      throw new IntegrationError(
        "INVALID_INSPECTION_INPUT",
        "Each check requires an identifier, supported outcome, bounded reason, and valid evidence references.",
      );
    }
    return {
      id: check.id,
      outcome: check.outcome,
      reason: check.reason,
      ...(check.evidenceRefs === undefined
        ? {}
        : { evidenceRefs: [...check.evidenceRefs] }),
    };
  });
  if (
    new Set(artifact.requiredChecks).size !== artifact.requiredChecks.length ||
    new Set(checks.map((p) => p.id)).size !== checks.length
  ) {
    throw new IntegrationError(
      "DUPLICATE_PREDICATE",
      "Each required check and recorded check must have one identifier.",
    );
  }
  const predicates = artifact.requiredChecks.map(
    (id) =>
      checks.find((check) => check.id === id) ?? {
        id,
        outcome: "REVIEW",
        reason:
          "Required evidence is absent. Capture the required evidence before acceptance.",
      },
  );
  return {
    schema: "proof-of-ready/inspection-report/v1",
    evaluatorVersion: "1",
    workOrderHash: artifact.workOrderHash,
    evidenceBundleHash: artifact.evidenceBundleHash,
    outcome: predicates.some((p) => p.outcome === "FAIL")
      ? "FAIL"
      : predicates.some((p) => p.outcome === "REVIEW")
        ? "REVIEW"
        : "PASS",
    predicates,
    limitations: [
      "The coordinator supplies verified checks. This inspector does not independently authenticate raw physical evidence.",
      ...(artifact.mode === "simulation"
        ? [
            "Simulation does not establish physical function or live settlement.",
          ]
        : []),
      ...(artifact.limitations ?? []),
    ],
  };
}
