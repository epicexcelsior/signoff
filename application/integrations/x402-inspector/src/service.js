import { createHash } from "node:crypto";
import { Service } from "../../../src/service.js";
import { AppError } from "../../../src/store.js";
import { requirements } from "../../../src/payment.js";
import {
  inspectionRequest,
  assertArtifact,
  validateReport,
} from "../../masumi/src/contracts.js";
import { inspectVerifiedChecks } from "../../masumi/src/inspector.js";

export const sha256 = (text) =>
  createHash("sha256").update(text, "utf8").digest("hex");
export class PaidInspector extends Service {
  constructor({
    store,
    payment,
    sellerAddress,
    writesAuthorized = false,
    loadArtifact,
  }) {
    const config = { mode: "preprod", spendAuthorized: writesAuthorized };
    const profile = {
      mode: "preprod",
      requirements: requirements(sellerAddress),
      contact: null,
      publicKey: null,
    };
    super({ store, payment, config, profile });
    this.loadArtifact = loadArtifact;
    store.bindConfig(
      sha256(
        JSON.stringify({
          service: "proof-of-ready/x402-inspector/v1",
          requirements: profile.requirements,
        }),
      ),
    );
  }
  async create(body) {
    const parsed = inspectionRequest.safeParse(body);
    if (!parsed.success)
      throw new AppError(
        "INVALID_INSPECTION",
        "Supply the original prepared inspection request.",
        422,
      );
    const artifact = await this.loadArtifact(parsed.data);
    assertArtifact(artifact, parsed.data);
    return this.store.create(
      parsed.data.idempotencyKey,
      parsed.data,
      this.profile,
    );
  }
  async inspect(id) {
    const current = this.store.get(id);
    if (current.state === "COMPLETE") return current;
    if (current.state !== "PAID")
      throw new AppError(
        "PAYMENT_REQUIRED",
        "Confirm the original payment before inspection.",
        402,
      );
    // Pure inspection can run again after a crash. Payment submission remains fenced in the shared Service.
    const artifact = await this.loadArtifact(current.input);
    assertArtifact(artifact, current.input);
    const report = validateReport(
      inspectVerifiedChecks(artifact),
      current.input,
    );
    const resultText = JSON.stringify(report);
    const patch = {
      state: "COMPLETE",
      report,
      resultText,
      resultHash: sha256(resultText),
      evidenceMode: artifact.mode,
      physicalAcceptance: false,
    };
    try {
      return this.store.update(
        id,
        ["PAID"],
        patch,
        "Delivered the deterministic report bound to the original request and confirmed payment.",
      );
    } catch (error) {
      if (
        error.code === "STATE_CONFLICT" &&
        this.store.get(id).state === "COMPLETE"
      )
        return this.store.get(id);
      throw error;
    }
  }
  view(job) {
    const { payment, ...rest } = job;
    return {
      ...rest,
      payment: payment
        ? {
            transaction: payment.transaction,
            status: payment.status,
            receipt: payment.receipt,
          }
        : null,
    };
  }
}
