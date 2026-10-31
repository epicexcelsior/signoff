import { randomBytes, randomInt, sign, verify } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { setTimeout as wait } from "node:timers/promises";
import { receiptPublicKey, EvidenceError } from "./evidence.js";
import { artifactDigest, canonicalJson } from "./artifacts.js";
import { AppError } from "./store.js";

const execute = promisify(execFile);
const fields = [
  "protocol",
  "provider",
  "sensor",
  "work_order_digest",
  "session_id",
  "request_id",
  "nonce",
  "bits",
  "half_symbol_ms",
  "started_at",
  "completed_at",
  "symbol_count",
  "receipt_signature",
];
const fail = (message) => {
  throw new EvidenceError("INVALID_OPTICAL_EVIDENCE", message);
};
export const opticalRequestId = (workOrderDigest, sessionId) =>
  artifactDigest({
    domain: "proof-of-ready/optical-request/v1",
    workOrderDigest,
    sessionId,
  }).slice(2, 18);

export function createOpticalChallenge(session, now) {
  return {
    work_order_digest: session.workOrderDigest,
    session_id: session.id,
    request_id: opticalRequestId(session.workOrderDigest, session.id),
    nonce: randomInt(1, 0x7fffffff),
    bits: randomBytes(4).toString("hex"),
    half_symbol_ms: 250,
    requested_at: now,
    expires_at: now + 45,
  };
}

export function opticalMessage(receipt) {
  return [
    "proof-of-ready-optical-v1",
    receipt.provider,
    receipt.sensor,
    receipt.work_order_digest,
    receipt.session_id,
    receipt.request_id,
    receipt.nonce,
    receipt.bits,
    receipt.half_symbol_ms,
    receipt.started_at,
    receipt.completed_at,
    receipt.symbol_count,
  ].join("|");
}

export function verifyOpticalExecution({
  receipt,
  challenge,
  provider,
  publicKey,
  verifiedAt,
}) {
  if (
    !receipt ||
    Object.keys(receipt).length !== fields.length ||
    fields.some((f) => !Object.hasOwn(receipt, f)) ||
    receipt.protocol !== "proof-of-ready/optical-execution/v1" ||
    receipt.provider !== provider ||
    !/^[A-Za-z0-9_-]{1,31}$/.test(provider) ||
    receipt.sensor !== "optical-led"
  )
    fail("Use the enrolled provider's supported signed optical execution.");
  if (
    !challenge ||
    !/^0x[0-9a-f]{64}$/.test(challenge.work_order_digest ?? "") ||
    !/^[0-9a-f]{16}$/.test(challenge.session_id ?? "") ||
    challenge.request_id !==
      opticalRequestId(challenge.work_order_digest, challenge.session_id) ||
    !/^[0-9a-f]{8}$/.test(challenge.bits ?? "") ||
    !Number.isSafeInteger(challenge.nonce) ||
    challenge.nonce < 1 ||
    challenge.nonce > 0x7fffffff ||
    challenge.half_symbol_ms !== 250 ||
    ![challenge.requested_at, challenge.expires_at, verifiedAt].every(
      (v) => Number.isSafeInteger(v) && v > 0,
    ) ||
    challenge.expires_at - challenge.requested_at !== 45
  )
    fail("Use the original bounded optical challenge.");
  for (const f of [
    "work_order_digest",
    "session_id",
    "request_id",
    "nonce",
    "bits",
    "half_symbol_ms",
  ])
    if (receipt[f] !== challenge[f])
      fail("The optical execution belongs to another challenge.");
  if (
    ![receipt.started_at, receipt.completed_at].every(
      (v) => Number.isSafeInteger(v) && v > 0,
    ) ||
    receipt.started_at < challenge.requested_at - 2 ||
    receipt.completed_at - receipt.started_at < 17 ||
    receipt.completed_at - receipt.started_at > 19 ||
    receipt.completed_at > challenge.expires_at ||
    receipt.completed_at > verifiedAt + 2 ||
    verifiedAt > challenge.expires_at ||
    verifiedAt - receipt.completed_at > 10 ||
    challenge.requested_at > verifiedAt + 2 ||
    receipt.symbol_count !== 72
  )
    fail(
      "The execution does not cover the original 18-second emission window.",
    );
  const encoded =
    typeof receipt.receipt_signature === "string" &&
    receipt.receipt_signature.startsWith("v3:")
      ? receipt.receipt_signature.slice(3)
      : "";
  const bytes = Buffer.from(encoded, "base64");
  if (
    !/^[A-Za-z0-9+/]{86}==$/.test(encoded) ||
    bytes.length !== 64 ||
    bytes.toString("base64") !== encoded ||
    !verify(
      "sha256",
      Buffer.from(opticalMessage(receipt)),
      { key: receiptPublicKey(publicKey), dsaEncoding: "ieee-p1363" },
      bytes,
    )
  )
    fail("The optical signature changed or another device signed it.");
  return {
    verified: true,
    source: "pinned-device-optical-execution",
    receiptDigest: artifactDigest(receipt),
    limitation:
      "The signed execution claim does not authenticate the camera or installed firmware.",
  };
}

export function makeOpticalEmitter(config, identity, env = process.env) {
  if (config.mode === "simulation")
    return async ({ challenge, contact }) => {
      await wait(18000);
      const receipt = {
        protocol: "proof-of-ready/optical-execution/v1",
        provider: contact.provider,
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
        started_at: challenge.requested_at,
        completed_at: challenge.requested_at + 18,
        symbol_count: 72,
      };
      receipt.receipt_signature = `v3:${sign("sha256", Buffer.from(opticalMessage(receipt)), { key: identity.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64")}`;
      return receipt;
    };
  return async (job) => {
    if (!config.opticalAuthorized)
      throw new AppError(
        "OPTICAL_DISABLED",
        "Physical optical emission requires explicit authorization and an enrolled board driver.",
        403,
      );
    const allowed = Object.fromEntries(
      [
        "PATH",
        "HOME",
        "LANG",
        "DBUS_SESSION_BUS_ADDRESS",
        "XDG_RUNTIME_DIR",
        "FIELDPROOF_BLE_ADDRESS",
        "FIELDPROOF_DEVICE_SECRET",
        "PROOFREADY_OPTICAL_AUTHORIZED",
      ]
        .filter((k) => env[k] !== undefined)
        .map((k) => [k, env[k]]),
    );
    const { stdout } = await execute(
      config.python,
      [fileURLToPath(new URL("../device/optical.py", import.meta.url))],
      {
        timeout: 44000,
        maxBuffer: 16384,
        env: { ...allowed, PROOFREADY_OPTICAL_REQUEST: canonicalJson(job) },
      },
    );
    return JSON.parse(stdout);
  };
}
