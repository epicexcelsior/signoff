import { randomBytes } from "node:crypto";
import { IntegrationError, sha256Text } from "./contracts.js";
import { readBoundedText } from "./network.js";

export const TEST_USDM =
  "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d";
const positive = (value) =>
  typeof value === "string" && /^[1-9][0-9]{0,39}$/.test(value);
export function confirmedState(payment, expected) {
  return [
    payment.CurrentTransaction,
    ...(payment.TransactionHistory ?? []),
  ].some((tx) => tx?.status === "Confirmed" && tx.newOnChainState === expected);
}
export function termsRequest(state, registration, now = Date.now()) {
  const minute = 60_000;
  const nonce = randomBytes(10).toString("hex");
  return {
    network: "Preprod",
    paymentSourceType: "Web3CardanoV2",
    agentIdentifier: registration.agentIdentifier,
    supportedPaymentSourceIndex: registration.supportedPaymentSourceIndex,
    inputHash: state.inputHash,
    identifierFromPurchaser: nonce,
    RequestedFunds: [{ amount: "1000000", unit: TEST_USDM }],
    payByTime: new Date(now + 5 * minute).toISOString(),
    submitResultTime: new Date(now + 20 * minute).toISOString(),
    unlockTime: new Date(now + 36 * minute).toISOString(),
    externalDisputeUnlockTime: new Date(now + 52 * minute).toISOString(),
    metadata: JSON.stringify({
      inspectionId: state.request.inspectionId,
      taskId: state.taskId,
    }),
  };
}
export function paymentTime(value) {
  const number =
    typeof value === "number" || /^\d+$/.test(value)
      ? Number(value)
      : Date.parse(value);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new IntegrationError(
      "INVALID_TERMS",
      "The payment deadline is invalid.",
    );
  return number;
}
export function assertRegistration(registration) {
  if (
    !registration ||
    registration.status !== "RegistrationConfirmed" ||
    !Number.isSafeInteger(registration.supportedPaymentSourceIndex) ||
    registration.supportedPaymentSourceIndex < 0 ||
    [
      "agentIdentifier",
      "walletId",
      "sellerVkey",
      "sellerAddress",
      "smartContractAddress",
      "policyId",
    ].some((key) => typeof registration[key] !== "string" || !registration[key])
  ) {
    throw new IntegrationError(
      "REGISTRATION_REQUIRED",
      "Load this project's confirmed registration, source index, and dedicated seller wallet.",
    );
  }
}
export function purchasePayload(payment, request, registration) {
  assertRegistration(registration);
  const reject = () => {
    throw new IntegrationError(
      "PAYMENT_TERMS_MISMATCH",
      "The signed terms differ from this inspection's approved Preprod payment.",
    );
  };
  if (
    payment.agentIdentifier !== registration.agentIdentifier ||
    payment.inputHash !== request.inputHash ||
    payment.PaymentSource?.network !== "Preprod" ||
    payment.PaymentSource?.paymentSourceType !== "Web3CardanoV2" ||
    payment.SmartContractWallet?.id !== registration.walletId ||
    payment.SmartContractWallet?.walletVkey !== registration.sellerVkey ||
    payment.sellerReturnAddress !== null ||
    (payment.forceLayer !== undefined && payment.forceLayer !== null) ||
    typeof payment.blockchainIdentifier !== "string" ||
    !payment.blockchainIdentifier ||
    payment.blockchainIdentifier.length > 8000 ||
    !Array.isArray(payment.RequestedFunds) ||
    payment.RequestedFunds.length !== 1 ||
    payment.RequestedFunds[0].unit !== TEST_USDM ||
    payment.RequestedFunds[0].amount !== "1000000" ||
    typeof payment.PaymentSource.smartContractAddress !== "string" ||
    !payment.PaymentSource.smartContractAddress ||
    typeof payment.PaymentSource.policyId !== "string"
  )
    reject();
  if (
    registration.smartContractAddress &&
    payment.PaymentSource.smartContractAddress !==
      registration.smartContractAddress
  )
    reject();
  if (
    registration.policyId &&
    payment.PaymentSource.policyId !== registration.policyId
  )
    reject();
  for (const field of [
    "payByTime",
    "submitResultTime",
    "unlockTime",
    "externalDisputeUnlockTime",
  ]) {
    if (paymentTime(payment[field]) !== paymentTime(request[field])) reject();
  }
  return {
    blockchainIdentifier: payment.blockchainIdentifier,
    agentIdentifier: payment.agentIdentifier,
    sellerVkey: registration.sellerVkey,
    inputHash: payment.inputHash,
    identifierFromPurchaser: request.identifierFromPurchaser,
    payByTime: payment.payByTime,
    submitResultTime: payment.submitResultTime,
    unlockTime: payment.unlockTime,
    externalDisputeUnlockTime: payment.externalDisputeUnlockTime,
    paymentSourceType: "Web3CardanoV2",
    supportedPaymentSourceIndex: registration.supportedPaymentSourceIndex,
    Amounts: payment.RequestedFunds.map(({ amount, unit }) => ({
      amount,
      unit,
    })),
    PaymentSource: {
      network: "Preprod",
      smartContractAddress: payment.PaymentSource.smartContractAddress,
      policyId: payment.PaymentSource.policyId,
    },
  };
}
export function assertObservedPayment(payment, state, registration) {
  purchasePayload(payment, state.termsRequest, registration);
  if (
    payment.blockchainIdentifier !== state.terms.blockchainIdentifier ||
    payment.inputHash !== state.inputHash ||
    payment.agentIdentifier !== registration.agentIdentifier ||
    payment.PaymentSource?.network !== "Preprod"
  ) {
    throw new IntegrationError(
      "PAYMENT_BINDING_MISMATCH",
      "The observed payment does not belong to this inspection.",
    );
  }
  if (payment.resultHash && payment.resultHash !== state.resultHash) {
    throw new IntegrationError(
      "RESULT_HASH_MISMATCH",
      "The on-chain result hash differs from the saved inspection result.",
    );
  }
}
export function sellerTokenNet(utxos, address, unit) {
  const sum = (entries) => {
    if (!Array.isArray(entries))
      throw new IntegrationError(
        "INVALID_CHAIN_EVIDENCE",
        "The transaction inputs and outputs are unavailable.",
      );
    return entries
      .filter((entry) => entry.address === address)
      .reduce((total, entry) => {
        if (!Array.isArray(entry.amount))
          throw new IntegrationError(
            "INVALID_CHAIN_EVIDENCE",
            "The seller token amounts are unavailable.",
          );
        return (
          total +
          entry.amount
            .filter((asset) => asset.unit === unit)
            .reduce((subtotal, asset) => {
              if (!/^(0|[1-9][0-9]{0,79})$/.test(asset.quantity))
                throw new IntegrationError(
                  "INVALID_CHAIN_EVIDENCE",
                  "The chain provider returned an invalid token quantity.",
                );
              return subtotal + BigInt(asset.quantity);
            }, 0n)
        );
      }, 0n);
  };
  return sum(utxos.outputs) - sum(utxos.inputs);
}
export async function verifySellerReceipt({
  runtime,
  payment,
  taskId,
  sellerAddress,
  readUtxos,
  minimumNet = "1",
}) {
  if (!positive(minimumNet))
    throw new IntegrationError(
      "INVALID_RECEIPT_MINIMUM",
      "Use a positive minimum seller receipt in atomic units.",
    );
  const receipt = await runtime.readReceipt(taskId);
  if (receipt?.settled !== true || !receipt.txHash)
    return { verified: false, reason: "Seller receipt is not settled." };
  if (
    !/^[a-f0-9]{64}$/.test(receipt.txHash) ||
    receipt.blockchainIdentifier !== payment.blockchainIdentifier
  ) {
    throw new IntegrationError(
      "RECEIPT_BINDING_MISMATCH",
      "The seller receipt identifies another payment or an invalid transaction.",
    );
  }
  const withdrawal = [
    payment.CurrentTransaction,
    ...(payment.TransactionHistory ?? []),
  ].find(
    (tx) =>
      tx?.status === "Confirmed" &&
      ["Withdrawn", "DisputedWithdrawn"].includes(tx.newOnChainState) &&
      tx.txHash === receipt.txHash,
  );
  if (!withdrawal)
    return {
      verified: false,
      reason: "No matching confirmed withdrawal exists.",
    };
  const net = sellerTokenNet(
    await readUtxos(receipt.txHash),
    sellerAddress,
    TEST_USDM,
  );
  return {
    verified: net >= BigInt(minimumNet),
    transaction: receipt.txHash,
    netAtomicUnits: net.toString(),
    minimumNetAtomicUnits: minimumNet,
    unit: TEST_USDM,
    blockchainIdentifier: payment.blockchainIdentifier,
    method:
      "Matched Core receipt, confirmed MPS withdrawal, and seller net transaction token outputs.",
  };
}

