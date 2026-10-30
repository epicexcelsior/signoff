import { createPublicKey, verify } from "node:crypto";

export class EvidenceError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "EvidenceError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new EvidenceError(code, message);
};
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value) => Number.isSafeInteger(value) && value > 0;
const exactKeys = (value, keys) =>
  object(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const contactPins = new Set([0, 1, 2, 3, 6, 7, 9, 18, 19, 20, 21, 22, 23]);

/** Trusted configuration, never inferred from provider discovery or a receipt. */
export function validateContact(contact) {
  const sensorPin = /^gpio(\d+)-contact$/.exec(contact?.sensor ?? "");
  if (
    !exactKeys(contact, ["provider", "sensor", "location"]) ||
    typeof contact.provider !== "string" ||
    !/^[A-Za-z0-9_-]{1,31}$/.test(contact.provider) ||
    contact.location !== "demo-gate" ||
    !(
      contact.sensor === "simulated-contact" ||
      (sensorPin && contactPins.has(Number(sensorPin[1])))
    )
  ) {
    fail(
      "INVALID_CONFIG",
      "Select a trusted provider and supported contact sensor.",
    );
  }
  return contact;
}

export function receiptPublicKey(sec1Hex) {
  if (typeof sec1Hex !== "string" || !/^04[0-9a-f]{128}$/.test(sec1Hex)) {
    fail("INVALID_CONFIG", "Configure an uncompressed P-256 public key.");
  }
  try {
    return createPublicKey({
      key: Buffer.from(
        `3059301306072a8648ce3d020106082a8648ce3d030107034200${sec1Hex}`,
        "hex",
      ),
      format: "der",
      type: "spki",
    });
  } catch {
    fail("INVALID_CONFIG", "The configured P-256 point is invalid.");
  }
}

/** Exact legacy wire message from FieldProof protocol/auth.py receipt_message. */
export function receiptMessage(receipt) {
  const result = receipt.result;
  return [
    "fieldproof-observation-v1",
    receipt.protocol,
    receipt.request_id,
    receipt.provider,
    receipt.capability,
    receipt.parameters.location,
    receipt.nonce,
    result.metric,
    result.sensor,
    result.closed ? 1 : 0,
    result.stable_samples,
    result.total_samples,
    receipt.started_at,
    receipt.completed_at,
  ].join("|");
}

export function verifyEvidence({
  receipt,
  challenge,
  contact,
  publicKey,
  maxAgeSeconds = 10,
  now = Math.floor(Date.now() / 1000),
}) {
  validateContact(contact);
  const key = receiptPublicKey(publicKey);
  if (
    !Number.isInteger(maxAgeSeconds) ||
    maxAgeSeconds < 1 ||
    maxAgeSeconds > 30 ||
    !integer(now)
  ) {
    fail(
      "INVALID_CONFIG",
      "Use a freshness bound from 1 through 30 seconds and a valid evaluation time.",
    );
  }
  if (
    !exactKeys(challenge, ["request_id", "nonce", "timestamp", "expiration"]) ||
    typeof challenge.request_id !== "string" ||
    !/^[A-Za-z0-9_-]{1,16}$/.test(challenge.request_id) ||
    !integer(challenge.nonce) ||
    challenge.nonce > 0x7fffffff ||
    !integer(challenge.timestamp) ||
    !integer(challenge.expiration) ||
    challenge.expiration <= challenge.timestamp ||
    challenge.expiration - challenge.timestamp > 30
  ) {
    fail(
      "INVALID_CHALLENGE",
      "Use the original buyer challenge with a bounded expiration.",
    );
  }
  const required = [
    "protocol",
    "request_id",
    "status",
    "provider",
    "capability",
    "parameters",
    "nonce",
    "result",
    "started_at",
    "completed_at",
    "receipt_signature",
  ];
  const optional = ["delivery_proof", "authorization_ref", "error"];
  if (
    !object(receipt) ||
    !required.every((name) => Object.hasOwn(receipt, name)) ||
    Object.keys(receipt).some(
      (name) => !required.includes(name) && !optional.includes(name),
    ) ||
    optional.some(
      (name) => Object.hasOwn(receipt, name) && receipt[name] !== null,
    )
  ) {
    fail(
      "INVALID_RECEIPT",
      "The receipt does not match the supported observation schema.",
    );
  }
  if (
    receipt.protocol !== "capmesh/0.1" ||
    receipt.status !== "success" ||
    receipt.request_id !== challenge.request_id ||
    receipt.nonce !== challenge.nonce ||
    receipt.provider !== contact.provider ||
    receipt.capability !== "state.observe" ||
    !exactKeys(receipt.parameters, ["location"]) ||
    receipt.parameters.location !== contact.location
  ) {
    fail(
      "CHALLENGE_MISMATCH",
      "The receipt does not answer this buyer request.",
    );
  }
  const result = receipt.result;
  if (
    !exactKeys(result, [
      "metric",
      "sensor",
      "closed",
      "stable_samples",
      "total_samples",
    ]) ||
    result.metric !== "gate.closed" ||
    result.sensor !== contact.sensor ||
    typeof result.closed !== "boolean" ||
    !Number.isInteger(result.stable_samples) ||
    result.stable_samples < 0 ||
    result.stable_samples > 5 ||
    result.total_samples !== 5 ||
    !integer(receipt.started_at) ||
    !integer(receipt.completed_at)
  ) {
    fail(
      "INVALID_MEASUREMENT",
      "The receipt contains unsupported measurements or timestamps.",
    );
  }
  const encoded =
    typeof receipt.receipt_signature === "string" &&
    receipt.receipt_signature.startsWith("v3:")
      ? receipt.receipt_signature.slice(3)
      : "";
  if (!/^[A-Za-z0-9+/]{86}==$/.test(encoded))
    fail("INVALID_SIGNATURE", "Use the device P-256 signature.");
  const signature = Buffer.from(encoded, "base64");
  if (
    signature.length !== 64 ||
    signature.toString("base64") !== encoded ||
    !verify(
      "sha256",
      Buffer.from(receiptMessage(receipt)),
      { key, dsaEncoding: "ieee-p1363" },
      signature,
    )
  ) {
    fail(
      "INVALID_SIGNATURE",
      "The signed observation changed or a different device signed it.",
    );
  }
  if (result.stable_samples !== result.total_samples) {
    fail("UNSTABLE_MEASUREMENT", "The contact changed during sampling.");
  }
  if (
    challenge.timestamp > now + 2 ||
    receipt.started_at < challenge.timestamp - 2 ||
    receipt.completed_at < receipt.started_at ||
    receipt.completed_at > now + 2 ||
    receipt.completed_at > challenge.expiration ||
    now > challenge.expiration ||
    now - receipt.completed_at > maxAgeSeconds
  ) {
    fail(
      "STALE_EVIDENCE",
      "The observation is outside the original request or freshness window.",
    );
  }
  return {
    accepted: true,
    state: result.closed ? "CLOSED" : "OPEN",
    decision: result.closed ? "WAIT" : "DISPATCH",
    reason: result.closed
      ? "The verified contact is closed."
      : "The verified contact is open.",
    age_seconds: Math.max(0, now - receipt.completed_at),
    completed_at: receipt.completed_at,
    valid_until: Math.min(
      challenge.expiration,
      receipt.completed_at + maxAgeSeconds,
    ),
    sample_agreement: "5/5",
    confidence: null,
    receipt_identity: "pinned-device-p256",
    evidence_mode:
      contact.sensor === "simulated-contact"
        ? "simulation"
        : "physical-contact",
  };
}

/** Cached results expire without refreshing their original capture time. */
export function refreshDecision(result, now = Math.floor(Date.now() / 1000)) {
  if (
    !object(result) ||
    !integer(result.completed_at) ||
    !integer(result.valid_until) ||
    !integer(now)
  ) {
    fail("INVALID_RECEIPT", "The cached verification result is invalid.");
  }
  if (now > result.valid_until || result.completed_at > now + 2) {
    return {
      ...result,
      accepted: false,
      decision: "WAIT",
      age_seconds: Math.max(0, now - result.completed_at),
      reason: "The cached observation expired. Request a new physical check.",
    };
  }
  return { ...result, age_seconds: Math.max(0, now - result.completed_at) };
}
