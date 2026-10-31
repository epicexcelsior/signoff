import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { decodePaymentRequiredHeader } from "@x402/core/http";

test("actual loopback HTTP service returns standard x402 quote and rejects unauthorized or substituted evidence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "proof-ready-paid-http-"));
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  const artifact = {
    mode: "simulation",
    workOrderHash: "0x" + "11".repeat(32),
    evidenceBundleHash: "0x" + "22".repeat(32),
    requiredChecks: ["optical"],
    checks: [],
  };
  const request = {
    inspectionId: "prepared-http",
    workOrderHash: artifact.workOrderHash,
    evidenceBundleHash: artifact.evidenceBundleHash,
    inputText: "Inspect missing optical evidence",
    idempotencyKey: "prepared-http-intent",
  };
  const bridge = join(dir, "bridge.mjs");
  writeFileSync(
    bridge,
    `export function loadArtifact(request) { if(request.evidenceBundleHash!==${JSON.stringify(request.evidenceBundleHash)}) throw Error('Changed evidence'); return ${JSON.stringify(artifact)}; }`,
  );
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("../src/main.js", import.meta.url))],
    {
      env: {
        PATH: process.env.PATH,
        X402_INSPECTOR_STATE_DIR: join(dir, "state"),
        X402_INSPECTOR_PORT: String(port),
        INSPECTION_BRIDGE_MODULE: bridge,
        SELLER_ADDRESS: "addr_test1seller",
        BLOCKFROST_API_KEY_PREPROD: "preprod-fixture-reader",
        X402_INSPECTOR_SPEND_AUTHORIZED: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error("HTTP startup timeout")),
        10000,
      );
      child.stdout.on("data", (chunk) => {
        if (chunk.toString().includes("paid inspector:")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        reject(Error("HTTP startup exited " + code));
      });
    });
    const origin = `http://127.0.0.1:${port}`,
      config = await (await fetch(origin + "/api/config")).json();
    assert.equal(config.spendAuthorized, false);
    const post = (path, body, extra = {}) =>
      fetch(origin + path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-inspector-token": config.token,
          ...extra,
        },
        body: JSON.stringify(body),
      });
    const blocked = await post("/api/inspections", request, {
      "x-inspector-token": "wrong",
    });
    assert.equal(blocked.status, 403);
    const crossOrigin = await post("/api/inspections", request, {
      origin: "https://untrusted.invalid",
    });
    assert.equal(crossOrigin.status, 403);
    const created = await post("/api/inspections", request);
    assert.equal(created.status, 201);
    const job = await created.json();
    const quote = await post(`/api/inspections/${job.id}/payment`, {});
    assert.equal(quote.status, 402);
    const header = decodePaymentRequiredHeader(
      quote.headers.get("PAYMENT-REQUIRED"),
    );
    assert.equal(header.accepts[0].amount, "2000000");
    assert.equal(header.accepts[0].network, "cardano:preprod");
    assert.deepEqual(header, await quote.json());
    const missingPayment = await post(`/api/inspections/${job.id}/inspect`, {});
    assert.equal(missingPayment.status, 402);
    const invalidHeader = await post(
      `/api/inspections/${job.id}/payment`,
      {},
      { "payment-signature": "invalid" },
    );
    assert.equal(invalidHeader.status, 400);
    const changed = await post("/api/inspections", {
      ...request,
      evidenceBundleHash: "0x" + "33".repeat(32),
    });
    assert.equal(changed.status, 503);
  } finally {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
    rmSync(dir, { recursive: true, force: true });
  }
});
