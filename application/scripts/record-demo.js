import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { setTimeout as wait } from "node:timers/promises";

// Isolated local rehearsal. No .env loading, hardware adapter, or payment grant.
process.umask(0o077);
const parent = resolve(homedir(), ".local/state/proof-of-ready/demonstrations");
mkdirSync(parent, { recursive: true });
const dir = mkdtempSync(join(parent, "recording-"));
const child = spawn(process.execPath, ["src/main.js"], {
  cwd: new URL("../", import.meta.url),
  env: {
    PATH: process.env.PATH,
    HOME: homedir(),
    FIELDPROOF_MODE: "simulation",
    FIELDPROOF_PORT: "0",
    FIELDPROOF_STATE_DIR: join(dir, "station"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
let context;
try {
  const origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Recording station did not start.")),
      15000,
    );
    child.once("error", reject);
    child.once("exit", () =>
      reject(new Error("Recording station stopped before startup.")),
    );
    child.stdout.on("data", (data) => {
      const match = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page
    .getByRole("button", {
      name: "Confirm inspection requirements",
      exact: true,
    })
    .waitFor();
  await wait(6000);
  await page
    .getByLabel("Installation reference")
    .fill("Cabinet 07 · recorded rehearsal");
  await page
    .getByRole("button", {
      name: "Confirm inspection requirements",
      exact: true,
    })
    .click();
  await wait(5000);
  await page
    .getByRole("button", { name: "Run rehearsal", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.getElementById("acceptance-decision").textContent === "REVIEW",
  );
  await page
    .locator("section[aria-labelledby=report-heading]")
    .evaluate((node) => node.scrollIntoView({ block: "start" }));
  await wait(10000);
  await page
    .getByRole("button", { name: "Verify evidence files", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .getElementById("packet-status")
      .textContent.includes("Packet verified"),
  );
  await wait(5000);
  await page.locator(".advanced-tools > summary").click();
  await page
    .getByRole("button", { name: "Try changing the evidence", exact: true })
    .click();
  await wait(5000);
  await page.getByLabel("Rehearsal condition").selectOption("misplaced");
  await page
    .getByRole("button", { name: "Run rehearsal", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.getElementById("acceptance-decision").textContent === "REWORK",
  );
  await page
    .locator("section[aria-labelledby=report-heading]")
    .evaluate((node) => node.scrollIntoView({ block: "start" }));
  await wait(10000);
  await page.reload();
  await page.locator("#judge-paid-inspection").scrollIntoViewIfNeeded();
  await page.locator(".judge-history > summary").click();
  await page
    .getByText("Read the original inspection report · REVIEW", { exact: true })
    .click();
  await wait(15000);
  await page.locator("#earlier-evidence > summary").click();
  await page
    .getByText("Five required deployed policy tests", { exact: true })
    .click();
  await page.locator("#judge-cases").scrollIntoViewIfNeeded();
  await wait(10000);
  await page
    .getByText("Real device response · 72 of 72 optical symbols", {
      exact: true,
    })
    .scrollIntoViewIfNeeded();
  await wait(8000);
  if (errors.length)
    throw new Error(`Recording browser errors: ${errors.join("; ")}`);
  const video = page.video();
  await context.close();
  context = null;
  writeFileSync(
    join(dir, "scope.json"),
    JSON.stringify(
      {
        schema: "proof-of-ready/recording-scope/v1",
        recordedAt: new Date().toISOString(),
        file: await video.path(),
        scope:
          "Actual interface recording of isolated synthetic rehearsal and saved original historical evidence. No physical acceptance.",
        externalNetworkWrites: false,
        hardwareOperations: 0,
        payments: 0,
        scenarios: [
          "correct REVIEW",
          "edited packet rejected",
          "misplaced REWORK",
          "refresh recovery",
          "historical paid inspection",
          "deployed source cases",
          "recorded optical diagnostic",
        ],
        audio: false,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        directory: dir,
        video: await video.path(),
        scope:
          "Rehearsal and historical evidence. Not a complete physical demonstration.",
      },
      null,
      2,
    ),
  );
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  child.kill("SIGTERM");
}
