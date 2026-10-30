import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../../src/store.js";
import { PaidInspector, sha256 } from "../src/service.js";
const artifact = {
  mode: "simulation",
  workOrderHash: "0x" + "11".repeat(32),
  evidenceBundleHash: "0x" + "22".repeat(32),
  requiredChecks: ["optical", "contact"],
  checks: [],
};
const request = {
  inspectionId: "original-inspection",
  workOrderHash: artifact.workOrderHash,
  evidenceBundleHash: artifact.evidenceBundleHash,
  inputText: "Inspect missing physical evidence.",
  idempotencyKey: "original-paid-request",
};
function setup(t, opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), "proof-ready-x402-inspector-"));
  const path = join(dir, "ledger.sqlite");
  const store = new Store(path);
  const counts = { settled: 0, loaded: 0 };
  const payment = {
    identify: (payload) => {
      if (payload.transaction !== "original-tx")
        throw new Error("Changed transaction");
      return payload.transaction;
    },
    verify: async () => ({ isValid: true }),
    settle: async () => {
      counts.settled++;
      if (opts.lostResponse) throw new Error("Lost response");
      return {
        success: true,
        transaction: "original-tx",
        network: "cardano:preprod",
      };
    },
    confirm: async () => true,
  };
  const loadArtifact = async (input) => {
    counts.loaded++;
    assert.deepEqual(input, request);
    return structuredClone(artifact);
  };
  const service = new PaidInspector({
    store,
    payment,
    sellerAddress: "addr_test1seller",
    writesAuthorized: opts.authorized !== false,
    loadArtifact,
  });
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { store, service, payment, counts, path, loadArtifact };
}
test("confirmed payment buys a useful exact missing-evidence REVIEW, with source mode retained", async (t) => {
  const { service, counts, store } = setup(t);
  const created = await service.create(request);
  await assert.rejects(service.inspect(created.id), {
    code: "PAYMENT_REQUIRED",
  });
  const paid = await service.pay(created.id, { transaction: "original-tx" });
  assert.equal(paid.state, "PAID");
  const [a, b] = await Promise.all([
    service.inspect(created.id),
    service.inspect(created.id),
  ]);
  assert.equal(a.state, "COMPLETE");
  assert.equal(b.resultHash, a.resultHash);
  assert.equal(a.report.outcome, "REVIEW");
  assert.equal(a.evidenceMode, "simulation");
  assert.equal(a.physicalAcceptance, false);
  assert.equal(a.resultHash, sha256(a.resultText));
  assert.equal(a.report.workOrderHash, request.workOrderHash);
  assert.equal(counts.settled, 1);
  assert.ok(store.events(created.id).some((e) => e.kind === "COMPLETE"));
  assert.equal(service.view(a).payment.payload, undefined);
});
test("restart reconciles the original uncertain submission without another payment", async (t) => {
  const { service, payment, counts, path, loadArtifact } = setup(t, {
    lostResponse: true,
  });
  const created = await service.create(request);
  assert.equal(
    (await service.pay(created.id, { transaction: "original-tx" })).state,
    "PAYMENT_UNKNOWN",
  );
  const reopened = new Store(path);
  t.after(() => reopened.close());
  const restored = new PaidInspector({
    store: reopened,
    payment,
    sellerAddress: "addr_test1seller",
    writesAuthorized: true,
    loadArtifact,
  });
  assert.equal(
    (await restored.pay(created.id, { transaction: "original-tx" })).state,
    "PAYMENT_UNKNOWN",
  );
  assert.equal(counts.settled, 1);
  assert.equal((await restored.reconcile(created.id)).state, "PAID");
  assert.equal((await restored.inspect(created.id)).state, "COMPLETE");
});
test("authorization, immutable inputs, payment reuse, and changed payloads stop before delivery", async (t) => {
  const { service, store, counts } = setup(t, { authorized: false });
  const created = await service.create(request);
  await assert.rejects(
    service.pay(created.id, { transaction: "original-tx" }),
    { code: "PAYMENT_DISABLED" },
  );
  assert.equal(counts.settled, 0);
  assert.equal(store.get(created.id).state, "AWAITING_PAYMENT");
  await assert.rejects(
    service.create({ ...request, inputText: "Changed input" }),
  );
  await assert.rejects(
    service.create({ ...request, evidenceBundleHash: "0x" + "33".repeat(32) }),
  );
  await assert.rejects(service.pay(created.id, { transaction: "changed" }));
});
test("concurrent pay requests submit once and an original transaction cannot fund a second inspection", async (t) => {
  const { service, counts, store } = setup(t);
  const created = await service.create(request);
  await Promise.all([
    service.pay(created.id, { transaction: "original-tx" }),
    service.pay(created.id, { transaction: "original-tx" }),
  ]);
  assert.equal(counts.settled, 1);
  const second = store.create("different-inspection", request, service.profile);
  await assert.rejects(service.pay(second.id, { transaction: "original-tx" }), {
    code: "PAYMENT_REUSE",
  });
  assert.equal(counts.settled, 1);
  await assert.rejects(
    service.pay(created.id, { transaction: "original-tx", extra: true }),
    { code: "PAYMENT_CONFLICT" },
  );
});
