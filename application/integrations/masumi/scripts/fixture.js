import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createInspectionService,
  createFixtureRuntime,
  openLedger,
} from "../src/index.js";

const artifact = JSON.parse(
  readFileSync(new URL("../fixtures/inspection.json", import.meta.url), "utf8"),
);
const dir = mkdtempSync(join(tmpdir(), "proof-ready-masumi-fixture-"));
const ledger = openLedger(join(dir, "tasks.sqlite"));
try {
  const service = createInspectionService({
    ledger,
    runtime: createFixtureRuntime(),
    loadArtifact: async () => artifact,
  });
  let state = service.create({
    inspectionId: "fixture-inspection",
    workOrderHash: artifact.workOrderHash,
    evidenceBundleHash: artifact.evidenceBundleHash,
    inputText: "Evaluate the local commissioning fixture.",
    idempotencyKey: "fixture-intent",
  });
  for (let index = 0; index < 10 && state.stage !== "COMPLETE"; index += 1)
    state = await service.advance(state.taskId);
  if (state.stage !== "COMPLETE")
    throw new Error("The fixture did not complete.");
  process.stdout.write(
    `${JSON.stringify(
      {
        fixture: true,
        networkWrites: false,
        sellerPaid: state.sellerPaid,
        stage: state.stage,
        inputHash: state.inputHash,
        resultHash: state.resultHash,
        report: state.report,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  ledger.close();
  rmSync(dir, { recursive: true, force: true });
}
