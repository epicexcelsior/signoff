import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixture, server } from "./helpers.js";
import { Store } from "../src/store.js";
import {
  CommissioningService,
  verifyPacket,
  evaluateCommissioning,
} from "../src/commissioning.js";
import { artifactDigest, canonicalJson } from "../src/artifacts.js";

const approve = (c, asset = "Cabinet 07") =>
  c.createOrder({
    idempotency_key: `order-${asset.replaceAll(" ", "-")}`,
    asset,
  });
const attempt = (
  c,
  order,
  scenario = "correct",
  intent = `capture-${scenario}`,
) => c.createSession(order.id, { idempotency_key: intent, scenario });
async function complete(c, session) {
  c.fixtureVision(session.id);
  for (let step = 0; step < 3; step++)
    await c.captureStep(session.id, { step });
  return c.inspect(session.id);
}

test("canonical artifacts have stable sorted JSON and reject non-JSON values", () => {
  assert.equal(
    artifactDigest({ b: [2, 1], a: 3 }),
    artifactDigest({ a: 3, b: [2, 1] }),
  );
  assert.notEqual(artifactDigest([2, 1]), artifactDigest([1, 2]));
  for (const value of [{ a: undefined }, NaN, Infinity, new Date(), [, 1]])
    assert.throws(() => canonicalJson(value));
  assert.match(artifactDigest({ a: "hello" }), /^0x[0-9a-f]{64}$/);
});

test("approved work orders and capture intents stay immutable across SQLite connections", (t) => {
  const { service, db, profile, config } = fixture(t);
  const c = service.commissioning;
  const order = approve(c);
  assert.equal(approve(c).id, order.id);
  assert.throws(
    () =>
      c.createOrder({
        idempotency_key: "order-Cabinet-07",
        asset: "Different cabinet",
      }),
    { code: "INTENT_CONFLICT" },
  );
  const s = attempt(c, order);
  const secondStore = new Store(db);
  try {
    const second = new CommissioningService({
      store: secondStore,
      profile,
      config,
      observe: service.observe,
    });
    assert.equal(attempt(second, order).id, s.id);
    assert.throws(() => attempt(second, order, "stuck", "capture-correct"), {
      code: "INTENT_CONFLICT",
    });
    assert.equal(s.sequence.length, 3);
    assert.notEqual(s.sequence[0], s.sequence[1]);
    assert.notEqual(s.sequence[1], s.sequence[2]);
    assert.equal(s.workOrderDigest, artifactDigest(order));
  } finally {
    secondStore.close();
  }
  assert.throws(
    () =>
      c.createOrder({
        idempotency_key: "order-extra",
        asset: "X",
        requirements: {},
      }),
    { code: "INVALID_REQUEST" },
  );
});

test("rehearsal checks function, placement and receiving application with useful negative results", async (t) => {
  const { service } = fixture(t);
  const c = service.commissioning;
  const order = approve(c);
  for (const [scenario, failed] of [
    ["correct", null],
    ["misplaced", "vision"],
    ["stuck", "function"],
    ["missing-delivery", "delivery"],
  ]) {
    const result = await complete(c, attempt(c, order, scenario));
    const checks = new Map(
      result.report.predicates.map((p) => [p.id, p.outcome]),
    );
    assert.equal(checks.get("device"), "PASS");
    assert.equal(checks.get("optical"), "REVIEW");
    if (failed) {
      assert.equal(checks.get(failed), "FAIL");
      assert.equal(result.acceptance.decision, "REWORK");
    } else {
      for (const id of ["session", "device", "function", "delivery", "vision"])
        assert.equal(checks.get(id), "PASS", id);
      assert.equal(result.acceptance.decision, "REVIEW");
    }
    assert.equal(result.acceptance.liveSettlement, false);
    assert.equal(result.acceptance.contractVerified, false);
    assert.equal(c.inspect(result.id).report.outcome, result.report.outcome);
    assert.throws(
      () =>
        c.captureVision(result.id, {
          frame: result.evidence.vision.frame,
          frameDigest: result.evidence.vision.frameDigest,
          source: result.evidence.vision.source,
        }),
      { code: "SESSION_CLOSED" },
    );
  }
});

