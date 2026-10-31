import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { AppError } from "./store.js";
import { canonicalJson } from "./artifacts.js";
import { inspectionArtifact } from "./commissioning.js";
import { inspectVerifiedChecks } from "../integrations/masumi/src/inspector.js";

export function createInspectionBridge(path) {
  return {
    loadArtifact(request) {
      if (!/^por-[0-9a-f]{16}$/.test(request?.inspectionId ?? ""))
        throw new AppError(
          "INVALID_INSPECTION",
          "Use a prepared commissioning inspection.",
          422,
        );
      const db = new DatabaseSync(path, { readOnly: true });
      try {
        const row = db
          .prepare("SELECT document FROM commissioning_sessions WHERE id=?")
          .get(request.inspectionId.slice(4));
        const session = row ? JSON.parse(row.document) : null;
        if (
          !session ||
          session.state !== "INSPECTED" ||
          !session.inspectionRequest ||
          canonicalJson(session.inspectionRequest) !== canonicalJson(request)
        )
          throw new AppError(
            "INSPECTION_BINDING_MISMATCH",
            "The inspection differs from its durable prepared request.",
            422,
          );
        const workOrder = JSON.parse(
          db
            .prepare("SELECT document FROM commissioning_orders WHERE id=?")
            .get(session.workOrderId).document,
        );
        return inspectionArtifact(workOrder, session.evidence);
      } finally {
        db.close();
      }
    },
    evaluate: inspectVerifiedChecks,
  };
}

// The Masumi worker imports this module. Opening the ledger waits until an actual
// request, so importing the bridge never creates state or performs network calls.
export const loadArtifact = (request) =>
  createInspectionBridge(
    process.env.PROOFREADY_LEDGER_FILE ??
      resolve(
        process.env.FIELDPROOF_STATE_DIR ??
          resolve(homedir(), ".local/state/fieldproof-cardano"),
        "ledger.sqlite",
      ),
  ).loadArtifact(request);
export const evaluate = inspectVerifiedChecks;
