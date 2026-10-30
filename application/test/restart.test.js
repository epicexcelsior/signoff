import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

test("the real server retains its identity, receipt, and ledger after process death", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fieldproof-restart-"));
  let child;
  async function start() {
    child = spawn(process.execPath, ["src/main.js"], {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        FIELDPROOF_MODE: "simulation",
        FIELDPROOF_PORT: "0",
        FIELDPROOF_STATE_DIR: dir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const running = child;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("The local server did not start.")),
        10000,
      );
      let output = "";
      running.stdout.on("data", (data) => {
        output += data;
        const match = /FieldProof: (http:\/\/127\.0\.0\.1:\d+)/.exec(output);
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      });
      running.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      running.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Server exited before startup: ${code}`));
      });
    });
  }
  async function kill() {
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
    child = null;
  }
  try {
    const origin = await start();
    const config = await (await fetch(`${origin}/api/config`)).json();
    const post = async (path, body) => {
      const response = await fetch(`${origin}/api${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Fieldproof-Token": config.token,
        },
        body: JSON.stringify(body),
      });
      assert(response.ok);
      return response.json();
    };
    const job = await post("/jobs", {
      idempotency_key: "restart-check-01",
      closed: false,
    });
    await post(`/jobs/${job.id}/payment`, { simulation: job.id });
    const complete = await post(`/jobs/${job.id}/observe`, {});
    await kill();
    const restarted = await start();
    const saved = await (await fetch(`${restarted}/api/jobs/${job.id}`)).json();
    assert.equal(saved.state, "COMPLETE");
    assert.deepEqual(saved.receipt, complete.receipt);
    assert.equal(saved.public_key, complete.public_key);
    assert.deepEqual(saved.payment, complete.payment);
    assert.deepEqual(saved.events, complete.events);
    const freshConfig = await (await fetch(`${restarted}/api/config`)).json();
    assert.notEqual(freshConfig.token, config.token);
    const repeat = await fetch(`${restarted}/api/jobs/${job.id}/observe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fieldproof-Token": freshConfig.token,
      },
      body: "{}",
    });
    assert.equal(repeat.status, 200);
    assert.deepEqual((await repeat.json()).events, complete.events);
  } finally {
    if (child) await kill();
    rmSync(dir, { recursive: true, force: true });
  }
});
