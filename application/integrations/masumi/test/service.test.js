import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createInspectionService,
  createFixtureRuntime,
  openLedger,
  inspectVerifiedChecks,
} from "../src/index.js";
import {
  request,
  artifact,
  fixture,
  paidFixture,
  until,
  temporary,
} from "./helpers.js";

test("execution-only fixture delivers a useful negative report without claiming seller payment", async (t) => {
  const { service, runtime } = fixture(t, {
    loadArtifact: async () => artifact("FAIL"),
  });
  const created = service.create(request());
  assert.equal(service.create(request()).taskId, created.taskId);
  assert.throws(
    () => service.create({ ...request(), inputText: "changed evidence" }),
    { code: "IDEMPOTENCY_CONFLICT" },
  );
  const done = await until(service, created.taskId, "COMPLETE");
  assert.equal(done.report.outcome, "FAIL");
  assert.equal(done.sellerPaid, false);
  assert.equal(done.paid, false);
  assert.equal(runtime.counts.created, 1);
  assert.equal(runtime.counts.completed, 1);
  await service.advance(created.taskId);
  assert.equal(runtime.counts.completed, 1);
});

test("two database connections permit one remote Task creation claim", async (t) => {
  const { path, service, runtime } = fixture(t);
  const otherLedger = openLedger(path);
  t.after(() => otherLedger.close());
  const other = createInspectionService({
    ledger: otherLedger,
    runtime,
    loadArtifact: async () => artifact(),
  });
  const created = service.create(request());
  assert.equal(other.create(request()).taskId, created.taskId);
  const results = await Promise.allSettled([
    service.advance(created.taskId),
    other.advance(created.taskId),
  ]);
  assert.equal(results.filter((p) => p.status === "fulfilled").length, 1);
  assert.equal(runtime.counts.created, 1);
});

test("lost Task creation response reconciles the same Task after reopening the ledger", async (t) => {
  const path = join(temporary(t), "restart.sqlite");
  const runtime = createFixtureRuntime();
  const create = runtime.createTask;
  runtime.createTask = async (input) => {
    await create(input);
    throw new Error("connection lost");
  };
  let ledger = openLedger(path);
  let service = createInspectionService({
    ledger,
    runtime,
    loadArtifact: async () => artifact(),
  });
  const { taskId } = service.create(request());
  await assert.rejects(service.advance(taskId), {
    code: "OPERATION_UNCERTAIN",
  });
  assert.equal(service.get(taskId).stage, "TASK_CREATING");
  ledger.close();
  ledger = openLedger(path);
  t.after(() => ledger.close());
  service = createInspectionService({
    ledger,
    runtime,
    loadArtifact: async () => artifact(),
  });
  await assert.rejects(service.advance(taskId), { code: "RECOVERY_REQUIRED" });
  assert.equal((await service.reconcile(taskId)).stage, "TASK_CREATED");
  await until(service, taskId, "COMPLETE");
  assert.equal(runtime.counts.created, 1);
});

test("process restart preserves a write claim and reconciliation never sends another Task", async (t) => {
  const path = join(temporary(t), "process.sqlite");
  const moduleUrl = pathToFileURL(
    join(import.meta.dirname, "../src/index.js"),
  ).href;
  const script = `import { openLedger, createFixtureRuntime, createInspectionService } from ${JSON.stringify(moduleUrl)};
    const ledger = openLedger(process.argv[1]);
    const service = createInspectionService({ ledger, runtime: createFixtureRuntime(), loadArtifact: async () => ({}) });
    const state = service.create(${JSON.stringify(request())});
    ledger.update(state.taskId, state.version, { stage: 'TASK_CREATING' });
    process.stdout.write(state.taskId); process.exit(0);`;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script, path],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
  const ledger = openLedger(path);
  t.after(() => ledger.close());
  const runtime = createFixtureRuntime();
  const service = createInspectionService({
    ledger,
    runtime,
    loadArtifact: async () => artifact(),
  });
  await assert.rejects(service.advance(child.stdout), {
    code: "RECOVERY_REQUIRED",
  });
  assert.equal((await service.reconcile(child.stdout)).stage, "TASK_CREATING");
  assert.equal(runtime.counts.created, 0);
});

test("completion with a lost response requires matching exact result event before recovery", async (t) => {
  const { runtime, service } = fixture(t);
  const { taskId } = service.create(request());
  await until(service, taskId, "COMPLETION_READY");
  const complete = runtime.completeTask;
  runtime.completeTask = async (...args) => {
    await complete(...args);
    throw new Error("lost");
  };
  await assert.rejects(service.advance(taskId), {
    code: "OPERATION_UNCERTAIN",
  });
  assert.equal((await service.reconcile(taskId)).stage, "COMPLETE");
  assert.equal(runtime.counts.completed, 1);
});

test("substituted Task input and evidence stop the inspector", async (t) => {
  const { runtime, service } = fixture(t);
  const { taskId } = service.create(request());
  await service.advance(taskId);
  const original = runtime.readTask;
  runtime.readTask = async (id) => ({
    ...(await original(id)),
    description: "substituted",
  });
  await assert.rejects(service.advance(taskId), {
    code: "TASK_INPUT_MISMATCH",
  });
  assert.equal(runtime.counts.started, 0);
  runtime.readTask = original;
  const other = fixture(t, {
    loadArtifact: async () => ({
      ...artifact(),
      evidenceBundleHash: `0x${"c".repeat(64)}`,
    }),
  });
  const second = other.service.create(request());
  await until(other.service, second.taskId, "EVALUATION_READY");
  await assert.rejects(other.service.advance(second.taskId), {
    code: "OPERATION_UNCERTAIN",
  });
  assert.equal(other.service.get(second.taskId).report, undefined);
});

