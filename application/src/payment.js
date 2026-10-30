import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { blockfrostQueries, decodeCardanoTransaction } from "@x402/cardano";
import { AppError } from "./store.js";

export const NETWORK = "cardano:preprod";
export const AMOUNT = "2000000";
export const BLOCKFROST_URL = "https://cardano-preprod.blockfrost.io/api/v0";

export function requirements(payTo) {
  return {
    scheme: "exact",
    network: NETWORK,
    amount: AMOUNT,
    asset: "lovelace",
    payTo,
    maxTimeoutSeconds: 600,
    extra: {
      assetTransferMethod: "default",
      confirmationPolicy: { l1Confirmations: 1 },
    },
  };
}

export function paymentRequired(job, origin) {
  return {
    x402Version: 2,
    resource: {
      url: `${origin}/api/jobs/${job.id}/payment`,
      description: "One fresh signed gate observation",
      mimeType: "application/json",
    },
    accepts: [job.requirements],
  };
}

export function makePayment(config, fetcher = fetch) {
  if (config.mode === "simulation") {
    return {
      identify(payload, job) {
        if (!isDeepStrictEqual(payload, { simulation: job.id }))
          throw new AppError(
            "INVALID_PAYMENT",
            "Use the simulation payment for this check.",
            400,
          );
        return `simulated-${createHash("sha256").update(job.id).digest("hex")}`;
      },
      async verify() {
        return { isValid: true };
      },
      async settle(_payload, _requirements, transaction) {
        return { success: true, transaction, network: "simulation" };
      },
      async confirm() {
        return true;
      },
    };
  }
  const facilitator = new HTTPFacilitatorClient({
    url: config.facilitatorUrl,
    timeoutMs: 85000,
  });
  const chain = blockfrostQueries({
    timeoutMs: 15000,
    blockfrost: { baseUrl: BLOCKFROST_URL, projectId: config.projectId },
  });
  return {
    identify(payload, job) {
      if (
        !payload ||
        payload.x402Version !== 2 ||
        !isDeepStrictEqual(payload.accepted, job.requirements) ||
        typeof payload.payload?.transaction !== "string" ||
        typeof payload.payload?.nonce !== "string"
      ) {
        throw new AppError(
          "INVALID_PAYMENT",
          "The signed payment must match this check's exact Preprod requirements.",
          400,
        );
      }
      let decoded;
      try {
        decoded = decodeCardanoTransaction(payload.payload.transaction);
      } catch {
        throw new AppError(
          "INVALID_PAYMENT",
          "The Cardano transaction cannot be decoded.",
          400,
        );
      }
      if (
        !decoded.outputs.some(
          (output) =>
            output.address === job.requirements.payTo &&
            output.coin >= BigInt(AMOUNT),
        )
      ) {
        throw new AppError(
          "INVALID_PAYMENT",
          "The transaction does not pay the configured observation provider.",
          400,
        );
      }
      return decoded.txHash;
    },
    verify: (payload, req) => facilitator.verify(payload, req),
    settle: (payload, req) => facilitator.settle(payload, req),
    async confirm(transaction, req) {
      const evidence = await chain.evidence(transaction);
      if (evidence.status !== "confirmed" || evidence.confirmations < 1)
        return false;
      const response = await fetcher(
        `${BLOCKFROST_URL}/txs/${transaction}/utxos`,
        {
          headers: { project_id: config.projectId },
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok)
        throw new AppError(
          "CHAIN_UNAVAILABLE",
          "The chain provider cannot check the original payment.",
          503,
        );
      const utxos = await response.json();
      return (
        Array.isArray(utxos.outputs) &&
        utxos.outputs.some(
          (output) =>
            output.address === req.payTo &&
            Array.isArray(output.amount) &&
            output.amount.some(
              (asset) =>
                asset.unit === "lovelace" &&
                typeof asset.quantity === "string" &&
                /^[0-9]+$/.test(asset.quantity) &&
                BigInt(asset.quantity) >= BigInt(req.amount),
            ),
        )
      );
    },
  };
}
