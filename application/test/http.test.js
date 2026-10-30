import test from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { fixture, server } from "./helpers.js";

test("HTTP boundary rejects missing capability, cross-origin requests, hostile hosts, and malformed JSON", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
  const configResponse = await fetch(`${origin}/api/config`);
  assert.equal(configResponse.headers.get("cache-control"), "no-store");
  assert(
    configResponse.headers
      .get("content-security-policy")
      .includes("frame-ancestors 'none'"),
  );
  const { token } = await configResponse.json();
  const request = (headers, body = "{}") =>
    fetch(`${origin}/api/jobs`, { method: "POST", headers, body });
  const headers = {
    "Content-Type": "application/json",
    "X-Fieldproof-Token": token,
  };
  assert.equal(
    (await request({ "Content-Type": "application/json" })).status,
    403,
  );
  assert.equal(
    (await request({ ...headers, "X-Fieldproof-Token": "é".repeat(64) }))
      .status,
    403,
  );
  assert.equal(
    (await request({ ...headers, Origin: "https://attacker.example" })).status,
    403,
  );
  const hostileHost = await new Promise((resolve, reject) => {
    const req = httpRequest(
      `${origin}/api/config`,
      { headers: { Host: "attacker.example" } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on("error", reject);
    req.end();
  });
  assert.equal(hostileHost, 403);
  assert.equal((await request(headers, "{")).status, 400);
  assert.equal(
    (await request(headers, JSON.stringify({ huge: "x".repeat(50000) })))
      .status,
    413,
  );
  assert.equal(
    (await request({ ...headers, "Content-Type": "text/plain" })).status,
    415,
  );
});

test("HTTP simulation completes, edited receipt rejects, and public responses omit signed payment bytes", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
  const { token } = await (await fetch(`${origin}/api/config`)).json();
  const post = async (path, body) => {
    const response = await fetch(`${origin}/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fieldproof-Token": token,
      },
      body: JSON.stringify(body),
    });
    return { response, body: await response.json() };
  };
  const { body: job } = await post("/jobs", {
    idempotency_key: "http-check-01",
    closed: false,
  });
  const { body: paid } = await post(`/jobs/${job.id}/payment`, {
    simulation: job.id,
  });
  assert.equal(paid.state, "PAID");
  assert.equal(paid.payment.payload, undefined);
  const { body: complete } = await post(`/jobs/${job.id}/observe`, {});
  assert.equal(complete.decision.decision, "DISPATCH");
  const changed = structuredClone(complete.receipt);
  changed.result.closed = true;
  const rejected = await post(`/jobs/${job.id}/verify`, changed);
  assert.equal(rejected.response.status, 422);
  assert.equal(rejected.body.code, "INVALID_SIGNATURE");
  assert.equal(rejected.body.decision, "WAIT");
  assert.deepEqual(service.store.get(job.id).receipt, complete.receipt);
});
