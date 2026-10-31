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
        body: `export function createVisionController({onState,onMeasurement}) { let phase='STOPPED'; return {getState:()=>({phase}),start:async()=>{phase='ACTIVE';onState({phase});onMeasurement({state:'FAIL',predicates:[{id:'position',state:'FAIL',reason:'Planar offset uses the declared reference size.',actual:38,expected:8},{id:'orientation',state:'FAIL',reason:'Planar angle is clockwise from the reference marker axis.',actual:180,expected:8}]})},stop:()=>{phase='STOPPED';onState({phase})},capture:async()=>{const square=x=>[{x,y:150},{x:x+100,y:150},{x:x+100,y:250},{x,y:250}];return {markers:[{id:0,corners:square(100)},{id:10,corners:square(100+100*100/60)}],resolution:{width:640,height:480},capturedAt:Date.now(),calibrationId:'browser-test',frameDigest:'0x'+'a'.repeat(64),camera:{id:'browser-test'},state:'FAIL'}}};}`,
      }),
    );
    await page.goto(origin);
    await page.waitForFunction(
      () => !document.getElementById("approve").disabled,
    );
    await page.getByRole("button", { name: "Approve work order" }).click();
    await page.getByRole("button", { name: "Start capture attempt" }).click();
    await page.getByRole("button", { name: "Start camera" }).click();
    assert.match(await page.locator("#camera-status").innerText(), /38.0 mm/);
    assert.match(await page.locator("#camera-status").innerText(), /180.0°/);
    const captureStart =
      service.commissioning.store.list("sessions")[0].startedAt;
    await page.evaluate((value) => {
      window.actualDateNow = Date.now;
      Date.now = () => value;
    }, captureStart - 1000);
    await page.waitForFunction(() =>
      document
        .getElementById("capture-deadline")
        .textContent.includes("camera clock"),
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Save camera measurement" })
        .isDisabled(),
      true,
    );
    assert.match(
      await page.locator("#capture-deadline").innerText(),
      /camera clock/,
    );
    await page.evaluate(() => {
      Date.now = window.actualDateNow;
    });
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

test("lost rehearsal response recovers the saved attempt after refresh without another execution", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Approve work order", exact: true })
      .click();
    await page.evaluate(() => {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 64;
          const context = canvas.getContext("2d");
          const stream = canvas.captureStream(10);
          setInterval(() => context.fillRect(0, 0, 64, 64), 50);
          return stream;
        },
      });
      Object.defineProperty(navigator.mediaDevices, "enumerateDevices", {
        configurable: true,
        value: () =>
          new Promise((_resolve, reject) => {
            window.rejectEnumeration = reject;
          }),
      });
    });
    await page
      .getByRole("button", { name: "Start camera", exact: true })
      .click();
    await page.waitForFunction(
      () => typeof window.rejectEnumeration === "function",
    );
    const pattern = "**/api/commissioning/sessions/*/inspect";
    let intercepted = 0;
    await page.route(pattern, async (route) => {
      intercepted++;
      const original = await route.fetch();
      assert.equal(original.status(), 200);
      await route.abort("connectionfailed");
    });
    await page
      .getByRole("button", { name: "Run rehearsal", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .getElementById("feedback")
        .textContent.includes("OUTCOME_UNKNOWN"),
    );
    await page.evaluate(() =>
      rejectEnumeration(new Error("Camera enumeration failed")),
    );
    await page.waitForTimeout(100);
    assert.match(
      await page.locator("#feedback").innerText(),
      /OUTCOME_UNKNOWN/,
    );
    await page
      .getByRole("button", { name: "Stop camera", exact: true })
      .click();
    assert.match(
      await page.locator("#feedback").innerText(),
      /OUTCOME_UNKNOWN/,
    );
    assert.equal(intercepted, 1);
    assert.equal(
      await page
        .getByRole("button", { name: "Run rehearsal", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Approve a different work order" })
        .isDisabled(),
      true,
    );
    const sessions = service.commissioning.store.list("sessions");
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].acceptance.decision, "REVIEW");
    await page.unroute(pattern);
    await page.reload();
    await page.getByText("Local inspection: REVIEW", { exact: true }).waitFor();
    assert.equal(service.commissioning.store.list("sessions").length, 1);
    assert.equal(await page.locator("#history").inputValue(), sessions[0].id);
  } finally {
    await browser.close();
  }
});

