import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/store.js";
import { makePayment } from "../src/payment.js";
import { fixture } from "./helpers.js";

const create = (service, closed = false, id = "request-00001") =>
  service.create({ idempotency_key: id, closed });

test("one intent creates one immutable job and rejects changed input", (t) => {
  const { service } = fixture(t);
  const first = create(service);
  assert.equal(create(service).id, first.id);
  assert.throws(() => create(service, true), { code: "INTENT_CONFLICT" });
  assert.throws(
    () => service.create({ idempotency_key: 12345678, closed: false }),
    { code: "INVALID_REQUEST" },
  );
  assert.throws(
    () =>
      service.create({
        idempotency_key: "request-00002",
        closed: false,
        price: 1,
      }),
    { code: "INVALID_REQUEST" },
  );
});

test("unpaid capture rejects and concurrent payment/capture runs each external operation once", async (t) => {
  const { service } = fixture(t);
  const first = create(service);
  await assert.rejects(service.capture(first.id), { code: "STATE_CONFLICT" });
  let sends = 0,
    reads = 0;
  const settle = service.payment.settle;
  service.payment.settle = async (...args) => {
    sends++;
    return settle(...args);
  };
  const observe = service.observe;
  service.observe = async (job) => {
    reads++;
    return observe(job);
  };
  const paid = await Promise.all(
    Array.from({ length: 8 }, () =>
      service.pay(first.id, { simulation: first.id }),
    ),
  );
  assert(paid.every((job) => job.state === "PAID"));
  const results = await Promise.all(
    Array.from({ length: 8 }, () => service.capture(first.id)),
  );
  assert(
    results.every((job) => service.view(job).decision.decision === "DISPATCH"),
  );
  assert.equal(sends, 1);
  assert.equal(reads, 1);
  await service.pay(first.id, { simulation: first.id });
  await service.capture(first.id);
  assert.equal(sends, 1);
  assert.equal(reads, 1);
});

test("a concurrent changed payment rejects instead of joining the first operation", async (t) => {
  const { service } = fixture(t);
  service.payment.identify = () => "same-transaction";
  const job = create(service);
  const first = service.pay(job.id, { attempt: "first" });
  await assert.rejects(service.pay(job.id, { attempt: "changed" }), {
    code: "PAYMENT_CONFLICT",
  });
  await first;
});

test("one transaction cannot buy two jobs, including through separate SQLite connections", async (t) => {
  const { service, db } = fixture(t);
  service.payment.identify = () => "one-transaction";
  const first = create(service);
  const second = create(service, false, "request-00002");
  await service.pay(first.id, { same: "payment" });
  const other = new Store(db);
  try {
    const original = other.get(first.id);
    assert.throws(
      () =>
        other.update(
          second.id,
          ["AWAITING_PAYMENT"],
          {
            state: "PAYMENT_VERIFYING",
            payment: original.payment,
          },
          "Try to reuse payment",
        ),
      { code: "PAYMENT_REUSE" },
    );
    assert.equal(other.get(second.id).state, "AWAITING_PAYMENT");
  } finally {
    other.close();
  }
});

test("unknown settlement survives restart and reconciles without a replacement or resubmission", async (t) => {
  const { service, db } = fixture(t);
  let sends = 0;
  service.payment.settle = async () => {
    sends++;
    throw new Error("Lost response after possible broadcast");
  };
  const first = create(service);
  const result = await service.pay(first.id, { simulation: first.id });
  assert.equal(result.state, "PAYMENT_UNKNOWN");
  service.store.close();
  service.store = new Store(db);
  assert.equal(
    (await service.pay(first.id, { simulation: first.id })).state,
    "PAYMENT_UNKNOWN",
  );
  assert.equal(sends, 1);
  service.payment.confirm = async () => false;
  assert.equal((await service.reconcile(first.id)).state, "PAYMENT_UNKNOWN");
  service.payment.confirm = async () => true;
  assert.equal((await service.reconcile(first.id)).state, "PAID");
  assert.equal(sends, 1);
  const complete = await service.capture(first.id);
  assert.equal(complete.state, "COMPLETE");
});

test("verification failure submits nothing and resumes only the original bound payment", async (t) => {
  const { service } = fixture(t);
  let sends = 0;
  service.payment.verify = async () => {
    throw new Error("Unavailable");
  };
  service.payment.settle = async (_p, _r, transaction) => {
    sends++;
    return { transaction, network: "simulation" };
  };
  const job = create(service);
  assert.equal(
    (await service.pay(job.id, { simulation: job.id })).state,
    "PAYMENT_VERIFYING",
  );
  assert.equal(sends, 0);
  service.payment.verify = async () => ({ isValid: true });
  assert.equal(
    (await service.pay(job.id, { simulation: job.id })).state,
    "PAID",
  );
  assert.equal(sends, 1);
});

test("rejected payment and failed observations never authorize dispatch", async (t) => {
  const { service } = fixture(t);
  service.payment.verify = async () => ({ isValid: false });
  const job = create(service);
  assert.equal(
    (await service.pay(job.id, { simulation: job.id })).state,
    "PAYMENT_REJECTED",
  );
  await assert.rejects(service.capture(job.id), { code: "STATE_CONFLICT" });
  service.payment = makePayment(service.config);
  const next = create(service, false, "request-00002");
  await service.pay(next.id, { simulation: next.id });
  service.observe = async () => {
    throw Object.assign(new Error("Device unavailable"), { code: 1 });
  };
  assert.equal((await service.capture(next.id)).state, "OBSERVATION_FAILED");
  assert.equal(
    service.view(service.store.get(next.id)).decision.decision,
    "WAIT",
  );
  assert.equal((await service.capture(next.id)).state, "OBSERVATION_FAILED");
});

test("interrupted observation is not repeated after restart, and configuration changes fail", async (t) => {
  const { service, db } = fixture(t);
  const job = create(service);
  await service.pay(job.id, { simulation: job.id });
  service.store.update(
    job.id,
    ["PAID"],
    { state: "OBSERVING", challenge: { request_id: job.id } },
    "Crash fixture",
  );
  service.store.close();
  service.store = new Store(db);
  service.observe = () => assert.fail("An interrupted observation ran twice");
  assert.equal((await service.capture(job.id)).state, "OBSERVING");
  assert.equal(
    service.view(service.store.get(job.id)).decision.decision,
    "WAIT",
  );
  assert.throws(() => service.store.bindConfig("changed-provider"), {
    code: "CONFIG_CHANGED",
  });
});

test("a malformed facilitator verdict cannot authorize payment submission", async (t) => {
  const { service } = fixture(t);
  service.payment.verify = async () => ({ isValid: "yes" });
  service.payment.settle = () =>
    assert.fail("A malformed verdict authorized submission");
  const job = create(service);
  assert.equal(
    (await service.pay(job.id, { simulation: job.id })).state,
    "PAYMENT_REJECTED",
  );
});

test("Preprod submission requires explicit authorization before any external call", async (t) => {
  const { service } = fixture(t);
  const job = create(service);
  service.config.mode = "preprod";
  service.payment.verify = () =>
    assert.fail("Payment verification ran before authorization");
  await assert.rejects(service.pay(job.id, { simulation: job.id }), {
    code: "PAYMENT_DISABLED",
  });
  assert.equal(service.store.get(job.id).state, "AWAITING_PAYMENT");
});
