import { randomBytes } from "node:crypto";
import { getAddress, recoverTypedDataAddress } from "viem";
import { NVD_REQUEST, NVD_REQUEST_HASH } from "./index.mjs";

export const NVD_URL = "https://airnode-nvd.fly.dev/";
export const ACCESS_NETWORK = "eip155:84532";
export const ACCESS_CHAIN_ID = 84532;
export const AUSD = "0xbeA34973e5f67F18F656A2C6070C64326C791808";
export const PAY_TO = "0x1505FD562AC2Fb4307B85BC6c672FfeafB4d57A7";
export const ACCESS_AMOUNT = "10000";
export const REQUEST_TEXT = JSON.stringify(NVD_REQUEST);
export class AccessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AccessError";
    this.code = code;
  }
}
export const fail = (code, message) => {
  throw new AccessError(code, message);
};
const object = (value) =>
  value && Object.getPrototypeOf(value) === Object.prototype;
const keys = (value, required, optional = []) =>
  object(value) &&
  required.every((key) => Object.hasOwn(value, key)) &&
  Object.keys(value).every(
    (key) => required.includes(key) || optional.includes(key),
  );
export function address(value) {
  try {
    if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value))
      throw Error();
    return getAddress(value);
  } catch {
    fail(
      "INVALID_ADDRESS",
      "Use an explicitly selected EVM test-wallet address.",
    );
  }
}
export const sameAddress = (left, right) =>
  address(left).toLowerCase() === address(right).toLowerCase();

export function decodeHeader(value) {
  if (
    typeof value !== "string" ||
    value.length < 4 ||
    value.length > 16384 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    fail(
      "INVALID_PAYMENT_HEADER",
      "Use the original bounded x402 Base64 header.",
    );
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value)
    fail("INVALID_PAYMENT_HEADER", "The x402 header encoding changed.");
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(
      "INVALID_PAYMENT_HEADER",
      "The x402 header does not contain supported JSON.",
    );
  }
}
export const encodeHeader = (value) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64");

/** Only the reviewed NVD operation and the observed aUSD/EIP-3009 terms are supported. */
export function validateRequired(required) {
  if (
    !keys(required, ["x402Version", "resource", "accepts"], ["error"]) ||
    required.x402Version !== 2 ||
    !keys(required.resource, ["url", "description", "mimeType"]) ||
    required.resource.url !== NVD_URL ||
    required.resource.mimeType !== "application/json" ||
    required.resource.description !== 'AirnodeHub operation "getCve"' ||
    !Array.isArray(required.accepts) ||
    required.accepts.length !== 1
  )
    fail(
      "PAYMENT_TERMS_MISMATCH",
      "The quote differs from the approved NVD endpoint and operation.",
    );
  const terms = required.accepts[0];
  if (
    !keys(terms, [
      "scheme",
      "network",
      "amount",
      "asset",
      "payTo",
      "maxTimeoutSeconds",
      "extra",
    ]) ||
    terms.scheme !== "exact" ||
    terms.network !== ACCESS_NETWORK ||
    terms.amount !== ACCESS_AMOUNT ||
    !sameAddress(terms.asset, AUSD) ||
    !sameAddress(terms.payTo, PAY_TO) ||
    terms.maxTimeoutSeconds !== 300 ||
    !keys(terms.extra, ["name", "version"], ["assetTransferMethod"]) ||
    terms.extra.name !== "AirnodeHub USD" ||
    terms.extra.version !== "1" ||
    (terms.extra.assetTransferMethod !== undefined &&
      terms.extra.assetTransferMethod !== "eip3009")
  )
    fail(
      "PAYMENT_TERMS_MISMATCH",
      "The network, asset, recipient, amount, timeout, or authorization domain changed.",
    );
  return structuredClone(terms);
}

export const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

