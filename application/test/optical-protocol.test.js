import test from "node:test";
import assert from "node:assert/strict";
import { sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fixture } from "./helpers.js";
import { artifactDigest } from "../src/artifacts.js";
import {
  createOpticalChallenge,
  opticalMessage,
  verifyOpticalExecution,
} from "../src/optical.js";
const signed = (message, value, key) => ({
  ...value,
  receipt_signature: `v3:${sign("sha256", Buffer.from(message(value)), { key, dsaEncoding: "ieee-p1363" }).toString("base64")}`,
});
const execution = (
  challenge,
  provider,
  key,
  startAt = challenge.requested_at + 2,
) =>
  signed(
    opticalMessage,
    {
      protocol: "proof-of-ready/optical-execution/v1",
      provider,
      sensor: "optical-led",
      ...Object.fromEntries(
        [
          "work_order_digest",
          "session_id",
          "request_id",
          "nonce",
          "bits",
          "half_symbol_ms",
        ].map((k) => [k, challenge[k]]),
      ),
      started_at: startAt,
      completed_at: startAt + 18,
      symbol_count: 72,
    },
    key,
  );

test("optical protocol binds the original device, challenge, wire fields, and execution duration", (t) => {
  const f = fixture(t);
  const session = {
    id: "0123456789abcdef",
    workOrderDigest: artifactDigest({ work: "approved" }),
  };
  const now = Math.floor(Date.now() / 1000);
  const challenge = createOpticalChallenge(session, now);
  const receipt = execution(challenge, "fixture", f.identity.privateKey);
  const input = {
    receipt,
    challenge,
    provider: "fixture",
    publicKey: f.identity.publicKey,
    verifiedAt: now + 21,
  };
  assert.equal(verifyOpticalExecution(input).verified, true);
  const python =
    "import importlib.util,json,sys; spec=importlib.util.spec_from_file_location('optical','device/optical.py'); module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module); data=json.load(sys.stdin); module.validate_receipt(data['receipt'],data['challenge'],'fixture'); print('driver-compatible')";
  assert.match(
    execFileSync("python3", ["-c", python], {
      cwd: new URL("..", import.meta.url),
      input: JSON.stringify({ receipt, challenge }),
      encoding: "utf8",
    }),
    /driver-compatible/,
  );
  for (const edit of [
    (r) => {
      r.bits = "00000000";
    },
    (r) => {
      r.session_id = "1111111111111111";
    },
    (r) => {
      r.symbol_count = 70;
    },
    (r) => {
      r.completed_at++;
    },
    (r) => {
      r.extra = true;
    },
  ]) {
    const copy = structuredClone(receipt);
    edit(copy);
    assert.throws(() => verifyOpticalExecution({ ...input, receipt: copy }));
  }
  assert.throws(() =>
    verifyOpticalExecution({ ...input, verifiedAt: now + 46 }),
  );
  const short = signed(
    opticalMessage,
    { ...receipt, completed_at: receipt.started_at + 16 },
    f.identity.privateKey,
  );
  assert.throws(() => verifyOpticalExecution({ ...input, receipt: short }));
});
