import test from "node:test";
import assert from "node:assert/strict";
import { sign } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fixture, server } from "./helpers.js";
import { Store } from "../src/store.js";
import { CommissioningService, verifyPacket } from "../src/commissioning.js";
import { opticalMessage } from "../src/optical.js";
import { encodeOpticalChallenge } from "../public/vision/optical.js";
import { artifactDigest, canonicalJson } from "../src/artifacts.js";
import {
  bindInspectionResult,
  inspectionTransportText,
  contractExpectations,
} from "../src/inspection-binding.js";
import {
  createExternalAcceptance,
  loadExternalConfig,
} from "../src/external-acceptance.js";
import { createInspectionBridge } from "../src/inspection-bridge.js";
import { phoneEvidenceMessage } from "../mobile/src/phone-evidence.mjs";
import { loadConfig } from "../src/config.js";
import { createHash } from "node:crypto";

const signed = (message, value, key) => ({
  ...value,
  receipt_signature: `v3:${sign("sha256", Buffer.from(message(value)), { key, dsaEncoding: "ieee-p1363" }).toString("base64")}`,
});
const sha = (value) => createHash("sha256").update(value).digest("hex");
const start = (c) => {
  const order = c.createOrder({
    idempotency_key: "extended-order",
    asset: "Cabinet extension",
  });
  return {
    order,
    session: c.createSession(order.id, { idempotency_key: "extended-capture" }),
  };
};
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
const square = (x, y, side) => [
  { x, y },
  { x: x + side, y },
  { x: x + side, y: y + side },
  { x, y: y + side },
];
async function sealWithOptical(t, { physical = false, enrolled = false } = {}) {
  const f = fixture(t);
  const c = f.service.commissioning;
  let now = Date.now();
  c.now = () => now;
  if (physical) {
    f.config.mode = "physical";
    f.profile.contact.sensor = "gpio3-contact";
    f.config.opticalAuthorized = true;
  }
  if (enrolled)
    f.config.externalConfig = {
      software: {
        state: "operator-enrolled",
        manifestDigest: artifactDigest({ compiled: "disposable-fixture" }),
        manifest: { version: "1.9.0" },
        maxCvssTenths: 70,
      },
    };
  const { order, session } = start(c);
  const frame = {
    capturedAt: now,
    resolution: { width: 640, height: 480 },
    calibrationId: "extended-calibration",
    markers: [
      { id: 0, corners: square(70, 70, 60) },
      { id: 10, corners: square(185, 85, 30) },
    ],
  };
  const camera = {
    id: "extended-camera",
    resolution: { width: 640, height: 480 },
  };
  c.captureVision(session.id, {
    frame,
    frameDigest: artifactDigest(frame),
    source: "browser-camera",
    camera,
  });
  for (let step = 0; step < 3; step++)
    await c.captureStep(session.id, { step });
  const challenge = c.prepareOptical(session.id);
  const receipt = execution(
    challenge,
    order.device.contact.provider,
    f.identity.privateKey,
  );
  c.emitOptical = async () => {
    now = (receipt.completed_at + 1) * 1000;
    return receipt;
  };
  await c.executeOptical(session.id);
  const captureStartedAtMs = session.startedAt + 100;
  const startAtMs = receipt.started_at * 1000;
  const captureEndedAtMs = (receipt.completed_at + 0.5) * 1000;
  const opticalChallenge = { bits: challenge.bits, halfSymbolMs: 250 };
  const encoded = encodeOpticalChallenge(opticalChallenge);
  const samples = [];
  for (
    let atMs = captureStartedAtMs + 25;
    atMs <= captureEndedAtMs;
    atMs += 50
  ) {
    const index = Math.floor((atMs - startAtMs) / 250);
    const bit = index >= 0 && index < 72 ? encoded.symbols[index] : 0;
    samples.push({
      atMs,
      elapsedMs: atMs - captureStartedAtMs,
      brightness: bit ? 0.85 : 0.15,
      contrast: 0.9,
      tracked: true,
      frameNumber: samples.length + 1,
      deviceCorners: frame.markers[1].corners,
      referenceCorners: frame.markers[0].corners,
    });
  }
  const capture = {
    schemaVersion: "proof-of-ready-optical-capture-v1",
    source: "browser-camera",
    sessionId: session.id,
    challenge: opticalChallenge,
    roi: order.optical.roi,
    camera,
    calibrationId: frame.calibrationId,
    resolution: frame.resolution,
    captureStartedAtMs,
    captureEndedAtMs,
    samples,
    incidents: [],
    evaluation: { state: "FAIL" },
  };
  const saved = c.captureOptical(session.id, { capture });
  assert.equal(saved.optical.evaluation.outcome, "PASS");
  return {
    ...f,
    c,
    order,
    session,
    capture,
    setNow: (value) => {
      now = value;
    },
    now: () => now,
  };
}

