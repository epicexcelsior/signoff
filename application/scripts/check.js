import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

for (const folder of ["src", "scripts", "test", "public"]) {
  for (const entry of readdirSync(folder)) {
    if (entry.endsWith(".js"))
      execFileSync(process.execPath, ["--check", join(folder, entry)], {
        stdio: "inherit",
      });
  }
}
// Compile without creating bytecode in the source directory.
execFileSync("python3", [
  "-c",
  'import ast; ast.parse(open("scripts/observe.py").read())',
]);
for (const file of ["package.json", "package-lock.json"])
  JSON.parse(readFileSync(file, "utf8"));
console.log(
  "JavaScript syntax, Python syntax, and package JSON checks passed.",
);
