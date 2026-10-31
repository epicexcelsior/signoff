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
    "physical-paid-inspection-report",
    new URL(
      "../submission/evidence/physical-paid-inspection-report.json",
      import.meta.url,
    ),
  ],
  [
    "physical-paid-seller-receipt",
    new URL(
      "../submission/evidence/physical-paid-seller-receipt.json",
      import.meta.url,
    ),
  ],
  [
    "physical-camera-rework-packet",
    new URL(
      "../submission/evidence/physical-camera-rework-packet.json",
      import.meta.url,
    ),
  ],
  [
    "device-optical-diagnostic",
    new URL(
      "../submission/evidence/esp32-optical-diagnostic.json",
      import.meta.url,
    ),
  ],
  [
    "device-flash-proof",
    new URL(
      "../submission/evidence/esp32-optical-flash-proof.json",
      import.meta.url,
    ),
  ],
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
  [
    "paid-inspection-seller-receipt",
    new URL(
      "../submission/evidence/cardano-seller-receipt.json",
      import.meta.url,
    ),
  ],
  [
    "nvd-final-original",
    new URL(
      "../submission/evidence/nvd-paid-final-original.json",
      import.meta.url,
    ),
  ],
  [
    "nvd-final-settlement",
    new URL(
      "../submission/evidence/api3-final-access-settlement.json",
      import.meta.url,
    ),
  ],
  [
    "policy-five-cases",
    new URL(
      "../submission/evidence/api3-five-deployed-cases.json",
      import.meta.url,
    ),
  ],
  [
    "policy-finalization",
    new URL(
      "../submission/evidence/api3-finalization-proof.json",
      import.meta.url,
    ),
  ],
  [
    "policy-evaluation-context",
    new URL(
      "../submission/evidence/api3-policy-evaluation.json",
      import.meta.url,
    ),
  ],
  [
    "policy-other-request-original",
    new URL(
      "../submission/evidence/api3-other-request-original.json",
      import.meta.url,
    ),
  ],
  [
    "policy-wrong-key-test",
    new URL(
      "../submission/evidence/api3-wrong-key-deliberate-test.json",
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
