import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectVerifiedChecks,
  coworkerInputHash,
  coworkerResultHash,
  standardInputHash,
  standardResultHash,
  validateReport,
  inspectionRequest,
} from "../src/index.js";
import { artifact, request } from "./helpers.js";

test("inspector changes the delivered result when required evidence changes", () => {
  assert.equal(inspectVerifiedChecks(artifact()).outcome, "PASS");
  const fail = inspectVerifiedChecks(artifact("FAIL"));
  assert.equal(fail.outcome, "FAIL");
  assert.match(fail.predicates[0].reason, /did not transition/);
  const missing = artifact();
  missing.checks.pop();
  const report = inspectVerifiedChecks(missing);
  assert.equal(report.outcome, "REVIEW");
  assert.equal(report.predicates[1].id, "delivery");
  assert.match(report.limitations.join(" "), /Simulation/);
});

test("inspector rejects duplicate evidence, inconsistent results, and substituted bindings", () => {
  const input = artifact();
  input.checks.push(input.checks[0]);
  assert.throws(() => inspectVerifiedChecks(input), {
    code: "DUPLICATE_PREDICATE",
  });
  assert.throws(
    () =>
      validateReport(
        { ...inspectVerifiedChecks(artifact()), outcome: "FAIL" },
        request(),
      ),
    { code: "INCONSISTENT_REPORT" },
  );
  assert.throws(
    () =>
      validateReport(inspectVerifiedChecks(artifact()), {
        ...request(),
        workOrderHash: `0x${"c".repeat(64)}`,
      }),
    { code: "REPORT_BINDING_MISMATCH" },
  );
  assert.throws(() =>
    inspectionRequest.parse({ ...request(), workOrderHash: "a".repeat(64) }),
  );
});

test("Coworker hashes exact UTF-8 text and Standard commitments retain nonce framing", () => {
  const text = '{"a":1,"b":2}';
  assert.equal(coworkerInputHash(text), coworkerResultHash(text));
  assert.notEqual(coworkerInputHash(text), coworkerInputHash('{"b":2,"a":1}'));
  assert.notEqual(coworkerInputHash(text), coworkerInputHash(`${text}\n`));
  const nonce = "1234567890abcdef1234";
  assert.equal(
    standardInputHash({ prompt: "hi" }, nonce),
    coworkerInputHash(`${nonce};{"prompt":"hi"}`),
  );
  assert.equal(
    standardResultHash("answer", nonce),
    coworkerInputHash(`${nonce};answer`),
  );
  assert.throws(
    () => standardInputHash({ prompt: "hi", ignored: true }, nonce),
    { code: "INVALID_STANDARD_INPUT" },
  );
  assert.throws(() => standardResultHash("answer", "bad"), {
    code: "INVALID_NONCE",
  });
  assert.throws(() => standardResultHash({ text: "answer" }, nonce), {
    code: "INVALID_STANDARD_RESULT",
  });
});