test("concurrent capture performs one read and a separate process cannot repeat an interrupted read", async (t) => {
  const { service, db, profile, config } = fixture(t);
  const c = service.commissioning;
  const order = approve(c);
  const s = attempt(c, order);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const observe = c.observe;
  let reads = 0;
  c.observe = async (job) => {
    reads++;
    await gate;
    return observe(job);
  };
  const first = c.captureStep(s.id, { step: 0 });
  const concurrent = c.captureStep(s.id, { step: 0 });
  const secondStore = new Store(db);
  try {
    const second = new CommissioningService({
      store: secondStore,
      profile,
      config,
      observe,
    });
    await assert.rejects(second.captureStep(s.id, { step: 0 }), {
      code: "CAPTURE_PENDING",
    });
    const script = `import {Store} from './src/store.js'; import {CommissioningService} from './src/commissioning.js'; const store=new Store(process.argv[1]); const c=new CommissioningService({store,config:{mode:'simulation'},profile:{},observe:()=>{throw Error('REPEATED')}}); try { await c.captureStep(process.argv[2],{step:0}); process.exitCode=1; } catch(e) { if(e.code!=='CAPTURE_PENDING') throw e; console.log(e.code); } finally {store.close();}`;
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", script, db, s.id],
      { cwd: new URL("..", import.meta.url), encoding: "utf8" },
    );
    assert.match(output, /CAPTURE_PENDING/);
  } finally {
    secondStore.close();
    release();
  }
  await Promise.all([first, concurrent]);
  assert.equal(reads, 1);
  await c.captureStep(s.id, { step: 0 });
  assert.equal(reads, 1);
  await assert.rejects(c.captureStep(s.id, { step: 2 }), {
    code: "CAPTURE_PENDING",
  });
});

test("capture-time verification survives inspection delay and exported packets reject edited evidence", async (t) => {
  const { service, dir } = fixture(t);
  const c = service.commissioning;
  const order = approve(c);
  const s = attempt(c, order);
  c.fixtureVision(s.id);
  for (let step = 0; step < 3; step++) await c.captureStep(s.id, { step });
  const captured = c.store.get("sessions", s.id);
  c.now = () => captured.startedAt + 60000;
  const result = c.inspect(s.id);
  assert.equal(
    result.report.predicates.find((p) => p.id === "device").outcome,
    "PASS",
  );
  const packet = c.packet(s.id);
  const replay = structuredClone(packet.evidence);
  replay.sessionId = "f".repeat(16);
  assert.equal(
    evaluateCommissioning(order, replay).find((p) => p.id === "device").outcome,
    "FAIL",
  );
  const noTime = structuredClone(packet.evidence);
  delete noTime.vision.frame.capturedAt;
  assert.equal(
    evaluateCommissioning(order, noTime).find((p) => p.id === "vision").outcome,
    "REVIEW",
  );
  for (const mutate of [
    (p) => {
      p.evidence.vision.frame = null;
    },
    (p) => {
      p.workOrder.vision = {};
    },
  ]) {
    const malformed = structuredClone(packet);
    mutate(malformed);
    assert.throws(() => verifyPacket(malformed), { code: "INVALID_REQUEST" });
  }
  const verified = verifyPacket(packet, artifactDigest(order));
  assert.equal(verified.ownerPinned, true);
  assert.equal(verified.decision, "REVIEW");
  assert.equal(verifyPacket(packet).ownerPinned, false);
  const path = join(dir, "packet.json");
  writeFileSync(path, JSON.stringify(packet));
  const output = execFileSync(
    process.execPath,
    ["scripts/verify-packet.js", path, artifactDigest(order)],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );
  assert.equal(JSON.parse(output).verified, true);
  assert.throws(() => verifyPacket(packet, `0x${"f".repeat(64)}`), {
    code: "OWNER_PIN_MISMATCH",
  });
  packet.evidence.device[0].receipt.result.closed =
    !packet.evidence.device[0].receipt.result.closed;
  assert.throws(() => verifyPacket(packet), { code: "PACKET_MISMATCH" });
  assert.throws(() => verifyPacket({ schema: "proof-of-ready/packet/v1" }), {
    code: "INVALID_REQUEST",
  });
  assert.throws(
    () =>
      c.captureVision(s.id, {
        frame: {},
        frameDigest: artifactDigest({}),
        source: "browser-camera",
      }),
    { code: "INVALID_REQUEST" },
  );
});

