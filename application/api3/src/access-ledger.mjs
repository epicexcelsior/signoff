import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  realpathSync,
  existsSync,
  lstatSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import {
  dirname,
  basename,
  resolve,
  relative,
  isAbsolute,
  sep,
} from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { fail } from "./access-policy.mjs";

export function privatePath(path) {
  if (typeof path !== "string" || !isAbsolute(path))
    fail(
      "PRIVATE_PATH_REQUIRED",
      "Use an absolute private path outside source.",
    );
  let parent = resolve(path);
  const missing = [];
  while (!existsSync(parent)) {
    missing.unshift(basename(parent));
    parent = dirname(parent);
  }
  const actual = resolve(realpathSync(parent), ...missing);
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const rel = relative(root, actual);
  if (!rel || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel)))
    fail(
      "STATE_IN_SOURCE",
      "Keep access ledgers, authorization material and responses outside source.",
    );
  return actual;
}

export function openAccessLedger(
  path,
  { identity, budgetAtomicUnits = "20000" },
) {
  path = privatePath(path);
  if (
    !/^[1-9]\d{0,6}$/.test(budgetAtomicUnits) ||
    BigInt(budgetAtomicUnits) > 1000000n
  )
    fail(
      "INVALID_ACCESS_BUDGET",
      "Set an explicit total budget from one through one million atomic aUSD units.",
    );
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  try {
    writeFileSync(path, "", { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
    fail("INVALID_LEDGER", "Use a regular private access-ledger file.");
  chmodSync(path, 0o600);
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS access_config(id INTEGER PRIMARY KEY CHECK(id=1),document TEXT NOT NULL);CREATE TABLE IF NOT EXISTS access_jobs(id TEXT PRIMARY KEY,intent TEXT UNIQUE NOT NULL,nonce TEXT UNIQUE NOT NULL,amount INTEGER NOT NULL,revision INTEGER NOT NULL,document TEXT NOT NULL)",
  );
  const config = JSON.stringify({ identity, budgetAtomicUnits });
  db.prepare("INSERT OR IGNORE INTO access_config VALUES(1,?)").run(config);
  if (
    db.prepare("SELECT document FROM access_config WHERE id=1").get()
      .document !== config
  ) {
    db.close();
    fail(
      "ACCESS_CONFIG_MISMATCH",
      "The ledger belongs to another wallet, endpoint, policy or budget. Preserve the original ledger.",
    );
  }
  const tx = (run) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const value = run();
      db.exec("COMMIT");
      return value;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  const read = (id) => {
    const row = db
      .prepare("SELECT document FROM access_jobs WHERE id=?")
      .get(id);
    if (!row)
      fail("ACCESS_NOT_FOUND", "The original access request does not exist.");
    return JSON.parse(row.document);
  };
  return {
    create(intent, build, now) {
      if (typeof intent !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(intent))
        fail(
          "INVALID_ACCESS_INTENT",
          "Use one stable access request identifier.",
        );
      return tx(() => {
        const found = db
          .prepare("SELECT document FROM access_jobs WHERE intent=?")
          .get(intent);
        if (found) return JSON.parse(found.document);
        const pending = db
          .prepare("SELECT document FROM access_jobs")
          .all()
          .map((row) => JSON.parse(row.document))
          .some(
            (state) =>
              state.stage !== "SETTLED" &&
              !(
                state.stage === "PREPARED" &&
                Number(state.plan.typedData.message.validBefore) <= now
              ),
          );
        if (pending)
          fail(
            "ACCESS_UNRESOLVED",
            "An original access authorization remains unresolved. Do not prepare a replacement.",
          );
        const { count, reserved } = db
          .prepare(
            "SELECT count(*) AS count,coalesce(sum(amount),0) AS reserved FROM access_jobs",
          )
          .get();
        if (count >= 1000)
          fail(
            "ACCESS_CAPACITY",
            "The access ledger reached its capacity. Preserve financial history.",
          );
        const plan = build();
        const amount = Number(plan.accepted.amount);
        if (BigInt(reserved + amount) > BigInt(budgetAtomicUnits))
          fail(
            "ACCESS_BUDGET",
            "Prepared authorizations reached the pinned total budget. No new nonce was saved.",
          );
        const id = randomBytes(8).toString("hex");
        const state = {
          schema: "proof-of-ready/api3-access/v1",
          id,
          intent,
          stage: "PREPARED",
          revision: 0,
          plan,
          payment: null,
          source: null,
          error: null,
        };
        db.prepare("INSERT INTO access_jobs VALUES(?,?,?,?,?,?)").run(
          id,
          intent,
          plan.typedData.message.nonce,
          amount,
          0,
          JSON.stringify(state),
        );
        return state;
      });
    },
    get: read,
    change(id, run) {
      return tx(() => {
        const current = read(id);
        const next = { ...run(current), revision: current.revision + 1 };
        db.prepare(
          "UPDATE access_jobs SET revision=?,document=? WHERE id=? AND revision=?",
        ).run(next.revision, JSON.stringify(next), id, current.revision);
        return next;
      });
    },
    close() {
      db.close();
    },
  };
}
