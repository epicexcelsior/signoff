import { randomInt } from "node:crypto";
import { AppError } from "./store.js";
import { CommissioningStore } from "./commissioning-store.js";
import { artifactDigest, canonicalJson, isDigest } from "./artifacts.js";
import { createChallenge } from "./observation.js";
import { EvidenceError, verifyEvidence } from "./evidence.js";
import {
  evaluateGeometry,
  normalizePolicy,
} from "../public/vision/geometry.js";
import { inspectVerifiedChecks } from "../integrations/masumi/src/inspector.js";

const SCHEMA = "proof-of-ready";
const nowSeconds = (milliseconds) => Math.floor(milliseconds / 1000);
const plain = (v) => v && typeof v === "object" && !Array.isArray(v);
const validId = (id) =>
  typeof id === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(id);
const invalid = (message) => {
  throw new AppError("INVALID_REQUEST", message, 400);
};
const exact = (body, keys) =>
  plain(body) && Object.keys(body).every((key) => keys.includes(key));
const boundedJson = (body, limit) => {
  try {
    return canonicalJson(body).length <= limit;
  } catch {
    return false;
  }
};
const check = (id, outcome, reason, evidenceRefs = []) => ({
  id,
  outcome,
  reason,
  evidenceRefs,
});
const defaultVision = () => ({
  referenceMarkerId: 0,
  deviceMarkerId: 10,
  referenceSizeMm: 60,
  target: { xMm: 100, yMm: 0, angleDeg: 0 },
  tolerance: { positionMm: 8, angleDeg: 8 },
});

// The legacy receipt signs a 16-character request ID. Derive it from this
// work order, session, and step so a saved receipt cannot migrate to another attempt.
export const contactRequestId = (workOrderDigest, sessionId, step) =>
  artifactDigest({
    domain: `${SCHEMA}/contact-request/v1`,
    workOrderDigest,
    sessionId,
    step,
  }).slice(2, 18);