test("history retains the approved order after more than thirty newer empty orders", async (t) => {
  const { service } = fixture(t);
  const commissioning = service.commissioning;
  const original = commissioning.createOrder({
    idempotency_key: "original-history-order",
    asset: "Original cabinet",
  });
  commissioning.createSession(original.id, {
    idempotency_key: "original-history-session",
    scenario: "correct",
  });
  for (let i = 0; i < 31; i++)
    commissioning.createOrder({
      idempotency_key: `newer-empty-order-${i}`,
      asset: `New empty ${i}`,
    });
  const origin = await server(t, service);
  const history = await (await fetch(`${origin}/api/commissioning`)).json();
  assert.equal(history.sessions.length, 1);
  assert(history.workOrders.some((order) => order.id === original.id));
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(origin);
    await page.waitForFunction(
      (id) => document.getElementById("order-status").textContent.includes(id),
      original.id,
    );
    assert.equal(
      await page.getByLabel("Installation reference").inputValue(),
      "Original cabinet",
    );
    await page
      .getByRole("button", { name: "Start capture attempt", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll("#history option").length === 2,
    );
    assert.equal(
      commissioning.store.list("sessions")[0].workOrderId,
      original.id,
    );
  } finally {
    await browser.close();
  }
});

test("operator can cancel unanswered camera permission and recover controls before a late grant", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Approve work order", exact: true })
      .click();
    await page.evaluate(() =>
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: () =>
          new Promise((resolve) => {
            window.grantPendingCamera = resolve;
          }),
      }),
    );
    await page
      .getByRole("button", { name: "Start camera", exact: true })
      .click();
    await page.waitForFunction(
      () => typeof window.grantPendingCamera === "function",
    );
    await page
      .getByRole("button", { name: "Stop camera", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.getElementById("reset-presentation").disabled,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Start capture attempt", exact: true })
        .isEnabled(),
      true,
    );
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      window.lateCameraStream = canvas.captureStream(1);
      grantPendingCamera(lateCameraStream);
    });
    await page.waitForFunction(
      () => lateCameraStream.getVideoTracks()[0].readyState === "ended",
    );
    assert.equal(await page.locator("#camera").isVisible(), false);
  } finally {
    await browser.close();
  }
});

test("late camera enumeration cannot revive stopped camera controls", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Approve work order", exact: true })
      .click();
    await page.evaluate(() => {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 64;
          const context = canvas.getContext("2d");
          const stream = canvas.captureStream(10);
          setInterval(() => context.fillRect(0, 0, 64, 64), 50);
          return stream;
        },
      });
      Object.defineProperty(navigator.mediaDevices, "enumerateDevices", {
        configurable: true,
        value: () =>
          new Promise((resolve) => {
            window.finishEnumeration = resolve;
          }),
      });
    });
    await page
      .getByRole("button", { name: "Start camera", exact: true })
      .click();
    await page.waitForFunction(
      () => typeof window.finishEnumeration === "function",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Start capture attempt", exact: true })
        .isEnabled(),
      true,
    );
    await page
      .getByRole("button", { name: "Stop camera", exact: true })
      .click();
    await page.evaluate(() => finishEnumeration([]));
    await page.waitForTimeout(100);
    assert.equal(
      await page
        .getByRole("button", { name: "Stop camera", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(await page.locator("#camera").isVisible(), false);
    assert.match(await page.locator("#feedback").innerText(), /Camera stopped/);
  } finally {
    await browser.close();
  }
});

