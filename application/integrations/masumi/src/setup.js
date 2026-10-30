import { readFileSync, existsSync, realpathSync } from "node:fs";
import {
  resolve,
  dirname,
  basename,
  join,
  isAbsolute,
  relative,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { IntegrationError } from "./errors.js";
import { taskTarget } from "./runtime.js";
import { TEST_USDM } from "./payment.js";

export function privateStateDirectory(value) {
  if (typeof value !== "string" || !isAbsolute(value))
    throw new IntegrationError(
      "STATE_DIRECTORY_REQUIRED",
      "Use an absolute private runtime directory outside tracked source.",
    );
  let parent = resolve(value);
  const missing = [];
  while (!existsSync(parent)) {
    missing.unshift(basename(parent));
    parent = dirname(parent);
  }
  const actual = join(realpathSync(parent), ...missing);
  const source = realpathSync(
    fileURLToPath(new URL("../../../../", import.meta.url)),
  );
  const fromSource = relative(source, actual);
  if (
    !fromSource ||
    (!fromSource.startsWith(`..${sep}`) &&
      fromSource !== ".." &&
      !isAbsolute(fromSource))
  )
    throw new IntegrationError(
      "STATE_DIRECTORY_IN_SOURCE",
      "Select a private runtime directory outside the repository.",
    );
  return actual;
}

export function setupPlan(env = process.env) {
  const provenance = JSON.parse(
    readFileSync(new URL("../PROVENANCE.json", import.meta.url), "utf8"),
  );
  const target = env.COWORKER_ID
    ? taskTarget({
        coworkerId: env.COWORKER_ID,
        organizationId: env.SOKOSUMI_ORGANIZATION_ID || null,
        organizationSlug: env.SOKOSUMI_ORGANIZATION_SLUG || null,
      })
    : null;
  return {
    schema: "proof-of-ready/masumi-setup-plan/v1",
    executed: false,
    network: "Cardano Preprod",
    taskTarget: target,
    sources: provenance,
    localChecks: [
      "npm ci --ignore-scripts",
      "npm run check",
      "npm test",
      "npm run fixture",
    ],
    requiredPrivateConfiguration: [
      "MASUMI_STATE_DIR outside tracked source",
      "COWORKER_ID and confirmed Personal Workspace access or both organization identifiers",
      "MASUMI_REGISTRATION_FILE: actual registered agent, source index, dedicated seller wallet and source address",
      "MPS_RUNTIME_TOKEN_FILE: scoped seller token",
      "MPS_BUYER_RUNTIME_TOKEN_FILE: separately scoped buyer token for refund requests",
      "BLOCKFROST_API_KEY_PREPROD",
      "INSPECTION_BRIDGE_MODULE: immutable artifact loader",
    ],
    paymentService: {
      ...provenance.masumiPaymentService,
      baseUrl: env.MPS_URL || "http://127.0.0.1:38127",
      storage:
        "Dedicated PostgreSQL database and encrypted wallet state outside tracked source.",
      runtimeRule:
        "Use the pinned MPS Node range in an isolated runtime. The parent app runtime is insufficient.",
    },
    proposedPaidTask: {
      amountAtomicUnits: "1000000",
      unit: TEST_USDM,
      displayAmount: "1 test USDM",
      seller: null,
      fees: "Not estimated. Read actual configured wallet and transaction fee estimates before authorization.",
      deadlineOffsetsMinutes: {
        payBy: 5,
        submitResult: 20,
        unlock: 36,
        disputeUnlock: 52,
      },
    },
    externalDecisions: [
      "Approve dedicated account resources and public agent author identity.",
      "Approve the actual configured seller, wallet scope, Preprod funding, fee estimate, and bounded payment budget.",
      "Authorize execution-only external Task creation before enabling external writes.",
      "Authorize payments separately before enabling paid tasks.",
    ],
    recovery:
      "Persist exact input, signed terms, original payment identifier, write claims, and result bytes. Reconcile uncertain writes. Do not repurchase automatically.",
    unverified: [
      "External Personal Workspace execution",
      "Registration and scoped MPS configuration",
      "Escrow funding",
      "Live result submission",
      "Seller receipt",
      "Refund collection",
    ],
  };
}
