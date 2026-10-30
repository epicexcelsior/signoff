import { artifactDigest, canonicalJson } from "./artifacts.js";
import { verifyOpticalExecution, opticalRequestId } from "./optical.js";
import { alignOpticalChallenge } from "../public/vision/optical.js";
import { verifyPhoneEvidence } from "../mobile/src/phone-evidence.mjs";

export function opticalCheck(workOrder, bundle) {
  const item = bundle.optical;
  const result = (outcome, reason) => ({
    id: "optical",
    outcome,
    reason,
    evidenceRefs: item ? [artifactDigest(item)] : [],
  });
  if (!item?.receipt || !item.capture)
    return result(
      "REVIEW",
      "A signed optical execution and matching camera samples are not present.",
    );
  try {
    const challenge = item.challenge;
    if (
      challenge.work_order_digest !== bundle.workOrderDigest ||
      challenge.session_id !== bundle.sessionId ||
      challenge.request_id !==
        opticalRequestId(bundle.workOrderDigest, bundle.sessionId) ||
      challenge.requested_at * 1000 < bundle.startedAt - 1000 ||
      challenge.expires_at * 1000 > bundle.expiresAt ||
      item.verifiedAt * 1000 > bundle.closedAt
    )
      throw new Error("binding");
    verifyOpticalExecution({
      receipt: item.receipt,
      challenge,
      provider: workOrder.device.contact.provider,
      publicKey: workOrder.device.publicKey,
      verifiedAt: item.verifiedAt,
    });
    const capture = item.capture;
    if (canonicalJson(capture.roi) !== canonicalJson(workOrder.optical?.roi))
      throw new Error("approved emitter region");
    if (
      capture.schemaVersion !== "proof-of-ready-optical-capture-v1" ||
      capture.source !== "browser-camera" ||
      capture.sessionId !== bundle.sessionId ||
      capture.challenge?.bits !== challenge.bits ||
      capture.challenge?.halfSymbolMs !== 250 ||
      capture.captureStartedAtMs < bundle.startedAt ||
      capture.captureEndedAtMs > bundle.closedAt ||
      !Number.isSafeInteger(item.capturedAt) ||
      capture.captureEndedAtMs > item.capturedAt + 2000 ||
      item.capturedAt > bundle.closedAt ||
      !bundle.vision?.camera?.id ||
      capture.camera?.id !== bundle.vision.camera.id ||
      capture.calibrationId !== bundle.vision.frame.calibrationId ||
      canonicalJson(capture.camera) !== canonicalJson(bundle.vision.camera)
    )
      throw new Error("camera binding");
    const evaluation = alignOpticalChallenge({
      ...capture,
      policy: workOrder.vision,
      searchWindow: {
        earliestStartAtMs: Math.max(
          capture.captureStartedAtMs,
          item.receipt.started_at * 1000 - 2000,
        ),
        latestStartAtMs: Math.min(
          capture.captureEndedAtMs - 18000,
          item.receipt.started_at * 1000 + 2000,
        ),
      },
    });
    if (
      evaluation.state === "PASS" &&
      (!evaluation.alignment ||
        Math.abs(
          evaluation.alignment.startAtMs - item.receipt.started_at * 1000,
        ) > 2000 ||
        Math.abs(
          evaluation.alignment.endAtMs - item.receipt.completed_at * 1000,
        ) > 2000)
    )
      throw new Error("execution timing");
    return result(
      evaluation.state,
      evaluation.state === "PASS"
        ? "The original signed optical execution matches every tracked camera symbol and approved placement."
        : evaluation.predicates
            .filter((p) => p.state !== "PASS")
            .map((p) => p.reason)
            .join(" ") || "The optical capture requires review.",
    );
  } catch {
    return result(
      "FAIL",
      "The optical evidence differs from its enrolled device, original challenge, camera, or capture window.",
    );
  }
}

export function phoneCheck(workOrder, bundle) {
  const item = bundle.phone;
  const result = (outcome, reason) => ({
    id: "phone",
    outcome,
    reason,
    evidenceRefs: item ? [artifactDigest(item)] : [],
  });
  if (!item?.envelope)
    return result(
      "REVIEW",
      "A photo record from the enrolled Seeker key is required.",
    );
  try {
    const ch = item.challenge;
    if (
      ch.work_order_digest !== bundle.workOrderDigest ||
      ch.session_id !== bundle.sessionId ||
      ch.request_id !==
        phoneRequestId(bundle.workOrderDigest, bundle.sessionId) ||
      ch.requested_at * 1000 < bundle.startedAt - 1000 ||
      ch.expires_at * 1000 > bundle.expiresAt ||
      item.verifiedAt * 1000 > bundle.closedAt
    )
      throw new Error("binding");
    verifyPhoneEvidence({
      envelope: item.envelope,
      challenge: ch,
      publicKey: workOrder.phone.publicKey,
      now: item.verifiedAt,
    });
    return result(
      "PASS",
      "The enrolled Seeker key signed a photo-digest claim for this original session. Image bytes remain on the phone.",
    );
  } catch {
    return result(
      "FAIL",
      "The phone photo claim differs from its enrolled key, original challenge, or capture window.",
    );
  }
}

export const phoneRequestId = (workOrderDigest, sessionId) =>
  artifactDigest({
    domain: "proof-of-ready/phone-request/v1",
    workOrderDigest,
    sessionId,
  }).slice(2, 18);
