import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { IntegrationError, sha256Text, transportInput } from "./contracts.js";

export function openLedger(path) {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, inspection_id TEXT NOT NULL UNIQUE, intent TEXT NOT NULL UNIQUE,
      fingerprint TEXT NOT NULL, version INTEGER NOT NULL, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS configuration (id INTEGER PRIMARY KEY CHECK (id=1), value TEXT NOT NULL);`);
  const decode = (row) => (row ? JSON.parse(row.state) : null);
  return {
    pin(config) {
      const value = JSON.stringify(config);
      db.prepare("INSERT OR IGNORE INTO configuration VALUES(1, ?)").run(value);
      if (
        db.prepare("SELECT value FROM configuration WHERE id=1").get().value !==
        value
      ) {
        throw new IntegrationError(
          "LEDGER_CONFIG_MISMATCH",
          "Use a separate ledger for another runtime, Workspace, or payment identity.",
        );
      }
    },
    create(request, context) {
      const exactInput = transportInput(request);
      const fingerprint = sha256Text(JSON.stringify(request));
      db.exec("BEGIN IMMEDIATE");
      try {
        const existing = db
          .prepare("SELECT * FROM tasks WHERE intent=? OR inspection_id=?")
          .get(request.idempotencyKey, request.inspectionId);
        if (existing) {
          if (existing.fingerprint !== fingerprint)
            throw new IntegrationError(
              "IDEMPOTENCY_CONFLICT",
              "This inspection or idempotency key already identifies another input.",
            );
          db.exec("COMMIT");
          return { state: decode(existing), created: false };
        }
        const state = {
          taskId: randomUUID(),
          version: 1,
          stage: "CREATED",
          request,
          exactInput,
          inputHash: sha256Text(exactInput),
          transportMode: context.transportMode,
          paid: context.paid,
          sellerPaid: false,
        };
        db.prepare("INSERT INTO tasks VALUES(?,?,?,?,?,?)").run(
          state.taskId,
          request.inspectionId,
          request.idempotencyKey,
          fingerprint,
          state.version,
          JSON.stringify(state),
        );
        db.exec("COMMIT");
        return { state, created: true };
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    get(id) {
      const state = decode(
        db.prepare("SELECT state FROM tasks WHERE id=?").get(id),
      );
      if (!state)
        throw new IntegrationError(
          "TASK_NOT_FOUND",
          "The inspection task does not exist in this ledger.",
        );
      return state;
    },
    update(id, expectedVersion, changes) {
      const previous = this.get(id);
      if (previous.version !== expectedVersion)
        throw new IntegrationError(
          "STATE_CONFLICT",
          "Another worker advanced this inspection. Read its current state.",
        );
      const next = { ...previous, ...changes, version: expectedVersion + 1 };
      const result = db
        .prepare("UPDATE tasks SET version=?,state=? WHERE id=? AND version=?")
        .run(next.version, JSON.stringify(next), id, expectedVersion);
      if (result.changes !== 1)
        throw new IntegrationError(
          "STATE_CONFLICT",
          "Another worker advanced this inspection. Read its current state.",
        );
      return next;
    },
    list() {
      return db
        .prepare("SELECT state FROM tasks ORDER BY rowid")
        .all()
        .map(decode);
    },
    close() {
      db.close();
    },
  };
}
