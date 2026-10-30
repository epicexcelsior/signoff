import test from "node:test";
import assert from "node:assert/strict";
import { makePayment, requirements, paymentRequired } from "../src/payment.js";
import {
  decodePaymentRequiredHeader,
  encodePaymentRequiredHeader,
} from "@x402/core/http";
import { fixture, server } from "./helpers.js";

test("independent confirmation requires depth, correct recipient, and sufficient original output", async (t) => {
  let depth = 0;
  let amount = "2000000";
  let recipient = "expected-seller";
  const transaction = "a".repeat(64);
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url.endsWith(`/txs/${transaction}`))
      return Response.json({ block_height: 100, valid_contract: true });
    if (url.endsWith("/blocks/latest"))
      return Response.json({ height: 100 + depth });
    if (url.endsWith("/utxos"))
      return Response.json({
        outputs: [
          {
            address: recipient,
            amount: [{ unit: "lovelace", quantity: amount }],
          },
        ],
      });
    assert.fail(`Unexpected network call: ${url}`);
  });
  const payment = makePayment({
    mode: "preprod",
    facilitatorUrl: "https://facilitator.example",
    projectId: "preprod-fixture",
  });
  const req = requirements("expected-seller");
  assert.equal(await payment.confirm(transaction, req), false);
  depth = 1;
  assert.equal(await payment.confirm(transaction, req), true);
  amount = "1999999";
  assert.equal(await payment.confirm(transaction, req), false);
  amount = "2000000";
  recipient = "other-seller";
  assert.equal(await payment.confirm(transaction, req), false);
  assert.throws(
    () =>
      payment.identify(
        { x402Version: 2, accepted: { ...req, network: "cardano:mainnet" } },
        { requirements: req },
      ),
    { code: "INVALID_PAYMENT" },
  );
});

test("Preprod uses x402 payment-required headers and rejects malformed signature headers", async (t) => {
  const { service } = fixture(t);
  const job = service.create({
    idempotency_key: "preprod-quote-01",
    closed: false,
  });
  service.store.update(
    job.id,
    ["AWAITING_PAYMENT"],
    { mode: "preprod" },
    "Protocol-only fixture",
  );
  const origin = await server(t, service);
  const { token } = await (await fetch(`${origin}/api/config`)).json();
  const headers = {
    "Content-Type": "application/json",
    "X-Fieldproof-Token": token,
  };
  const response = await fetch(`${origin}/api/jobs/${job.id}/payment`, {
    method: "POST",
    headers,
    body: "{}",
  });
  assert.equal(response.status, 402);
  const required = decodePaymentRequiredHeader(
    response.headers.get("payment-required"),
  );
  assert.deepEqual(required.accepts, [job.requirements]);
  assert.deepEqual(
    decodePaymentRequiredHeader(encodePaymentRequiredHeader(required)),
    paymentRequired(job, origin),
  );
  const invalid = await fetch(`${origin}/api/jobs/${job.id}/payment`, {
    method: "POST",
    headers: { ...headers, "PAYMENT-SIGNATURE": "invalid" },
    body: "{}",
  });
  assert.equal(invalid.status, 400);
  assert.equal(service.store.get(job.id).state, "AWAITING_PAYMENT");
});
