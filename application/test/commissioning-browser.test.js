import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fixture, server } from "./helpers.js";

test("judge view rejects edited original report bytes and recovers after the original returns", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
  const browser = await chromium.launch(
    process.env.FIELDPROOF_BROWSER_EXECUTABLE
      ? {
          executablePath: process.env.FIELDPROOF_BROWSER_EXECUTABLE,
          headless: true,
        }
      : { channel: "chrome", headless: true },
  );
  try {
    const page = await browser.newPage();
    const path = "**/api/submission-evidence/artifacts/paid-inspection-report";
    await page.route(path, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: '{"outcome":"PASS","predicates":[]}',
      }),
    );
    await page.goto(origin);
    await page.waitForFunction(() =>
      document
        .getElementById("judge-status")
        .textContent.includes("differs from its saved manifest hash"),
    );
    assert.equal(await page.locator(".judge-report").count(), 0);
    assert.equal(await page.locator(".judge-lifecycle li").count(), 0);
    await page.unroute(path);
    await page.getByRole("button", { name: "Refresh evidence" }).click();
    await page
      .getByText("Read the original inspection report · REVIEW", {
        exact: true,
      })
      .waitFor();
    assert.equal(await page.locator(".judge-lifecycle li").count(), 4);
    await page.evaluate(async () => {
      const { refreshJudgeEvidence } = await import("/judge-evidence.js");
      await Promise.all([refreshJudgeEvidence(), refreshJudgeEvidence()]);
    });
    assert.equal(await page.locator(".judge-lifecycle li").count(), 4);
  } finally {
    await browser.close();
  }
});