export function createMpsClient({
  baseUrl,
  token,
  writesAuthorized = false,
  fetcher = fetch,
}) {
  const url = new URL(baseUrl);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new IntegrationError(
      "INVALID_MPS_URL",
      "Use the dedicated loopback MPS base URL without credentials or paths.",
    );
  }
  if (typeof token !== "string" || !token)
    throw new IntegrationError(
      "MPS_CREDENTIAL_REQUIRED",
      "Load the scoped MPS runtime credential from private configuration.",
    );
  async function request(path, body, writes) {
    if (writes && !writesAuthorized)
      throw new IntegrationError(
        "PAYMENT_AUTHORIZATION_REQUIRED",
        "The owner must authorize this payment-service write.",
      );
    const response = await fetcher(new URL(`/api/v1${path}`, url), {
      method: "POST",
      headers: { "content-type": "application/json", token },
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    const text = await readBoundedText(response, 1_000_000);
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new IntegrationError(
        "MPS_UNAVAILABLE",
        "The payment service did not return JSON. Reconcile the original operation.",
      );
    }
    if (!response.ok || data.status !== "success")
      throw new IntegrationError(
        "MPS_UNAVAILABLE",
        `The payment service returned HTTP ${response.status}. Reconcile the original operation.`,
      );
    return data.data;
  }
  return {
    createTerms: (body) => request("/payment", body, true),
    readPayment: (blockchainIdentifier) =>
      request(
        "/payment/resolve-blockchain-identifier",
        { network: "Preprod", blockchainIdentifier, includeHistory: "true" },
        false,
      ),
    submitResult: (blockchainIdentifier, submitResultHash) =>
      request(
        "/payment/submit-result",
        { network: "Preprod", blockchainIdentifier, submitResultHash },
        true,
      ),
    requestRefund: (blockchainIdentifier) =>
      request(
        "/purchase/request-refund",
        { network: "Preprod", blockchainIdentifier },
        true,
      ),
    authorizeRefund: (blockchainIdentifier) =>
      request(
        "/payment/authorize-refund",
        { network: "Preprod", blockchainIdentifier },
        true,
      ),
  };
}

export function createBlockfrostReader({ projectId, fetcher = fetch }) {
  if (!projectId)
    throw new IntegrationError(
      "CHAIN_CREDENTIAL_REQUIRED",
      "Load a dedicated Preprod Blockfrost project key.",
    );
  return async (transaction) => {
    if (!/^[a-f0-9]{64}$/.test(transaction))
      throw new IntegrationError(
        "INVALID_TRANSACTION",
        "Use the original Cardano transaction hash.",
      );
    const response = await fetcher(
      `https://cardano-preprod.blockfrost.io/api/v0/txs/${transaction}/utxos`,
      {
        headers: { project_id: projectId },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok)
      throw new IntegrationError(
        "CHAIN_UNAVAILABLE",
        "The chain provider cannot verify the seller receipt.",
      );
    const text = await readBoundedText(response, 1_000_000);
    return JSON.parse(text);
  };
}

export const paymentFingerprint = (registration) =>
  sha256Text(JSON.stringify(registration ?? null));
