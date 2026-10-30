import { DatabaseSync } from "node:sqlite";
import { isAbsolute } from "node:path";
import { artifactDigest } from "../src/artifacts.js";

// Print only the commitment. Runtime credentials and ledger contents stay private.
let db;
try {
  const path = process.argv[2];
  if (!isAbsolute(path ?? ""))
    throw new Error("Use the absolute private Masumi tasks.sqlite path.");
  db = new DatabaseSync(path, { readOnly: true });
  const value = db
    .prepare("SELECT value FROM configuration WHERE id=1")
    .get()?.value;
  if (!value)
    throw new Error("The inspector ledger has no pinned configuration.");
  console.log(
    JSON.stringify({ configurationDigest: artifactDigest(JSON.parse(value)) }),
  );
} catch {
  console.error(
    "INSPECTOR_PIN_UNAVAILABLE: Use an initialized private inspector ledger. No state changed.",
  );
  process.exitCode = 1;
} finally {
  db?.close();
}
