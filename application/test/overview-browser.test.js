import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { fixture, server } from "./helpers.js";

test("generated project overview serves canonical sources and fits desktop and phone widths", async (t) => {
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
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.goto(origin + "/overview.html");
      await page
        .getByRole("heading", { name: "What runs. What still needs evidence." })
        .waitFor();
      assert.match(await page.locator("body").textContent(), /ESP32-C6/);
      assert.equal(
        await page.evaluate(() => getComputedStyle(document.body).margin),
        "0px",
      );
      assert.equal(
        await page
          .getByRole("link", { name: "Private setup", exact: true })
          .getAttribute("href"),
        "#document-1",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: `/tmp/proof-ready-overview-${width}.png`,
        fullPage: true,
      });
      await page.close();
    }
    const doc = await fetch(origin + "/project-docs/ENGINEERING.md");
    assert.equal(doc.status, 200);
    assert.match(await doc.text(), /# Proof of Ready engineering/);
    assert.equal((await fetch(origin + "/project-docs/AGENTS.md")).status, 404);
  } finally {
    await browser.close();
  }
});

test("documentation export preserves Markdown bytes and opens offline as one HTML file", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "proof-ready-export-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "overview.html");
  copyFileSync(new URL("../public/overview.html", import.meta.url), path);
  const browser = await chromium.launch(
    process.env.FIELDPROOF_BROWSER_EXECUTABLE
      ? {
          executablePath: process.env.FIELDPROOF_BROWSER_EXECUTABLE,
          headless: true,
        }
      : { channel: "chrome", headless: true },
  );
  try {
    const context = await browser.newContext({
      offline: true,
      viewport: { width: 390, height: 900 },
    });
    const page = await context.newPage();
    const network = [];
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) network.push(request.url());
    });
    await page.goto(pathToFileURL(path).href);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.body).margin),
      "0px",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const documents = page.locator("#documents details");
    assert.equal(await documents.count(), 8);
    const exported = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Export Markdown", exact: true })
      .click();
    const saved = join(directory, "context.md");
    await (await exported).saveAs(saved);
    assert.equal(
      readFileSync(saved, "utf8"),
      readFileSync(new URL("../public/overview.md", import.meta.url), "utf8"),
    );
    for (const document of await documents.all()) {
      const name = await document.locator("summary").textContent();
      const original = readFileSync(
        new URL("../../" + name, import.meta.url),
        "utf8",
      );
      assert.equal(await document.locator("pre code").textContent(), original);
      const url = await document.locator("a[download]").getAttribute("href");
      assert.equal(
        Buffer.from(url.split(",")[1], "base64").toString(),
        original,
      );
    }
    await page
      .getByRole("link", { name: "Private setup", exact: true })
      .click();
    assert.equal(new URL(page.url()).hash, "#document-1");
    await page.locator("#document-1 summary").click();
    await page.locator("#document-1 pre").waitFor({ state: "visible" });
    assert.deepEqual(network, []);
    await page.screenshot({
      path: "/tmp/proof-ready-export-offline.png",
      fullPage: false,
    });
  } finally {
    await browser.close();
  }
  const result = execFileSync(
    "python3",
    [
      "-c",
      `import zipfile,json,hashlib,pathlib
root=pathlib.Path.cwd().parent
with zipfile.ZipFile('public/overview-export.zip') as archive:
 manifest=json.loads(archive.read('manifest.json'))
 assert len(manifest['documents']) == 8
 for name,digest in manifest['files'].items():
  content=archive.read(name)
  assert hashlib.sha256(content).hexdigest() == digest
  if name not in ('overview.html','overview.md'):
   assert content == (root/name).read_bytes(),name
 assert archive.read('overview.html') == pathlib.Path('public/overview.html').read_bytes()
 assert archive.read('overview.md') == pathlib.Path('public/overview.md').read_bytes()
 print('All export hashes and source bytes match.')`,
    ],
    { encoding: "utf8" },
  );
  assert.match(result, /All export hashes/);
});
