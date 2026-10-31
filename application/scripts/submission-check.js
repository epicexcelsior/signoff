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
      reviewed.sourceDependence.sourceDependentTerminalDecision !== true)
  )
    throw new Error(
      "The qualification claim lacks a verified source-dependent terminal decision.",
    );
  console.log(
    audit.qualified
      ? "API3 qualification evidence is recorded."
      : "API3 NOT QUALIFIED: deployed tamper checks pass, but a source-dependent terminal decision is missing.",
  );
  console.log(
    manifest.readyForSubmission
      ? "Submission evidence is marked complete. Owner publication remains separate."
      : "SUBMISSION NOT COMPLETE: physical acceptance and owner publication/video links remain separate requirements.",
  );
  if (process.argv.includes("--require-ready") && !manifest.readyForSubmission)
    process.exitCode = 1;
}
