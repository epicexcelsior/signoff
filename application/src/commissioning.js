import { randomInt, randomBytes } from "node:crypto";
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
import {
  makeInspectionRequest,
  inspectionJobId,
  contractExpectations,
  externalAcceptance,
} from "./inspection-binding.js";
import { createOpticalChallenge, verifyOpticalExecution } from "./optical.js";
import {
  opticalCheck,
  phoneCheck,
  phoneRequestId,
} from "./capture-evaluation.js";
import {
  verifyPhoneEvidence,
  PhoneEvidenceError,
} from "../mobile/src/phone-evidence.mjs";

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
const configSoftware = (config) =>
  config.externalConfig?.software ?? {
    state: "unenrolled",
    manifestDigest: null,
  };
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
  checks.push(opticalCheck(workOrder, bundle));
  if (workOrder.requirements?.phone) checks.push(phoneCheck(workOrder, bundle));
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
      ...(workOrder.requirements?.phone ? ["phone"] : []),
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

export function acceptanceFor(report, sourceMode, external = null) {
  return externalAcceptance(report, sourceMode, external);
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
  const acceptance = acceptanceFor(
    report,
    packet.evidence.sourceMode,
    packet.external ?? null,
  );
  const digests = {
    workOrder: workOrderDigest,
    evidence: bundleDigest,
    report: artifactDigest(report),
    acceptance: artifactDigest(acceptance),
    ...(packet.external ? { external: artifactDigest(packet.external) } : {}),
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
    decision: acceptance.decision === "READY" ? "REVIEW" : acceptance.decision,
    recordedDecision: acceptance.decision,
    externalRevalidated: false,
    report: report.outcome,
    digests,
    limitation:
      "Internal consistency does not establish independent owner approval, physical truth, live payment, or deployed contract state.",
  };
}

export class CommissioningService {
  constructor({
    store,
    config,
    profile,
    observe,
    external = null,
    emitOptical = null,
    now = Date.now,
  }) {
    Object.assign(this, {
      config,
      profile,
      observe,
      external,
      emitOptical,
      now,
    });
    this.store = new CommissioningStore(store);
    this.inFlight = new Map();
    this.freshAcceptance = new Map();
  }

