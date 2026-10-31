import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  validatePhoneChallenge,
  phoneEvidenceMessage,
  verifyPhoneEvidence,
} from "../src/phone-evidence.mjs";
import { usbPlan, connectUsb } from "../scripts/usb.mjs";

const challenge = () => ({
  schema: "proof-of-ready/phone-challenge/v1",
  work_order_digest: `0x${"a".repeat(64)}`,
  session_id: "0123456789abcdef",
  request_id: "aaaaaaaaaaaaaaaa",
  provider: "seeker-inspector",
  nonce: 1,
  requested_at: 1000,
  expires_at: 1060,
});
const jpeg = Buffer.alloc(200);
jpeg.set([255, 216]);
jpeg.set([255, 217], 198);
function fixture() {
  const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publicKey = keys.publicKey
    .export({ type: "spki", format: "der" })
    .subarray(-65)
    .toString("hex");
  const envelope = {
    ...challenge(),
    schema: "proof-of-ready/phone-photo/v1",
    image_sha256: createHash("sha256").update(jpeg).digest("hex"),
    captured_at: 1001,
    public_key_sec1_hex: publicKey,
    key_security_level: "software_reported",
  };
  const resign = () => {
    envelope.receipt_signature = `v3:${sign("sha256", Buffer.from(phoneEvidenceMessage(envelope)), { key: keys.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64")}`;
  };
  resign();
  return { envelope, publicKey, resign, challenge: challenge(), now: 1002 };
}
function rejectsCode(run, code) {
  assert.throws(run, (error) => error.code === code);
}

