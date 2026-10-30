import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fixture, server } from "./helpers.js";

test("desktop and phone: run open/closed checks, reject an edit, expire evidence, and retain history", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
  // Use installed Chrome. Do not install or garbage-collect shared browser caches during tests.
  const browser = await chromium.launch(
    process.env.FIELDPROOF_BROWSER_EXECUTABLE
      ? {
          executablePath: process.env.FIELDPROOF_BROWSER_EXECUTABLE,
          headless: true,
        }
      : { channel: "chrome", headless: true },
  );
  const errors = [];
  try {
    for (const viewport of [
      { width: 1280, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/observation.html`);
      const run = page.getByRole("button", { name: "Run simulated check" });
      await run.waitFor();
      await page.waitForFunction(
        () => !document.getElementById("run").disabled,
      );
      await run.click();
      await page
        .getByRole("heading", { name: "DISPATCH", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Verify receipt", exact: true })
        .click();
      await page.waitForFunction(
        () => document.getElementById("verification").dataset.valid === "true",
      );
      await page.getByRole("button", { name: "Change one value" }).click();
      await page
        .getByRole("button", { name: "Verify receipt", exact: true })
        .click();
      await page.waitForFunction(
        () => document.getElementById("verification").dataset.valid === "false",
      );
      assert.match(
        await page.locator("#verification").textContent(),
        /INVALID_SIGNATURE/,
      );
      // The decision must expire even when the next HTTP response never arrives.
      await page.route("**/api/jobs/*", () => {});
      await page.clock.install();
      await page.clock.fastForward(12000);
      await page.getByRole("heading", { name: "WAIT", exact: true }).waitFor();
      await page.getByText("Observation expired", { exact: true }).waitFor();
      await page.unroute("**/api/jobs/*");
      await page.clock.setSystemTime(Date.now());
      await page.reload();
      await page.waitForFunction(
        () => !document.getElementById("run").disabled,
      );
      await page.getByRole("radio", { name: "Closed", exact: true }).check();
      await run.click();
      await page
        .getByText("Verified closed contact", { exact: true })
        .waitFor();
      assert.equal(
        await page.getByRole("heading", { name: "WAIT", exact: true }).count(),
        1,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.reload();
      await page
        .getByText("Verified closed contact", { exact: true })
        .waitFor();
      assert((await page.locator("#history option").count()) >= 2);
      await page.getByRole("radio", { name: "Open", exact: true }).check();
      await run.focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("heading", { name: "DISPATCH", exact: true })
        .waitFor();
      if (process.env.FIELDPROOF_SCREENSHOT_DIR) {
        mkdirSync(process.env.FIELDPROOF_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({
          path: join(
            process.env.FIELDPROOF_SCREENSHOT_DIR,
            `${viewport.width}.png`,
          ),
          fullPage: true,
          animations: "disabled",
        });
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