test("complete optical capture reconstructs raw symbols, binds the camera and preserves fixture origin", async (t) => {
  const { c, session, capture } = await sealWithOptical(t);
  const result = c.inspect(session.id);
  assert.equal(result.report.outcome, "PASS");
  assert.equal(result.acceptance.decision, "REVIEW");
  assert.equal(
    verifyPacket(c.packet(session.id), session.workOrderDigest).report,
    "PASS",
  );
  const packet = c.packet(session.id);
  packet.evidence.optical.capture.samples[70].brightness =
    1 - packet.evidence.optical.capture.samples[70].brightness;
  assert.throws(() => verifyPacket(packet), { code: "PACKET_MISMATCH" });
  const cameraEdit = c.packet(session.id);
  cameraEdit.evidence.optical.capture.camera.id = "other-camera";
  assert.throws(() => verifyPacket(cameraEdit), { code: "PACKET_MISMATCH" });
  assert.throws(() => c.captureOptical(session.id, { capture }), {
    code: "SESSION_CLOSED",
  });
});

test("optical claims coalesce concurrent callers and survive restart without repeating emission", async (t) => {
  const f = fixture(t);
  const c = f.service.commissioning;
  const { session } = start(c);
  const challenge = c.prepareOptical(session.id);
  let release;
  let count = 0;
  const gate = new Promise((r) => {
    release = r;
  });
  let now = Date.now();
  c.now = () => now;
  const receipt = execution(
    challenge,
    f.profile.contact.provider,
    f.identity.privateKey,
  );
  c.emitOptical = async () => {
    count++;
    await gate;
    now = (receipt.completed_at + 1) * 1000;
    return receipt;
  };
  const a = c.executeOptical(session.id),
    b = c.executeOptical(session.id);
  const db = new Store(f.db);
  const second = new CommissioningService({
    store: db,
    config: f.config,
    profile: f.profile,
    observe: f.service.observe,
    emitOptical: () => {
      throw Error("REPEATED");
    },
  });
  try {
    await assert.rejects(second.executeOptical(session.id), {
      code: "OPTICAL_PENDING",
    });
    assert.throws(() => second.inspect(session.id), {
      code: "CAPTURE_PENDING",
    });
    await assert.rejects(second.captureStep(session.id, { step: 0 }), {
      code: "CAPTURE_PENDING",
    });
  } finally {
    db.close();
    release();
  }
  await Promise.all([a, b]);
  await c.executeOptical(session.id);
  assert.equal(count, 1);
  f.config.mode = "physical";
  await assert.rejects(c.executeOptical(session.id), {
    code: "OPTICAL_DISABLED",
  });
});