test("camera restart blocks optical dispatch until a new passing measurement binds that camera", async (t) => {
  const { service } = fixture(t);
  service.config.opticalAuthorized = true;
  const origin = await server(t, service);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/api/config", async (route) => {
      const response = await route.fetch();
      const config = await response.json();
      await route.fulfill({ json: { ...config, mode: "physical" } });
    });
    await page.route("**/vision/controller.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `let generation=0;
      export function createVisionController({onState}) { const id='camera-'+(++generation); let phase='STOPPED'; return {
      getState:()=>({phase,camera:{id},calibrationId:id}),start:async()=>{phase='ACTIVE';onState({phase})},stop:()=>{phase='STOPPED';onState({phase})},
      capture:async()=>{const square=x=>[{x,y:150},{x:x+100,y:150},{x:x+100,y:250},{x,y:250}];return {markers:[{id:0,corners:square(100)},{id:10,corners:square(100+(globalThis.badPlacement?200:100)*100/60)}],resolution:{width:640,height:480},capturedAt:Date.now(),calibrationId:id,frameDigest:'0x'+'a'.repeat(64),camera:{id}}}}}`,
      }),
    );
    let dispatches = 0;
    await page.route("**/optical-challenge", (route) => {
      dispatches++;
      return route.abort();
    });
    await page.goto(origin);
    await page
      .getByRole("button", { name: "Approve work order", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Start capture attempt", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Start camera", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save camera measurement", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.getElementById("capture-optical").disabled,
    );
    await page
      .getByRole("button", { name: "Stop camera", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Start camera", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Capture signed optical test" })
        .isDisabled(),
      true,
    );
    // A stale queued click must also fail before preparing any device request.
    await page.locator("#capture-optical").dispatchEvent("click");
    await page.waitForFunction(() =>
      document
        .getElementById("feedback")
        .textContent.includes("passing measurement"),
    );
    assert.equal(dispatches, 0);
    await page
      .getByRole("button", { name: "Start capture attempt", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save camera measurement", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.getElementById("capture-optical").disabled,
    );
    assert.equal(dispatches, 0);
    await page.evaluate(() => {
      globalThis.badPlacement = true;
    });
    await page
      .getByRole("button", { name: "Start capture attempt", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save camera measurement", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .getElementById("feedback")
        .textContent.includes("measurement saved"),
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Capture signed optical test" })
        .isDisabled(),
      true,
    );
    assert.equal(dispatches, 0);
  } finally {
    await browser.close();
  }
});

test("partial physical inspection prioritizes placement correction and shows saved measurements", async (t) => {
  const { service } = fixture(t);
  service.config.mode = "physical";
  service.profile.contact.sensor = "disabled-contact";
  const c = service.commissioning;
  const original = JSON.parse(
    readFileSync(
      new URL(
        "../submission/evidence/physical-camera-rework-packet.json",
        import.meta.url,
      ),
    ),
  );
  const order = c.createOrder({
    idempotency_key: "placement-guidance-order",
    asset: "Placement correction",
  });
  const session = c.createSession(order.id, {
    idempotency_key: "placement-guidance-session",
    scenario: "correct",
  });
  const vision = original.evidence.vision;
  c.captureVision(session.id, {
    source: "browser-camera",
    frame: { ...vision.frame, capturedAt: Date.now() },
    frameDigest: vision.frameDigest,
    camera: vision.camera,
  });
  c.inspect(session.id);
  const before = c.store.get("sessions", session.id);
  assert.equal(
    before.report.predicates.find((p) => p.id === "vision").outcome,
    "FAIL",
  );
  assert.equal(
    before.report.predicates.find((p) => p.id === "delivery").outcome,
    "FAIL",
  );
  const origin = await server(t, service);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(origin);
    await page.getByText("Local inspection: FAIL", { exact: true }).waitFor();
    assert.match(
      await page.locator("#next-action").innerText(),
      /Align both markers/,
    );
    assert.match(
      await page.locator("#results").innerText(),
      /Estimated offset: \d+\.\d mm/,
    );
    assert.match(
      await page.locator("#results").innerText(),
      /Estimated angle difference: \d+\.\d°/,
    );
    assert.deepEqual(c.store.get("sessions", session.id), before);
  } finally {
    await browser.close();
  }
});
