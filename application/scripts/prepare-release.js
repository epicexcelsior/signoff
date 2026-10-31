import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publicSourcePath, reviewedPublicContent } from "./release-policy.js";

process.umask(0o077);
const root = fileURLToPath(new URL("../../", import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = join(root, ".local/release-candidates", stamp);
mkdirSync(dirname(output), { recursive: true });
mkdirSync(output);
const paths = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const content = new Map();
for (const path of new Set(paths)) {
  if (path === "README.md" || path === ".gitignore" || !publicSourcePath(path))
    continue;
  content.set(path, readFileSync(join(root, path)));
}
content.set(
  "README.md",
  readFileSync(join(root, "application/submission/release/README.md")),
);
content.set(
  "docs/JUDGE.md",
  readFileSync(join(root, "application/submission/release/JUDGE.md")),
);
content.set(
  ".gitignore",
  Buffer.from(
    "**/node_modules/\n**/.env\n**/.env.*\n!**/.env.example\n**/artifacts/\n**/test-results/\n**/playwright-report/\n**/__pycache__/\n**/out/\n**/cache/\n*.sqlite*\n*.db*\napplication/public/demo/evidence.json\napplication/public/demo/sw.js\n",
  ),
);
content.set(
  "application/public-release.json",
  Buffer.from(
    JSON.stringify({
      schema: "proof-of-ready/public-release/v1",
      privateDocuments: false,
    }) + "\n",
  ),
);
const pkg = JSON.parse(content.get("application/package.json"));
delete pkg.scripts.overview;
delete pkg.scripts["overview:check"];
delete pkg.scripts["release:prepare"];
pkg.scripts.pretest = "node scripts/demo-evidence.js";
pkg.scripts["submission:check"] = "node scripts/submission-check.js --public";
content.set(
  "application/package.json",
  Buffer.from(JSON.stringify(pkg, null, 2) + "\n"),
);
const mobilePackage = JSON.parse(
  content.get("application/mobile/package.json"),
);
for (const key of ["format", "format:check"])
  mobilePackage.scripts[key] = mobilePackage.scripts[key].replace(
    " README.md",
    "",
  );
content.set(
  "application/mobile/package.json",
  Buffer.from(JSON.stringify(mobilePackage, null, 2) + "\n"),
);
const manifest = JSON.parse(
  content.get("application/submission/evidence-manifest.json"),
);
for (const record of manifest.liveEvidence)
  delete record.chargedPersonalCredits;
manifest.releaseCandidate = {
  published: false,
  sourceSanitized: true,
  privateHistoryIncluded: false,
};
manifest.limits = manifest.limits.filter(
  (line) => !line.includes("budget") && !line.includes("ceiling"),
);
content.set(
  "application/submission/evidence-manifest.json",
  Buffer.from(JSON.stringify(manifest, null, 2) + "\n"),
);
const physical = manifest.liveEvidence.find(
  (record) => record.id === manifest.primaryRealDemo,
);
const evidenceGuide = `# Evidence index\n\nThe main demonstration uses actual Seeker camera evidence and a useful paid FAIL report. It does not establish complete physical acceptance.\n\n- [Real camera packet](../application/submission/evidence/physical-camera-rework-packet.json)\n- [Paid actual-camera FAIL report](../application/submission/evidence/physical-paid-inspection-report.json)\n- [Positive seller receipt](../application/submission/evidence/physical-paid-seller-receipt.json)\n- [Recorded signed ESP32 diagnostic](../application/submission/evidence/esp32-optical-diagnostic.json)\n- [API3 qualification audit](../application/submission/evidence/api3-qualification-audit.json)\n- [Evidence manifest](../application/submission/evidence-manifest.json)\n\nOriginal Cardano Preprod transactions:\n\n- [Escrow](https://preprod.cardanoscan.io/transaction/${physical.transactionHash})\n- [Inspector result](https://preprod.cardanoscan.io/transaction/${physical.resultTransactionHash})\n- [Inspector payment](https://preprod.cardanoscan.io/transaction/${physical.sellerReceiptTransactionHash})\n\nThe earlier paid REVIEW used synthetic inspection input. It remains separate from this actual-camera inspection. Files named deliberate-test are negative-test inputs, not genuine source responses. The other-request original belongs to another authenticated request. The original NVD files retain their exact paid response bytes.\n\n[Judge commands](JUDGE.md) replay the original deployed policy. API3 qualification remains unestablished because the terminal rejection is independent of the CVE verdict.\n\nFile hashes check saved-file integrity. They do not recheck current chain state or establish physical truth. All original evidence bytes remain unchanged.\n`;
content.set("docs/EVIDENCE.md", Buffer.from(evidenceGuide));
for (const [path, bytes] of content) {
  if (!publicSourcePath(path) || !reviewedPublicContent(path, bytes))
    throw new Error(
      `Release review rejected ${path}. No public action occurred.`,
    );
}
const hashes = Object.fromEntries(
  [...content]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, bytes]) => [
      path,
      createHash("sha256").update(bytes).digest("hex"),
    ]),
);
content.set(
  "RELEASE.json",
  Buffer.from(
    JSON.stringify(
      {
        schema: "proof-of-ready/release-candidate/v1",
        preparedAt: new Date().toISOString(),
        privateHistoryIncluded: false,
        publicReleaseProfile: true,
        api3Qualified: false,
        physicalInstallationAccepted: false,
        files: hashes,
      },
      null,
      2,
    ) + "\n",
  ),
);
for (const [path, bytes] of content) {
  const target = resolve(output, path);
  if (!target.startsWith(output + "/"))
    throw new Error("Invalid release path.");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  const source = join(root, path);
  if (existsSync(source) && statSync(source).mode & 0o111)
    chmodSync(target, 0o700);
}
execFileSync("git", ["init", "-q", "--initial-branch=main"], { cwd: output });
execFileSync("git", ["add", "--all"], { cwd: output });
console.log(
  JSON.stringify(
    {
      directory: output,
      reviewedFiles: content.size,
      markdown: [...content.keys()].filter((path) => path.endsWith(".md")),
      privateHistoryIncluded: false,
      published: false,
    },
    null,
    2,
  ),
);
