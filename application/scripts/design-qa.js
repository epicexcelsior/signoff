// Read-only QA of the existing real-evidence station. Outputs stay private.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

const output = resolve("../.local/design-pass/after");
mkdirSync(output, { recursive: true });
const origin = "http://127.0.0.1:4022";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [],
      writes = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.method() !== "GET") writes.push(request.url());
    });
    for (const [name, route] of [
      ["inspection", "/"],
      ["saved", "/demo/"],
    ]) {
      await page.goto(origin + route);
      if (name === "inspection")
        await page.waitForFunction(
          () =>
            document.querySelector("#acceptance-decision").textContent ===
            "REWORK",
        );
      else
        await page.waitForFunction(
          () => !document.querySelector("#verify-files").disabled,
        );
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.match(
        await page.locator("#saved-measurement").innerText(),
        /37\.7 mm/,
      );
      assert.match(
        await page.locator("#saved-measurement").innerText(),
        /179\.0°/,
      );
      const stamp = page.locator(
        name === "inspection" ? "#acceptance-decision" : ".stamp",
      );
      assert.ok(
        Number.parseFloat(
          await stamp.evaluate((node) => getComputedStyle(node).fontSize),
        ) >= 72,
      );
      const motion = await page.evaluate(() =>
        [...document.querySelectorAll("*")].every(
          (node) => getComputedStyle(node).animationName === "none",
        ),
      );
      assert.equal(motion, true);
      await page.screenshot({
        path: join(output, `${name}-${width}.png`),
        fullPage: true,
      });
      await page.screenshot({
        path: join(output, `${name}-${width}-viewport.png`),
      });
      const keyboard = [];
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        keyboard.push(
          await page.evaluate(() => ({
            tag: document.activeElement.tagName,
            id: document.activeElement.id,
            outline: getComputedStyle(document.activeElement).outlineWidth,
          })),
        );
      }
      assert.ok(keyboard.some((item) => Number.parseFloat(item.outline) >= 3));
      if (name === "saved") {
        await page.locator("#verify-files").focus();
        await page.keyboard.press("Enter");
        assert.match(
          await page.locator("#verification").innerText(),
          /6 saved file hashes match/,
        );
        await page.waitForFunction(() =>
          Boolean(navigator.serviceWorker.controller),
        );
        await context.setOffline(true);
        await page.reload();
        await page.locator("#verify-files:not(:disabled)").waitFor();
        await page.locator("#verify-files").click();
        assert.match(
          await page.locator("#verification").innerText(),
          /6 saved file hashes match/,
        );
        assert.equal(
          await page.evaluate(async () => {
            const a = await document.fonts.load('700 80px "Barlow Condensed"');
            const b = await document.fonts.load(
              '400 18px "Atkinson Hyperlegible Next"',
            );
            return (
              a.length > 0 &&
              b.length > 0 &&
              [...a, ...b].every((f) => f.status === "loaded")
            );
          }),
          true,
        );
        assert.equal(
          await page.locator("#transactions a[aria-disabled=true]").count(),
          3,
        );
        await page.screenshot({
          path: join(output, `saved-${width}-offline.png`),
        });
        await context.setOffline(false);
      }
      results.push({
        name,
        width,
        height,
        keyboard,
        overflow: false,
        exactReadings: true,
        reducedMotion: true,
        offline: name === "saved",
      });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    await context.close();
  }
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  await page.goto(origin);
  await page
    .locator("#judge-source-tests tbody tr")
    .first()
    .waitFor({ state: "attached" });
  await page.locator("#earlier-evidence > summary").click();
  const sourceDisclosure = page.getByText(
    "Five required deployed policy tests",
    { exact: true },
  );
  await sourceDisclosure.click();
  await sourceDisclosure.evaluate((node) =>
    node.parentElement.scrollIntoView({ block: "start" }),
  );
  assert.equal(await page.locator("#judge-source-tests tbody tr").count(), 5);
  await page.screenshot({
    path: join(output, "04-airnode-contract-tamper.png"),
  });
  const luminance = (hex) => {
    const channels = hex
      .match(/[0-9a-f]{2}/gi)
      .map((v) => Number.parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const contrast = [];
  for (const [text, background] of [
    ["172424", "F5F1E8"],
    ["52615E", "F5F1E8"],
    ["A6362A", "FFF2ED"],
    ["805511", "FFF6DD"],
    ["216247", "E7F5EA"],
    ["F5F1E8", "172424"],
    ["F1CF54", "172424"],
  ]) {
    const values = [luminance(text), luminance(background)].sort(
      (a, b) => b - a,
    );
    const ratio = (values[0] + 0.05) / (values[1] + 0.05);
    assert.ok(ratio >= 4.5);
    contrast.push({ text, background, ratio: Number(ratio.toFixed(2)) });
  }
  writeFileSync(
    join(output, "qa.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        origin,
        results,
        contrast,
        networkWrites: 0,
        scope:
          "Browser UI and saved-file checks. No fresh physical test, payment, or chain verification.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Design QA passed: three sizes, keyboard, focus, exact readings, reduced motion, offline fonts/files, five saved source cases, contrast. No writes.",
  );
} finally {
  await browser.close();
}
