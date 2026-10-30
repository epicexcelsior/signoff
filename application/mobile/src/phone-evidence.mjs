import { createHash, createPublicKey, verify } from "node:crypto";

export const PHONE_CHALLENGE_SCHEMA = "proof-of-ready/phone-challenge/v1";
export const PHONE_EVIDENCE_SCHEMA = "proof-of-ready/phone-photo/v1";
export class PhoneEvidenceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PhoneEvidenceError";
    this.code = code;
  }
}
const fail = (code, message) => {
  throw new PhoneEvidenceError(code, message);
};
const object = (value) =>
  value && Object.getPrototypeOf(value) === Object.prototype;
const matches = (value, pattern) =>
  typeof value === "string" && pattern.test(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const exact = (value, keys) =>
  object(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const challengeKeys = [
  "schema",
  "work_order_digest",
  "session_id",
  "request_id",
  "provider",
  "nonce",
  "requested_at",
  "expires_at",
];
const signedFields = [
  "work_order_digest",
  "session_id",
  "request_id",
  "provider",
  "nonce",
  "image_sha256",
  "requested_at",
  "expires_at",
  "captured_at",
];
const envelopeKeys = [
  "schema",
  ...signedFields,
  "public_key_sec1_hex",
  "receipt_signature",
  "key_security_level",
];

export function validatePhoneChallenge(challenge) {
  if (
    !exact(challenge, challengeKeys) ||
    challenge.schema !== PHONE_CHALLENGE_SCHEMA ||
    !matches(challenge.work_order_digest, /^0x[0-9a-f]{64}$/) ||
    !matches(challenge.session_id, /^[0-9a-f]{16}$/) ||
    !matches(challenge.request_id, /^[0-9a-f]{16}$/) ||
    challenge.provider !== "seeker-inspector" ||
    !positive(challenge.nonce) ||
    challenge.nonce > 0x7fffffff ||
    !positive(challenge.requested_at) ||
    !positive(challenge.expires_at) ||
    challenge.expires_at <= challenge.requested_at ||
    challenge.expires_at - challenge.requested_at > 60
  )
    fail(
      "INVALID_PHONE_CHALLENGE",
      "Use the original bounded phone capture request.",
    );
  return structuredClone(challenge);
}

export function phoneEvidenceMessage(envelope) {
  return [
    "proof-of-ready-phone-photo-v1",
    ...signedFields.map((field) => envelope[field]),
    envelope.key_security_level,
  ].join("|");
}

export function verifyPhoneEvidence({
  envelope,
  challenge,
  publicKey,
  imageBytes,
  now = Math.floor(Date.now() / 1000),
}) {
  validatePhoneChallenge(challenge);
  if (
    !exact(envelope, envelopeKeys) ||
    envelope.schema !== PHONE_EVIDENCE_SCHEMA ||
    !matches(envelope.image_sha256, /^[0-9a-f]{64}$/) ||
    !positive(envelope.captured_at) ||
    ![
      "software_reported",
      "trusted_environment_reported",
      "strongbox_reported",
      "unknown_reported",
      "unavailable",
      "not_reported_api_below_31",
    ].includes(envelope.key_security_level) ||
    !positive(now)
  )
    fail(
      "INVALID_PHONE_EVIDENCE",
      "Use a supported phone envelope with a valid capture time.",
    );
  for (const field of challengeKeys.filter((key) => key !== "schema")) {
    if (envelope[field] !== challenge[field])
      fail(
        "PHONE_CHALLENGE_MISMATCH",
        "The phone envelope belongs to a different original request.",
      );
  }
  if (
    typeof publicKey !== "string" ||
    !/^04[0-9a-f]{128}$/.test(publicKey) ||
    envelope.public_key_sec1_hex !== publicKey
  )
    fail(
      "PHONE_KEY_MISMATCH",
      "The phone envelope does not match the independently enrolled key.",
    );
  const encoded =
    typeof envelope.receipt_signature === "string" &&
    envelope.receipt_signature.startsWith("v3:")
      ? envelope.receipt_signature.slice(3)
      : "";
  if (!/^[A-Za-z0-9+/]{86}==$/.test(encoded))
    fail(
      "INVALID_PHONE_SIGNATURE",
      "Use the phone's canonical P-256 signature.",
    );
  let key;
  try {
    key = createPublicKey({
      key: Buffer.from(
        `3059301306072a8648ce3d020106082a8648ce3d030107034200${publicKey}`,
        "hex",
      ),
      format: "der",
      type: "spki",
    });
  } catch {
    fail("PHONE_KEY_MISMATCH", "The enrolled phone key is invalid.");
  }
  const signature = Buffer.from(encoded, "base64");
  if (
    signature.length !== 64 ||
    signature.toString("base64") !== encoded ||
    !verify(
      "sha256",
      Buffer.from(phoneEvidenceMessage(envelope)),
      { key, dsaEncoding: "ieee-p1363" },
      signature,
    )
  )
    fail(
      "INVALID_PHONE_SIGNATURE",
      "The phone evidence changed or another key signed it.",
    );
  if (
    challenge.requested_at > now + 2 ||
    now > challenge.expires_at ||
    envelope.captured_at < challenge.requested_at ||
    envelope.captured_at > challenge.expires_at ||
    envelope.captured_at > now + 2
  )
    fail(
      "STALE_PHONE_EVIDENCE",
      "The phone capture falls outside its original request window.",
    );
  let imageBytesVerified = false;
  if (imageBytes !== undefined) {
    if (
      !(imageBytes instanceof Uint8Array) ||
      imageBytes.byteLength < 100 ||
      imageBytes.byteLength > 12 * 1024 * 1024
    )
      fail("INVALID_PHONE_IMAGE", "Provide bounded original JPEG bytes.");
    if (
      imageBytes[0] !== 0xff ||
      imageBytes[1] !== 0xd8 ||
      imageBytes.at(-2) !== 0xff ||
      imageBytes.at(-1) !== 0xd9
    )
      fail("INVALID_PHONE_IMAGE", "Provide the complete original JPEG file.");
    if (
      createHash("sha256").update(imageBytes).digest("hex") !==
      envelope.image_sha256
    )
      fail(
        "PHONE_IMAGE_MISMATCH",
        "The JPEG bytes differ from the signed image digest.",
      );
    imageBytesVerified = true;
  }
  return {
    verified: true,
    source: "android-keystore-signed-photo-claim",
    requestId: challenge.request_id,
    imageBytesVerified,
    imageDigest: `0x${envelope.image_sha256}`,
    keySecurityLevel: envelope.key_security_level,
    capturedAt: envelope.captured_at,
    limitation:
      "The signature binds a phone key and image digest. It does not attest camera origin, scene truth, hardware-backed storage, or physical installation.",
  };
}
