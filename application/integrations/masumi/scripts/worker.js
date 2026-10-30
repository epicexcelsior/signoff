import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import {
  createInspectionService,
  createSokosumiRuntime,
  openLedger,
  createMpsClient,
  createBlockfrostReader,
  IntegrationError,
  privateStateDirectory,
} from "../src/index.js";

let ledger;
try {
  const [action, value, recoveryPath] = process.argv.slice(2);
  if (
    ![
      "create",
      "advance",
      "reconcile",
      "show",
      "recover-terms",
      "request-refund",
      "authorize-refund",
    ].includes(action) ||
    !value
  )
    throw new IntegrationError(
      "USAGE",
      "Use create REQUEST_FILE, advance ID, reconcile ID, show ID, recover-terms ID FILE, request-refund ID, or authorize-refund ID.",
    );
  const bridgePath = process.env.INSPECTION_BRIDGE_MODULE;
  if (!bridgePath || !isAbsolute(bridgePath))
    throw new IntegrationError(
      "BRIDGE_REQUIRED",
      "Set an absolute application-owned immutable artifact bridge module.",
    );
  const bridge = await import(pathToFileURL(bridgePath).href);
  const writesAuthorized =
    process.env.MASUMI_EXTERNAL_WRITES_AUTHORIZED === "true";
  const paid = process.env.PAID_TASKS_ENABLED === "true";
  const paymentsAuthorized = process.env.MASUMI_PAYMENTS_AUTHORIZED === "true";
  const runtime = createSokosumiRuntime({
    coworkerId: process.env.COWORKER_ID,
    organizationId: process.env.SOKOSUMI_ORGANIZATION_ID || null,
    organizationSlug: process.env.SOKOSUMI_ORGANIZATION_SLUG || null,
    accountApiKey: process.env.SOKOSUMI_API_KEY || undefined,
    writesAuthorized,
  });
  const privateText = (file) => {
    if (!file || !isAbsolute(file))
      throw new IntegrationError(
        "PRIVATE_FILE_REQUIRED",
        "Configure an absolute private credential or registration file path.",
      );
    return readFileSync(file, "utf8").trim();
  };
  const registration = paid
    ? JSON.parse(privateText(process.env.MASUMI_REGISTRATION_FILE))
    : undefined;
  const mps = paid
    ? createMpsClient({
        baseUrl: process.env.MPS_URL || "http://127.0.0.1:38127",
        token: privateText(process.env.MPS_RUNTIME_TOKEN_FILE),
        writesAuthorized: paymentsAuthorized,
      })
    : undefined;
  const buyerMps =
    paid && process.env.MPS_BUYER_RUNTIME_TOKEN_FILE
      ? createMpsClient({
          baseUrl: process.env.MPS_URL || "http://127.0.0.1:38127",
          token: privateText(process.env.MPS_BUYER_RUNTIME_TOKEN_FILE),
          writesAuthorized: paymentsAuthorized,
        })
      : undefined;
  const stateDir =
    process.env.MASUMI_STATE_DIR ||
    join(homedir(), ".local", "state", "proof-of-ready", "masumi");
  if (!isAbsolute(stateDir))
    throw new IntegrationError(
      "STATE_DIRECTORY_REQUIRED",
      "Use an absolute private runtime directory outside tracked source.",
    );
  ledger = openLedger(join(privateStateDirectory(stateDir), "tasks.sqlite"));
  const service = createInspectionService({
    ledger,
    runtime,
    loadArtifact: bridge.loadArtifact,
    evaluate: bridge.evaluate,
    paid,
    paymentsAuthorized,
    registration,
    mps,
    buyerMps,
    readUtxos: paid
      ? createBlockfrostReader({
          projectId: process.env.BLOCKFROST_API_KEY_PREPROD,
        })
      : undefined,
  });
  let state;
  if (action === "create")
    state = service.create(JSON.parse(privateText(value)));
  if (action === "advance") state = await service.advance(value);
  if (action === "reconcile") state = await service.reconcile(value);
  if (action === "show") state = service.get(value);
  if (action === "recover-terms")
    state = service.recoverTerms(value, JSON.parse(privateText(recoveryPath)));
  if (action === "request-refund") state = await service.requestRefund(value);
  if (action === "authorize-refund")
    state = await service.authorizeRefund(value);
  // Exact input and private signed terms remain in the private ledger.
  process.stdout.write(
    `${JSON.stringify(
      {
        taskId: state.taskId,
        remoteTaskId: state.remoteTaskId,
        stage: state.stage,
        paid: state.paid,
        sellerPaid: state.sellerPaid,
        resultHash: state.resultHash,
        report: state.report,
        receipt: state.receipt,
        lastError: state.lastError,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof IntegrationError ? `${error.code}: ${error.message}` : "WORKER_FAILED: Inspect private configuration and saved state. No operation is retried automatically."}\n`,
  );
  process.exitCode = 1;
} finally {
  ledger?.close();
}
