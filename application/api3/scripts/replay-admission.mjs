import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createAdmissionReader,
  judgeAdmissionCandidate,
  verifyAdmission,
} from "../src/admission.mjs";

const original = (name) =>
  JSON.parse(
    readFileSync(new URL(`../../submission/evidence/${name}`, import.meta.url)),
  );
try {
  const client = createAdmissionReader();
  const snapshot = original("api3-admission-context.json");
  const saved = original("api3-admission-five-cases.json");
  const candidate = original("nvd-admission-original.json");
  for (const [name, response] of [
    ["valid", candidate],
    ["edited", original("api3-admission-edited-deliberate-test.json")],
    ["stale", original("nvd-paid-final-original.json")],
    ["other-request", original("api3-other-request-original.json")],
    ["wrong-key", original("api3-wrong-key-deliberate-test.json")],
  ]) {
    const result = await judgeAdmissionCandidate({
      client,
      snapshot,
      candidate: response,
    });
    assert.deepEqual(
      { case: name, ...result },
      saved.results.find((item) => item.case === name),
    );
    console.log(`${name}: ${result.observedRevert ?? result.observed}`);
  }
  assert.deepEqual(
    await judgeAdmissionCandidate({
      client,
      snapshot: saved.vulnerableSnapshot,
      candidate,
    }),
    saved.vulnerableResult,
  );
  const expected = original("api3-admission-proof.json");
  const proof = await verifyAdmission({
    client,
    snapshot,
    candidate,
    transactionHash: expected.transactionHash,
  });
  assert.deepEqual(proof, expected);
  console.log(
    JSON.stringify(
      {
        networkWrites: false,
        originalFreshAdmissionVerified: true,
        results: saved.results.map(
          ({ case: name, observed, observedRevert }) => ({
            case: name,
            observed,
            observedRevert,
          }),
        ),
        vulnerableBuild: saved.vulnerableResult.observedRevert,
        admission: proof,
        scope:
          "Historical replay of the actual fresh-source admission. No physical acceptance or current source freshness claim.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: "ADMISSION_REPLAY_FAILED",
      error: error.name,
      message: error.shortMessage ?? error.message?.split("\n")[0],
      networkWrites: false,
    }),
  );
  process.exitCode = 1;
}
