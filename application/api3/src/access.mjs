import { decodeEventLog, parseAbi } from "viem";
import { NVD_SIGNER, NVD_REQUEST_HASH, verifyNvdResponse } from "./index.mjs";
import { openAccessLedger } from "./access-ledger.mjs";
import {
  ACCESS_CHAIN_ID,
  ACCESS_NETWORK,
  AUSD,
  PAY_TO,
  NVD_URL,
  REQUEST_TEXT,
  address,
  sameAddress,
  makePlan,
  validatePlan,
  paymentPayload,
  encodeHeader,
  decodeHeader,
  boundedText,
  fail,
  AccessError,
} from "./access-policy.mjs";
export * from "./access-policy.mjs";
export { privatePath } from "./access-ledger.mjs";

const paymentEvents = parseAbi([
  "event Transfer(address indexed from,address indexed to,uint256 value)",
  "event AuthorizationUsed(address indexed authorizer,bytes32 indexed nonce)",
]);
const transactionHash = (value) =>
  typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);

export function validateSettlementClaim(header, payer) {
  const claim = decodeHeader(header);
  if (
    !claim ||
    claim.network !== ACCESS_NETWORK ||
    (claim.payer && !sameAddress(claim.payer, payer)) ||
    typeof claim.success !== "boolean" ||
    (claim.transaction && !transactionHash(claim.transaction))
  )
    fail(
      "SETTLEMENT_CLAIM_MISMATCH",
      "The settlement claim identifies another network, payer, or transaction.",
    );
  return claim;
}

export async function confirmAccessPayment({
  client,
  plan,
  transaction,
  confirmations = 1,
}) {
  validatePlan(plan);
  if (
    !client ||
    !transactionHash(transaction) ||
    !Number.isInteger(confirmations) ||
    confirmations < 1 ||
    confirmations > 20
  )
    fail(
      "INVALID_ACCESS_CONFIRMATION",
      "Use the original payment hash and a bounded confirmation policy.",
    );
  if ((await client.getChainId()) !== ACCESS_CHAIN_ID)
    fail("ACCESS_CHAIN_MISMATCH", "The reader is connected to another chain.");
  const receipt = await client.getTransactionReceipt({ hash: transaction });
  if (
    receipt.transactionHash?.toLowerCase() !== transaction.toLowerCase() ||
    receipt.status !== "success" ||
    !/^0x[0-9a-fA-F]{64}$/.test(receipt.blockHash ?? "")
  )
    fail(
      "ACCESS_PAYMENT_REJECTED",
      "The original payment has no matching successful receipt.",
    );
  const current = await client.getBlockNumber();
  if (current < receipt.blockNumber + BigInt(confirmations))
    fail(
      "ACCESS_CONFIRMATIONS_PENDING",
      "The original transfer still needs the configured confirmation depth.",
    );
  const decoded = [];
  for (const log of receipt.logs ?? []) {
    if (log.removed || !sameAddress(log.address, AUSD)) continue;
    try {
      decoded.push(
        decodeEventLog({
          abi: paymentEvents,
          data: log.data,
          topics: log.topics,
          strict: true,
        }),
      );
    } catch {
      /* Other token events do not establish this payment. */
    }
  }
  const authorization = plan.typedData.message;
  const transfers = decoded.filter(
    (event) =>
      event.eventName === "Transfer" &&
      sameAddress(event.args.from, authorization.from) &&
      sameAddress(event.args.to, PAY_TO) &&
      event.args.value === BigInt(authorization.value),
  );
  const uses = decoded.filter(
    (event) =>
      event.eventName === "AuthorizationUsed" &&
      sameAddress(event.args.authorizer, authorization.from) &&
      event.args.nonce === authorization.nonce,
  );
  if (transfers.length !== 1 || uses.length !== 1)
    fail(
      "ACCESS_PAYMENT_MISMATCH",
      "The receipt lacks the exact token transfer and original authorization nonce.",
    );
  return {
    verified: true,
    checkedAt: Date.now(),
    chainId: ACCESS_CHAIN_ID,
    transaction,
    asset: AUSD,
    payer: authorization.from,
    payTo: PAY_TO,
    amountAtomicUnits: authorization.value,
    nonce: authorization.nonce,
    blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber.toString(),
    confirmations: Number(current - receipt.blockNumber),
    trust:
      "Pinned aUSD contract semantics and the configured RPC's canonical transaction receipt and block count.",
  };
}

