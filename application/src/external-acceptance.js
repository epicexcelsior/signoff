import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { isAbsolute } from "node:path";
import { AppError } from "./store.js";
import { artifactDigest, canonicalJson, isDigest } from "./artifacts.js";
import { bindInspectionResult } from "./inspection-binding.js";

const invalid = () => {
  throw new AppError(
    "INVALID_EXTERNAL_CONFIG",
    "Use pinned private Masumi, build, and contract configuration.",
    400,
  );
};
const loadJson = (path) => {
  if (typeof path !== "string" || !isAbsolute(path)) invalid();
  const buffer = readFileSync(path);
  if (buffer.length > 128000) invalid();
  return JSON.parse(buffer.toString("utf8"));
};
const token = (path) => {
  if (typeof path !== "string" || !isAbsolute(path)) invalid();
  const value = readFileSync(path, "utf8").trim();
  if (!value || value.length > 8192) invalid();
  return value;
};

export function loadExternalConfig(path) {
  if (!path) return null;
  const config = loadJson(path);
  if (config.schema !== "proof-of-ready/external-config/v1") invalid();
  if (config.contract) {
    const c = config.contract;
    const rpc = new URL(c.rpcUrl);
    if (
      !Number.isSafeInteger(c.chainId) ||
      c.chainId < 1 ||
      !/^0x[0-9a-fA-F]{40}$/.test(c.address ?? "") ||
      !isDigest(c.runtimeCodeHash) ||
      rpc.username ||
      rpc.password ||
      rpc.search ||
      rpc.hash ||
      !(
        rpc.protocol === "https:" ||
        (rpc.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(rpc.hostname))
      )
    )
      invalid();
  }
  if (
    config.masumi &&
    (!isAbsolute(config.masumi.ledgerFile ?? "") ||
      !isDigest(config.masumi.configurationDigest))
  )
    invalid();
  if (config.build) {
    const manifest = loadJson(config.build.manifestFile);
    if (
      manifest.schema !== "proof-of-ready/build-manifest/v1" ||
      manifest.component !== "apache-nimble" ||
      !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(manifest.version ?? "") ||
      !/^[a-f0-9]{64}$/.test(manifest.binarySha256 ?? "") ||
      manifest.provenance !== "operator-enrolled" ||
      !isAbsolute(config.build.binaryFile ?? "") ||
      canonicalJson(manifest).length > 16000
    )
      invalid();
    const actual = createHash("sha256")
      .update(readFileSync(config.build.binaryFile))
      .digest("hex");
    if (actual !== manifest.binarySha256)
      throw new AppError(
        "BUILD_ARTIFACT_MISMATCH",
        "The enrolled build manifest differs from the actual compiled artifact.",
        422,
      );
    config.software = {
      state: "operator-enrolled",
      manifestDigest: artifactDigest(manifest),
      manifest,
      maxCvssTenths: config.build.maxCvssTenths ?? 70,
    };
    if (
      !Number.isInteger(config.software.maxCvssTenths) ||
      config.software.maxCvssTenths < 0 ||
      config.software.maxCvssTenths > 100
    )
      invalid();
  }
  return config;
}