/** All predicates are reconstructed from raw saved evidence, never client verdicts. */
export function evaluateCommissioning(workOrder, bundle) {
  const checks = [];
  const refs = [artifactDigest(bundle)];
  const binding =
    bundle.workOrderDigest === artifactDigest(workOrder) &&
    /^[0-9a-f]{16}$/.test(bundle.sessionId) &&
    bundle.sourceMode === workOrder.sourceMode &&
    bundle.startedAt >= workOrder.approvedAt &&
    bundle.startedAt < workOrder.expiresAt &&
    bundle.expiresAt - bundle.startedAt === 120000 &&
    bundle.closedAt >= bundle.startedAt &&
    bundle.closedAt <= bundle.expiresAt &&
    bundle.sequence.length === workOrder.function.transitions &&
    bundle.sequence.every(
      (state, index) =>
        typeof state === "boolean" &&
        (index === 0 || state !== bundle.sequence[index - 1]),
    );
  checks.push(
    check(
      "session",
      binding ? "PASS" : "FAIL",
      binding
        ? "Evidence binds the approved work order and capture window."
        : "The work order or capture window changed.",
      refs,
    ),
  );
  let verified = true;
  let invalidReceipt = false;
  let functionPass = true;
  if (bundle.device.length !== bundle.sequence.length) verified = false;
  const requestIds = new Set();
  const nonces = new Set();
  for (const [index, item] of bundle.device.entries()) {
    try {
      if (
        item.error ||
        !Number.isSafeInteger(item.verifiedAt) ||
        item.verifiedAt * 1000 < bundle.startedAt - 1000 ||
        item.verifiedAt * 1000 > bundle.closedAt ||
        item.challenge.request_id !==
          contactRequestId(bundle.workOrderDigest, bundle.sessionId, index) ||
        requestIds.has(item.challenge.request_id) ||
        nonces.has(item.challenge.nonce)
      )
        throw new Error("Invalid capture binding");
      requestIds.add(item.challenge.request_id);
      nonces.add(item.challenge.nonce);
      verifyEvidence({
        receipt: item.receipt,
        challenge: item.challenge,
        contact: workOrder.device.contact,
        publicKey: workOrder.device.publicKey,
        now: item.verifiedAt,
      });
      if (item.receipt.result.closed !== bundle.sequence[index])
        functionPass = false;
    } catch {
      verified = false;
      invalidReceipt = true;
    }
  }
  checks.push(
    check(
      "device",
      verified
        ? "PASS"
        : invalidReceipt || bundle.device.some((item) => item.error)
          ? "FAIL"
          : "REVIEW",
      verified
        ? "Every original challenge has a fresh pinned P-256 receipt."
        : "A complete valid signed sequence is required.",
      refs,
    ),
  );
  checks.push(
    check(
      "function",
      !verified ? "REVIEW" : functionPass ? "PASS" : "FAIL",
      !verified
        ? "Function requires the verified signed sequence."
        : functionPass
          ? "The contact followed every requested transition."
          : "The contact did not follow the requested sequence.",
      refs,
    ),
  );
  const deliveries = bundle.delivery;
  const deliveryPass =
    verified &&
    deliveries.length === bundle.device.length &&
    deliveries.every(
      (item, index) =>
        item.destination === workOrder.function.destination &&
        item.receiptDigest === artifactDigest(bundle.device[index].receipt) &&
        item.closed === bundle.device[index].receipt.result.closed &&
        item.receivedAt >= bundle.device[index].receivedAt &&
        item.receivedAt - bundle.device[index].receivedAt <=
          workOrder.function.deadlineMs,
    );
  checks.push(
    check(
      "delivery",
      deliveryPass ? "PASS" : "FAIL",
      deliveryPass
        ? "The local receiving application recorded each matching signed observation within the deadline."
        : "The receiving application lacks a timely matching observation.",
      refs,
    ),
  );
  let geometry = null;
  if (bundle.vision && plain(bundle.vision.frame)) {
    geometry = evaluateGeometry(bundle.vision.frame, workOrder.vision);
    if (
      !isDigest(bundle.vision.frameDigest) ||
      !Number.isSafeInteger(bundle.vision.frame.capturedAt) ||
      (bundle.sourceMode === "physical" &&
        bundle.vision.source === "fixture") ||
      bundle.vision.frame.capturedAt < bundle.startedAt ||
      bundle.vision.frame.capturedAt > bundle.closedAt ||
      !["fixture", "browser-camera"].includes(bundle.vision.source)
    )
      geometry = null;
  }
  checks.push(
    check(
      "vision",
      geometry?.state ?? "REVIEW",
      geometry
        ? geometry.predicates
            .filter((p) => p.state !== "PASS")
            .map((p) => p.reason)
            .join(" ") ||
            "The marker position and orientation meet the approved planar tolerances."
        : "Capture a bounded marker frame during this session.",
      bundle.vision ? [artifactDigest(bundle.vision)] : [],
    ),
  );
  checks.push(
    check(
      "optical",
      "REVIEW",
      "A signed optical execution and matching camera samples are not present.",
    ),
  );
  return checks;
}

export function inspectionArtifact(workOrder, bundle) {
  return {
    mode: bundle.sourceMode === "fixture" ? "simulation" : "physical",
    workOrderHash: artifactDigest(workOrder),
    evidenceBundleHash: artifactDigest(bundle),
    requiredChecks: [
      "session",
      "device",
      "function",
      "delivery",
      "vision",
      "optical",
    ],
    checks: evaluateCommissioning(workOrder, bundle),
    limitations: [
      "The coordinator supplies normalized verified checks to the inspector.",
      "Camera evidence trusts the browser, measured reference size, and common marker plane.",
      "The local receiving application shares the coordinator trust boundary.",
      "The device signature does not establish mounting or installed firmware provenance.",
      "The verifier trusts the coordinator's original challenge and capture-time records.",
      ...(bundle.sourceMode === "fixture"
        ? [
            "This rehearsal uses synthetic physical evidence and moves no funds.",
          ]
        : []),
    ],
  };
}

export function acceptanceFor(report, sourceMode) {
  const predicates = [
    check(
      "inspection",
      report.outcome,
      `Local inspection returned ${report.outcome}.`,
      [artifactDigest(report)],
    ),
    check(
      "physical-origin",
      sourceMode === "physical" ? "PASS" : "REVIEW",
      sourceMode === "physical"
        ? "The configured physical adapter supplied the reads."
        : "Fixture evidence cannot approve a physical installation.",
    ),
    check(
      "paid-inspection",
      "REVIEW",
      "No verified Masumi seller receipt binds this inspection.",
    ),
    check(
      "software-policy",
      "REVIEW",
      "No pinned deployed contract decision binds this work order and inspection.",
    ),
  ];
  return {
    schema: `${SCHEMA}/acceptance/v1`,
    decision: report.outcome === "FAIL" ? "REWORK" : "REVIEW",
    predicates,
    liveSettlement: false,
    contractVerified: false,
  };
}

