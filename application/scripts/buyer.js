import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  fsyncSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { isDeepStrictEqual } from "node:util";
import { x402Client } from "@x402/core/client";
import { ExactCardanoScheme } from "@x402/cardano/exact/client";
import { toClientCardanoSigner, decodeCardanoTransaction } from "@x402/cardano";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import { AMOUNT, NETWORK, BLOCKFROST_URL } from "../src/payment.js";

// Explicit prepare/send/reconcile commands prevent a timeout from causing a fresh signature.
process.umask(0o077);
const [command, id] = process.argv.slice(2);
if (
  !["prepare", "send", "reconcile", "observe"].includes(command) ||
  !/^[0-9a-f]{16}$/.test(id ?? "")
) {
  throw new Error(
    "Use npm run buyer -- prepare|send|reconcile|observe CHECK_ID.",
  );
}
const origin = process.env.FIELDPROOF_URL ?? "http://127.0.0.1:4021";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
  throw new Error("Use a local FieldProof URL.");
const request = async (path, body, extraHeaders = {}) => {
  const response = await fetch(`${origin}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "X-Fieldproof-Token": config.token,
            ...extraHeaders,
          },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(120000),
  });
  const result = await response.json();
  if (!response.ok && response.status !== 402)
    throw new Error(result.error ?? `HTTP ${response.status}`);
  return result;
};
const config = await request("/api/config");
if (config.mode !== "preprod")
  throw new Error(
    "The buyer requires a Preprod server. Use the browser for simulation.",
  );
const path = `/api/jobs/${id}`;
const job = await request(path);
const stateDir = resolve(
  process.env.FIELDPROOF_BUYER_STATE_DIR ??
    join(homedir(), ".local/state/fieldproof-cardano-buyer"),
);
mkdirSync(stateDir, { recursive: true, mode: 0o700 });
const file = join(stateDir, `${id}.json`);
if (command === "prepare") {
  if (
    process.env.FIELDPROOF_SPEND_AUTHORIZED !== "true" ||
    !config.spend_authorized
  ) {
    throw new Error(
      "Explicit operator authorization is required before signing a payment.",
    );
  }
  if (job.state !== "AWAITING_PAYMENT")
    throw new Error(
      "This check already has a payment attempt. Reconcile the original payment.",
    );
  if (
    !process.env.MNEMONIC ||
    !process.env.BLOCKFROST_PROJECT_ID?.startsWith("preprod")
  ) {
    throw new Error(
      "Configure a dedicated Preprod mnemonic and Blockfrost project identifier.",
    );
  }
  const required = await request(`${path}/payment`, {});
  const expected = job.requirements;
  if (
    required.x402Version !== 2 ||
    required.accepts.length !== 1 ||
    !isDeepStrictEqual(required.accepts[0], expected) ||
    expected.network !== NETWORK ||
    expected.asset !== "lovelace" ||
    expected.amount !== AMOUNT ||
    expected.payTo !== process.env.SELLER_ADDRESS ||
    expected.extra?.assetTransferMethod !== "default"
  ) {
    throw new Error(
      "The quote does not match the explicitly configured seller and 2 tADA limit.",
    );
  }
  // The exclusive intent survives a failed preparation. Never sign twice after an ambiguous local crash.
  const intent = openSync(`${file}.intent`, "wx", 0o600);
  fsyncSync(intent);
  closeSync(intent);
  const client = new x402Client().setSpendControls({
    allowedAssets: [
      { network: NETWORK, asset: "lovelace", maxAmountPerPayment: AMOUNT },
    ],
  });
  const signer = toClientCardanoSigner({
    mnemonic: process.env.MNEMONIC,
    network: NETWORK,
    provider: {
      blockfrost: {
        baseUrl: BLOCKFROST_URL,
        projectId: process.env.BLOCKFROST_PROJECT_ID,
      },
    },
  });
  client.register(NETWORK, new ExactCardanoScheme(signer));
  const payload = await client.createPaymentPayload(required);
  const transaction = decodeCardanoTransaction(
    payload.payload.transaction,
  ).txHash;
  const descriptor = openSync(file, "wx", 0o600);
  try {
    writeFileSync(
      descriptor,
      JSON.stringify({ origin, id, transaction, payload }),
    );
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  console.log(
    `Prepared ${transaction}. No payment was submitted. Run the send command for this check.`,
  );
} else if (command === "send") {
  if (process.env.FIELDPROOF_SPEND_AUTHORIZED !== "true")
    throw new Error(
      "Explicit operator authorization is required before submission.",
    );
  const saved = JSON.parse(readFileSync(file, "utf8"));
  if (
    saved.origin !== origin ||
    saved.id !== id ||
    decodeCardanoTransaction(saved.payload.payload.transaction).txHash !==
      saved.transaction
  ) {
    throw new Error(
      "The saved payment does not match this server, check, or transaction.",
    );
  }
  // A send marker forbids automatic or accidental resubmission, even after a lost HTTP response.
  const marker = openSync(`${file}.send`, "wx", 0o600);
  fsyncSync(marker);
  closeSync(marker);
  const result = await request(
    `${path}/payment`,
    {},
    { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(saved.payload) },
  );
  console.log(
    JSON.stringify(
      { id, state: result.state, payment: result.payment, error: result.error },
      null,
      2,
    ),
  );
} else {
  const result = await request(`${path}/${command}`, {});
  console.log(JSON.stringify(result, null, 2));
}
