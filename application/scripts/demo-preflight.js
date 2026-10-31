import { createHash } from "node:crypto";
import {
  submissionEvidence,
  submissionArtifact,
} from "../src/submission-evidence.js";
import { verifyOpticalExecution } from "../src/optical.js";

const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const port = Number(process.env.FIELDPROOF_PORT ?? 4021);
const origin = `http://127.0.0.1:${port}`;
async function read(path) {
  let response;
  try {
    response = await fetch(`${origin}${path}`, {
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error(
      "Cannot read the local station. Start it with npm start, then rerun preflight.",
    );
  }
  check(
    response.ok,
    `Station read failed: ${path} returned HTTP ${response.status}.`,
  );
  return response;
}
try {
  check(
    Number.isInteger(port) && port > 0 && port <= 65535,
    "FIELDPROOF_PORT must identify a local station port from 1 through 65535.",
  );
  const [config, history, served] = await Promise.all([
    read("/api/config").then((r) => r.json()),
    read("/api/commissioning").then((r) => r.json()),
    read("/api/submission-evidence").then((r) => r.json()),
  ]);
  check(
    ["simulation", "physical", "preprod"].includes(config.mode),
    "The station returned an unsupported mode.",
  );
  check(
    Array.isArray(history.sessions) && Array.isArray(history.workOrders),
    "The station returned invalid history.",
  );
  for (const session of history.sessions)
    check(
      history.workOrders.some((order) => order.id === session.workOrderId),
      "A saved attempt has no approved work order. Restart the station with the current source.",
    );
  const local = submissionEvidence();
  check(
    digest(Buffer.from(JSON.stringify(served.manifest))) ===
      digest(Buffer.from(JSON.stringify(local.manifest))),
    "The running station evidence differs from this checkout. Restart the station with the current source.",
  );
  await Promise.all(
    local.artifacts.map(async (artifact) => {
      check(
        served.artifacts.some(
          (item) => item.id === artifact.id && item.sha256 === artifact.sha256,
        ),
        `Saved artifact metadata differs: ${artifact.id}.`,
      );
      const bytes = Buffer.from(
        await (await read(artifact.href)).arrayBuffer(),
      );
      check(
        digest(bytes) === artifact.sha256,
        `Saved artifact bytes differ: ${artifact.id}.`,
      );
    }),
  );
  const parse = (id) => JSON.parse(submissionArtifact(id));
  const manifest = local.manifest;
  const receipt = parse("paid-inspection-seller-receipt");
  check(
    receipt.verified === true &&
      receipt.originalResultConsumed === true &&
      BigInt(receipt.netAtomicUnits) > 0n,
    "The saved seller receipt does not establish positive original collection.",
  );
  check(
    digest(submissionArtifact("paid-inspection-report")) ===
      manifest.mandatoryEvidence.cardano.usefulReportSha256,
    "The saved inspection report differs from its recorded hash.",
  );
  check(
    digest(submissionArtifact("paid-inspection-seller-receipt")) ===
      manifest.mandatoryEvidence.cardano.sellerReceiptSha256,
    "The saved seller receipt differs from its recorded hash.",
  );
  check(
    receipt.exactReportSha256 ===
      digest(submissionArtifact("paid-inspection-report")),
    "The seller receipt belongs to another inspection report.",
  );
  const cases = parse("policy-five-cases");
  const proof = parse("policy-finalization");
  check(
    ["valid", "edited", "stale", "other-request", "wrong-key"].every((name) =>
      cases.results.some((item) => item.case === name && item.passed),
    ),
    "The saved source checks do not cover all five required cases.",
  );
  check(
    cases.results.length === 5 && cases.results.every((item) => item.passed),
    "A saved deployed source check is missing or failed.",
  );
  check(
    proof.judgeBlockHash === cases.blockHash &&
      proof.sourceResponseDigest === cases.sourceResponseDigest &&
      proof.decision === "REJECTED",
    "The saved contract proof differs from the source checks.",
  );
  const optical = parse("device-optical-diagnostic");
  const publicKey =
    "04" +
    Buffer.from(optical.publicKeyJwk.x, "base64url").toString("hex") +
    Buffer.from(optical.publicKeyJwk.y, "base64url").toString("hex");
  verifyOpticalExecution({
    receipt: optical.receipt,
    challenge: optical.challenge,
    provider: optical.receipt.provider,
    publicKey,
    verifiedAt: optical.finishedAt,
  });
  check(
    digest(submissionArtifact("device-optical-diagnostic")) ===
      manifest.liveEvidence.find(
        (item) => item.id === "esp32-optical-diagnostic",
      ).artifactSha256,
    "The original optical diagnostic differs from its recorded hash.",
  );
  console.log(
    JSON.stringify(
      {
        status:
          config.mode === "simulation"
            ? "REHEARSAL_AVAILABLE"
            : "STATION_AVAILABLE",
        station: {
          origin,
          mode: config.mode,
          savedAttempts: history.sessions.length,
          workOrderBindings: "MATCH",
          paymentGrant: config.spend_authorized === true,
          opticalGrant: config.optical_authorized === true,
        },
        savedEvidence: {
          originalArtifactHashes: "MATCH",
          cardano:
            "Positive saved seller receipt; original synthetic inspection",
          api3: "Five saved deployed source cases and historical REJECTED proof",
          optical:
            "Original signed diagnostic verifies at its historical capture time",
        },
        currentPhysicalAcceptance: "NOT_ESTABLISHED_BY_PREFLIGHT",
        remaining: Object.entries(manifest.mandatoryEvidence).flatMap(
          ([area, value]) =>
            (value.remaining ?? []).map((action) => ({ area, action })),
        ),
        scope:
          "Read-only local checks. No new chain verification, camera capture, BLE operation, payment, or installation authorization. Saved evidence does not prove current freshness or sponsor qualification.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "PREFLIGHT_FAILED",
        error: error.message,
        scope:
          "No repair, retry, hardware operation, or payment was attempted.",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
