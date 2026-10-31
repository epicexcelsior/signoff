import { createHash } from "node:crypto";

const generated = new Set([
  "application/public/overview.html",
  "application/public/overview.md",
  "application/public/overview-export.zip",
  "application/public/demo/evidence.json",
  "application/public/demo/sw.js",
]);
const publicMarkdown = new Set([
  "README.md",
  "docs/JUDGE.md",
  "docs/EVIDENCE.md",
]);
const scriptNames = new Set([
  "observe.py",
  "check.js",
  "demo-evidence.js",
  "demo-integration.js",
  "demo-preflight.js",
  "record-demo.js",
  "record-evidence-demo.js",
  "submission-check.js",
  "release-policy.js",
  "verify-packet.js",
  "buyer.js",
  "masumi-check.js",
]);
export function forbiddenRuntimePath(path) {
  return (
    /(?:^|\/)(?:\.git|node_modules|artifacts|test-results|playwright-report|__pycache__|\.venv[^/]*|out|cache|archive|\.local)(?:\/|$)/.test(
      path,
    ) ||
    (/(?:^|\/)\.env(?:\.[^/]*)?$/.test(path) &&
      !path.endsWith(".env.example")) ||
    /\.(?:sqlite(?:-[^/]*)?|db(?:-[^/]*)?|apk|aab|bin|elf|pem|key|keystore|xlsx|pyc)$/i.test(
      path,
    ) ||
    generated.has(path) ||
    path === "TUM_Hackathon_Autonomous_Agent_Master_Handoff.md"
  );
}
export function publicSourcePath(path) {
  if (
    forbiddenRuntimePath(path) ||
    path.split("/").some((part) => part === "..")
  )
    return false;
  if (/\.md$/i.test(path)) return publicMarkdown.has(path);
  if (path === ".gitignore" || path === "RELEASE.json") return true;
  if (
    [
      "application/package.json",
      "application/package-lock.json",
      "application/.env.example",
      "application/.prettierignore",
      "application/requirements-ble.txt",
      "application/public-release.json",
    ].includes(path)
  )
    return true;
  if (path.startsWith("application/src/")) return true;
  if (path.startsWith("application/public/")) return !path.includes("overview");
  if (path.startsWith("application/scripts/"))
    return scriptNames.has(path.slice("application/scripts/".length));
  if (path.startsWith("application/test/"))
    return !path.endsWith("overview-browser.test.js");
  if (
    path === "application/submission/evidence-manifest.json" ||
    path.startsWith("application/submission/evidence/")
  )
    return true;
  return [
    "application/api3/",
    "application/contracts/",
    "application/integrations/",
    "application/firmware/",
    "application/device/",
    "application/mobile/",
    "application/protocol/",
  ].some((prefix) => path.startsWith(prefix));
}
export function sensitivePublicText(text) {
  return /-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----|\bsk_live_[A-Za-z0-9]{20,}|\/(?:home|Users)\/[^/\s]+\/|\.local\/private-config\//.test(
    text,
  );
}
export function reviewedPublicContent(path, bytes) {
  // This exact official OpenCV build contains upstream compiler paths.
  // A checksum change requires a new review instead of a vendor-wide exception.
  if (path === "application/public/vendor/opencv-4.13.0/opencv.js")
    return (
      createHash("sha256").update(bytes).digest("hex") ===
      "63366510248adf3a7eddf3e793dd825404efb7df3749f4d6f8557c7fa4ca8aa0"
    );
  return !sensitivePublicText(bytes.toString("utf8"));
}
