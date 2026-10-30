import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const files = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const forbidden = files.filter(
  (path) =>
    /(?:^|\/)(?:node_modules|artifacts|test-results|playwright-report|__pycache__|\.venv[^/]*|out|cache|archive)(?:\/|$)/.test(
      path,
    ) ||
    (/(?:^|\/)\.env(?:\.[^/]*)?$/.test(path) &&
      !path.endsWith(".env.example")) ||
    /\.(?:sqlite(?:-[^/]*)?|db(?:-[^/]*)?|apk|aab|bin|elf|pem|key|keystore|xlsx|pyc)$/i.test(
      path,
    ) ||
    [
      "application/public/overview.html",
      "application/public/overview.md",
      "application/public/overview-export.zip",
    ].includes(path) ||
    path === "TUM_Hackathon_Autonomous_Agent_Master_Handoff.md",
);
if (forbidden.length) {
  console.error(
    "Tracked material crosses the submission boundary:\n" +
      forbidden.join("\n"),
  );
  process.exitCode = 1;
} else
  console.log(
    `Checked ${files.length} tracked paths. No forbidden runtime, credential, build, original-input or generated-report artifact is tracked. This is an artifact-boundary check, not a complete secret audit.`,
  );