export function verifyPacket(packet, expectedWorkOrderDigest) {
  if (
    !plain(packet) ||
    packet.schema !== `${SCHEMA}/packet/v1` ||
    packet.workOrder?.schema !== `${SCHEMA}/work-order/v1` ||
    packet.evidence?.schema !== `${SCHEMA}/evidence/v1` ||
    !plain(packet.report) ||
    !plain(packet.acceptance) ||
    !plain(packet.digests) ||
    !Array.isArray(packet.evidence.device) ||
    packet.evidence.device.length > 3 ||
    packet.evidence.device.some((item) => !plain(item)) ||
    !Array.isArray(packet.evidence.sequence) ||
    packet.evidence.sequence.length !== 3 ||
    !Array.isArray(packet.evidence.delivery) ||
    packet.evidence.delivery.length > 3 ||
    packet.evidence.delivery.some((item) => !plain(item)) ||
    !plain(packet.workOrder.device) ||
    !plain(packet.workOrder.function) ||
    !plain(packet.workOrder.vision) ||
    (packet.evidence.vision !== null &&
      (!plain(packet.evidence.vision) ||
        !plain(packet.evidence.vision.frame))) ||
    !["fixture", "physical"].includes(packet.evidence.sourceMode) ||
    ![
      packet.evidence.startedAt,
      packet.evidence.closedAt,
      packet.evidence.expiresAt,
      packet.workOrder.approvedAt,
      packet.workOrder.expiresAt,
    ].every(Number.isSafeInteger) ||
    (expectedWorkOrderDigest !== undefined &&
      !isDigest(expectedWorkOrderDigest))
  )
    invalid(
      "Use a supported evidence packet and an optional approved work-order digest.",
    );
  try {
    normalizePolicy(packet.workOrder.vision);
    canonicalJson(packet);
  } catch {
    invalid("The packet contains an unsupported policy or non-JSON artifact.");
  }
  const workOrderDigest = artifactDigest(packet.workOrder);
  if (expectedWorkOrderDigest && expectedWorkOrderDigest !== workOrderDigest)
    throw new AppError(
      "OWNER_PIN_MISMATCH",
      "The packet differs from the independently approved work order.",
      422,
    );
  const bundleDigest = artifactDigest(packet.evidence);
  const report = inspectVerifiedChecks(
    inspectionArtifact(packet.workOrder, packet.evidence),
  );
  const acceptance = acceptanceFor(report, packet.evidence.sourceMode);
  const digests = {
    workOrder: workOrderDigest,
    evidence: bundleDigest,
    report: artifactDigest(report),
    acceptance: artifactDigest(acceptance),
  };
  if (
    canonicalJson(packet.digests) !== canonicalJson(digests) ||
    canonicalJson(packet.report) !== canonicalJson(report) ||
    canonicalJson(packet.acceptance) !== canonicalJson(acceptance)
  )
    throw new AppError(
      "PACKET_MISMATCH",
      "The packet commitments or deterministic inspection changed.",
      422,
    );
  return {
    verified: true,
    ownerPinned: Boolean(expectedWorkOrderDigest),
    decision: acceptance.decision,
    report: report.outcome,
    digests,
    limitation:
      "Internal consistency does not establish independent owner approval, physical truth, live payment, or deployed contract state.",
  };
}

export class CommissioningService {
  constructor({ store, config, profile, observe, now = Date.now }) {
    Object.assign(this, { config, profile, observe, now });
    this.store = new CommissioningStore(store);
    this.inFlight = new Map();
  }

  createOrder(body) {
    if (
      !exact(body, ["idempotency_key", "asset"]) ||
      !validId(body.idempotency_key) ||
      typeof body.asset !== "string" ||
      body.asset.trim().length < 1 ||
      body.asset.length > 120 ||
      /[\u0000-\u001f]/.test(body.asset)
    )
      invalid("Enter an asset name and one request identifier.");
    const input = { asset: body.asset.trim() };
    return this.store.create("orders", body.idempotency_key, input, (id) => {
      const approvedAt = this.now();
      return {
        schema: `${SCHEMA}/work-order/v1`,
        id,
        asset: input.asset,
        approvedAt,
        expiresAt: approvedAt + 86400000,
        device: {
          contact: this.profile.contact,
          publicKey: this.profile.publicKey,
        },
        vision: defaultVision(),
        function: {
          transitions: 3,
          destination: "local-owner-monitor",
          deadlineMs: 5000,
        },
        requirements: {
          vision: true,
          optical: true,
          delivery: true,
          paidInspection: true,
          softwarePolicy: true,
        },
        software: { state: "unenrolled", manifestDigest: null },
        authority: "local-operator-session",
        sourceMode: this.config.mode === "simulation" ? "fixture" : "physical",
      };
    });
  }

