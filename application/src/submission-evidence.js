import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const manifestUrl = new URL(
  "../submission/evidence-manifest.json",
  import.meta.url,
);
// Only reviewed public artifacts are exposed. Private runtime stores are never served.
const artifacts = new Map([
  ["manifest", manifestUrl],
  [
    "nvd-original",
    new URL(
      "../submission/evidence/nvd-paid-first-original.json",
      import.meta.url,
    ),
  ],
  [
    "policy-helper",
    new URL(
      "../submission/evidence/deployed-policy-helper.json",
      import.meta.url,
    ),
  ],
  [
    "paid-inspection-report",
    new URL(
      "../submission/evidence/cardano-paid-report-original.json",
      import.meta.url,
    ),
  ],
  [
    "paid-inspection-bindings",
    new URL(
      "../submission/evidence/cardano-paid-hosted-bindings.json",
      import.meta.url,
    ),
  ],
  [
    "paid-inspection-chain-proof",
    new URL(
      "../submission/evidence/cardano-paid-chain-proof.json",
      import.meta.url,
    ),
  ],
  [
    "paid-inspection-request",
    new URL(
      "../submission/evidence/cardano-paid-request-original.json",
      import.meta.url,
    ),
  ],
]);

export function submissionArtifact(id) {
  const url = artifacts.get(id);
  return url ? readFileSync(url) : null;
}

export function submissionEvidence() {
  const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));
  return {
    manifest,
    scope:
      "Saved evidence. These records do not authorize the current installation.",
    artifacts: [...artifacts.keys()].map((id) => ({
      id,
      sha256: createHash("sha256").update(submissionArtifact(id)).digest("hex"),
      href: `/api/submission-evidence/artifacts/${id}`,
    })),
  };
}
