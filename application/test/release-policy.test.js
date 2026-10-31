import test from "node:test";
import assert from "node:assert/strict";
import {
  publicSourcePath,
  sensitivePublicText,
} from "../scripts/release-policy.js";

test("public release allowlist excludes private documents, credentials, runtime and unknown source lanes", () => {
  for (const path of [
    "AGENTS.md",
    "MORNING_HANDOFF.md",
    "DEMO_NOW.md",
    "PROOF_OF_READY_AGENT_HANDOFF.md",
    "research/EVIDENCE.md",
    "docs/ENGINEERING.md",
    "application/.env",
    "application/public/overview.html",
    "application/public/demo/evidence.json",
    "application/mobile/node_modules/key.js",
    "application/submission/devfolio-draft.json",
    "application/submission/release/README.md",
    "../README.md",
    "unreviewed/new-file.js",
  ])
    assert.equal(publicSourcePath(path), false, path);
  for (const path of [
    "README.md",
    "docs/JUDGE.md",
    "application/src/app.js",
    "application/submission/evidence/physical-paid-seller-receipt.json",
    "application/api3/package-lock.json",
    "application/public-release.json",
  ])
    assert.equal(publicSourcePath(path), true, path);
  assert.equal(
    sensitivePublicText(["-----BEGIN ", "PRIVATE KEY-----"].join("")),
    true,
  );
  assert.equal(
    sensitivePublicText("Use /home/" + "operator/" + "private/file"),
    true,
  );
  assert.equal(
    sensitivePublicText("Cardano Preprod original transaction"),
    false,
  );
});
