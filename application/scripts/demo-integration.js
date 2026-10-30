import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { Store } from "../src/store.js";
import { Service } from "../src/service.js";
import { simulationIdentity, makeObserver } from "../src/observation.js";
import { makePayment, requirements } from "../src/payment.js";
import { createInspectionBridge } from "../src/inspection-bridge.js";
import { bindInspectionResult } from "../src/inspection-binding.js";
import { verifyPacket } from "../src/commissioning.js";
import {
  createInspectionService,
  createFixtureRuntime,
  openLedger,
} from "../integrations/masumi/src/index.js";

// This command only creates private local fixture ledgers. It has no live runtime,
// hardware adapter, wallet, signing call, or external-write grant.
process.umask(0o077);
const parent = resolve(
  process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state"),
  "proof-of-ready",
  "demonstrations",
);
mkdirSync(parent, { recursive: true, mode: 0o700 });
const dir = mkdtempSync(join(parent, "commissioning-"));
const db = join(dir, "ledger.sqlite");
const store = new Store(db);
const ledger = openLedger(join(dir, "tasks.sqlite"));
try {
  const config = { mode: "simulation", spendAuthorized: false };
  const identity = simulationIdentity(join(dir, "fixture-key.json"));
  const profile = {
    mode: "simulation",
    contact: {
      provider: "fixture-demo",
      sensor: "simulated-contact",
      location: "demo-gate",
    },
    publicKey: identity.publicKey,
    requirements: requirements("simulation-no-funds"),
  };
  store.bindConfig(JSON.stringify(profile));
  const service = new Service({
    store,
    config,
    profile,
    observe: makeObserver(config, identity),
    payment: makePayment(config),
  });
  const c = service.commissioning;
  const runtime = createFixtureRuntime();
  const bridge = createInspectionBridge(db);
  const inspector = createInspectionService({
    ledger,
    runtime,
    loadArtifact: bridge.loadArtifact,
    evaluate: bridge.evaluate,
  });
  const order = c.createOrder({
    idempotency_key: "local-demo-order",
    asset: "Cabinet monitoring station",
  });
  const scenarios = [];
  for (const scenario of [
    "correct",
    "misplaced",
    "stuck",
    "missing-delivery",
  ]) {
    const attempt = c.createSession(order.id, {
      idempotency_key: `demo-${scenario}`,
      scenario,
    });
    c.fixtureVision(attempt.id);
    for (let step = 0; step < 3; step++)
      await c.captureStep(attempt.id, { step });
    c.inspect(attempt.id);
    const request = c.prepareInspection(attempt.id);
    let task = inspector.create(request);
    assert.equal(inspector.create(request).taskId, task.taskId);
    for (let step = 0; step < 10 && task.stage !== "COMPLETE"; step++)
      task = await inspector.advance(task.taskId);
    assert.equal(task.stage, "COMPLETE");
    assert.equal(task.sellerPaid, false);
    c.external = {
      readInspection: async (original, report) =>
        bindInspectionResult({
          state: inspector.get(task.taskId),
          request: original,
          report,
        }),
    };
    const accepted = await c.reconcileAcceptance(attempt.id);
    const packet = c.packet(attempt.id);
    const verified = verifyPacket(packet, accepted.workOrderDigest);
    assert.equal(verified.verified, true);
    assert.equal(
      task.report.outcome,
      scenario === "correct" ? "REVIEW" : "FAIL",
    );
    assert.equal(
      accepted.acceptance.decision,
      scenario === "correct" ? "REVIEW" : "REWORK",
    );
    const edited = structuredClone(packet);
    edited.evidence.device[0].receipt.result.closed =
      !edited.evidence.device[0].receipt.result.closed;
    assert.throws(() => verifyPacket(edited), { code: "PACKET_MISMATCH" });
    const packetFile = join(dir, `${scenario}-packet.json`);
    writeFileSync(packetFile, JSON.stringify(packet, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    scenarios.push({
      scenario,
      inspection: task.report.outcome,
      decision: accepted.acceptance.decision,
      delivered: accepted.external.paid.delivered,
      sellerPaid: false,
      packetFile,
    });
  }
  assert.equal(runtime.counts.created, 4);
  assert.equal(runtime.counts.completed, 4);
  console.log(
    JSON.stringify(
      {
        fixture: true,
        networkWrites: false,
        hardwareOperations: 0,
        payments: 0,
        scenarios,
        limitation:
          "These local fixture Tasks do not establish hosted execution, physical function, or live settlement.",
      },
      null,
      2,
    ),
  );
} finally {
  ledger.close();
  store.close();
}