  createSession(orderId, body) {
    if (
      !exact(body, ["idempotency_key", "scenario"]) ||
      !validId(body.idempotency_key)
    )
      invalid("Use one capture request identifier.");
    const scenario = body.scenario ?? "correct";
    if (
      !["correct", "misplaced", "stuck", "missing-delivery"].includes(
        scenario,
      ) ||
      (this.config.mode !== "simulation" && scenario !== "correct")
    )
      invalid("Use a supported rehearsal scenario.");
    const order = this.store.get("orders", orderId);
    if (this.now() > order.expiresAt)
      throw new AppError(
        "ORDER_EXPIRED",
        "Approve a new work order before capture.",
      );
    return this.store.create(
      "sessions",
      body.idempotency_key,
      { orderId, scenario },
      (id) => {
        const closed = Boolean(randomInt(2));
        const startedAt = this.now();
        return {
          schema: `${SCHEMA}/capture-session/v1`,
          id,
          workOrderId: orderId,
          workOrderDigest: artifactDigest(order),
          state: "CAPTURING",
          startedAt,
          expiresAt: startedAt + 120000,
          sourceMode: order.sourceMode,
          scenario,
          sequence: [closed, !closed, closed],
          device: [],
          delivery: [],
          vision: null,
          optical: null,
          pending: null,
          evidence: null,
          report: null,
          acceptance: null,
        };
      },
    );
  }

  active(session) {
    if (session.state !== "CAPTURING")
      throw new AppError(
        "SESSION_CLOSED",
        "This capture is immutable. Start an explicit new attempt.",
      );
    if (this.now() > session.expiresAt)
      throw new AppError(
        "SESSION_EXPIRED",
        "The capture window expired. Close it for review or start a new attempt.",
      );
  }

  async captureStep(id, body) {
    if (
      !exact(body, ["step"]) ||
      !Number.isInteger(body.step) ||
      body.step < 0 ||
      body.step > 2
    )
      invalid("Select contact step 0, 1, or 2.");
    const session = this.store.get("sessions", id);
    if (body.step < session.device.length) return session;
    const key = `${id}:${body.step}`;
    if (this.inFlight.has(key)) return this.inFlight.get(key);
    const claimed = this.store.change(id, (current) => {
      this.active(current);
      if (current.pending || current.device.length !== body.step)
        throw new AppError(
          "CAPTURE_PENDING",
          "The original read is pending or interrupted. It cannot run again.",
        );
      return {
        ...current,
        pending: {
          step: body.step,
          challenge: createChallenge(
            contactRequestId(current.workOrderDigest, current.id, body.step),
            nowSeconds(this.now()),
          ),
        },
      };
    });
    const promise = this.readStep(claimed).finally(() =>
      this.inFlight.delete(key),
    );
    this.inFlight.set(key, promise);
    return promise;
  }

  async readStep(session) {
    const order = this.store.get("orders", session.workOrderId);
    const { step, challenge } = session.pending;
    let item;
    try {
      const receipt = await this.observe({
        challenge,
        contact: order.device.contact,
        input: {
          closed:
            session.scenario === "stuck"
              ? session.sequence[0]
              : session.sequence[step],
        },
      });
      const receivedAt = this.now();
      const verifiedAt = nowSeconds(receivedAt);
      const verification = verifyEvidence({
        receipt,
        challenge,
        contact: order.device.contact,
        publicKey: order.device.publicKey,
        now: verifiedAt,
      });
      item = {
        challenge,
        receipt,
        receivedAt,
        verifiedAt,
        verification,
        error: null,
      };
    } catch (error) {
      item = {
        challenge,
        receipt: null,
        receivedAt: this.now(),
        verifiedAt: nowSeconds(this.now()),
        verification: null,
        error:
          error instanceof EvidenceError
            ? { code: error.code, message: error.message }
            : {
                code: "DEVICE_UNAVAILABLE",
                message:
                  "The configured device read failed. The original attempt remains recorded.",
              },
      };
    }
    return this.store.change(session.id, (current) => {
      if (
        !current.pending ||
        current.pending.challenge.request_id !== challenge.request_id ||
        current.state !== "CAPTURING"
      )
        throw new AppError(
          "CAPTURE_CONFLICT",
          "The capture state changed before the read finished.",
        );
      const delivery =
        item.receipt && session.scenario !== "missing-delivery"
          ? [
              {
                destination: order.function.destination,
                receiptDigest: artifactDigest(item.receipt),
                closed: item.receipt.result.closed,
                receivedAt: this.now(),
              },
            ]
          : [];
      return {
        ...current,
        pending: null,
        device: [...current.device, item],
        delivery: [...current.delivery, ...delivery],
      };
    });
  }