/** All operations here read existing state. This adapter has no write or signing method. */
export function createExternalAcceptance(config, env = process.env) {
  if (!config) return null;
  return {
    async readInspection(request, report) {
      if (!config.masumi) return null;
      const m = config.masumi;
      const db = new DatabaseSync(m.ledgerFile, { readOnly: true });
      let state;
      try {
        const identity = JSON.parse(
          db.prepare("SELECT value FROM configuration WHERE id=1").get()
            ?.value ?? "null",
        );
        if (artifactDigest(identity) !== m.configurationDigest)
          throw new AppError(
            "INSPECTOR_CONFIG_MISMATCH",
            "The inspector ledger belongs to another runtime or payment identity.",
            422,
          );
        const row = db
          .prepare("SELECT state FROM tasks WHERE inspection_id=?")
          .get(request.inspectionId);
        if (!row) return null;
        state = JSON.parse(row.state);
      } finally {
        db.close();
      }
      const preliminary = bindInspectionResult({ state, request, report });
      if (state.stage !== "SELLER_PAID") return preliminary;
      const {
        createMpsClient,
        createBlockfrostReader,
        verifySellerReceipt,
        assertObservedPayment,
        paymentFingerprint,
      } = await import("../integrations/masumi/src/payment.js");
      const { createSokosumiRuntime } = await import(
        "../integrations/masumi/src/runtime.js"
      );
      const registration = loadJson(m.registrationFile);
      const runtime = createSokosumiRuntime({
        coworkerId: m.coworkerId,
        organizationId: m.organizationId ?? null,
        organizationSlug: m.organizationSlug ?? null,
        writesAuthorized: false,
      });
      const identity = {
        runtime: runtime.identity,
        transportMode: runtime.kind,
        paid: true,
        paymentIdentity: paymentFingerprint(registration),
      };
      if (artifactDigest(identity) !== m.configurationDigest)
        throw new AppError(
          "INSPECTOR_CONFIG_MISMATCH",
          "The configured readers differ from the inspector ledger's pinned runtime or payment identity.",
          422,
        );
      const remote = await runtime.readTask(state.remoteTaskId);
      if (
        remote.description !== state.exactInput ||
        remote.status !== "COMPLETED"
      )
        throw new AppError(
          "INSPECTION_BINDING_MISMATCH",
          "The remote Task no longer contains the completed original inspection.",
          422,
        );
      const events = await runtime.readEvents(state.remoteTaskId);
      if (
        !events.some(
          (event) =>
            event.status === "COMPLETED" && event.comment === state.resultText,
        )
      )
        throw new AppError(
          "INSPECTION_BINDING_MISMATCH",
          "The remote Task lacks the exact delivered inspection result.",
          422,
        );
      const mps = createMpsClient({
        baseUrl: m.mpsUrl ?? "http://127.0.0.1:38127",
        token: token(m.sellerTokenFile),
        writesAuthorized: false,
      });
      const payment = await mps.readPayment(state.terms.blockchainIdentifier);
      assertObservedPayment(payment, state, registration);
      const receipt = await verifySellerReceipt({
        runtime,
        payment,
        taskId: state.remoteTaskId,
        sellerAddress: registration.sellerAddress,
        readUtxos: createBlockfrostReader({
          projectId: env.BLOCKFROST_API_KEY_PREPROD,
        }),
      });
      return bindInspectionResult({ state, receipt, request, report });
    },
    async sourceDigest() {
      if (!config.contract?.responseFile) return null;
      const { sourceResponseDigest } = await import("../api3/src/abi.mjs");
      return sourceResponseDigest(loadJson(config.contract.responseFile));
    },
    async readContract({ jobId, expected }) {
      if (!config.contract || !expected)
        return {
          verdict: "REVIEW",
          reason:
            "A pinned contract, enrolled build, source response, and paid result are required.",
        };
      const { createPublicClient, http } = createRequire(
        new URL("../api3/package.json", import.meta.url),
      )("viem");
      const { readAcceptance } = await import("../api3/src/abi.mjs");
      const c = config.contract;
      return readAcceptance({
        client: createPublicClient({
          transport: http(c.rpcUrl, { retryCount: 0, timeout: 15000 }),
        }),
        chainId: c.chainId,
        contract: c.address,
        runtimeCodeHash: c.runtimeCodeHash,
        jobId,
        expected,
      });
    },
    async prepareContract({ jobId, order, session }) {
      if (!config.contract || !order.software?.manifestDigest)
        throw new AppError(
          "CONTRACT_UNCONFIGURED",
          "Configure a pinned contract and enrolled compiled build before preparing calls.",
          422,
        );
      const {
        prepareEnrollBuild,
        prepareOpenJob,
        prepareRecordInspection,
        prepareFinalize,
      } = await import("../api3/src/abi.mjs");
      const c = {
        chainId: config.contract.chainId,
        contract: config.contract.address,
      };
      const version = order.software.manifest.version
        .split(".")
        .reduce((value, part) => value * 1000 + Number(part), 0);
      const calls = [
        {
          action: "enrollBuild",
          call: prepareEnrollBuild(c, {
            manifestDigest: order.software.manifestDigest,
            version,
          }),
        },
        {
          action: "openJob",
          call: prepareOpenJob(c, {
            jobId,
            workOrderDigest: session.workOrderDigest,
            buildManifestDigest: order.software.manifestDigest,
            deadline: Math.floor(order.expiresAt / 1000),
            maxCvssTenths: order.software.maxCvssTenths,
          }),
        },
      ];
      if (session.external?.paid?.outcome === "PASS") {
        calls.push({
          action: "recordInspection",
          call: prepareRecordInspection(c, {
            jobId,
            inspectionDigest: artifactDigest(session.report),
            paymentEvidenceDigest: session.external.paid.evidenceDigest,
            passed: session.report.outcome === "PASS",
            sellerReceived: true,
          }),
        });
        if (config.contract.responseFile)
          calls.push({
            action: "finalize",
            call: prepareFinalize(c, {
              jobId,
              response: loadJson(config.contract.responseFile),
            }),
          });
      }
      return {
        schema: "proof-of-ready/unsigned-contract-plan/v1",
        authorization: "UNSIGNED",
        jobId,
        calls,
        limitation:
          "Inspect existing contract state before each call. No call is signed or broadcast. Enrollment asserts the declared build artifact, not remote firmware attestation.",
      };
    },
  };
}
