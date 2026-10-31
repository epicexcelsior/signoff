import {
  IntegrationError,
  inspectionRequest,
  inspectVerifiedChecks,
  assertArtifact,
  validateReport,
  coworkerResultHash,
} from "./contracts.js";
import {
  assertRegistration,
  termsRequest,
  purchasePayload,
  assertObservedPayment,
  confirmedState,
  verifySellerReceipt,
  paymentFingerprint,
  paymentTime,
} from "./payment.js";

const uncertain = new Set([
  "TASK_CREATING",
  "TASK_STARTING",
  "TERMS_CREATING",
  "REQUESTING_PAYMENT",
  "EVALUATING",
  "SUBMITTING_RESULT",
  "COMPLETING",
  "REFUND_REQUESTING",
  "REFUND_AUTHORIZING",
]);

export function createInspectionService({
  ledger,
  runtime,
  loadArtifact,
  evaluate = inspectVerifiedChecks,
  explanationModel,
  paid = false,
  paymentsAuthorized = false,
  registration,
  mps,
  buyerMps,
  readUtxos,
  now = Date.now,
}) {
  if (!ledger || !runtime || typeof loadArtifact !== "function")
    throw new IntegrationError(
      "INVALID_SERVICE",
      "Configure a ledger, runtime, and immutable artifact loader.",
    );
  if (paid) {
    assertRegistration(registration);
    if (
      !paymentsAuthorized ||
      runtime.kind === "fixture" ||
      !mps ||
      !readUtxos
    ) {
      throw new IntegrationError(
        "PAYMENT_AUTHORIZATION_REQUIRED",
        "Paid execution requires authorized Preprod services and independent chain evidence.",
      );
    }
  }
  ledger.pin({
    runtime: runtime.identity,
    transportMode: runtime.kind,
    paid,
    paymentIdentity: paymentFingerprint(registration),
  });
  const save = (state, changes) =>
    ledger.update(state.taskId, state.version, changes);
  // Older claims retain their original name for uncertain-operation recovery.
  const name = (state) =>
    state.remoteTaskName ?? `signoff ${state.taskId}`;
  function assertRemoteInput(task, state) {
    if (
      !task ||
      task.id !== state.remoteTaskId ||
      task.description !== state.exactInput
    ) {
      throw new IntegrationError(
        "TASK_INPUT_MISMATCH",
        "The Task input differs from this inspection's saved exact text.",
      );
    }
  }
  function beforeResultDeadline(state) {
    if (state.paid && now() >= paymentTime(state.terms.submitResultTime))
      throw new IntegrationError(
        "RESULT_DEADLINE",
        "The result deadline expired. Reconcile or request recovery for this payment.",
      );
  }
  async function external(state, stage, action, next, claim = {}) {
    const claimed = save(state, { ...claim, stage, lastError: null });
    let value;
    try {
      value = await action(claimed);
    } catch (error) {
      save(claimed, {
        lastError:
          error instanceof IntegrationError
            ? error.code
            : "EXTERNAL_OPERATION_FAILED",
      });
      throw new IntegrationError(
        "OPERATION_UNCERTAIN",
        `${stage} did not complete locally. Reconcile the saved operation before recovery.`,
      );
    }
    return save(claimed, next(value, claimed));
  }
  async function readPayment(state) {
    const payment = await mps.readPayment(state.terms.blockchainIdentifier);
    assertObservedPayment(payment, state, registration);
    return payment;
  }
  async function readCompletion(state) {
    const task = await runtime.readTask(state.remoteTaskId);
    assertRemoteInput(task, state);
    if (task.status !== "COMPLETED") return false;
    const events = await runtime.readEvents(state.remoteTaskId);
    return events.some(
      (event) =>
        event.status === "COMPLETED" && event.comment === state.resultText,
    );
  }
  async function paymentProgress(state) {
    const observed = await readPayment(state);
    if (
      observed.onChainState === "RefundWithdrawn" &&
      confirmedState(observed, "RefundWithdrawn")
    ) {
      return save(state, {
        stage: "REFUND_WITHDRAWN",
        observed,
        sellerPaid: false,
      });
    }
    if (
      observed.onChainState === "RefundAuthorized" &&
      confirmedState(observed, "RefundAuthorized")
    ) {
      return save(state, {
        stage: "REFUND_AUTHORIZED",
        observed,
        sellerPaid: false,
      });
    }
    if (["RefundRequested", "Disputed"].includes(observed.onChainState)) {
      return save(state, {
        stage: state.refundAuthorizationClaimed
          ? state.stage
          : "REFUND_PENDING",
        observed,
        sellerPaid: false,
      });
    }
    if (
      ["AWAITING_ESCROW", "REQUESTING_PAYMENT"].includes(state.stage) &&
      observed.onChainState === "FundsLocked" &&
      confirmedState(observed, "FundsLocked")
    ) {
      beforeResultDeadline(state);
      return save(state, { stage: "EVALUATION_READY", observed });
    }
    if (
      ["AWAITING_RESULT", "SUBMITTING_RESULT"].includes(state.stage) &&
      observed.onChainState === "ResultSubmitted" &&
      confirmedState(observed, "ResultSubmitted") &&
      observed.resultHash === state.resultHash
    ) {
      return save(state, { stage: "COMPLETION_READY", observed });
    }
    if (
      state.stage === "AWAITING_WITHDRAWAL" &&
      ["Withdrawn", "DisputedWithdrawn"].includes(observed.onChainState)
    ) {
      const receipt = await verifySellerReceipt({
        runtime,
        payment: observed,
        taskId: state.remoteTaskId,
        sellerAddress: registration.sellerAddress,
        readUtxos,
      });
      return save(state, {
        stage: receipt.verified ? "SELLER_PAID" : "AWAITING_WITHDRAWAL",
        observed,
        receipt,
        sellerPaid: receipt.verified,
      });
    }
    return save(state, { observed });
  }
  return {
    create(value) {
      const request = inspectionRequest.parse(value);
      return ledger.create(request, { transportMode: runtime.kind, paid })
        .state;
    },
    get: (id) => ledger.get(id),
    list: () => ledger.list(),
    async advance(id) {
      let state = ledger.get(id);
      if (uncertain.has(state.stage))
        throw new IntegrationError(
          "RECOVERY_REQUIRED",
          `${state.stage} requires reconciliation. Automatic repetition is disabled.`,
        );
      if (state.stage === "CREATED") {
        return external(
          state,
          "TASK_CREATING",
          () =>
            runtime.createTask({
              name: name(state),
              description: state.exactInput,
            }),
          (task) => {
            if (typeof task?.id !== "string" || !task.id)
              throw new IntegrationError(
                "INVALID_TASK_RESPONSE",
                "Task creation did not return its identifier.",
              );
            return { stage: "TASK_CREATED", remoteTaskId: task.id };
          },
        );
      }
      if (state.stage === "TASK_CREATED") {
        assertRemoteInput(await runtime.readTask(state.remoteTaskId), state);
        return external(
          state,
          "TASK_STARTING",
          () => runtime.startTask(state.remoteTaskId),
          (task) => {
            if (task.description !== state.exactInput)
              throw new IntegrationError(
                "TASK_INPUT_MISMATCH",
                "The started Task input changed. Inspect the original Task.",
              );
            return { stage: state.paid ? "STARTED" : "EVALUATION_READY" };
          },
        );
      }
      if (state.stage === "STARTED") {
        const request = termsRequest(state, registration, now());
        state = save(state, { termsRequest: request });
        return external(
          state,
          "TERMS_CREATING",
          () => mps.createTerms(request),
          (terms) => {
            purchasePayload(terms, request, registration);
            return { stage: "TERMS_SAVED", terms };
          },
        );
      }
      if (state.stage === "TERMS_SAVED") {
        if (now() >= paymentTime(state.terms.payByTime))
          throw new IntegrationError(
            "PAYMENT_DEADLINE",
            "The original signed payment terms expired. Do not generate a replacement automatically.",
          );
        const payload = purchasePayload(
          state.terms,
          state.termsRequest,
          registration,
        );
        return external(
          state,
          "REQUESTING_PAYMENT",
          () => runtime.requestPayment(state.remoteTaskId, payload),
          (event) => ({
            stage: "AWAITING_ESCROW",
            paymentEventId: event?.id ?? null,
          }),
        );
      }
      if (
        [
          "AWAITING_ESCROW",
          "AWAITING_RESULT",
          "AWAITING_WITHDRAWAL",
          "REFUND_PENDING",
          "REFUND_AUTHORIZED",
          "AWAITING_REFUND_AUTHORIZATION",
        ].includes(state.stage)
      )
        return paymentProgress(state);
      if (state.stage === "EVALUATION_READY") {
        beforeResultDeadline(state);
        assertRemoteInput(await runtime.readTask(state.remoteTaskId), state);
        return external(
          state,
          "EVALUATING",
          async () => {
            const artifact = await loadArtifact(state.request);
            assertArtifact(artifact, state.request);
            const report = validateReport(
              await evaluate(artifact, { request: state.request }),
              state.request,
            );
            const explanation = explanationModel
              ? await explanationModel({ report })
              : undefined;
            const resultText = JSON.stringify({
              ...report,
              ...(explanation ? { explanation } : {}),
            });
            if (Buffer.byteLength(resultText) > 128_000)
              throw new IntegrationError(
                "RESULT_LIMIT",
                "The inspection result exceeds the supported transport limit.",
              );
            beforeResultDeadline(state);
            return {
              report,
              resultText,
              resultHash: coworkerResultHash(resultText),
            };
          },
          (result) => ({ ...result, stage: "RESULT_SAVED" }),
        );
      }
      if (state.stage === "RESULT_SAVED") {
        if (!state.paid) return save(state, { stage: "COMPLETION_READY" });
        beforeResultDeadline(state);
        return external(
          state,
          "SUBMITTING_RESULT",
          () =>
            mps.submitResult(
              state.terms.blockchainIdentifier,
              state.resultHash,
            ),
          () => ({ stage: "AWAITING_RESULT" }),
        );
      }
      if (state.stage === "COMPLETION_READY") {
        return external(
          state,
          "COMPLETING",
          () => runtime.completeTask(state.remoteTaskId, state.resultText),
          (event) => ({
            stage: state.paid ? "AWAITING_WITHDRAWAL" : "COMPLETE",
            completionEventId: event?.id ?? null,
            sellerPaid: false,
          }),
        );
      }
      return state;
    },
    async reconcile(id) {
      const state = ledger.get(id);
      if (state.stage === "TASK_CREATING") {
        const task = await runtime.findTask({
          name: name(state),
          description: state.exactInput,
        });
        if (!task) return state;
        return save(state, { stage: "TASK_CREATED", remoteTaskId: task.id });
      }
      if (state.stage === "TASK_STARTING") {
        const task = await runtime.readTask(state.remoteTaskId);
        assertRemoteInput(task, state);
        return task.status === "RUNNING"
          ? save(state, { stage: state.paid ? "STARTED" : "EVALUATION_READY" })
          : state;
      }
      if (state.stage === "COMPLETING") {
        return (await readCompletion(state))
          ? save(state, {
              stage: state.paid ? "AWAITING_WITHDRAWAL" : "COMPLETE",
            })
          : state;
      }
      if (
        state.terms &&
        [
          "REQUESTING_PAYMENT",
          "SUBMITTING_RESULT",
          "REFUND_REQUESTING",
          "REFUND_AUTHORIZING",
          "AWAITING_ESCROW",
          "AWAITING_RESULT",
          "AWAITING_WITHDRAWAL",
          "REFUND_PENDING",
          "REFUND_AUTHORIZED",
          "AWAITING_REFUND_AUTHORIZATION",
        ].includes(state.stage)
      )
        return paymentProgress(state);
      return state;
    },
    recoverTerms(id, payment) {
      const state = ledger.get(id);
      if (state.stage !== "TERMS_CREATING")
        throw new IntegrationError(
          "INVALID_RECOVERY",
          "Terms recovery requires the original uncertain terms operation.",
        );
      purchasePayload(payment, state.termsRequest, registration);
      return save(state, { stage: "TERMS_SAVED", terms: payment });
    },
    async requestRefund(id) {
      const state = ledger.get(id);
      if (
        !state.paid ||
        !paymentsAuthorized ||
        !buyerMps ||
        !state.terms ||
        state.report ||
        state.refundRequestClaimed ||
        !["AWAITING_ESCROW", "EVALUATION_READY", "EVALUATING"].includes(
          state.stage,
        ) ||
        (uncertain.has(state.stage) && state.stage !== "EVALUATING")
      )
        throw new IntegrationError(
          "REFUND_NOT_AVAILABLE",
          "An authorized buyer service and an undelivered paid inspection are required for refund request.",
        );
      const observed = await readPayment(state);
      if (
        observed.onChainState !== "FundsLocked" ||
        !confirmedState(observed, "FundsLocked")
      )
        throw new IntegrationError(
          "REFUND_NOT_AVAILABLE",
          "The original payment must have a confirmed locked state.",
        );
      return external(
        state,
        "REFUND_REQUESTING",
        () => buyerMps.requestRefund(state.terms.blockchainIdentifier),
        () => ({ stage: "REFUND_PENDING" }),
        { refundRequestClaimed: true },
      );
    },
    async authorizeRefund(id) {
      const state = ledger.get(id);
      if (
        !state.paid ||
        !paymentsAuthorized ||
        !state.terms ||
        state.report ||
        state.refundAuthorizationClaimed ||
        state.stage !== "REFUND_PENDING" ||
        (uncertain.has(state.stage) && state.stage !== "EVALUATING")
      )
        throw new IntegrationError(
          "REFUND_NOT_AVAILABLE",
          "An undelivered paid inspection is required for refund authorization.",
        );
      const observed = await readPayment(state);
      if (
        observed.onChainState !== "RefundRequested" ||
        !confirmedState(observed, "RefundRequested")
      )
        throw new IntegrationError(
          "REFUND_NOT_AVAILABLE",
          "The original buyer refund request must be confirmed.",
        );
      return external(
        state,
        "REFUND_AUTHORIZING",
        () => mps.authorizeRefund(state.terms.blockchainIdentifier),
        () => ({ stage: "AWAITING_REFUND_AUTHORIZATION" }),
        { refundAuthorizationClaimed: true },
      );
    },
  };
}