export function makePlan(probe, payer, now) {
  if (
    probe?.schema !== "proof-of-ready/api3-unpaid-probe/v1" ||
    probe.endpoint !== NVD_URL ||
    probe.requestHash !== NVD_REQUEST_HASH ||
    probe.requestText !== REQUEST_TEXT ||
    !Number.isSafeInteger(now) ||
    now < 1
  )
    fail(
      "INVALID_PROBE",
      "Use the original unpaid quote for the pinned NVD request.",
    );
  const required = decodeHeader(probe.requiredHeader);
  const accepted = validateRequired(required);
  const message = {
    from: address(payer),
    to: accepted.payTo,
    value: accepted.amount,
    validAfter: String(now - 1),
    validBefore: String(now + accepted.maxTimeoutSeconds),
    nonce: `0x${randomBytes(32).toString("hex")}`,
  };
  const typedData = {
    domain: {
      name: accepted.extra.name,
      version: accepted.extra.version,
      chainId: ACCESS_CHAIN_ID,
      verifyingContract: accepted.asset,
    },
    types: authorizationTypes,
    primaryType: "TransferWithAuthorization",
    message,
  };
  return {
    schema: "proof-of-ready/api3-access-plan/v1",
    authorization: "UNSIGNED",
    endpoint: NVD_URL,
    requestHash: NVD_REQUEST_HASH,
    requestText: REQUEST_TEXT,
    requiredHeader: probe.requiredHeader,
    resource: required.resource,
    accepted,
    typedData,
    price: "0.01 aUSD",
    trust:
      "The EIP-3009 payment binds token, payer, payee, value and nonce. The Airnode signature separately binds the exact API request and data.",
  };
}

export async function paymentPayload(plan, signature) {
  validatePlan(plan);
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature))
    fail(
      "INVALID_ACCESS_SIGNATURE",
      "Use the signature for the original prepared authorization.",
    );
  let recovered;
  try {
    recovered = await recoverTypedDataAddress({ ...plan.typedData, signature });
  } catch {
    fail("INVALID_ACCESS_SIGNATURE", "The authorization signature is invalid.");
  }
  if (!sameAddress(recovered, plan.typedData.message.from))
    fail(
      "INVALID_ACCESS_SIGNATURE",
      "Another wallet signed the authorization.",
    );
  return {
    x402Version: 2,
    resource: plan.resource,
    accepted: plan.accepted,
    payload: { signature, authorization: plan.typedData.message },
  };
}

export function validatePlan(plan) {
  const accepted = validateRequired(decodeHeader(plan?.requiredHeader));
  const message = plan?.typedData?.message;
  if (
    plan.schema !== "proof-of-ready/api3-access-plan/v1" ||
    plan.endpoint !== NVD_URL ||
    plan.requestHash !== NVD_REQUEST_HASH ||
    plan.requestText !== REQUEST_TEXT ||
    JSON.stringify(plan.accepted) !== JSON.stringify(accepted) ||
    JSON.stringify(plan.resource) !==
      JSON.stringify(decodeHeader(plan.requiredHeader).resource) ||
    !keys(message, [
      "from",
      "to",
      "value",
      "validAfter",
      "validBefore",
      "nonce",
    ]) ||
    !sameAddress(message.to, PAY_TO) ||
    message.value !== ACCESS_AMOUNT ||
    !/^[1-9]\d{0,11}$/.test(message.validAfter) ||
    !/^[1-9]\d{0,11}$/.test(message.validBefore) ||
    Number(message.validBefore) - Number(message.validAfter) !== 301 ||
    !/^0x[0-9a-f]{64}$/.test(message.nonce) ||
    JSON.stringify(plan.typedData.domain) !==
      JSON.stringify({
        name: "AirnodeHub USD",
        version: "1",
        chainId: ACCESS_CHAIN_ID,
        verifyingContract: accepted.asset,
      }) ||
    plan.typedData.primaryType !== "TransferWithAuthorization" ||
    JSON.stringify(plan.typedData.types) !== JSON.stringify(authorizationTypes)
  )
    fail(
      "INVALID_ACCESS_PLAN",
      "The prepared authorization differs from the original reviewed NVD terms.",
    );
  address(message.from);
  return plan;
}

export async function boundedText(response, limit = 220000) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        fail(
          "RESPONSE_LIMIT",
          "The original response exceeds the supported limit.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(
    Buffer.concat(chunks),
  );
}

export async function probeNvd({
  fetcher = fetch,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  const response = await fetcher(NVD_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: REQUEST_TEXT,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  const text = await boundedText(response, 16384);
  if (
    response.status !== 402 ||
    !response.headers.get("content-type")?.startsWith("application/json")
  )
    fail(
      "UNEXPECTED_PROBE_RESPONSE",
      "The unpaid NVD request did not return the expected x402 quote.",
    );
  const requiredHeader = response.headers.get("payment-required");
  const required = decodeHeader(requiredHeader);
  validateRequired(required);
  return {
    schema: "proof-of-ready/api3-unpaid-probe/v1",
    endpoint: NVD_URL,
    requestHash: NVD_REQUEST_HASH,
    requestText: REQUEST_TEXT,
    checkedAt: now(),
    status: 402,
    requiredHeader,
    responseText: text,
    required,
    price: "0.01 aUSD",
    paid: false,
  };
}
