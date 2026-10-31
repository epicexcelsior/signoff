import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createApp } from "../src/app.js";
import { fixture, server } from "./helpers.js";

test("phone demo reopens with the coordinator stopped and rejects corrupt cached evidence", async (t) => {
  const { service } = fixture(t);
  const http = createApp(service).listen(0, "127.0.0.1");
  await new Promise((resolve) => http.once("listening", resolve));
  const origin = `http://127.0.0.1:${http.address().port}`;
  const stop = async () => {
    if (!http.listening) return;
    http.closeAllConnections();
    await new Promise((resolve) => http.close(resolve));
  };
  t.after(stop);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    const posts = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    await page.goto(origin + "/demo/");
    await page.waitForFunction(() =>
      document
        .getElementById("phone-status")
        .textContent.includes("Saved in this browser"),
    );
    await page.waitForFunction(() =>
      Boolean(navigator.serviceWorker.controller),
    );
    assert.match(
      await page.locator("#verification").textContent(),
      /6 saved file hashes match/,
    );
    await stop();
    await context.setOffline(true);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.reload();
      await page.waitForFunction(
        () => !document.getElementById("verify-files").disabled,
      );
      await page.waitForFunction(() =>
        /Saved in this browser|Offline saved view/.test(
          document.getElementById("phone-status").textContent,
        ),
      );
      assert.equal(
        await page.locator("#phone-status").getAttribute("data-error"),
        "false",
      );
      await page.getByRole("button", { name: "Verify saved files" }).click();
      assert.match(
        await page.locator("#verification").textContent(),
        /6 saved file hashes match/,
      );
      assert.match(
        await page.locator("#placement").textContent(),
        /Camera placement FAIL/,
      );
      assert.equal(await page.locator("#transactions a").count(), 3);
      assert.equal(
        await page.locator("section[data-proof]:visible").count(),
        2,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `/tmp/proof-ready-phone-demo-${width}.png`,
        fullPage: true,
      });
    }
    // A read-only viewer must never cache a live API as an offline answer.
    assert.equal(
      await page.evaluate(async () => {
        try {
          await fetch("/api/config");
          return false;
        } catch {
          return true;
        }
      }),
      true,
    );
    await page.evaluate(async () => {
      const key = (await caches.keys()).find((name) =>
        name.startsWith("proof-ready-evidence-"),
      );
      const cache = await caches.open(key);
      const response = await cache.match("/demo/evidence.json");
      const data = await response.json();
      data.files[0].text += " ";
      await cache.put(
        "/demo/evidence.json",
        new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    await page.reload();
    await page.waitForFunction(() =>
      document
        .getElementById("verification")
        .textContent.includes("Saved file changed"),
    );
    assert.equal(await page.locator("section[data-proof]:visible").count(), 0);
    assert.equal(await page.locator("#verify-files").isDisabled(), true);
    assert.deepEqual(posts, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test("phone demo reports missing evidence without showing a completed inspection", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/demo/evidence.json", (route) =>
      route.fulfill({ status: 404, body: "Unavailable" }),
    );
    await page.goto(origin + "/demo/");
    await page.waitForFunction(
      () => document.getElementById("phone-status").dataset.error === "true",
    );
    assert.match(
      await page.locator("#verification").textContent(),
      /Reconnect USB and reload/,
    );
    assert.equal(await page.locator("section[data-proof]:visible").count(), 0);
    assert.equal(await page.locator("#verify-files").isDisabled(), true);
  } finally {
    await browser.close();
  }
});
