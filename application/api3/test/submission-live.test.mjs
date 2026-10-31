import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { verifyNvdResponse } from "../src/index.mjs";

test("original genuine paid CVE bytes authenticate at ingestion and retain bounded policy and stale rejection", async () => {
  const bytes = readFileSync(
    new URL(
      "../../submission/evidence/nvd-paid-first-original.json",
      import.meta.url,
    ),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "54ffd855925dc58cce9fb4f37680f0f4a5f8b740f60fe8f3175c3b1250324f4b",
  );
  const response = JSON.parse(bytes);
  const options = {
    now: Number(response.timestamp),
    buildVersion: "1.9.0",
    maxCvssTenths: 70,
  };
  assert.equal((await verifyNvdResponse(response, options)).verdict, "PASS");
  assert.equal(
    (await verifyNvdResponse(response, { ...options, buildVersion: "1.8.0" }))
      .verdict,
    "FAIL",
  );
  await assert.rejects(
    verifyNvdResponse({ ...response, data: response.data + " " }, options),
  );
  await assert.rejects(
    verifyNvdResponse(response, { ...options, now: options.now + 301 }),
    /Stale/,
  );
});