test("paid mock path separates lock, delivered FAIL, and independently verified seller receipt", async (t) => {
  const h = paidFixture(t, { loadArtifact: async () => artifact("FAIL") });
  const { taskId } = h.service.create(request());
  let state = await until(h.service, taskId, "AWAITING_WITHDRAWAL");
  assert.equal(state.report.outcome, "FAIL");
  assert.equal(state.sellerPaid, false);
  h.state.phase = "Withdrawn";
  state = await h.service.advance(taskId);
  assert.equal(state.sellerPaid, false);
  h.state.receipt = {
    settled: true,
    txHash: h.state.txHash,
    blockchainIdentifier: h.state.terms.blockchainIdentifier,
  };
  state = await h.service.advance(taskId);
  assert.equal(state.stage, "SELLER_PAID");
  assert.equal(state.sellerPaid, true);
  assert.equal(h.state.calls.terms, 1);
  assert.equal(h.state.calls.submit, 1);
});

test("uncertain result submission reconciles original hash without another submit", async (t) => {
  const h = paidFixture(t);
  const { taskId } = h.service.create(request());
  await until(h.service, taskId, "RESULT_SAVED");
  const submit = h.mps.submitResult;
  h.mps.submitResult = async (...args) => {
    await submit(...args);
    throw new Error("lost");
  };
  await assert.rejects(h.service.advance(taskId), {
    code: "OPERATION_UNCERTAIN",
  });
  assert.equal((await h.service.reconcile(taskId)).stage, "COMPLETION_READY");
  assert.equal(h.state.calls.submit, 1);
});

test("undelivered paid service can request and authorize the original refund without repurchase", async (t) => {
  const h = paidFixture(t, {
    evaluate: async () => {
      throw new Error("corrupt evidence");
    },
  });
  const { taskId } = h.service.create(request());
  await until(h.service, taskId, "EVALUATION_READY");
  await assert.rejects(h.service.advance(taskId), {
    code: "OPERATION_UNCERTAIN",
  });
  assert.equal((await h.service.requestRefund(taskId)).stage, "REFUND_PENDING");
  assert.equal(
    (await h.service.authorizeRefund(taskId)).stage,
    "AWAITING_REFUND_AUTHORIZATION",
  );
  h.state.phase = "RefundWithdrawn";
  const done = await h.service.reconcile(taskId);
  assert.equal(done.stage, "REFUND_WITHDRAWN");
  assert.equal(done.sellerPaid, false);
  assert.equal(h.state.calls.refund, 1);
  assert.equal(h.state.calls.authorize, 1);
  assert.equal(h.state.calls.terms, 1);
});

test("wrong paid terms, altered result hashes, and expired deadlines stop acceptance", async (t) => {
  const h = paidFixture(t);
  const { taskId } = h.service.create(request());
  await until(h.service, taskId, "AWAITING_ESCROW");
  h.state.terms.SmartContractWallet.walletVkey = "different-seller";
  await assert.rejects(h.service.advance(taskId), {
    code: "PAYMENT_TERMS_MISMATCH",
  });
  h.state.terms.SmartContractWallet.walletVkey = h.registration.sellerVkey;
  await until(h.service, taskId, "AWAITING_RESULT");
  h.state.submittedHash = "0".repeat(64);
  await assert.rejects(h.service.advance(taskId), {
    code: "RESULT_HASH_MISMATCH",
  });
  const expired = paidFixture(t, { now: () => Date.now() + 60 * 60_000 });
  const other = expired.service.create(request());
  await until(expired.service, other.taskId, "TERMS_SAVED");
  // Terms are generated against the service clock, so move that saved deadline into the past.
  const saved = expired.service.get(other.taskId);
  expired.ledger.update(saved.taskId, saved.version, {
    terms: { ...saved.terms, payByTime: new Date(1).toISOString() },
  });
  await assert.rejects(expired.service.advance(other.taskId), {
    code: "PAYMENT_DEADLINE",
  });
});

test("paid setup rejects fixture runtime and ledger identity changes", (t) => {
  const h = paidFixture(t);
  assert.throws(
    () =>
      createInspectionService({
        ledger: h.ledger,
        runtime: createFixtureRuntime(),
        loadArtifact: async () => artifact(),
        paid: true,
        paymentsAuthorized: true,
        registration: h.registration,
        mps: h.mps,
        readUtxos: h.readUtxos,
      }),
    { code: "PAYMENT_AUTHORIZATION_REQUIRED" },
  );
  assert.throws(
    () =>
      createInspectionService({
        ledger: h.ledger,
        runtime: { ...h.runtime, identity: { coworkerId: "wrong" } },
        loadArtifact: async () => artifact(),
        evaluate: inspectVerifiedChecks,
      }),
    { code: "LEDGER_CONFIG_MISMATCH" },
  );
});
