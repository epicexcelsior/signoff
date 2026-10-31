import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  submissionArtifact,
  submissionEvidence,
} from "../src/submission-evidence.js";

const { manifest } = submissionEvidence();
const inspection = manifest.liveEvidence.find(
  (entry) => entry.id === "cardano-physical-camera-inspection",
);
if (!inspection?.sellerPaid || !inspection.physicalCameraEvidence)
  throw new Error("The reviewed real paid inspection is missing.");
const selected = [
  [
    "physical-camera-rework-packet",
    "real camera packet",
    manifest.liveEvidence.find(
      (entry) => entry.id === "physical-camera-placement-rework",
    ).artifactSha256,
  ],
  [
    "physical-paid-inspection-report",
    "paid inspection report",
    inspection.usefulReportSha256,
  ],
  [
    "physical-paid-seller-receipt",
    "inspector payment receipt",
    inspection.sellerReceiptSha256,
  ],
  [
    "device-optical-diagnostic",
    "recorded ESP32 diagnostic",
    manifest.liveEvidence.find(
      (entry) => entry.id === "esp32-optical-diagnostic",
    ).artifactSha256,
  ],
  ["policy-five-cases", "deployed policy checks"],
  ["policy-finalization", "mined policy rejection"],
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = selected.map(([id, name, expected]) => {
  const bytes = submissionArtifact(id);
  if (!bytes) throw new Error(`Missing reviewed artifact: ${id}`);
  const sha256 = hash(bytes);
  if (expected && expected !== sha256)
    throw new Error(`Reviewed artifact hash changed: ${id}`);
  return { id, name, sha256, text: bytes.toString("utf8") };
});
const data =
  JSON.stringify({
    schema: "proof-of-ready/phone-demo/v1",
    checkedAt: manifest.checkedAt,
    inspection,
    files,
  }) + "\n";
const assets = [
  "/demo/",
  "/demo/index.html",
  "/demo/view.js",
  "/demo/demo.css",
  "/demo/evidence.json",
  "/theme.css",
  "/measurement.js",
  "/fonts/BarlowCondensed-SemiBold.woff2",
  "/fonts/BarlowCondensed-Bold.woff2",
  "/fonts/AtkinsonHyperlegibleNext.woff2",
];
const root = new URL("../public/", import.meta.url);
const version = hash(
  data +
    assets
      .filter((path) => !["/demo/", "/demo/evidence.json"].includes(path))
      .map((path) => path.slice(1))
      .map((path) => readFileSync(new URL(path, root)).toString("base64"))
      .join("\n"),
).slice(0, 20);
const worker = `// Generated from reviewed evidence and viewer source. Scope excludes the live station.\nconst CACHE = "proof-ready-evidence-${version}";\nconst ASSETS = ${JSON.stringify(assets)};\nself.addEventListener("install", event => event.waitUntil((async () => {\n  const cache = await caches.open(CACHE);\n  await cache.addAll(ASSETS);\n  await self.skipWaiting();\n})()));\nself.addEventListener("activate", event => event.waitUntil((async () => {\n  for (const key of await caches.keys()) if (key.startsWith("proof-ready-evidence-") && key !== CACHE) await caches.delete(key);\n  await self.clients.claim();\n})()));\nself.addEventListener("fetch", event => {\n  const url = new URL(event.request.url);\n  if (event.request.method !== "GET" || url.origin !== self.location.origin || !ASSETS.includes(url.pathname) || url.search) return;\n  event.respondWith((async () => {\n    const cache = await caches.open(CACHE);\n    const saved = await cache.match(url.pathname);\n    if (saved) return saved;\n    return fetch(event.request);\n  })());\n});\n`;
for (const [name, text] of [
  ["demo/evidence.json", data],
  ["demo/sw.js", worker],
]) {
  const path = new URL(name, root);
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") !== text)
      throw new Error(`Stale ${name}. Run npm run demo:prepare.`);
  } else writeFileSync(path, text);
}
console.log(
  `Phone demo: ${files.length} reviewed files, ${Buffer.byteLength(data)} bytes, cache ${version}.`,
);