test("Seeker evidence rejects changed keys and replays while preserving historical verification", async (t) => {
  const f = fixture(t);
  const c = f.service.commissioning;
  f.config.phonePublicKey = f.identity.publicKey;
  const { order, session } = start(c);
  const challenge = c.preparePhone(session.id);
  assert.deepEqual(c.preparePhone(session.id), challenge);
  const { schema: _, ...bindings } = challenge;
  const envelope = signed(
    phoneEvidenceMessage,
    {
      schema: "proof-of-ready/phone-photo/v1",
      ...bindings,
      image_sha256: sha("private jpeg"),
      captured_at: challenge.requested_at,
      public_key_sec1_hex: f.identity.publicKey,
      key_security_level: "software_reported",
    },
    f.identity.privateKey,
  );
  assert.throws(
    () =>
      c.capturePhone(session.id, { ...envelope, image_sha256: sha("edited") }),
    { code: "INVALID_PHONE_SIGNATURE" },
  );
  c.capturePhone(session.id, envelope);
  assert.deepEqual(
    c.capturePhone(session.id, envelope).phone.envelope,
    envelope,
  );
  const other = c.createSession(order.id, {
    idempotency_key: "other-phone-capture",
  });
  c.preparePhone(other.id);
  assert.throws(() => c.capturePhone(other.id, envelope), {
    code: "PHONE_CHALLENGE_MISMATCH",
  });
  assert.throws(
    () => c.capturePhone(session.id, { ...envelope, image_sha256: sha("new") }),
    { code: "PHONE_BOUND" },
  );
  const result = c.inspect(session.id);
  assert.equal(
    result.report.predicates.find((p) => p.id === "phone").outcome,
    "PASS",
  );
  c.now = () => Date.now() + 600000;
  assert.equal(verifyPacket(c.packet(session.id)).verified, true);
  assert.deepEqual(
    c.capturePhone(session.id, envelope).phone.envelope,
    envelope,
  );
});

test("prepared inspector input bridges the original SQLite evidence and read-only fixture ledger", async (t) => {
  const { c, session, db, dir } = await sealWithOptical(t);
  c.inspect(session.id);
  const request = c.prepareInspection(session.id);
  assert.deepEqual(c.prepareInspection(session.id), request);
  const bridge = createInspectionBridge(db);
  const artifact = bridge.loadArtifact(request);
  assert.equal(bridge.evaluate(artifact).outcome, "PASS");
  assert.throws(
    () => bridge.loadArtifact({ ...request, inputText: "changed" }),
    { code: "INSPECTION_BINDING_MISMATCH" },
  );
  const report = c.store.get("sessions", session.id).report;
  const resultText = JSON.stringify({ ...report, explanation: null });
  const exactInput = inspectionTransportText(request);
  const state = {
    request,
    exactInput,
    inputHash: sha(exactInput),
    report,
    resultText,
    resultHash: sha(resultText),
    stage: "COMPLETE",
    transportMode: "fixture",
    paid: false,
    sellerPaid: false,
  };
  const ledger = join(dir, "tasks.sqlite");
  const local = new DatabaseSync(ledger);
  const identity = { fixture: "read-only-example" };
  local.exec(
    "CREATE TABLE configuration(id INTEGER PRIMARY KEY,value TEXT);CREATE TABLE tasks(inspection_id TEXT,state TEXT)",
  );
  local
    .prepare("INSERT INTO configuration VALUES(1,?)")
    .run(JSON.stringify(identity));
  local
    .prepare("INSERT INTO tasks VALUES(?,?)")
    .run(request.inspectionId, JSON.stringify(state));
  local.close();
  const adapter = createExternalAcceptance({
    masumi: {
      ledgerFile: ledger,
      configurationDigest: artifactDigest(identity),
    },
  });
  const paid = await adapter.readInspection(request, report);
  assert.equal(paid.outcome, "REVIEW");
  assert.equal(paid.delivered, true);
  assert.equal(
    bindInspectionResult({ state, request, report }).outcome,
    "REVIEW",
  );
  assert.throws(
    () =>
      bindInspectionResult({
        state: { ...state, resultHash: sha("changed") },
        request,
        report,
      }),
    { code: "INSPECTION_BINDING_MISMATCH" },
  );
  await assert.rejects(
    createExternalAcceptance({
      masumi: {
        ledgerFile: ledger,
        configurationDigest: artifactDigest({ other: true }),
      },
    }).readInspection(request, report),
    { code: "INSPECTOR_CONFIG_MISMATCH" },
  );
});

