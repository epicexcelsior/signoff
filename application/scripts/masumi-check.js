import { HTTPFacilitatorClient } from "@x402/core/server";
import {
  masumiEscrowAddress,
  MASUMI_MIN_PAY_TO_SUBMIT_MS,
  MASUMI_MIN_SUBMIT_TO_UNLOCK_MS,
  MASUMI_MIN_UNLOCK_TO_DISPUTE_MS,
  MASUMI_MIN_SUBMIT_RESULT_LEAD_MS,
} from "@x402/cardano";

// Read-only availability check. No wallet, registry write, quote signature, or payment exists here.
const url =
  process.env.FACILITATOR_URL ??
  "https://x402.preprod.dev.ecosyseng.cf-deployments.org";
const parsed = new URL(url);
if (
  parsed.protocol !== "https:" ||
  parsed.username ||
  parsed.password ||
  parsed.search ||
  parsed.hash
) {
  throw new Error("Use an HTTPS facilitator URL without credentials.");
}
const supported = await new HTTPFacilitatorClient({
  url,
  timeoutMs: 15000,
}).getSupported();
const kind = supported.kinds.find(
  (item) =>
    item.x402Version === 2 &&
    item.scheme === "exact" &&
    item.network === "cardano:preprod",
);
if (!kind?.extra?.assetTransferMethods?.includes("masumi")) {
  throw new Error(
    "This facilitator does not advertise Masumi on Cardano Preprod.",
  );
}
console.log(
  JSON.stringify(
    {
      network: kind.network,
      masumi_advertised: true,
      escrow_address: masumiEscrowAddress("cardano:preprod"),
      confirmation_range: kind.extra.l1Confirmations,
      minimum_minutes: {
        pay_to_submit: Number(MASUMI_MIN_PAY_TO_SUBMIT_MS) / 60000,
        submit_to_unlock: Number(MASUMI_MIN_SUBMIT_TO_UNLOCK_MS) / 60000,
        unlock_to_dispute: Number(MASUMI_MIN_UNLOCK_TO_DISPUTE_MS) / 60000,
        submit_result_lead: Number(MASUMI_MIN_SUBMIT_RESULT_LEAD_MS) / 60000,
      },
      scope:
        "Availability only. FieldProof does not implement the Masumi escrow lifecycle yet.",
    },
    null,
    2,
  ),
);
