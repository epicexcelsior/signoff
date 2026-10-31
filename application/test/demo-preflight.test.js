import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { fixture } from "./helpers.js";
import { createApp } from "../src/app.js";
const execute = promisify(execFile);
const script = fileURLToPath(
  new URL("../scripts/demo-preflight.js", import.meta.url),
);

test("morning preflight reads actual station artifacts, rejects changed bytes, and never writes", async (t) => {
  const { service } = fixture(t);
  const app = createApp(service);
  const methods = [];
  let corrupt = false;
  const server = createServer((req, res) => {
    methods.push(req.method);
    if (
      corrupt &&
      req.url === "/api/submission-evidence/artifacts/device-optical-diagnostic"
    ) {
      res.setHeader("content-type", "application/json");
      res.end("{}");
    } else app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const env = {
    ...process.env,
    FIELDPROOF_PORT: String(server.address().port),
  };
  const before = {
    orders: service.commissioning.store.list("orders"),
    sessions: service.commissioning.store.list("sessions"),
    jobs: service.store.list(),
  };
  const result = await execute(process.execPath, [script], { env });
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "REHEARSAL_AVAILABLE");
  assert.equal(
    report.currentPhysicalAcceptance,
    "NOT_ESTABLISHED_BY_PREFLIGHT",
  );
  assert.equal(report.station.paymentGrant, false);
  assert.equal(report.station.opticalGrant, false);
  assert.equal(report.savedEvidence.originalArtifactHashes, "MATCH");
  assert(report.remaining.some((item) => item.area === "hardware"));
  assert(!result.stdout.includes('"token"'));
  corrupt = true;
  await assert.rejects(
    execute(process.execPath, [script], { env }),
    (error) => {
      assert.equal(error.code, 1);
      const failure = JSON.parse(
        error.stderr
          .split("\n")
          .filter(
            (line) => !line.startsWith("(node:") && !line.startsWith("(Use "),
          )
          .join("\n"),
      );
      assert.equal(failure.status, "PREFLIGHT_FAILED");
      assert.match(
        failure.error,
        /artifact bytes differ: device-optical-diagnostic/,
      );
      return true;
    },
  );
  assert(methods.length > 0 && methods.every((method) => method === "GET"));
  assert.deepEqual(
    {
      orders: service.commissioning.store.list("orders"),
      sessions: service.commissioning.store.list("sessions"),
      jobs: service.store.list(),
    },
    before,
  );
});

test("morning preflight refuses an invalid station port before reading a service", async () => {
  await assert.rejects(
    execute(process.execPath, [script], {
      env: { ...process.env, FIELDPROOF_PORT: "0" },
    }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /FIELDPROOF_PORT/);
      assert.equal(error.stdout, "");
      return true;
    },
  );
});