/** Payment and result delivery remain separate. No operation automatically retries HTTP or signing. */
export function createNvdAccess({
  ledgerFile,
  payer,
  budgetAtomicUnits = "20000",
  paymentsAuthorized = false,
  fetcher = fetch,
  client = null,
  now = () => Math.floor(Date.now() / 1000),
  verifyResponse = verifyNvdResponse,
}) {
  payer = address(payer);
  const ledger = openAccessLedger(ledgerFile, {
    identity: {
      endpoint: NVD_URL,
      requestHash: NVD_REQUEST_HASH,
      payer,
      network: ACCESS_NETWORK,
      asset: AUSD,
      payTo: PAY_TO,
      sourceSigner: NVD_SIGNER,
    },
    budgetAtomicUnits,
  });
  const grant = () => {
    if (paymentsAuthorized !== true)
      fail(
        "ACCESS_PAYMENT_DISABLED",
        "Signing and submission require an explicit bounded payment grant.",
      );
  };
  const fresh = (plan) => {
    validatePlan(plan);
    if (
      now() >= Number(plan.typedData.message.validBefore) ||
      now() <= Number(plan.typedData.message.validAfter)
    )
      fail(
        "ACCESS_AUTHORIZATION_EXPIRED",
        "The original authorization is outside its validity window. Do not renew it automatically.",
      );
  };
  const recordError = (id, error) =>
    ledger.change(id, (s) => ({
      ...s,
      error: {
        code:
          error instanceof AccessError
            ? error.code
            : "ACCESS_OPERATION_UNCERTAIN",
        message:
          "Inspect the original saved request and payment. No automatic repeat or replacement occurs.",
      },
    }));
  const bindSignature = async (id, signature) => {
    grant();
    const original = ledger.get(id);
    fresh(original.plan);
    if (!["PREPARED", "SIGNING"].includes(original.stage))
      fail(
        "ACCESS_SIGNING_CLAIMED",
        "The original authorization already has a signing or submission record.",
      );
    const payload = await paymentPayload(original.plan, signature);
    return ledger.change(id, (current) => {
      if (
        !["PREPARED", "SIGNING"].includes(current.stage) ||
        current.plan.typedData.message.nonce !==
          original.plan.typedData.message.nonce
      )
        fail(
          "ACCESS_CONFLICT",
          "Another process changed the original authorization.",
        );
      return {
        ...current,
        stage: "SIGNED",
        payment: { payload, encodedHeader: encodeHeader(payload) },
        error: null,
      };
    });
  };
  return {
    prepare(intent, probe) {
      return ledger.create(intent, () => makePlan(probe, payer, now()), now());
    },
    get: (id) => ledger.get(id),
    async sign(id, account) {
      grant();
      const claimed = ledger.change(id, (current) => {
        if (current.stage !== "PREPARED")
          fail(
            "ACCESS_SIGNING_CLAIMED",
            "The original signing operation is pending or complete. Import its original signature for recovery.",
          );
        fresh(current.plan);
        if (
          !sameAddress(account?.address, payer) ||
          typeof account?.signTypedData !== "function"
        )
          fail(
            "ACCESS_WALLET_MISMATCH",
            "Use the dedicated wallet pinned to this access ledger.",
          );
        return { ...current, stage: "SIGNING", error: null };
      });
      try {
        return await bindSignature(
          id,
          await account.signTypedData(claimed.plan.typedData),
        );
      } catch (error) {
        recordError(id, error);
        throw error;
      }
    },
    importSignature: bindSignature,
    async send(id) {
      grant();
      const claimed = ledger.change(id, (current) => {
        if (current.stage !== "SIGNED")
          fail(
            "ACCESS_SUBMISSION_CLAIMED",
            "The original payment is pending or already submitted. Reconcile it without another HTTP retry.",
          );
        fresh(current.plan);
        return {
          ...current,
          stage: "SUBMITTING",
          submittedAt: now(),
          error: null,
        };
      });
      let response, rawText, paymentHeader;
      try {
        response = await fetcher(NVD_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "payment-signature": claimed.payment.encodedHeader,
          },
          body: REQUEST_TEXT,
          redirect: "error",
          signal: AbortSignal.timeout(20000),
        });
        paymentHeader = response.headers.get("payment-response");
        // Save any transaction claim before consuming a response stream that can fail.
        ledger.change(id, (s) => ({
          ...s,
          responseStatus: response.status,
          rawPaymentResponseHeader: paymentHeader,
        }));
        const settlementClaim = paymentHeader
          ? validateSettlementClaim(paymentHeader, payer)
          : null;
        ledger.change(id, (s) => ({
          ...s,
          responseStatus: response.status,
          settlementClaim,
        }));
        rawText = await boundedText(response);
        ledger.change(id, (s) => ({
          ...s,
          rawResponseText: rawText,
          receivedAt: now(),
        }));
        if (
          response.status !== 200 ||
          !response.headers.get("content-type")?.startsWith("application/json")
        )
          fail(
            "ACCESS_DELIVERY_UNRESOLVED",
            "The paid request did not return a supported response. Preserve the original authorization and transaction.",
          );
        let signedResponse;
        try {
          signedResponse = JSON.parse(rawText);
        } catch {
          fail(
            "INVALID_NVD_RESPONSE",
            "The delivered response is not valid JSON.",
          );
        }
        const verifiedAt = now();
        const verification = await verifyResponse(signedResponse, {
          now: verifiedAt,
        });
        if (
          verification.authenticated !== true ||
          verification.requestHash !== NVD_REQUEST_HASH
        )
          fail(
            "INVALID_NVD_RESPONSE",
            "The source verifier did not authenticate the approved request.",
          );
        return ledger.change(id, (s) => ({
          ...s,
          stage: "DELIVERED",
          source: { response: signedResponse, verifiedAt, verification },
          error: settlementClaim
            ? null
            : {
                code: "PAYMENT_RECEIPT_MISSING",
                message:
                  "The source result is authenticated. Independent payment confirmation remains required.",
              },
        }));
      } catch (error) {
        return ledger.change(id, (s) => ({
          ...s,
          stage: "UNRESOLVED",
          error: {
            code:
              error instanceof AccessError
                ? error.code
                : "ACCESS_DELIVERY_UNRESOLVED",
            message:
              "The original paid request did not complete verification. Reconcile its payment. Do not resend or create a replacement automatically.",
          },
        }));
      }
    },
    async reconcile(id, transaction) {
      const original = ledger.get(id);
      if (
        ![
          "SUBMITTING",
          "UNRESOLVED",
          "DELIVERED",
          "SETTLED",
          "PAID_UNDELIVERED",
        ].includes(original.stage)
      )
        fail(
          "ACCESS_NOT_SUBMITTED",
          "The original authorization has no submission claim.",
        );
      const hash = transaction ?? original.settlementClaim?.transaction;
      if (
        original.paymentConfirmation?.transaction &&
        hash?.toLowerCase() !==
          original.paymentConfirmation.transaction.toLowerCase()
      )
        fail(
          "ACCESS_TRANSACTION_CONFLICT",
          "This access request already binds another confirmed transaction.",
        );
      try {
        const paymentConfirmation = await confirmAccessPayment({
          client,
          plan: original.plan,
          transaction: hash,
        });
        return ledger.change(id, (s) => ({
          ...s,
          stage: s.source ? "SETTLED" : "PAID_UNDELIVERED",
          paymentConfirmation,
          paymentCurrentlyVerified: true,
          error: null,
        }));
      } catch (error) {
        return ledger.change(id, (s) => ({
          ...s,
          paymentCurrentlyVerified: false,
          error: {
            code:
              error instanceof AccessError
                ? error.code
                : "ACCESS_CHAIN_UNAVAILABLE",
            message:
              "The configured reader did not verify the original payment. No cached confirmation authorizes new spending.",
          },
        }));
      }
    },
    close() {
      ledger.close();
    },
  };
}
