import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  forbiddenRuntimePath,
  publicSourcePath,
  reviewedPublicContent,
} from "./release-policy.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const files = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const publicMode =
  process.argv.includes("--public") ||
  existsSync(new URL("../public-release.json", import.meta.url));
const forbidden = files.filter(
  (path) =>
    forbiddenRuntimePath(path) ||
    (publicMode &&
      (!publicSourcePath(path) ||
        !reviewedPublicContent(
          path,
          readFileSync(new URL("../../" + path, import.meta.url)),
        ))),
);
if (forbidden.length) {
  console.error(
    "Tracked material crosses the submission boundary:\n" +
      forbidden.join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${files.length} tracked paths. Artifact boundary ${publicMode ? "and public allowlist " : ""}passed. Content checks are heuristic, not a complete secret audit.`,
  );
  if (publicMode) {
    const release = JSON.parse(
      readFileSync(new URL("../../RELEASE.json", import.meta.url)),
    );
    const expected = Object.keys(release.files).concat("RELEASE.json").sort();
    if (JSON.stringify([...files].sort()) !== JSON.stringify(expected))
      throw new Error(
        "The candidate file inventory changed. Rebuild the reviewed candidate.",
      );
    for (const [path, sha256] of Object.entries(release.files))
      if (
        createHash("sha256")
          .update(readFileSync(new URL("../../" + path, import.meta.url)))
          .digest("hex") !== sha256
      )
        throw new Error(`Release file changed: ${path}.`);
  }
  const manifest = JSON.parse(
    readFileSync(
      new URL("../submission/evidence-manifest.json", import.meta.url),
    ),
  );
  const audit = manifest.api3Qualification;
  if (
    !audit ||
    audit.qualified !== manifest.mandatoryEvidence.api3.qualificationConfirmed
  )
    throw new Error(
      "The API3 qualification status contradicts its evidence manifest.",
    );
  const bytes = readFileSync(
    new URL("../../" + audit.auditArtifact, import.meta.url),
  );
  if (createHash("sha256").update(bytes).digest("hex") !== audit.auditSha256)
    throw new Error("The API3 qualification audit hash changed.");
  const reviewed = JSON.parse(bytes);
  if (
    reviewed.qualificationEstablished !== audit.qualified ||
    (audit.qualified &&
      reviewed.sourceDependence.sourceDependentOnChainAction !== true)
  )
    throw new Error(
      "The qualification claim lacks a verified source-dependent on-chain action.",
    );
  if (audit.qualified) {
    for (const [name, expected] of Object.entries(reviewed.artifactHashes)) {
      if (!/^(?:api3-|nvd-)[a-z0-9-]+\.json$/.test(name))
        throw new Error(
          "The qualification audit contains an invalid artifact path.",
        );
      const bytes = readFileSync(
        new URL(`../submission/evidence/${name}`, import.meta.url),
      );
      if (createHash("sha256").update(bytes).digest("hex") !== expected)
        throw new Error(`Qualification artifact changed: ${name}.`);
    }
    const original = (name) =>
      JSON.parse(
        readFileSync(
          new URL(`../submission/evidence/${name}`, import.meta.url),
        ),
      );
    const proof = original("api3-admission-proof.json");
    const cases = original("api3-admission-five-cases.json");
    const context = original("api3-admission-context.json");
    const expectedErrors = {
      valid: null,
      edited: "NotSignedByAirnode",
      stale: "InvalidOracle",
      "other-request": "NotSignedByAirnode",
      "wrong-key": "NotSignedByAirnode",
    };
    if (
      proof.sourceDependentAction !== true ||
      proof.inspectionRecorded !== false ||
      proof.decision !== "SOFTWARE_ADMITTED" ||
      proof.jobDecision !== "OPEN" ||
      proof.contract.toLowerCase() !== context.contract.toLowerCase() ||
      proof.jobId !== context.jobId ||
      BigInt(proof.blockNumber) <= BigInt(context.blockNumber) ||
      cases.contract.toLowerCase() !== context.contract.toLowerCase() ||
      cases.blockHash !== context.blockHash ||
      cases.results.length !== 5 ||
      !Object.entries(expectedErrors).every(([name, error]) =>
        cases.results.some(
          (result) =>
            result.case === name &&
            result.observedRevert === error &&
            result.observed === (error ? "REVERTED" : "SUCCEEDED") &&
            result.blockHash === context.blockHash,
        ),
      ) ||
      cases.vulnerableResult.observedRevert !== "SoftwareNotEligible" ||
      cases.unsignedEntryPoint !== "SignedSoftwareRequired"
    )
      throw new Error(
        "Source-gated admission proof and deployed rejection cases do not match.",
      );
  }
  console.log(
    audit.qualified
      ? "API3 source-dependent software admission and all four tamper rejections are recorded."
      : "API3 NOT QUALIFIED: deployed tamper checks pass, but a source-dependent terminal decision is missing.",
  );
  console.log(
    manifest.readyForSubmission
      ? "Submission evidence is marked complete. Owner publication remains separate."
      : "SUBMISSION NOT COMPLETE: final video, reviewed public links, and owner submission remain pending. Physical acceptance remains unestablished.",
  );
  if (process.argv.includes("--require-ready") && !manifest.readyForSubmission)
    process.exitCode = 1;
}