test("external reconciliation binds paid evidence and contract policy, expires READY, and never trusts cached packets", async (t) => {
  const { c, session, order, setNow, now, db, profile, config, service } =
    await sealWithOptical(t, { physical: true });
  c.inspect(session.id);
  const stored = c.store.get("sessions", session.id);
  // Disposable fixtures exercise the trusted-reader contract. No live receipt or contract is claimed.
  const evidence = {
    inspectionDigest: artifactDigest(stored.report),
    workOrderDigest: stored.workOrderDigest,
    evidenceBundleDigest: artifactDigest(stored.evidence),
    fixture: true,
  };
  const paid = {
    outcome: "PASS",
    reason: "Disposable reader fixture",
    evidence,
    evidenceDigest: artifactDigest(evidence),
  };
  order.software = {
    manifestDigest: artifactDigest({ build: "reference" }),
    maxCvssTenths: 70,
  };
  assert.equal(
    contractExpectations(
      order,
      stored,
      { ...paid, evidenceDigest: artifactDigest({ changed: true }) },
      artifactDigest({ source: true }),
    ),
    null,
  );
  // This order is intentionally unenrolled. The contract reader must remain unused.
  let reads = 0;
  c.external = {
    readInspection: async () => paid,
    sourceDigest: async () => artifactDigest({ source: true }),
    readContract: async () => {
      reads++;
      return { verdict: "PASS", reason: "fixture" };
    },
  };
  let result = await c.reconcileAcceptance(session.id);
  assert.equal(result.acceptance.decision, "REVIEW");
  assert.equal(reads, 0);
  // Independent gate policy also prevents a cached READY from authorizing work after restart.
  const ready = { ...result.acceptance, decision: "READY" };
  c.store.change(session.id, (s) => ({ ...s, acceptance: ready }));
  const secondStore = new Store(db);
  try {
    const second = new CommissioningService({
      store: secondStore,
      config,
      profile,
      observe: service.observe,
    });
    assert.equal(
      second.view(second.store.get("sessions", session.id)).acceptance.decision,
      "REVIEW",
    );
  } finally {
    secondStore.close();
  }
  setNow(now() + 31000);
  assert.equal(
    c.view(c.store.get("sessions", session.id)).acceptance.decision,
    "REVIEW",
  );
  c.external.readInspection = async () => {
    throw new Error("RPC down");
  };
  result = await c.reconcileAcceptance(session.id);
  assert.equal(result.acceptance.decision, "REVIEW");
  assert.equal(result.external.paid.code, "INSPECTOR_UNAVAILABLE");
  const packet = c.packet(session.id);
  assert.equal(verifyPacket(packet).externalRevalidated, false);
  packet.external.checkedAt++;
  assert.throws(() => verifyPacket(packet), { code: "PACKET_MISMATCH" });
});

test("physical mode loads device pins without payment credentials and rejects the paid lab", async (t) => {
  const f = fixture(t);
  const pins = join(f.dir, "pins.json");
  writeFileSync(
    pins,
    JSON.stringify({
      publicKey: f.identity.publicKey,
      contact: { ...f.profile.contact, sensor: "gpio3-contact" },
    }),
  );
  const config = loadConfig({
    FIELDPROOF_MODE: "physical",
    FIELDPROOF_RECEIPT_PINS: pins,
    FIELDPROOF_BLE_ADDRESS: "00:11:22:33:44:55",
    FIELDPROOF_DEVICE_SECRET: "local-fixture-secret",
    FIELDPROOF_STATE_DIR: f.dir,
  });
  assert.equal(config.mode, "physical");
  assert.equal(config.spendAuthorized, false);
  assert.equal(config.opticalAuthorized, false);
  assert.equal(config.sellerAddress, undefined);
  f.service.config.mode = "physical";
  const base = await server(t, f.service);
  const { token } = await (await fetch(base + "/api/config")).json();
  const response = await fetch(base + "/api/jobs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fieldproof-token": token,
    },
    body: JSON.stringify({ idempotency_key: "physical-mode-job" }),
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "PAYMENT_DISABLED");
  const binary = join(f.dir, "build.bin");
  writeFileSync(binary, "compiled-fixture");
  const manifest = {
    schema: "proof-of-ready/build-manifest/v1",
    component: "apache-nimble",
    version: "1.9.0",
    binarySha256: sha("compiled-fixture"),
    provenance: "operator-enrolled",
  };
  const manifestFile = join(f.dir, "manifest.json");
  writeFileSync(manifestFile, JSON.stringify(manifest));
  const external = join(f.dir, "external.json");
  writeFileSync(
    external,
    JSON.stringify({
      schema: "proof-of-ready/external-config/v1",
      build: { manifestFile, binaryFile: binary },
    }),
  );
  assert.equal(
    loadExternalConfig(external).software.manifestDigest,
    artifactDigest(manifest),
  );
  writeFileSync(binary, "edited-build");
  assert.throws(() => loadExternalConfig(external), {
    code: "BUILD_ARTIFACT_MISMATCH",
  });
});

