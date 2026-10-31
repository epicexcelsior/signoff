import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) check(path);
    else if (entry.name.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", path], {
        encoding: "utf8",
      });
      if (result.status !== 0) {
        process.stderr.write(result.stderr);
        process.exitCode = 1;
      }
    } else if (entry.name.endsWith(".json"))
      JSON.parse(readFileSync(path, "utf8"));
  }
}
for (const directory of ["src", "scripts", "test", "fixtures"])
  check(new URL(`../${directory}`, import.meta.url).pathname);
for (const file of ["package.json", "package-lock.json", "PROVENANCE.json"])
  JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
if (!process.exitCode)
  process.stdout.write("Masumi syntax and JSON checks passed.\n");
