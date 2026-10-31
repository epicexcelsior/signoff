import { isDeepStrictEqual } from "node:util";
import { EvidenceError, verifyEvidence, refreshDecision } from "./evidence.js";
import { createChallenge } from "./observation.js";
import { AppError } from "./store.js";
import { CommissioningService } from "./commissioning.js";

export class Service {
  constructor({
    store,
    config,
    profile,
    payment,
    observe,
    external = null,
    emitOptical = null,
  }) {
    Object.assign(this, { store, config, profile, payment, observe });
    this.inFlight = new Map();
    this.commissioning = new CommissioningService({
      store,
      config,
      profile,
      observe,
      external,
      emitOptical,
    });
  }

  create(body) {
    if (this.config.mode === "physical")
      throw new AppError(
        "PAYMENT_DISABLED",
        "Use the commissioning station for physical tests without payments.",
        403,
      );
    if (
      !body ||
      Object.keys(body).some(
        (key) => !["idempotency_key", "closed"].includes(key),
      ) ||
      typeof body.idempotency_key !== "string" ||
      !/^[A-Za-z0-9_-]{8,80}$/.test(body.idempotency_key) ||
      (this.config.mode === "simulation"
        ? typeof body.closed !== "boolean"
        : body.closed !== undefined)
    ) {
      throw new AppError(
        "INVALID_REQUEST",
        "Use one request identifier and a supported contact selection.",
        400,
      );
    }
    return this.store.create(
      body.idempotency_key,
      this.config.mode === "simulation" ? { closed: body.closed } : {},
      this.profile,
    );
  }

