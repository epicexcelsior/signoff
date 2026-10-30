import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fixture, server } from "./helpers.js";

test("judge evidence serves only reviewed originals and their exact hashes without changing saved attempts", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
  const before = service.commissioning.store.list("sessions");
  const response = await fetch(`${origin}/api/submission-evidence`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const result = await response.json();
  assert.match(result.scope, /do not authorize/);
  const original = readFileSync(
    new URL(
      "../submission/evidence/nvd-paid-first-original.json",
      import.meta.url,
    ),
  );
  const artifact = result.artifacts.find(
    (entry) => entry.id === "nvd-original",
  );
  assert.equal(
    artifact.sha256,
    createHash("sha256").update(original).digest("hex"),
  );
  const served = Buffer.from(
    await (await fetch(`${origin}${artifact.href}`)).arrayBuffer(),
  );
  assert.deepEqual(served, original);
  for (const id of [
    "credentials.env",
    "wallet",
    "__proto__",
    "constructor",
    "..%2f..%2f.local%2fprivate-config",
  ]) {
    const rejected = await fetch(
      `${origin}/api/submission-evidence/artifacts/${id}`,
    );
    assert.equal(rejected.status, 404);
  }
  assert.deepEqual(service.commissioning.store.list("sessions"), before);
});
