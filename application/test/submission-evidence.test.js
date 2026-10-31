import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fixture, server } from "./helpers.js";

test("judge evidence serves only reviewed originals and their exact hashes without changing saved attempts", async (t) => {
  const { service } = fixture(t);
  const origin = await server(t, service);
  const before = service.commissioning.store.list("sessions");
  const response = await fetch(`${origin}/api/submission-evidence`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const result = await response.json();
  assert.match(result.scope, /do not authorize/);
  const original = readFileSync(
    new URL(
      "../submission/evidence/nvd-paid-first-original.json",
      import.meta.url,
    ),
  );
  const artifact = result.artifacts.find(
    (entry) => entry.id === "nvd-original",
  );
  assert.equal(
    artifact.sha256,
    createHash("sha256").update(original).digest("hex"),
  );
  const served = Buffer.from(
    await (await fetch(`${origin}${artifact.href}`)).arrayBuffer(),
  );
  assert.deepEqual(served, original);
  assert.equal(
    artifact.sha256,
    result.manifest.liveEvidence.find(
      (entry) => entry.id === "api3-paid-nvd-first",
    ).originalResponseSha256,
  );
  const reportArtifact = result.artifacts.find(
    (entry) => entry.id === "paid-inspection-report",
  );
  const reportResponse = await fetch(`${origin}${reportArtifact.href}`);
  const report = await reportResponse.json();
  assert.equal(report.outcome, "REVIEW");
  assert.match(report.limitations.join(" "), /synthetic physical evidence/);
  assert.equal(
    reportArtifact.sha256,
    result.manifest.liveEvidence.find(
      (entry) => entry.id === "cardano-paid-inspection-delivery",
    ).usefulReportSha256,
  );
  const receiptArtifact = result.artifacts.find(
    (entry) => entry.id === "paid-inspection-seller-receipt",
  );
  const receipt = await (
    await fetch(`${origin}${receiptArtifact.href}`)
  ).json();
  assert.equal(
    receiptArtifact.sha256,
    result.manifest.mandatoryEvidence.cardano.sellerReceiptSha256,
  );
  assert.equal(receipt.verified, true);
  assert.equal(receipt.originalResultConsumed, true);
  assert.equal(receipt.exactReportSha256, reportArtifact.sha256);
  assert(BigInt(receipt.netAtomicUnits) > 0n);
  assert.equal(receipt.physicalEvidence, false);
  const check = await (
    await fetch(
      `${origin}${result.artifacts.find((entry) => entry.id === "policy-five-cases").href}`,
    )
  ).json();
  const proof = await (
    await fetch(
      `${origin}${result.artifacts.find((entry) => entry.id === "policy-finalization").href}`,
    )
  ).json();
  assert.equal(check.results.length, 5);
  assert(check.results.every((entry) => entry.passed));
  assert.equal(check.validSourcePolicy, "PASS");
  assert.equal(proof.judgeBlockHash, check.blockHash);
  assert.equal(proof.sourceResponseDigest, check.sourceResponseDigest);
  assert.equal(proof.decision, "REJECTED");
  assert.equal(proof.mode, "MINED_TRANSACTION_AND_PINNED_STATE");
  assert.equal(result.manifest.readyForSubmission, false);
  for (const id of [
    "credentials.env",
    "wallet",
    "__proto__",
    "constructor",
    "..%2f..%2f.local%2fprivate-config",
  ]) {
    const rejected = await fetch(
      `${origin}/api/submission-evidence/artifacts/${id}`,
    );
    assert.equal(rejected.status, 404);
  }
  assert.deepEqual(service.commissioning.store.list("sessions"), before);
});
