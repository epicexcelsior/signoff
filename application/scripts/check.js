import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

function checkFolder(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      if (path !== join("public", "vendor")) checkFolder(path);
    } else if (entry.name.endsWith(".js"))
      execFileSync(process.execPath, ["--check", path], {
        stdio: "inherit",
      });
  }
}
for (const folder of ["src", "scripts", "test", "public"]) checkFolder(folder);
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
