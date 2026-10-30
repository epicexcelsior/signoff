import { randomBytes } from "node:crypto";
import { AppError } from "./store.js";
import { canonicalJson } from "./artifacts.js";

/** Uses the existing ledger connection and its immediate transactions. */
export class CommissioningStore {
  constructor(store) {
    this.store = store;
    this.db = store.db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS commissioning_orders (
      id TEXT PRIMARY KEY, intent TEXT UNIQUE NOT NULL, input TEXT NOT NULL,
      document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS commissioning_sessions (
      id TEXT PRIMARY KEY, intent TEXT UNIQUE NOT NULL, input TEXT NOT NULL,
      revision INTEGER NOT NULL, document TEXT NOT NULL);`);
  }

  create(kind, intent, input, build) {
    const table = this.table(kind);
    return this.store.transaction(() => {
      const encoded = canonicalJson(input);
      const row = this.db
        .prepare(`SELECT * FROM ${table} WHERE intent=?`)
        .get(intent);
      if (row) {
        if (row.input !== encoded)
          throw new AppError(
            "INTENT_CONFLICT",
            "This request identifier belongs to different commissioning inputs.",
          );
        return JSON.parse(row.document);
      }
      if (
        this.db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count >=
        1000
      )
        throw new AppError(
          "CAPACITY",
          "The commissioning ledger reached its 1,000-record limit.",
          429,
        );
      const document = build(randomBytes(8).toString("hex"));
      if (kind === "orders")
        this.db
          .prepare(`INSERT INTO ${table} VALUES (?,?,?,?)`)
          .run(document.id, intent, encoded, JSON.stringify(document));
      else
        this.db
          .prepare(`INSERT INTO ${table} VALUES (?,?,?,?,?)`)
          .run(document.id, intent, encoded, 0, JSON.stringify(document));
      return document;
    });
  }

  table(kind) {
    if (!["orders", "sessions"].includes(kind))
      throw new TypeError("Unknown commissioning record.");
    return `commissioning_${kind}`;
  }

  get(kind, id) {
    const row = this.db
      .prepare(`SELECT document FROM ${this.table(kind)} WHERE id=?`)
      .get(id);
    if (!row)
      throw new AppError(
        "NOT_FOUND",
        "This commissioning record does not exist.",
        404,
      );
    return JSON.parse(row.document);
  }

  list(kind) {
    return this.db
      .prepare(
        `SELECT document FROM ${this.table(kind)} ORDER BY rowid DESC LIMIT 30`,
      )
      .all()
      .map((row) => JSON.parse(row.document));
  }

  change(id, run) {
    return this.store.transaction(() => {
      const current = this.get("sessions", id);
      const next = run(current);
      this.db
        .prepare(
          "UPDATE commissioning_sessions SET revision=revision+1,document=? WHERE id=?",
        )
        .run(JSON.stringify(next), id);
      return next;
    });
  }
}