test("expired and incomplete sessions cannot approve work, wrong keys fail, and physical mode rejects fixtures", async (t) => {
  const { service } = fixture(t);
  const c = service.commissioning;
  const order = approve(c);
  const s = attempt(c, order);
  c.now = () => s.expiresAt + 1;
  await assert.rejects(c.captureStep(s.id, { step: 0 }), {
    code: "SESSION_EXPIRED",
  });
  assert.equal(c.inspect(s.id).acceptance.decision, "REWORK");
  c.now = Date.now;
  const physical = new CommissioningService({
    store: service.store,
    config: { mode: "preprod" },
    profile: service.profile,
    observe: service.observe,
  });
  const physicalOrder = approve(physical, "Physical cabinet");
  const ps = attempt(physical, physicalOrder, "correct", "capture-physical");
  assert.throws(() => physical.fixtureVision(ps.id), {
    code: "FIXTURE_DISABLED",
  });
  assert.throws(() => attempt(physical, physicalOrder, "stuck"), {
    code: "INVALID_REQUEST",
  });
  const second = fixture(t);
  c.observe = second.service.observe;
  const wrong = attempt(c, order, "correct", "capture-wrong-key");
  await c.captureStep(wrong.id, { step: 0 });
  const report = c.inspect(wrong.id);
  assert.equal(report.device[0].error.code, "INVALID_SIGNATURE");
  assert.equal(report.acceptance.decision, "REWORK");
});

test("commissioning HTTP requires capability and returns reproducible bounded packets", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
  const { token } = await (await fetch(`${origin}/api/config`)).json();
  const post = (path, body) =>
    fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FieldProof-Token": token,
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await fetch(`${origin}/api/commissioning/work-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
  const order = await (
    await post("/api/commissioning/work-orders", {
      idempotency_key: "http-order-test",
      asset: "HTTP cabinet",
    })
  ).json();
  const s = await (
    await post(`/api/commissioning/work-orders/${order.id}/sessions`, {
      idempotency_key: "http-capture-test",
    })
  ).json();
  await post(`/api/commissioning/sessions/${s.id}/fixture-vision`, {});
  for (let step = 0; step < 3; step++)
    assert.equal(
      (await post(`/api/commissioning/sessions/${s.id}/contact`, { step }))
        .status,
      200,
    );
  assert.equal(
    (await post(`/api/commissioning/sessions/${s.id}/inspect`, {})).status,
    200,
  );
  const exported = await fetch(
    `${origin}/api/commissioning/sessions/${s.id}/packet`,
  );
  assert.match(exported.headers.get("content-disposition"), /attachment/);
  const packet = await exported.json();
  assert.equal(
    (await post("/api/commissioning/verify", { packet })).status,
    200,
  );
  const page = await fetch(origin);
  assert.doesNotMatch(
    page.headers.get("content-security-policy"),
    /unsafe-eval/,
  );
  const worker = await fetch(`${origin}/vision/detector-worker.js`);
  assert.match(worker.headers.get("content-security-policy"), /unsafe-eval/);
  const detector = await fetch(`${origin}/vision/detector.js`);
  assert.doesNotMatch(
    detector.headers.get("content-security-policy"),
    /unsafe-eval/,
  );
});

test("clock boundaries preserve exact session duration and deeply nested camera input returns a validation error", (t) => {
  const { service } = fixture(t);
  const c = service.commissioning;
  let instant = Date.now();
  c.now = () => instant++;
  const order = approve(c);
  assert.equal(order.expiresAt - order.approvedAt, 86400000);
  const session = attempt(c, order);
  assert.equal(session.expiresAt - session.startedAt, 120000);
  const frame = {
    capturedAt: session.startedAt,
    resolution: { width: 640, height: 480 },
    markers: [],
  };
  let camera = {};
  for (let index = 0; index < 40; index++) camera = { child: camera };
  assert.throws(
    () =>
      c.captureVision(session.id, {
        frame,
        frameDigest: artifactDigest({}),
        source: "browser-camera",
        camera,
      }),
    { code: "INVALID_REQUEST" },
  );
  assert.equal(c.store.get("sessions", session.id).vision, null);
});
