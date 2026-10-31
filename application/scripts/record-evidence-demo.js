import { chromium } from "@playwright/test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";

process.umask(0o077);
const port = Number(process.env.FIELDPROOF_PORT ?? 4022);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Use a valid local station port.");
const parent = join(homedir(), ".local/state/proof-of-ready/demonstrations");
mkdirSync(parent, { recursive: true });
const dir = mkdtempSync(join(parent, "saved-real-evidence-"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
let context;
try {
  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const errors = [];
  const writes = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await page.goto(`http://127.0.0.1:${port}/demo/`);
  await page.waitForFunction(() =>
    document
      .getElementById("phone-status")
      .textContent.includes("Saved in this browser"),
  );
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await wait(6500);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(
    () => !document.getElementById("verify-files").disabled,
  );
  await page.getByRole("link", { name: "Camera found a defect" }).click();
  await wait(7000);
  await page.getByRole("link", { name: "Inspector received payment" }).click();
  await wait(7000);
  await page
    .getByText("Read the original inspector report · FAIL", { exact: true })
    .click();
  await page.locator("#report").scrollIntoViewIfNeeded();
  await wait(8500);
  await page.locator("#file-proof").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Verify saved evidence" }).click();
  await wait(6000);
  await page.getByText("The pitch in 20 seconds", { exact: true }).click();
  await page.locator(".story").scrollIntoViewIfNeeded();
  await wait(8500);
  if (errors.length || writes.length)
    throw new Error("Recording failed its browser-error or read-only checks.");
  const video = page.video();
  await context.close();
  context = null;
  const result = {
    schema: "proof-of-ready/recording-scope/v1",
    recordedAt: new Date().toISOString(),
    video: await video.path(),
    scope:
      "Silent walkthrough of saved actual camera FAIL, real paid inspector report and original receipts. Offline browser presentation. No synthetic capture and no fresh physical test or chain verification.",
    hardwareOperations: 0,
    payments: 0,
    audio: false,
    browserErrors: errors.length,
    networkWrites: writes.length,
  };
  writeFileSync(
    join(dir, "scope.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (context) await context.close();
  await browser.close();
}