  captureVision(id, body) {
    if (
      !exact(body, ["frame", "frameDigest", "source", "camera"]) ||
      !isDigest(body.frameDigest) ||
      !["browser-camera", "fixture"].includes(body.source) ||
      (body.source === "fixture" && this.config.mode !== "simulation") ||
      !plain(body.frame) ||
      !Number.isSafeInteger(body.frame.capturedAt) ||
      !boundedJson(body, 24000)
    )
      invalid("Use one bounded camera measurement and its frame digest.");
    return this.store.change(id, (session) => {
      this.active(session);
      if (session.vision)
        throw new AppError(
          "VISION_BOUND",
          "This session already contains a camera capture. Start a new attempt to replace it.",
        );
      if (
        body.frame.capturedAt < session.startedAt ||
        body.frame.capturedAt > this.now() + 2000
      )
        invalid("Capture the camera frame inside this session window.");
      const order = this.store.get("orders", session.workOrderId);
      const measurement = evaluateGeometry(body.frame, order.vision);
      return {
        ...session,
        vision: {
          source: body.source,
          frame: body.frame,
          frameDigest: body.frameDigest,
          camera: body.camera ?? null,
          measurement,
        },
      };
    });
  }

  fixtureVision(id) {
    const session = this.store.get("sessions", id);
    if (session.sourceMode !== "fixture")
      throw new AppError(
        "FIXTURE_DISABLED",
        "Generated camera evidence is available only in rehearsal mode.",
        403,
      );
    if (session.vision) return session;
    const x = session.scenario === "misplaced" ? 430 : 100 + (100 * 100) / 60;
    const square = (left) => [
      { x: left, y: 150 },
      { x: left + 100, y: 150 },
      { x: left + 100, y: 250 },
      { x: left, y: 250 },
    ];
    const frame = {
      capturedAt: this.now(),
      resolution: { width: 640, height: 480 },
      calibrationId: "fixture-planar-60mm",
      markers: [
        { id: 0, corners: square(100) },
        { id: 10, corners: square(x) },
      ],
    };
    return this.captureVision(id, {
      source: "fixture",
      frame,
      frameDigest: artifactDigest({ generatedMarkerFrame: frame }),
      camera: { source: "generated-marker-corners" },
    });
  }

  inspect(id) {
    return this.store.change(id, (session) => {
      if (session.state === "INSPECTED") return session;
      if (session.pending)
        throw new AppError(
          "CAPTURE_PENDING",
          "The original read is pending or interrupted. Start a new attempt for another read.",
        );
      const workOrder = this.store.get("orders", session.workOrderId);
      const evidence = {
        schema: `${SCHEMA}/evidence/v1`,
        sessionId: session.id,
        workOrderDigest: session.workOrderDigest,
        sourceMode: session.sourceMode,
        startedAt: session.startedAt,
        closedAt: this.now(),
        expiresAt: session.expiresAt,
        sequence: session.sequence,
        device: session.device,
        delivery: session.delivery,
        vision: session.vision,
        optical: session.optical,
      };
      const report = inspectVerifiedChecks(
        inspectionArtifact(workOrder, evidence),
      );
      const acceptance = acceptanceFor(report, session.sourceMode);
      return { ...session, state: "INSPECTED", evidence, report, acceptance };
    });
  }

  packet(id) {
    const session = this.store.get("sessions", id);
    if (session.state !== "INSPECTED")
      throw new AppError(
        "NOT_INSPECTED",
        "Close the capture and inspect it before export.",
      );
    const workOrder = this.store.get("orders", session.workOrderId);
    return {
      schema: `${SCHEMA}/packet/v1`,
      workOrder,
      evidence: session.evidence,
      report: session.report,
      acceptance: session.acceptance,
      digests: {
        workOrder: artifactDigest(workOrder),
        evidence: artifactDigest(session.evidence),
        report: artifactDigest(session.report),
        acceptance: artifactDigest(session.acceptance),
      },
    };
  }
}
