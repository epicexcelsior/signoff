import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";

export class AppError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, intent TEXT UNIQUE NOT NULL, state TEXT NOT NULL,
        transaction_id TEXT UNIQUE, document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL,
        at INTEGER NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL);`);
  }

  transaction(run) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = run();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  bindConfig(fingerprint) {
    this.transaction(() => {
      const row = this.db
        .prepare("SELECT value FROM metadata WHERE key=?")
        .get("configuration");
      if (row && row.value !== fingerprint) {
        throw new AppError(
          "CONFIG_CHANGED",
          "Use a separate state directory for a different provider, mode, or payment configuration.",
        );
      }
      this.db
        .prepare("INSERT OR IGNORE INTO metadata VALUES (?,?)")
        .run("configuration", fingerprint);
    });
  }

  get(id) {
    const row = this.db.prepare("SELECT document FROM jobs WHERE id=?").get(id);
    if (!row)
      throw new AppError("NOT_FOUND", "This check does not exist.", 404);
    return JSON.parse(row.document);
  }

  list() {
    return this.db
      .prepare("SELECT document FROM jobs ORDER BY rowid DESC LIMIT 30")
      .all()
      .map((row) => JSON.parse(row.document));
  }

  events(id) {
    return this.db
      .prepare(
        "SELECT sequence, at, kind, detail FROM events WHERE job_id=? ORDER BY sequence",
      )
      .all(id);
  }

  event(id, kind, detail) {
    this.db
      .prepare("INSERT INTO events (job_id,at,kind,detail) VALUES (?,?,?,?)")
      .run(id, Math.floor(Date.now() / 1000), kind, detail);
  }

  create(intent, input, profile) {
    return this.transaction(() => {
      const row = this.db
        .prepare("SELECT document FROM jobs WHERE intent=?")
        .get(intent);
      if (row) {
        const existing = JSON.parse(row.document);
        if (JSON.stringify(existing.input) !== JSON.stringify(input)) {
          throw new AppError(
            "INTENT_CONFLICT",
            "This request identifier already belongs to a different check.",
          );
        }
        return existing;
      }
      const count = this.db
        .prepare("SELECT count(*) AS count FROM jobs")
        .get().count;
      if (count >= 1000)
        throw new AppError(
          "CAPACITY",
          "The local ledger reached its 1,000-check limit.",
          429,
        );
      const job = {
        id: randomBytes(8).toString("hex"),
        input,
        mode: profile.mode,
        state: "AWAITING_PAYMENT",
        created_at: Math.floor(Date.now() / 1000),
        requirements: profile.requirements,
        contact: profile.contact,
        public_key: profile.publicKey,
        payment: null,
        challenge: null,
        receipt: null,
        verification: null,
        error: null,
      };
      this.db
        .prepare("INSERT INTO jobs (id,intent,state,document) VALUES (?,?,?,?)")
        .run(job.id, intent, job.state, JSON.stringify(job));
      this.event(
        job.id,
        job.state,
        "Created one immutable paid observation request.",
      );
      return job;
    });
  }

  update(id, allowedStates, patch, detail) {
    return this.transaction(() => {
      const job = this.get(id);
      if (!allowedStates.includes(job.state)) {
        throw new AppError(
          "STATE_CONFLICT",
          "This check already advanced. Read its current state.",
        );
      }
      const next = { ...job, ...patch };
      try {
        this.db
          .prepare(
            "UPDATE jobs SET state=?,transaction_id=?,document=? WHERE id=?",
          )
          .run(
            next.state,
            next.payment?.transaction ?? null,
            JSON.stringify(next),
            id,
          );
      } catch (error) {
        if (
          error.code === "ERR_SQLITE_ERROR" &&
          error.message.includes("UNIQUE")
        ) {
          throw new AppError(
            "PAYMENT_REUSE",
            "This payment already belongs to another check.",
          );
        }
        throw error;
      }
      this.event(id, next.state, detail);
      return next;
    });
  }

  close() {
    this.db.close();
  }
}
