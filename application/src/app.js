import express from "express";
import { readFileSync } from "node:fs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { paymentRequired } from "./payment.js";
import { EvidenceError } from "./evidence.js";
import { AppError } from "./store.js";
import { verifyPacket } from "./commissioning.js";
import {
  submissionEvidence,
  submissionArtifact,
} from "./submission-evidence.js";
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";

export function createApp(service) {
  const app = express();
  const token = randomBytes(32).toString("hex");
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    if (!/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(req.headers.host ?? "")) {
      return next(
        new AppError("INVALID_HOST", "Use the local FieldProof address.", 403),
      );
    }
    if (
      req.headers.origin &&
      req.headers.origin !== `http://${req.headers.host}`
    ) {
      return next(
        new AppError(
          "INVALID_ORIGIN",
          "Open FieldProof directly to run a check.",
          403,
        ),
      );
    }
    if (!["GET", "HEAD", "POST"].includes(req.method)) {
      return next(
        new AppError("INVALID_METHOD", "Use a supported request method.", 405),
      );
    }
    if (req.method === "POST") {
      const supplied = req.headers["x-fieldproof-token"];
      if (
        typeof supplied !== "string" ||
        !/^[0-9a-f]{64}$/.test(supplied) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
      ) {
        return next(
          new AppError(
            "UNAUTHORIZED",
            "Reload FieldProof to obtain a local session.",
            403,
          ),
        );
      }
      if (!req.is("application/json"))
        return next(
          new AppError("INVALID_CONTENT_TYPE", "Send a JSON request.", 415),
        );
    }
    next();
  });
  const smallJson = express.json({ limit: "48kb", strict: true });
  const captureJson = express.json({ limit: "1mb", strict: true });
  app.use((req, res, next) =>
    (/^\/api\/commissioning\/sessions\/[0-9a-f]{16}\/optical$/.test(req.path) ||
      req.path === "/api/commissioning/verify"
      ? captureJson
      : smallJson)(req, res, next),
  );
  const route = (run) => (req, res, next) =>
    Promise.resolve()
      .then(() => run(req, res))
      .catch(next);
  const view = (job) => service.view(job);
  app.get(
    "/api/submission-evidence",
    route((_req, res) => res.json(submissionEvidence())),
  );
  app.get(
    "/api/submission-evidence/artifacts/:id",
    route((req, res) => {
      const bytes = submissionArtifact(req.params.id);
      if (!bytes)
        throw new AppError(
          "NOT_FOUND",
          "This evidence artifact does not exist.",
          404,
        );
      res.type("application/json").send(bytes);
    }),
  );
  app.get("/api/config", (_req, res) =>
    res.json({
      token,
      mode: service.config.mode,
      contact: service.profile.contact,
      contact_enabled: service.profile.contact.sensor !== "disabled-contact",
      price: "2 tADA",
      spend_authorized: service.config.spendAuthorized,
      optical_authorized: service.config.opticalAuthorized === true,
      phone_enrolled: Boolean(service.config.phonePublicKey),
    }),
  );
  app.get("/api/jobs", (_req, res) => res.json(service.store.list().map(view)));
  app.post(
    "/api/jobs",
    route((req, res) => res.status(201).json(view(service.create(req.body)))),
  );
  app.get(
    "/api/jobs/:id",
    route((req, res) => res.json(view(service.store.get(req.params.id)))),
  );
  app.get(
    "/api/jobs/:id/payment",
    route((req, res) => {
      const job = service.store.get(req.params.id);
      if (job.mode === "simulation")
        throw new AppError(
          "SIMULATION_ONLY",
          "This check uses simulated payment.",
          400,
        );
      const required = paymentRequired(job, `http://${req.headers.host}`);
      res.set("PAYMENT-REQUIRED", encodePaymentRequiredHeader(required));
      res.status(402).json(required);
    }),
  );
  app.post(
    "/api/jobs/:id/payment",
    route(async (req, res) => {
      const original = service.store.get(req.params.id);
      let payload = req.body;
      if (original.mode !== "simulation") {
        if (!req.headers["payment-signature"]) {
          const required = paymentRequired(
            original,
            `http://${req.headers.host}`,
          );
          res.set("PAYMENT-REQUIRED", encodePaymentRequiredHeader(required));
          return res.status(402).json(required);
        }
        try {
          payload = decodePaymentSignatureHeader(
            req.headers["payment-signature"],
          );
        } catch {
          throw new AppError(
            "INVALID_PAYMENT",
            "Send a valid PAYMENT-SIGNATURE header.",
            400,
          );
        }
      }
      const job = await service.pay(req.params.id, payload);
      if (job.payment?.receipt)
        res.set(
          "PAYMENT-RESPONSE",
          encodePaymentResponseHeader(job.payment.receipt),
        );
      res.status(job.state === "PAID" ? 200 : 202).json(view(job));
    }),
  );
  app.post(
    "/api/jobs/:id/reconcile",
    route(async (req, res) =>
      res.json(view(await service.reconcile(req.params.id))),
    ),
  );
  app.post(
    "/api/jobs/:id/observe",
    route(async (req, res) =>
      res.json(view(await service.capture(req.params.id))),
    ),
  );
  app.post(
    "/api/jobs/:id/verify",
    route((req, res) => res.json(service.verify(req.params.id, req.body))),
  );
  const commissioning = service.commissioning;
  app.get("/api/commissioning", (_req, res) => {
    const sessions = commissioning.store.list("sessions");
    const orders = new Map(
      commissioning.store.list("orders").map((order) => [order.id, order]),
    );
    // A session retains its approved order even after newer empty orders fill the list.
    for (const session of sessions)
      if (!orders.has(session.workOrderId))
        orders.set(
          session.workOrderId,
          commissioning.store.get("orders", session.workOrderId),
        );
    res.json({
      workOrders: [...orders.values()],
      sessions: sessions.map((session) => commissioning.view(session)),
    });
  });
  app.post(
    "/api/commissioning/work-orders",
    route((req, res) =>
      res.status(201).json(commissioning.createOrder(req.body)),
    ),
  );
  app.post(
    "/api/commissioning/work-orders/:id/sessions",
    route((req, res) =>
      res
        .status(201)
        .json(commissioning.createSession(req.params.id, req.body)),
    ),
  );
  app.get(
    "/api/commissioning/sessions/:id",
    route((req, res) =>
      res.json(
        commissioning.view(commissioning.store.get("sessions", req.params.id)),
      ),
    ),
  );
  app.post(
    "/api/commissioning/sessions/:id/optical-challenge",
    route((req, res) => res.json(commissioning.prepareOptical(req.params.id))),
  );
  app.post(
    "/api/commissioning/sessions/:id/optical-execution",
    route(async (req, res) =>
      res.json(await commissioning.executeOptical(req.params.id)),
    ),
  );
  app.post(
    "/api/commissioning/sessions/:id/optical",
    route((req, res) =>
      res.json(commissioning.captureOptical(req.params.id, req.body)),
    ),
  );
  app.post(
    "/api/commissioning/sessions/:id/phone-challenge",
    route((req, res) => res.json(commissioning.preparePhone(req.params.id))),
  );
  app.post(
    "/api/commissioning/sessions/:id/phone-evidence",
    route((req, res) =>
      res.json(commissioning.capturePhone(req.params.id, req.body)),
    ),
  );
  app.post(
    "/api/commissioning/sessions/:id/contact",
    route(async (req, res) =>
      res.json(await commissioning.captureStep(req.params.id, req.body)),
    ),
  );
  app.post(
    "/api/commissioning/sessions/:id/vision",
    route((req, res) =>
      res.json(commissioning.captureVision(req.params.id, req.body)),
    ),
  );
  app.post(
    "/api/commissioning/sessions/:id/fixture-vision",
    route((req, res) => res.json(commissioning.fixtureVision(req.params.id))),
  );
  app.post(
    "/api/commissioning/sessions/:id/inspect",
    route((req, res) => res.json(commissioning.inspect(req.params.id))),
  );
  app.get(
    "/api/commissioning/sessions/:id/packet",
    route((req, res) => {
      res.set(
        "Content-Disposition",
        `attachment; filename="proof-of-ready-${req.params.id.replace(/[^a-zA-Z0-9_-]/g, "")}.json"`,
      );
      res.json(commissioning.packet(req.params.id));
    }),
  );
  app.post(
    "/api/commissioning/sessions/:id/inspection-request",
    route((req, res) =>
      res.json(commissioning.prepareInspection(req.params.id)),
    ),
  );
  app.post(
    "/api/commissioning/sessions/:id/reconcile-acceptance",
    route(async (req, res) =>
      res.json(await commissioning.reconcileAcceptance(req.params.id)),
    ),
  );
  app.post(
    "/api/commissioning/sessions/:id/contract-plan",
    route(async (req, res) =>
      res.json(await commissioning.prepareContract(req.params.id)),
    ),
  );
  app.post(
    "/api/commissioning/verify",
    route((req, res) =>
      res.json(verifyPacket(req.body.packet, req.body.expectedWorkOrderDigest)),
    ),
  );
  app.use("/vision/detector-worker.js", (_req, res, next) => {
    res.set(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'",
    );
    next();
  });
  app.get("/overview.html", (_req, res, next) => {
    try {
      const html = readFileSync(
        new URL("../public/overview.html", import.meta.url),
        "utf8",
      );
      const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
      if (!style) throw new Error("Regenerate the standalone overview.");
      const hash = createHash("sha256").update(style).digest("base64");
      res.set(
        "Content-Security-Policy",
        res
          .get("Content-Security-Policy")
          .replace("style-src 'self'", `style-src 'self' 'sha256-${hash}'`),
      );
      res.type("html").send(html);
    } catch (error) {
      if (error.code === "ENOENT") return next();
      next(error);
    }
  });
  const projectDocuments = {
    "README.md": "README.md",
    "ENGINEERING.md": "docs/ENGINEERING.md",
    "EVIDENCE.md": "research/EVIDENCE.md",
    "PLAN.md": "PROOF_OF_READY_IMPLEMENTATION_PLAN.md",
    "DIRECTIVE.md": "PROOF_OF_READY_AGENT_HANDOFF.md",
    "FIRMWARE.md": "application/firmware/README.md",
    "MOBILE.md": "application/mobile/README.md",
  };
  app.get("/project-docs/:name", (req, res, next) => {
    const path = Object.hasOwn(projectDocuments, req.params.name)
      ? projectDocuments[req.params.name]
      : null;
    if (!path)
      return next(
        new AppError("NOT_FOUND", "This project document does not exist.", 404),
      );
    res
      .type("text/plain")
      .sendFile(fileURLToPath(new URL(`../../${path}`, import.meta.url)));
  });
  app.use(
    express.static(fileURLToPath(new URL("../public", import.meta.url)), {
      etag: false,
      maxAge: 0,
    }),
  );
  app.use((_req, _res, next) =>
    next(new AppError("NOT_FOUND", "This page does not exist.", 404)),
  );
  app.use((error, _req, res, _next) => {
    if (error instanceof EvidenceError)
      return res
        .status(422)
        .json({ code: error.code, error: error.message, decision: "WAIT" });
    if (error instanceof AppError)
      return res
        .status(error.status)
        .json({ code: error.code, error: error.message });
    if (
      error.type === "entity.parse.failed" ||
      error.type === "entity.too.large"
    ) {
      return res.status(error.status).json({
        code: "INVALID_BODY",
        error: "Send valid JSON within this route's body limit.",
      });
    }
    // Do not send upstream bodies, paths, authorization secrets, or stack traces to the browser.
    console.error("FieldProof request failed:", error.code ?? error.name);
    res.status(500).json({
      code: "INTERNAL_ERROR",
      error: "The local check failed. Read its stored state before retrying.",
    });
  });
  return app;
}