test("phone envelope pins the original request and enrolled key, with optional original JPEG verification", () => {
  const input = fixture();
  const result = verifyPhoneEvidence(input);
  assert.equal(result.verified, true);
  assert.equal(result.imageBytesVerified, false);
  assert.match(result.limitation, /does not attest camera origin/);
  assert.equal(
    verifyPhoneEvidence({ ...input, imageBytes: jpeg }).imageBytesVerified,
    true,
  );
  assert.equal(
    validatePhoneChallenge(input.challenge).request_id,
    input.challenge.request_id,
  );
});
test("changed request, image, key, and signed security metadata reject", () => {
  const fields = [
    "work_order_digest",
    "session_id",
    "request_id",
    "provider",
    "nonce",
    "requested_at",
    "expires_at",
  ];
  for (const field of fields) {
    const input = fixture();
    input.envelope[field] =
      typeof input.envelope[field] === "number"
        ? input.envelope[field] + 1
        : `${input.envelope[field]}b`;
    rejectsCode(() => verifyPhoneEvidence(input), "PHONE_CHALLENGE_MISMATCH");
  }
  const input = fixture();
  input.envelope.key_security_level = "strongbox_reported";
  rejectsCode(() => verifyPhoneEvidence(input), "INVALID_PHONE_SIGNATURE");
  const key = fixture();
  key.envelope.public_key_sec1_hex = fixture().publicKey;
  rejectsCode(() => verifyPhoneEvidence(key), "PHONE_KEY_MISMATCH");
  const image = fixture();
  const changed = Buffer.from(jpeg);
  changed[10] = 1;
  rejectsCode(
    () => verifyPhoneEvidence({ ...image, imageBytes: changed }),
    "PHONE_IMAGE_MISMATCH",
  );
  const data = fixture();
  data.envelope.image_sha256 = "b".repeat(64);
  rejectsCode(() => verifyPhoneEvidence(data), "INVALID_PHONE_SIGNATURE");
});
test("original capture window rejects expiry and accepts exact boundaries", () => {
  for (const at of [1000, 1060]) {
    const input = fixture();
    input.envelope.captured_at = at;
    input.now = at;
    input.resign();
    assert.equal(verifyPhoneEvidence(input).verified, true);
  }
  for (const at of [999, 1061]) {
    const input = fixture();
    input.envelope.captured_at = at;
    input.now = at;
    input.resign();
    rejectsCode(() => verifyPhoneEvidence(input), "STALE_PHONE_EVIDENCE");
  }
  rejectsCode(
    () => verifyPhoneEvidence({ ...fixture(), now: 1061 }),
    "STALE_PHONE_EVIDENCE",
  );
  const future = fixture();
  future.envelope.captured_at = 1005;
  future.resign();
  rejectsCode(() => verifyPhoneEvidence(future), "STALE_PHONE_EVIDENCE");
  rejectsCode(
    () => verifyPhoneEvidence({ ...fixture(), now: 997 }),
    "STALE_PHONE_EVIDENCE",
  );
});
test("malformed schemas, coercible identifiers, signature encodings and image boundaries reject", () => {
  for (const value of [
    null,
    [],
    { ...challenge(), unknown: true },
    { ...challenge(), nonce: 1.5 },
    { ...challenge(), expires_at: 1061 },
    { ...challenge(), session_id: 1111111111111111 },
    { ...challenge(), request_id: 1111111111111111 },
  ])
    rejectsCode(() => validatePhoneChallenge(value), "INVALID_PHONE_CHALLENGE");
  for (const value of [
    null,
    [],
    { ...fixture().envelope, extra: true },
    { ...fixture().envelope, captured_at: NaN },
    { ...fixture().envelope, key_security_level: "hardware-attested" },
  ])
    rejectsCode(
      () => verifyPhoneEvidence({ ...fixture(), envelope: value }),
      "INVALID_PHONE_EVIDENCE",
    );
  const input = fixture();
  for (const signature of [
    "v2:AAAA",
    "v3:AAAA",
    input.envelope.receipt_signature + "\n",
    input.envelope.receipt_signature.slice(0, -1),
    "v3:" + "A".repeat(86) + "==",
  ]) {
    if (signature === input.envelope.receipt_signature) continue;
    rejectsCode(
      () =>
        verifyPhoneEvidence({
          ...input,
          envelope: { ...input.envelope, receipt_signature: signature },
        }),
      "INVALID_PHONE_SIGNATURE",
    );
  }
  for (const imageBytes of [
    Buffer.alloc(99),
    Buffer.alloc(12 * 1024 * 1024 + 1),
    "jpeg",
    Buffer.alloc(200),
  ])
    rejectsCode(
      () => verifyPhoneEvidence({ ...input, imageBytes }),
      "INVALID_PHONE_IMAGE",
    );
});
test("USB preparation is read-only by default, targets one explicit device, and requires authorization for forwarding", () => {
  const plan = usbPlan({ serial: "example-serial", port: 4022 });
  assert.equal(plan.executed, false);
  assert.deepEqual(plan.command, [
    "adb",
    "-s",
    "example-serial",
    "reverse",
    "tcp:4022",
    "tcp:4022",
  ]);
  assert.throws(
    () => connectUsb(plan, {}),
    /targeted USB-forwarding authorization/,
  );
  for (const serial of [undefined, "", "bad;echo", "a b", "a\n"])
    assert.throws(() => usbPlan({ serial }), /explicit adb device/);
  for (const port of [80, 65536, 4022.5, "4022"])
    assert.throws(() => usbPlan({ serial: "example", port }), /port/);
});
test("actual Java P-256 conversion interoperates with the Node verifier and URL restrictions pass", () => {
  const scratch = mkdtempSync(join(tmpdir(), "por-java-test-"));
  try {
    const source = resolve("src/com/proofofready/seeker");
    const host = resolve(
      "host-test/com/proofofready/seeker/ProtocolHostTest.java",
    );
    execFileSync(
      "javac",
      [
        "--release",
        "8",
        "-d",
        scratch,
        join(source, "SignatureEncoding.java"),
        join(source, "LocalOrigin.java"),
        host,
      ],
      { encoding: "utf8" },
    );
    const outcome = execFileSync(
      "java",
      ["-cp", scratch, "com.proofofready.seeker.ProtocolHostTest"],
      { encoding: "utf8" },
    );
    assert.match(outcome, /256 Java P-256 signature conversions passed/);
    const input = fixture();
    const message = phoneEvidenceMessage(input.envelope);
    const actual = JSON.parse(
      execFileSync(
        "java",
        [
          "-cp",
          scratch,
          "com.proofofready.seeker.ProtocolHostTest",
          "sign",
          Buffer.from(message).toString("base64"),
        ],
        { encoding: "utf8" },
      ),
    );
    input.publicKey = actual.publicKeySec1Hex;
    input.envelope.public_key_sec1_hex = actual.publicKeySec1Hex;
    input.envelope.receipt_signature = actual.receiptSignature;
    assert.equal(verifyPhoneEvidence(input).verified, true);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
