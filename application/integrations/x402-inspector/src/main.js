import express from "express";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve, isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import { Store, AppError } from "../../../src/store.js";
import { makePayment, NETWORK, AMOUNT } from "../../../src/payment.js";
import {
  decodePaymentSignatureHeader,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import { PaidInspector } from "./service.js";
import { privateStateDirectory } from "../../masumi/src/setup.js";

process.umask(0o077);
const stateDirectory = privateStateDirectory(
  process.env.X402_INSPECTOR_STATE_DIR,
);
const bridgePath = process.env.INSPECTION_BRIDGE_MODULE;
if (!isAbsolute(bridgePath ?? ""))
  throw new Error("Configure an absolute immutable inspection bridge.");
if (!/^addr_test1[a-z0-9]+$/.test(process.env.SELLER_ADDRESS ?? ""))
  throw new Error("Configure the dedicated Preprod seller address.");
if (!process.env.BLOCKFROST_API_KEY_PREPROD?.startsWith("preprod"))
  throw new Error("Configure the Preprod chain reader.");
const port = Number(process.env.X402_INSPECTOR_PORT ?? 4024);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Use an unprivileged local port.");
const origin = `http://127.0.0.1:${port}`;
mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
const store = new Store(join(stateDirectory, "inspections.sqlite"));
const { loadArtifact } = await import(pathToFileURL(resolve(bridgePath)).href);
const writesAuthorized = process.env.X402_INSPECTOR_SPEND_AUTHORIZED === "true";
const payment = makePayment({
  mode: "preprod",
  facilitatorUrl: "https://x402.preprod.dev.ecosyseng.cf-deployments.org",
  projectId: process.env.BLOCKFROST_API_KEY_PREPROD,
});
const service = new PaidInspector({
  store,
  payment,
  sellerAddress: process.env.SELLER_ADDRESS,
  writesAuthorized,
  loadArtifact,
});
const token = randomBytes(32).toString("hex");
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb", strict: true }));
app.use((req, res, next) => {
  res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  if (
    req.headers.host !== `127.0.0.1:${port}` ||
    (req.headers.origin && req.headers.origin !== origin)
  )
    return res
      .status(403)
      .json({ code: "LOCAL_ONLY", error: "Use the local inspection service." });
  if (req.method !== "GET" && req.headers["x-inspector-token"] !== token)
    return res.status(403).json({
      code: "TOKEN_REQUIRED",
      error: "Use the current local inspection token.",
    });
  next();
});
const route = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res)).catch(next);
app.get("/api/config", (_req, res) =>
  res.json({
    service: "proof-of-ready/x402-inspector/v1",
    mode: "preprod",
    network: NETWORK,
    amount: AMOUNT,
    asset: "lovelace",
    spendAuthorized: writesAuthorized,
    token,
  }),
);
app.post(
  "/api/inspections",
  route(async (req, res) =>
    res.status(201).json(service.view(await service.create(req.body))),
  ),
);
app.get(
  "/api/inspections/:id",
  route(async (req, res) => res.json(service.view(store.get(req.params.id)))),
);
app.get(
  "/api/inspections/:id/events",
  route(async (req, res) => res.json(store.events(req.params.id))),
);
app.post(
  "/api/inspections/:id/payment",
  route(async (req, res) => {
    const job = store.get(req.params.id);
    if (!req.headers["payment-signature"]) {
      const required = {
        x402Version: 2,
        resource: {
          url: `${origin}/api/inspections/${job.id}/payment`,
          description:
            "One useful evidence inspection. Missing physical evidence returns REVIEW.",
          mimeType: "application/json",
        },
        accepts: [job.requirements],
      };
      res.set("PAYMENT-REQUIRED", encodePaymentRequiredHeader(required));
      return res.status(402).json(required);
    }
    let payload;
    try {
      payload = decodePaymentSignatureHeader(req.headers["payment-signature"]);
    } catch {
      throw new AppError(
        "INVALID_PAYMENT",
        "Use a valid x402 payment header.",
        400,
      );
    }
    let current = await service.pay(job.id, payload);
    if (current.payment?.receipt)
      res.set(
        "PAYMENT-RESPONSE",
        encodePaymentResponseHeader(current.payment.receipt),
      );
    if (current.state === "PAID") current = await service.inspect(job.id);
    res
      .status(current.state === "COMPLETE" ? 200 : 202)
      .json(service.view(current));
  }),
);
app.post(
  "/api/inspections/:id/reconcile",
  route(async (req, res) =>
    res.json(service.view(await service.reconcile(req.params.id))),
  ),
);
app.post(
  "/api/inspections/:id/inspect",
  route(async (req, res) =>
    res.json(service.view(await service.inspect(req.params.id))),
  ),
);
app.use((error, _req, res, _next) =>
  res.status(error instanceof AppError ? error.status : 503).json({
    code: error instanceof AppError ? error.code : "INSPECTION_UNAVAILABLE",
    error:
      error instanceof AppError
        ? error.message
        : "The inspection service cannot finish. Preserve the original payment and inspect private configuration.",
  }),
);
const server = app.listen(port, "127.0.0.1", () =>
  console.log(
    `signoff paid inspector: ${origin}; spending ${writesAuthorized ? "authorized" : "disabled"}.`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
