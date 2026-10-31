import test from "node:test";
import assert from "node:assert/strict";
import { sign } from "node:crypto";
import {
  receiptMessage,
  verifyEvidence,
  refreshDecision,
} from "../src/evidence.js";
import { createChallenge, simulatedReceipt } from "../src/observation.js";
import { fixture } from "./helpers.js";

function evidence(t) {
  const { identity, profile } = fixture(t);
  const challenge = createChallenge("0123456789abcdef");
  const receipt = simulatedReceipt(
    challenge,
    profile.contact,
    identity.privateKey,
    false,
  );
  const verify = (candidate = receipt, changes = {}) =>
    verifyEvidence({
      receipt: candidate,
      challenge,
      contact: profile.contact,
      publicKey: identity.publicKey,
      ...changes,
    });
  const resign = (candidate) => {
    candidate.receipt_signature = `v3:${sign(
      "sha256",
      Buffer.from(receiptMessage(candidate)),
      { key: identity.privateKey, dsaEncoding: "ieee-p1363" },
    ).toString("base64")}`;
    return candidate;
  };
  return { receipt, challenge, verify, resign };
}

test("the wire message matches the existing FieldProof observation protocol", () => {
  assert.equal(
    receiptMessage({
      protocol: "capmesh/0.1",
      request_id: "abc",
      provider: "board",
      capability: "state.observe",
      parameters: { location: "demo-gate" },
      nonce: 42,
      result: {
        metric: "gate.closed",
        sensor: "gpio3-contact",
        closed: false,
        stable_samples: 5,
        total_samples: 5,
      },
      started_at: 100,
      completed_at: 101,
    }),
    "fieldproof-observation-v1|capmesh/0.1|abc|board|state.observe|demo-gate|42|gate.closed|gpio3-contact|0|5|5|100|101",
  );
});

test("fresh open and closed observations produce different decisions", (t) => {
  const { receipt, verify, resign } = evidence(t);
  assert.equal(verify().decision, "DISPATCH");
  const closed = resign({
    ...receipt,
    result: { ...receipt.result, closed: true },
  });
  assert.equal(verify(closed).decision, "WAIT");
  assert.equal(verify(closed).accepted, true);
});

test("edited, stale, other-request, and wrong-key observations reject", (t) => {
  const { receipt, challenge, verify } = evidence(t);
  assert.throws(
    () => verify({ ...receipt, result: { ...receipt.result, closed: true } }),
    { code: "INVALID_SIGNATURE" },
  );
  assert.throws(() => verify(receipt, { now: receipt.completed_at + 11 }), {
    code: "STALE_EVIDENCE",
  });
  assert.throws(
    () =>
      verify(receipt, { challenge: { ...challenge, request_id: "different" } }),
    { code: "CHALLENGE_MISMATCH" },
  );
  const other = fixture(t).identity;
  assert.throws(() => verify(receipt, { publicKey: other.publicKey }), {
    code: "INVALID_SIGNATURE",
  });
});

test("reject future time, altered nonce, unstable sampling, coercion, and unknown fields", (t) => {
  const { receipt, challenge, verify, resign } = evidence(t);
  assert.throws(
    () =>
      verify(resign({ ...receipt, completed_at: receipt.completed_at + 5 })),
    { code: "STALE_EVIDENCE" },
  );
  assert.throws(
    () =>
      verify(receipt, {
        challenge: { ...challenge, nonce: challenge.nonce + 1 },
      }),
    { code: "CHALLENGE_MISMATCH" },
  );
  assert.throws(
    () =>
      verify(
        resign({
          ...receipt,
          result: { ...receipt.result, stable_samples: 4 },
        }),
      ),
    { code: "UNSTABLE_MEASUREMENT" },
  );
  assert.throws(
    () => verify({ ...receipt, result: { ...receipt.result, closed: 0 } }),
    { code: "INVALID_MEASUREMENT" },
  );
  assert.throws(() => verify({ ...receipt, new_field: "untrusted" }), {
    code: "INVALID_RECEIPT",
  });
  assert.throws(
    () =>
      verify(receipt, { challenge: { ...challenge, request_id: 12345678 } }),
    { code: "INVALID_CHALLENGE" },
  );
});

test("cached decisions expire from the original capture time", (t) => {
  const { receipt, verify } = evidence(t);
  const result = verify();
  assert.equal(
    refreshDecision(result, receipt.completed_at + 10).decision,
    "DISPATCH",
  );
  const expired = refreshDecision(result, receipt.completed_at + 11);
  assert.equal(expired.accepted, false);
  assert.equal(expired.decision, "WAIT");
  assert.equal(expired.completed_at, receipt.completed_at);
  assert.equal(
    refreshDecision(expired, receipt.completed_at + 12).decision,
    "WAIT",
  );
});

test("a signed contact receipt cannot override an explicitly disabled enrollment", (t) => {
  const { identity, profile } = fixture(t);
  const contact = { ...profile.contact, sensor: "disabled-contact" };
  const challenge = createChallenge("0123456789abcdef");
  const receipt = simulatedReceipt(
    challenge,
    contact,
    identity.privateKey,
    true,
  );
  assert.throws(
    () =>
      verifyEvidence({
        receipt,
        challenge,
        contact,
        publicKey: identity.publicKey,
      }),
    (error) => error.code === "CONTACT_DISABLED",
  );
});
