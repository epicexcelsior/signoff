import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  openLedger,
  createFixtureRuntime,
  createInspectionService,
  TEST_USDM,
} from "../src/index.js";

export const request = () => ({
  inspectionId: "inspection-1",
  workOrderHash: `0x${"a".repeat(64)}`,
  evidenceBundleHash: `0x${"b".repeat(64)}`,
  inputText: "Inspect the approved installation checks.",
  idempotencyKey: "intent-0001",
});
export const artifact = (outcome = "PASS") => ({
  mode: "simulation",
  ...request(),
  requiredChecks: ["contact", "delivery"],
  checks: [
    {
      id: "contact",
      outcome,
      reason:
        outcome === "FAIL"
          ? "The contact did not transition."
          : "The signed state sequence matches.",
    },
    {
      id: "delivery",
      outcome: "PASS",
      reason: "The receiver recorded both states within the approved deadline.",
    },
  ],
});
export function temporary(t) {
  const dir = mkdtempSync(join(tmpdir(), "proof-ready-masumi-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
export function fixture(t, options = {}) {
  const path = join(temporary(t), "tasks.sqlite");
  const ledger = openLedger(path);
  t.after(() => ledger.close());
  const runtime = createFixtureRuntime();
  const service = createInspectionService({
    ledger,
    runtime,
    loadArtifact: async () => artifact(),
    ...options,
  });
  return { path, ledger, runtime, service };
}
export async function until(service, id, wanted, limit = 20) {
  for (let index = 0; index < limit; index += 1) {
    const state = service.get(id);
    if (state.stage === wanted) return state;
    await service.advance(id);
  }
  throw new Error(`Stage ${wanted} was not reached: ${service.get(id).stage}`);
}
export function paidFixture(t, options = {}) {
  const ledger = openLedger(join(temporary(t), "tasks.sqlite"));
  t.after(() => ledger.close());
  const runtime = createFixtureRuntime();
  // A mocked authorized dependency exercises the paid state machine. It never contacts a network.
  runtime.kind = "sokosumi-preprod";
  runtime.identity = { coworkerId: "test-coworker", organizationId: null };
  const registration = {
    status: "RegistrationConfirmed",
    supportedPaymentSourceIndex: 2,
    agentIdentifier: "registered-agent",
    walletId: "seller-wallet",
    sellerVkey: "seller-key",
    sellerAddress: "seller-address",
    smartContractAddress: "script-address",
    policyId: "policy-identifier",
  };
  const state = {
    phase: "FundsLocked",
    calls: { terms: 0, request: 0, submit: 0, refund: 0, authorize: 0 },
    txHash: "c".repeat(64),
    terms: null,
    submittedHash: null,
    receipt: null,
  };
  const mps = {
    async createTerms(body) {
      state.calls.terms += 1;
      state.terms = {
        ...structuredClone(body),
        blockchainIdentifier: "original-payment",
        sellerReturnAddress: null,
        PaymentSource: {
          network: "Preprod",
          paymentSourceType: "Web3CardanoV2",
          smartContractAddress: registration.smartContractAddress,
          policyId: registration.policyId,
        },
        SmartContractWallet: {
          id: registration.walletId,
          walletVkey: registration.sellerVkey,
        },
      };
      return structuredClone(state.terms);
    },
    async readPayment() {
      return {
        ...structuredClone(state.terms),
        onChainState: state.phase,
        resultHash: state.submittedHash,
        CurrentTransaction: {
          status: "Confirmed",
          newOnChainState: state.phase,
          txHash: state.txHash,
        },
      };
    },
    async submitResult(id, hash) {
      state.calls.submit += 1;
      state.submittedHash = hash;
      state.phase = "ResultSubmitted";
    },
    async authorizeRefund() {
      state.calls.authorize += 1;
      state.phase = "RefundAuthorized";
    },
  };
  const buyerMps = {
    async requestRefund() {
      state.calls.refund += 1;
      state.phase = "RefundRequested";
    },
  };
  runtime.requestPayment = async () => {
    state.calls.request += 1;
    return { id: "payment-event" };
  };
  runtime.readReceipt = async () => state.receipt ?? { settled: false };
  const readUtxos = async () => ({
    inputs: [],
    outputs: [
      {
        address: registration.sellerAddress,
        amount: [{ unit: TEST_USDM, quantity: "1000000" }],
      },
    ],
  });
  const service = createInspectionService({
    ledger,
    runtime,
    paid: true,
    paymentsAuthorized: true,
    mps,
    buyerMps,
    registration,
    readUtxos,
    loadArtifact: async () => artifact(),
    ...options,
  });
  return {
    ledger,
    runtime,
    registration,
    mps,
    buyerMps,
    service,
    state,
    readUtxos,
  };
}
