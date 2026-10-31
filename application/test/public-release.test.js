import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { fixture, server } from "./helpers.js";

test("public release blocks private documents and links only to saved public evidence", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service, { publicRelease: true });
  for (const path of [
    "/project-docs/README.md",
    "/project-docs/ENGINEERING.md",
    "/project-docs/EVIDENCE.md",
    "/project-docs/PLAN.md",
    "/project-docs/DIRECTIVE.md",
    "/overview.html",
    "/overview.md",
    "/overview-export.zip",
  ])
    assert.equal((await fetch(origin + path)).status, 404);
  assert.equal(
    (await (await fetch(origin + "/api/config")).json()).public_release,
    true,
  );
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(origin);
    await page.waitForFunction(
      () =>
        document.getElementById("project-overview-link").textContent ===
        "Saved real evidence",
    );
    assert.equal(
      await page.locator("#project-overview-link").getAttribute("href"),
      "/demo/",
    );
    assert.equal(
      (await fetch(origin + "/api/submission-evidence")).status,
      200,
    );
  } finally {
    await browser.close();
  }
});
