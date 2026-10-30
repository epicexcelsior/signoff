import { createHash } from "node:crypto";
import { z } from "zod";

import { IntegrationError } from "./errors.js";
export { IntegrationError } from "./errors.js";
export { inspectVerifiedChecks } from "./inspector.js";

const reference = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_.:-]+$/);
const digest = z.string().regex(/^0x[a-f0-9]{64}$/);
export const inspectionRequest = z.strictObject({
  inspectionId: reference,
  workOrderHash: digest,
  evidenceBundleHash: digest,
  inputText: z.string().min(1).max(8000),
  idempotencyKey: z.string().min(8).max(200),
});
const outcome = z.enum(["PASS", "FAIL", "REVIEW"]);
export const deterministicReport = z
  .object({
    outcome,
    predicates: z
      .array(
        z
          .object({
            id: reference,
            outcome,
            reason: z.string().min(1).max(2000),
          })
          .passthrough(),
      )
      .min(1)
      .max(100),
    limitations: z.array(z.string().max(2000)).max(100),
    workOrderHash: digest,
    evidenceBundleHash: digest,
  })
  .passthrough();

export const sha256Text = (text) =>
  createHash("sha256").update(text, "utf8").digest("hex");
// These are different transport protocols. Do not substitute artifact digests here.
export const coworkerInputHash = sha256Text;
export const coworkerResultHash = sha256Text;
export function standardInputHash(input, nonce) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).length !== 1 ||
    typeof input.prompt !== "string"
  ) {
    throw new IntegrationError(
      "INVALID_STANDARD_INPUT",
      "Standard input must contain exactly one prompt string.",
    );
  }
  assertNonce(nonce);
  return sha256Text(`${nonce};${JSON.stringify({ prompt: input.prompt })}`);
}
export function standardResultHash(result, nonce) {
  assertNonce(nonce);
  if (typeof result !== "string")
    throw new IntegrationError(
      "INVALID_STANDARD_RESULT",
      "Standard result commitments require the exact result text.",
    );
  return sha256Text(`${nonce};${result}`);
}
function assertNonce(nonce) {
  if (typeof nonce !== "string" || !/^[a-fA-F0-9]{14,26}$/.test(nonce)) {
    throw new IntegrationError(
      "INVALID_NONCE",
      "Use a 14 to 26 character hexadecimal purchaser nonce.",
    );
  }
}
export function transportInput(request) {
  return JSON.stringify({
    schema: "proof-of-ready-inspection-request-v1",
    inspectionId: request.inspectionId,
    workOrderHash: request.workOrderHash,
    evidenceBundleHash: request.evidenceBundleHash,
    inputText: request.inputText,
  });
}
export function validateReport(value, request) {
  const parsed = deterministicReport.parse(value);
  for (const field of ["workOrderHash", "evidenceBundleHash"]) {
    if (parsed[field] !== request[field]) {
      throw new IntegrationError(
        "REPORT_BINDING_MISMATCH",
        "The inspector report refers to different evidence or policy.",
      );
    }
  }
  if (
    new Set(parsed.predicates.map((p) => p.id)).size !==
    parsed.predicates.length
  ) {
    throw new IntegrationError(
      "DUPLICATE_PREDICATE",
      "The report contains duplicate predicate identifiers.",
    );
  }
  const expected = parsed.predicates.some((p) => p.outcome === "FAIL")
    ? "FAIL"
    : parsed.predicates.some((p) => p.outcome === "REVIEW")
      ? "REVIEW"
      : "PASS";
  if (parsed.outcome !== expected) {
    throw new IntegrationError(
      "INCONSISTENT_REPORT",
      "The report outcome must match its recorded predicates.",
    );
  }
  return parsed;
}

export function assertArtifact(input, request) {
  if (
    !input ||
    input.workOrderHash !== request.workOrderHash ||
    input.evidenceBundleHash !== request.evidenceBundleHash ||
    !["simulation", "physical"].includes(input.mode)
  ) {
    throw new IntegrationError(
      "ARTIFACT_BINDING_MISMATCH",
      "Load the exact approved policy and evidence bundle with an explicit evidence mode.",
    );
  }
}