  view(session) {
    const checked = this.freshAcceptance.get(session.id);
    if (
      session.acceptance?.decision !== "READY" ||
      (checked?.refreshId === session.external?.refreshId &&
        this.now() >= checked.at &&
        this.now() - checked.at <= 30000)
    )
      return session;
    const acceptance = acceptanceFor(session.report, session.sourceMode);
    return {
      ...session,
      recordedDecision: session.acceptance.decision,
      acceptance,
      externalRevalidationRequired: true,
    };
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
        optical: {
          roi: { x: 1.1, y: 0.25, width: 0.35, height: 0.35 },
          halfSymbolMs: 250,
        },
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
          ...(this.config.phonePublicKey ? { phone: true } : {}),
        },
        software: configSoftware(this.config),
        phone: {
          provider: "seeker-inspector",
          publicKey: this.config.phonePublicKey ?? null,
        },
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
          phone: null,
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
    if (
      this.store.get("orders", session.workOrderId).device.contact.sensor ===
      "disabled-contact"
    )
      throw new AppError(
        "CONTACT_DISABLED",
        "This enrolled board disables contact input. Contact testing requires reviewed hardware and a new enrolled profile.",
        403,
      );
    const key = `${id}:${body.step}`;
    if (this.inFlight.has(key)) return this.inFlight.get(key);
    const claimed = this.store.change(id, (current) => {
      this.active(current);
      if (
        current.pending ||
        current.optical?.stage === "EXECUTING" ||
        current.device.length !== body.step
      )
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

  prepareOptical(id) {
    return this.store.change(id, (session) => {
      this.active(session);
      if (session.optical) return session;
      if (this.now() + 45000 > session.expiresAt)
        throw new AppError(
          "SESSION_EXPIRED",
          "Start a new attempt with time for the complete optical capture.",
        );
      return {
        ...session,
        optical: {
          challenge: createOpticalChallenge(session, nowSeconds(this.now())),
          stage: "PREPARED",
          receipt: null,
          capture: null,
          error: null,
        },
      };
    }).optical.challenge;
  }

  async executeOptical(id) {
    const key = `${id}:optical`;
    if (this.inFlight.has(key)) return this.inFlight.get(key);
    if (this.config.mode !== "simulation" && !this.config.opticalAuthorized)
      throw new AppError(
        "OPTICAL_DISABLED",
        "Physical emission requires explicit authorization and a configured board driver.",
        403,
      );
    if (!this.emitOptical)
      throw new AppError(
        "OPTICAL_UNAVAILABLE",
        "Configure the signed optical adapter before execution.",
        503,
      );
    const original = this.store.change(id, (session) => {
      this.active(session);
      if (session.optical?.receipt) return session;
      if (session.optical?.stage !== "PREPARED" || session.pending)
        throw new AppError(
          "OPTICAL_PENDING",
          "The original emission is pending, interrupted, or unprepared. Start a new attempt for another execution.",
        );
      if (nowSeconds(this.now()) + 19 > session.optical.challenge.expires_at)
        throw new AppError(
          "OPTICAL_EXPIRED",
          "The original optical challenge expired. Start a new attempt.",
        );
      return {
        ...session,
        optical: { ...session.optical, stage: "EXECUTING" },
      };
    });
    if (original.optical.receipt) return original;
    const promise = (async () => {
      const workOrder = this.store.get("orders", original.workOrderId);
      let changes;
      try {
        const receipt = await this.emitOptical({
          challenge: original.optical.challenge,
          contact: workOrder.device.contact,
        });
        const verifiedAt = nowSeconds(this.now());
        verifyOpticalExecution({
          receipt,
          challenge: original.optical.challenge,
          provider: workOrder.device.contact.provider,
          publicKey: workOrder.device.publicKey,
          verifiedAt,
        });
        changes = { stage: "EXECUTED", receipt, verifiedAt };
      } catch (error) {
        changes = {
          stage: "FAILED",
          error: {
            code:
              error instanceof EvidenceError
                ? error.code
                : "OPTICAL_EXECUTION_FAILED",
            message:
              "The original emission did not produce a valid signed execution. No automatic repeat occurs.",
          },
        };
      }
      return this.store.change(id, (current) => {
        if (
          current.optical?.stage !== "EXECUTING" ||
          current.state !== "CAPTURING"
        )
          throw new AppError(
            "CAPTURE_CONFLICT",
            "The optical capture changed during execution.",
          );
        return { ...current, optical: { ...current.optical, ...changes } };
      });
    })().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  captureOptical(id, body) {
    if (
      !exact(body, ["capture"]) ||
      !plain(body.capture) ||
      !boundedJson(body, 1000000)
    )
      invalid("Use one bounded optical camera capture.");
    return this.store.change(id, (session) => {
      this.active(session);
      if (session.optical?.stage !== "EXECUTED" || session.optical.capture)
        throw new AppError(
          "OPTICAL_BOUND",
          "Save one camera capture after the original signed optical execution.",
        );
      const optical = {
        ...session.optical,
        capture: body.capture,
        capturedAt: this.now(),
      };
      const order = this.store.get("orders", session.workOrderId);
      const evaluation = opticalCheck(order, {
        ...session,
        optical,
        sessionId: session.id,
        closedAt: this.now(),
      });
      return { ...session, optical: { ...optical, evaluation } };
    });
  }

  preparePhone(id) {
    return this.store.change(id, (session) => {
      this.active(session);
      const order = this.store.get("orders", session.workOrderId);
      if (!order.phone?.publicKey)
        throw new AppError(
          "PHONE_UNENROLLED",
          "Enroll the Seeker public key before approving the work order.",
          403,
        );
      if (session.phone) return session;
      const requested_at = nowSeconds(this.now());
      const challenge = {
        schema: "proof-of-ready/phone-challenge/v1",
        work_order_digest: session.workOrderDigest,
        session_id: session.id,
        request_id: phoneRequestId(session.workOrderDigest, session.id),
        provider: "seeker-inspector",
        nonce: randomInt(1, 0x7fffffff),
        requested_at,
        expires_at: Math.min(requested_at + 60, nowSeconds(session.expiresAt)),
      };
      if (challenge.expires_at <= requested_at)
        throw new AppError(
          "SESSION_EXPIRED",
          "Start a fresh phone capture attempt.",
        );
      return { ...session, phone: { challenge, envelope: null } };
    }).phone.challenge;
  }

  capturePhone(id, body) {
    if (!plain(body) || !boundedJson(body, 12000))
      invalid("Use the enrolled phone's bounded signed photo envelope.");
    return this.store.change(id, (session) => {
      if (!session.phone?.challenge)
        throw new AppError(
          "PHONE_UNPREPARED",
          "Prepare the original phone challenge first.",
        );
      if (session.phone.envelope) {
        if (canonicalJson(body) !== canonicalJson(session.phone.envelope))
          throw new AppError(
            "PHONE_BOUND",
            "The original signed photo claim cannot change. Start a new attempt.",
          );
        return session;
      }
      this.active(session);
      const order = this.store.get("orders", session.workOrderId);
      const verifiedAt = nowSeconds(this.now());
      let verification;
      try {
        verification = verifyPhoneEvidence({
          envelope: body,
          challenge: session.phone.challenge,
          publicKey: order.phone.publicKey,
          now: verifiedAt,
        });
      } catch (error) {
        if (error instanceof PhoneEvidenceError)
          throw new AppError(error.code, error.message, 422);
        throw error;
      }
      return {
        ...session,
        phone: { ...session.phone, envelope: body, verifiedAt, verification },
      };
    });
  }

  inspect(id) {
    return this.store.change(id, (session) => {
      if (session.state === "INSPECTED") return session;
      if (session.pending || session.optical?.stage === "EXECUTING")
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
        ...(session.phone ? { phone: session.phone } : {}),
      };
      const report = inspectVerifiedChecks(
        inspectionArtifact(workOrder, evidence),
      );
      const acceptance = acceptanceFor(report, session.sourceMode);
      return { ...session, state: "INSPECTED", evidence, report, acceptance };
    });
  }

  prepareInspection(id) {
    return this.store.change(id, (session) => {
      if (session.state !== "INSPECTED")
        throw new AppError(
          "NOT_INSPECTED",
          "Seal the physical evidence before preparing specialist inspection.",
        );
      const order = this.store.get("orders", session.workOrderId);
      const request = makeInspectionRequest(
        session,
        inspectionArtifact(order, session.evidence),
      );
      if (
        session.inspectionRequest &&
        canonicalJson(session.inspectionRequest) !== canonicalJson(request)
      )
        throw new AppError(
          "INSPECTION_BINDING_MISMATCH",
          "The original prepared inspection no longer matches the sealed evidence.",
          422,
        );
      return { ...session, inspectionRequest: request };
    }).inspectionRequest;
  }

  async reconcileAcceptance(id) {
    const key = `${id}:acceptance`;
    if (this.inFlight.has(key)) return this.inFlight.get(key);
    const request = this.prepareInspection(id);
    const refreshId = randomBytes(16).toString("hex");
    const original = this.store.change(id, (current) => ({
      ...current,
      acceptanceRefresh: refreshId,
    }));
    const order = this.store.get("orders", original.workOrderId);
    const promise = (async () => {
      let paid = {
        outcome: "REVIEW",
        reason:
          "No configured inspector reader supplies the original delivered result and seller receipt.",
        evidence: null,
      };
      if (this.external?.readInspection) {
        try {
          paid = (await this.external.readInspection(
            request,
            original.report,
          )) ?? {
            ...paid,
            reason:
              "The prepared inspection is not present in the configured inspector ledger.",
          };
        } catch (error) {
          paid = {
            ...paid,
            code: error.code ?? "INSPECTOR_UNAVAILABLE",
            reason: `Inspection reconciliation failed (${error.code ?? "INSPECTOR_UNAVAILABLE"}). Inspect the original task and configured services.`,
          };
        }
      }
      let contract = {
        verdict: "REVIEW",
        reason:
          "A pinned contract, enrolled build, original source response, and verified paid result are required.",
      };
      try {
        const source = this.external?.sourceDigest
          ? await this.external.sourceDigest()
          : null;
        const expected = contractExpectations(order, original, paid, source);
        if (this.external?.readContract && expected) {
          const read = await this.external.readContract({
            jobId: inspectionJobId(original),
            expected,
          });
          contract = {
            verdict: read.verdict,
            reason: read.reason,
            ...(read.chainId
              ? {
                  chainId: read.chainId,
                  contract: read.contract,
                  jobId: read.jobId,
                  acceptanceHash: read.acceptanceHash,
                }
              : {}),
          };
          if (!["PASS", "FAIL", "REVIEW"].includes(contract.verdict))
            throw new Error("Invalid contract decision");
        }
      } catch {
        contract = {
          verdict: "REVIEW",
          reason:
            "The pinned contract or original source response is unavailable. No cached acceptance authorizes this installation.",
        };
      }
      const external = {
        schema: "proof-of-ready/external-evidence/v1",
        refreshId,
        checkedAt: this.now(),
        paid,
        contract,
      };
      const updated = this.store.change(id, (current) => {
        if (current.acceptanceRefresh !== refreshId)
          throw new AppError(
            "ACCEPTANCE_CONFLICT",
            "Another reconciliation superseded this read. Read the latest acceptance state.",
          );
        if (artifactDigest(current.report) !== artifactDigest(original.report))
          throw new AppError(
            "INSPECTION_BINDING_MISMATCH",
            "The sealed inspection changed during reconciliation.",
            422,
          );
        return {
          ...current,
          external,
          acceptance: acceptanceFor(
            current.report,
            current.sourceMode,
            external,
          ),
        };
      });
      this.freshAcceptance.set(id, { refreshId, at: external.checkedAt });
      return updated;
    })().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  async prepareContract(id) {
    if (!this.external?.prepareContract)
      throw new AppError(
        "CONTRACT_UNCONFIGURED",
        "Configure the pinned contract reader before preparing unsigned calls.",
        422,
      );
    const session = await this.reconcileAcceptance(id);
    const order = this.store.get("orders", session.workOrderId);
    return this.external.prepareContract({
      jobId: inspectionJobId(session),
      order,
      session,
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
      ...(session.external ? { external: session.external } : {}),
      digests: {
        workOrder: artifactDigest(workOrder),
        evidence: artifactDigest(session.evidence),
        report: artifactDigest(session.report),
        acceptance: artifactDigest(session.acceptance),
        ...(session.external
          ? { external: artifactDigest(session.external) }
          : {}),
      },
    };
  }
}