test("commissioning desktop and phone: approve, inspect defects, verify packets, retain history", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
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
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(origin);
      await page.waitForFunction(
        () =>
          !document.getElementById("approve").disabled ||
          !document.getElementById("new-order").hidden,
      );
      if (
        await page
          .getByRole("button", { name: "Approve a different work order" })
          .isVisible()
      ) {
        await page
          .getByRole("button", { name: "Approve a different work order" })
          .click();
      }
      await page.waitForFunction(
        () => !document.getElementById("approve").disabled,
      );
      await page.getByLabel("Installation reference").fill(`Cabinet ${width}`);
      await page.getByRole("button", { name: "Approve work order" }).focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () =>
          document.getElementById("approve").disabled &&
          !document.getElementById("run-rehearsal").disabled,
      );
      await page.getByLabel("Rehearsal condition").selectOption("misplaced");
      await page.getByRole("button", { name: "Run rehearsal" }).click();
      await page.waitForFunction(
        () =>
          document.getElementById("acceptance-decision").textContent ===
          "REWORK",
      );
      assert.match(await page.locator("#results").textContent(), /visionFAIL/);
      assert.match(
        await page.locator("#next-action").textContent(),
        /Align both markers/,
      );
      await page
        .getByRole("button", { name: "Verify packet", exact: true })
        .click();
      await page.waitForFunction(() =>
        document
          .getElementById("packet-status")
          .textContent.includes("Packet verified"),
      );
      await page.getByRole("button", { name: "Test an edited packet" }).click();
      await page.waitForFunction(() =>
        document
          .getElementById("packet-status")
          .textContent.includes("Edited packet rejected"),
      );
      await page.getByLabel("Rehearsal condition").selectOption("correct");
      await page.getByRole("button", { name: "Run rehearsal" }).click();
      await page.waitForFunction(
        () =>
          document.getElementById("acceptance-decision").textContent ===
            "REVIEW" &&
          document.getElementById("capture-state").textContent ===
            "Capture sealed",
      );
      assert.match(await page.locator("#results").textContent(), /visionPASS/);
      assert.match(
        await page.locator("#acceptance-gates").textContent(),
        /No verified Masumi seller receipt/,
      );
      const downloadPromise = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Export inspector request" })
        .click();
      const download = await downloadPromise;
      const request = JSON.parse(readFileSync(await download.path(), "utf8"));
      assert.match(request.inspectionId, /^por-[0-9a-f]{16}$/);
      assert.equal(JSON.parse(request.inputText).mode, "simulation");
      await page
        .getByRole("button", { name: "Check external acceptance" })
        .click();
      await page.waitForFunction(() =>
        document
          .getElementById("feedback")
          .textContent.includes("External evidence checked"),
      );
      assert.equal(
        await page.locator("#acceptance-decision").textContent(),
        "REVIEW",
      );
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
          .map((el) => ({
            tag: el.tagName,
            id: el.id,
            class: el.className,
            right: el.getBoundingClientRect().right,
          }))
          .slice(0, 15),
      );
      if (overflow.length) {
        await page.screenshot({
          path: "/tmp/proof-ready-overflow.png",
          fullPage: true,
        });
      }
      assert.deepEqual(overflow, []);
      await page.reload();
      await page
        .getByText("Local inspection: REVIEW", { exact: true })
        .waitFor();
      assert((await page.locator("#history option").count()) >= 2);
      await page
        .locator("#judge-panel")
        .getByText("Paid original NVD response", { exact: true })
        .waitFor();
      assert.match(
        await page.locator("#judge-status").textContent(),
        /Saved evidence/,
      );
      assert.equal(await page.locator("#judge-cases dt").count(), 5);
      assert.equal(await page.locator(".judge-lifecycle li").count(), 4);
      const paidSummary = page.locator("#judge-paid-inspection");
      assert.match(
        await paidSummary.textContent(),
        /Historical inspection of synthetic input/,
      );
      assert.match(
        await paidSummary.textContent(),
        /Positive seller receipt confirmed/,
      );
      const chainLinks = await paidSummary
        .locator("a")
        .evaluateAll((links) => links.map((link) => link.href));
      assert(
        chainLinks.some((href) =>
          href.endsWith(
            "405a406634d221ea635aff5e85b58928cf44fd181fde3048829b8d42108f6465",
          ),
        ),
      );
      assert(
        chainLinks.some((href) =>
          href.endsWith(
            "344fd5f6fd40f469ff72e0feac7b58ae9f9a100f472a29429e1082ae42aaa202",
          ),
        ),
      );
      await page
        .getByRole("heading", { name: "Confirmed inspector payment" })
        .waitFor();
      await page
        .getByRole("heading", { name: "Mined policy rejection" })
        .waitFor();
      assert.match(
        await page.locator("#judge-cases").textContent(),
        /passed mined open to rejected/,
      );
      await page
        .getByText("Read the original inspection report · REVIEW", {
          exact: true,
        })
        .click();
      await page
        .getByText(
          "Original capture: synthetic. Inspection purchase: real Cardano Preprod escrow. This report does not establish physical acceptance.",
          { exact: true },
        )
        .waitFor();
      const countBeforeReset = await page
        .locator('#history option:not([value=""])')
        .count();
      const savedAttempt = await page.locator("#history").inputValue();
      await page.getByRole("button", { name: "Reset presentation" }).click();
      await page.waitForFunction(
        () => !document.getElementById("approve").disabled,
      );
      assert.equal(
        await page.locator('#history option:not([value=""])').count(),
        countBeforeReset,
      );
      assert.equal(
        await page.locator("#acceptance-decision").textContent(),
        "REVIEW",
      );
      assert.match(
        await page.locator("#feedback").textContent(),
        /All saved attempts/,
      );
      assert.equal(await page.locator("#history").inputValue(), "");
      await page.locator("#history").selectOption(savedAttempt);
      await page
        .getByText("Local inspection: REVIEW", { exact: true })
        .waitFor();
      await page.reload();
      await page
        .getByText("Local inspection: REVIEW", { exact: true })
        .waitFor();
      if (process.env.FIELDPROOF_SCREENSHOT_DIR) {
        mkdirSync(process.env.FIELDPROOF_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({
          path: join(
            process.env.FIELDPROOF_SCREENSHOT_DIR,
            `commissioning-${width}.png`,
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

test("camera UI saves the controller frame shape and backend recomputes placement", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
  const browser = await chromium.launch(
    process.env.FIELDPROOF_BROWSER_EXECUTABLE
      ? {
          executablePath: process.env.FIELDPROOF_BROWSER_EXECUTABLE,
          headless: true,
        }
      : { channel: "chrome", headless: true },
  );
  try {
    const page = await browser.newPage();
    // Controller behavior and real OpenCV have separate actual-browser tests.
    await page.route("**/vision/controller.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `export function createVisionController({onState}) { let phase='STOPPED'; return {getState:()=>({phase}),start:async()=>{phase='ACTIVE';onState({phase})},stop:()=>{phase='STOPPED';onState({phase})},capture:async()=>{const square=x=>[{x,y:150},{x:x+100,y:150},{x:x+100,y:250},{x,y:250}];return {markers:[{id:0,corners:square(100)},{id:10,corners:square(100+100*100/60)}],resolution:{width:640,height:480},capturedAt:Date.now(),calibrationId:'browser-test',frameDigest:'0x'+'a'.repeat(64),camera:{id:'browser-test'},state:'FAIL'}}};}`,
      }),
    );
    await page.goto(origin);
    await page.waitForFunction(
      () => !document.getElementById("approve").disabled,
    );
    await page.getByRole("button", { name: "Approve work order" }).click();
    await page.getByRole("button", { name: "Start capture attempt" }).click();
    await page.getByRole("button", { name: "Start camera" }).click();
    await page.getByRole("button", { name: "Save camera measurement" }).click();
    await page
      .getByText(
        "Camera measurement saved. The server recomputed placement from the marker corners.",
        { exact: true },
      )
      .waitFor();
    const originalNow = await page.evaluate(() => Date.now());
    const active = service.commissioning.store.list("sessions")[0];
    await page.evaluate((value) => {
      Date.now = () => value;
    }, active.expiresAt + 1);
    await page.waitForFunction(() =>
      document
        .getElementById("capture-deadline")
        .textContent.includes("expired"),
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Save camera measurement" })
        .isDisabled(),
      true,
    );
    await page.evaluate((value) => {
      Date.now = () => value;
    }, originalNow);
    await page.getByRole("button", { name: "Run rehearsal" }).click();
    await page.getByText("Local inspection: REVIEW", { exact: true }).waitFor();
    const [session] = service.commissioning.store.list("sessions");
    assert.equal(session.evidence.vision.source, "browser-camera");
    assert.equal(session.evidence.vision.measurement.state, "PASS");
    assert.equal(
      session.report.predicates.find((entry) => entry.id === "vision").outcome,
      "PASS",
    );
    await page
      .getByRole("button", { name: "Stop camera", exact: true })
      .click();
    assert.equal(await page.locator("#camera").isVisible(), false);
    const savedId = await page.locator("#history").inputValue();
    assert.equal(
      await page.locator('#history option:not([value=""])').count(),
      1,
    );
    await page.getByRole("button", { name: "Reset presentation" }).click();
    await page.waitForFunction(
      () => !document.getElementById("approve").disabled,
    );
    assert.equal(await page.locator("#history").inputValue(), "");
    await page.locator("#history").selectOption(savedId);
    await page.getByText("Local inspection: REVIEW", { exact: true }).waitFor();
    assert.equal(await page.locator("#history").inputValue(), savedId);
  } finally {
    await browser.close();
  }
});