test("verified reader commitments control READY and fresh reconciliation supersedes older concurrent reads", async (t) => {
  const f = await sealWithOptical(t, { physical: true, enrolled: true });
  const { c, session, order, config, profile, service, db } = f;
  c.inspect(session.id);
  const s = c.store.get("sessions", session.id);
  const evidence = {
    inspectionDigest: artifactDigest(s.report),
    workOrderDigest: s.workOrderDigest,
    evidenceBundleDigest: artifactDigest(s.evidence),
    fixture: true,
  };
  const paid = {
    outcome: "PASS",
    reason: "Disposable paid-reader fixture",
    evidence,
    evidenceDigest: artifactDigest(evidence),
  };
  const source = artifactDigest({ source: "fixture" });
  let calls = 0;
  c.external = {
    readInspection: async () => paid,
    sourceDigest: async () => source,
    readContract: async ({ expected, jobId }) => {
      calls++;
      assert.equal(expected.workOrderDigest, s.workOrderDigest);
      assert.equal(expected.paymentEvidenceDigest, paid.evidenceDigest);
      assert.equal(expected.buildManifestDigest, order.software.manifestDigest);
      assert.equal(expected.deadline, Math.floor(order.expiresAt / 1000));
      assert.match(jobId, /^0x[0-9a-f]{64}$/);
      return {
        verdict: "PASS",
        reason: "Disposable contract reader fixture",
        chainId: 31337,
        contract: "0x" + "11".repeat(20),
        jobId,
        acceptanceHash: artifactDigest(expected),
      };
    },
  };
  const ready = await c.reconcileAcceptance(session.id);
  assert.equal(ready.acceptance.decision, "READY");
  assert.equal(calls, 1);
  assert.equal(c.view(ready).acceptance.decision, "READY");
  const packet = c.packet(session.id);
  assert.equal(verifyPacket(packet).recordedDecision, "READY");
  assert.equal(verifyPacket(packet).decision, "REVIEW");
  f.setNow(f.now() + 30001);
  assert.equal(c.view(ready).acceptance.decision, "REVIEW");
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  c.external.readInspection = async () => {
    await gate;
    return paid;
  };
  const slow = c.reconcileAcceptance(session.id);
  const secondStore = new Store(db);
  try {
    const other = new CommissioningService({
      store: secondStore,
      config,
      profile,
      observe: service.observe,
      external: {
        readInspection: async () => ({
          outcome: "REVIEW",
          reason: "Newer unavailable fixture",
          evidence: null,
        }),
      },
    });
    const newer = await other.reconcileAcceptance(session.id);
    assert.equal(newer.acceptance.decision, "REVIEW");
    release();
    await assert.rejects(slow, { code: "ACCEPTANCE_CONFLICT" });
    assert.equal(
      c.store.get("sessions", session.id).external.paid.reason,
      "Newer unavailable fixture",
    );
  } finally {
    release();
    secondStore.close();
  }
});