  single(id, action, run) {
    const key = `${id}:${action}`;
    if (this.inFlight.has(key)) return this.inFlight.get(key);
    const promise = Promise.resolve()
      .then(run)
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  async pay(id, payload) {
    // Validate every concurrent caller before coalescing. A changed payload is never silently accepted.
    const original = this.store.get(id);
    const transaction = this.payment.identify(payload, original);
    if (
      original.payment &&
      (!isDeepStrictEqual(original.payment.payload, payload) ||
        original.payment.transaction !== transaction)
    ) {
      throw new AppError(
        "PAYMENT_CONFLICT",
        "This check already binds a different signed payment. Reconcile that payment.",
      );
    }
    if (this.config.mode !== "simulation" && !this.config.spendAuthorized) {
      throw new AppError(
        "PAYMENT_DISABLED",
        "Payment submission requires explicit operator authorization.",
        403,
      );
    }
    if (original.state === "AWAITING_PAYMENT") {
      this.store.update(
        id,
        ["AWAITING_PAYMENT"],
        {
          state: "PAYMENT_VERIFYING",
          payment: {
            transaction,
            payload,
            receipt: null,
            status: "unsubmitted",
          },
        },
        "Bound the exact payment to this check before verification.",
      );
    }
    return this.single(id, "payment", async () => {
      let job = this.store.get(id);
      if (job.state !== "PAYMENT_VERIFYING") return job;
      let verified;
      try {
        verified = await this.payment.verify(payload, job.requirements);
      } catch {
        return this.store.update(
          id,
          ["PAYMENT_VERIFYING"],
          {
            error:
              "Payment verification is unavailable. No payment was submitted.",
          },
          "Verification failed before submission. The original payload remains bound.",
        );
      }
      if (verified?.isValid !== true) {
        return this.store.update(
          id,
          ["PAYMENT_VERIFYING"],
          {
            state: "PAYMENT_REJECTED",
            error: "The facilitator rejected this payment. No observation ran.",
          },
          "Payment verification rejected the signed transaction.",
        );
      }
      job = this.store.update(
        id,
        ["PAYMENT_VERIFYING"],
        {
          state: "PAYMENT_UNKNOWN",
          payment: { ...job.payment, status: "unknown" },
          error: null,
        },
        "Recorded submission intent before contacting the facilitator.",
      );
      try {
        const receipt = await this.payment.settle(
          payload,
          job.requirements,
          transaction,
        );
        // A facilitator claim is recorded, then checked independently against the original transaction.
        if (
          receipt.transaction !== transaction ||
          receipt.network !==
            (job.mode === "simulation" ? "simulation" : "cardano:preprod")
        ) {
          throw new Error("Settlement identity mismatch");
        }
        job = this.store.get(id);
        job = this.store.update(
          id,
          ["PAYMENT_UNKNOWN", "PAID"],
          { payment: { ...job.payment, receipt } },
          "Recorded the facilitator response. Chain confirmation is still required.",
        );
        return await this.reconcile(id);
      } catch {
        const current = this.store.get(id);
        if (current.state !== "PAYMENT_UNKNOWN") return current;
        return this.store.update(
          id,
          ["PAYMENT_UNKNOWN"],
          {
            error:
              "Payment status is unknown. Reconcile the original transaction. Do not create a replacement payment.",
          },
          "Submission or confirmation did not finish. No observation ran.",
        );
      }
    });
  }

  async reconcile(id) {
    return this.single(id, "reconcile", async () => {
      const job = this.store.get(id);
      if (!["PAYMENT_UNKNOWN", "PAYMENT_VERIFYING"].includes(job.state))
        return job;
      // Verification never submits. A crash in that phase remains fenced instead of retrying a signature or send.
      if (job.state === "PAYMENT_VERIFYING") return job;
      let confirmed;
      try {
        confirmed = await this.payment.confirm(
          job.payment.transaction,
          job.requirements,
        );
      } catch {
        throw new AppError(
          "CHAIN_UNAVAILABLE",
          "The chain provider is unavailable. The original payment remains unresolved.",
          503,
        );
      }
      if (!confirmed) return job;
      return this.store.update(
        id,
        ["PAYMENT_UNKNOWN"],
        {
          state: "PAID",
          error: null,
          payment: {
            ...job.payment,
            status: job.mode === "simulation" ? "simulated" : "confirmed",
          },
        },
        job.mode === "simulation"
          ? "Simulated payment accepted. No funds moved."
          : "Checked the original transaction, recipient, amount, and confirmation depth.",
      );
    });
  }

  async capture(id) {
    return this.single(id, "observe", async () => {
      let job = this.store.get(id);
      if (["COMPLETE", "OBSERVATION_FAILED", "OBSERVING"].includes(job.state))
        return job;
      job = this.store.update(
        id,
        ["PAID"],
        { state: "OBSERVING", challenge: createChallenge(id) },
        "Persisted a fresh challenge before requesting one observation.",
      );
      try {
        const receipt = await this.observe(job);
        const verification = verifyEvidence({
          receipt,
          challenge: job.challenge,
          contact: job.contact,
          publicKey: job.public_key,
        });
        return this.store.update(
          id,
          ["OBSERVING"],
          { state: "COMPLETE", receipt, verification },
          "Verified the pinned device signature, original challenge, stable samples, and observation age.",
        );
      } catch (error) {
        return this.store.update(
          id,
          ["OBSERVING"],
          {
            state: "OBSERVATION_FAILED",
            error:
              error instanceof EvidenceError
                ? error.message
                : "The observation did not finish. No automatic repeat or refund exists.",
          },
          "Observation failed. The payment remains recorded and the dispatch decision stays blocked.",
        );
      }
    });
  }

  view(job) {
    const { payment, public_key, ...rest } = job;
    const decision = job.verification
      ? refreshDecision(job.verification)
      : {
          accepted: false,
          decision: "WAIT",
          reason:
            job.error ??
            (job.state === "OBSERVING"
              ? "The observation is pending or interrupted. It will not run again automatically."
              : "A fresh verified observation is required."),
        };
    return {
      ...rest,
      payment: payment
        ? {
            transaction: payment.transaction,
            status: payment.status,
            receipt: payment.receipt,
          }
        : null,
      decision,
      public_key,
      events: this.store.events(job.id),
    };
  }

  verify(id, receipt) {
    const job = this.store.get(id);
    if (!job.challenge)
      throw new AppError(
        "NO_OBSERVATION",
        "Capture an observation before checking a receipt.",
      );
    return verifyEvidence({
      receipt,
      challenge: job.challenge,
      contact: job.contact,
      publicKey: job.public_key,
    });
  }
}
