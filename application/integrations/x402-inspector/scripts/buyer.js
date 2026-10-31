import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  fsyncSync,
} from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { x402Client } from "@x402/core/client";
import { ExactCardanoScheme } from "@x402/cardano/exact/client";
import { toClientCardanoSigner, decodeCardanoTransaction } from "@x402/cardano";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import {
  NETWORK,
  AMOUNT,
  BLOCKFROST_URL,
  requirements,
} from "../../../src/payment.js";
import { privateStateDirectory } from "../../masumi/src/setup.js";
process.umask(0o077);
const [command, value] = process.argv.slice(2);
if (
  !["create", "prepare", "send", "reconcile", "inspect", "show"].includes(
    command,
  ) ||
  !value
)
  throw new Error(
    "Use create REQUEST_FILE or prepare|send|reconcile|inspect|show INSPECTION_ID.",
  );
const origin = process.env.X402_INSPECTOR_URL ?? "http://127.0.0.1:4024";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
  throw new Error("Use the loopback inspection service.");
const request = async (path, body, headers = {}) => {
  const r = await fetch(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(config ? { "x-inspector-token": config.token } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(120000),
  });
  const result = await r.json();
  if (!r.ok && r.status !== 402)
    throw new Error(
      `${result.code ?? r.status}: ${result.error ?? "Read the original inspection state."}`,
    );
  return result;
};
let config;
config = await request("/api/config");
if (config.network !== NETWORK || config.mode !== "preprod")
  throw new Error("The service is not Cardano Preprod.");
if (command === "create") {
  console.log(
    JSON.stringify(
      await request(
        "/api/inspections",
        JSON.parse(readFileSync(value, "utf8")),
      ),
      null,
      2,
    ),
  );
} else {
  if (!/^[0-9a-f]{16}$/.test(value))
    throw new Error("Use the original inspection ID.");
  const id = value,
    path = `/api/inspections/${id}`;
  const job = await request(path);
  const dir = privateStateDirectory(process.env.X402_INSPECTOR_BUYER_STATE_DIR);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, `${id}.json`);
  const claim = (path) => {
    const fd = openSync(path, "wx", 0o600);
    fsyncSync(fd);
    closeSync(fd);
  };
  if (command === "prepare") {
    if (
      process.env.X402_INSPECTOR_SPEND_AUTHORIZED !== "true" ||
      !config.spendAuthorized
    )
      throw new Error("Authorize the exact Preprod request before signing.");
    if (job.state !== "AWAITING_PAYMENT")
      throw new Error("Preserve and reconcile the original payment attempt.");
    if (
      !process.env.MNEMONIC ||
      !process.env.BLOCKFROST_API_KEY_PREPROD?.startsWith("preprod")
    )
      throw new Error(
        "Load the dedicated buyer and Preprod chain reader privately.",
      );
    const quote = await request(path + "/payment", {});
    const expected = requirements(process.env.SELLER_ADDRESS);
    if (
      quote.x402Version !== 2 ||
      quote.accepts?.length !== 1 ||
      !isDeepStrictEqual(quote.accepts[0], expected) ||
      !isDeepStrictEqual(job.requirements, expected)
    )
      throw new Error(
        "The quote differs from the approved seller and 2 tADA limit.",
      );
    claim(file + ".intent");
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
          projectId: process.env.BLOCKFROST_API_KEY_PREPROD,
        },
      },
    });
    client.register(NETWORK, new ExactCardanoScheme(signer));
    const payload = await client.createPaymentPayload(quote);
    const transaction = decodeCardanoTransaction(
      payload.payload.transaction,
    ).txHash;
    const fd = openSync(file, "wx", 0o600);
    try {
      writeFileSync(
        fd,
        JSON.stringify({ origin, id, transaction, payload }) + "\n",
      );
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    console.log(JSON.stringify({ id, transaction, submitted: false }));
  } else if (command === "send") {
    if (
      process.env.X402_INSPECTOR_SPEND_AUTHORIZED !== "true" ||
      !config.spendAuthorized
    )
      throw new Error("Authorize the exact Preprod request before submission.");
    const saved = JSON.parse(readFileSync(file, "utf8"));
    if (
      saved.origin !== origin ||
      saved.id !== id ||
      decodeCardanoTransaction(saved.payload.payload.transaction).txHash !==
        saved.transaction
    )
      throw new Error("The original transaction binding changed.");
    claim(file + ".send");
    console.log(
      JSON.stringify(
        await request(
          path + "/payment",
          {},
          { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(saved.payload) },
        ),
        null,
        2,
      ),
    );
  } else {
    console.log(
      JSON.stringify(
        await request(
          path + (command === "show" ? "" : "/" + command),
          command === "show" ? undefined : {},
        ),
        null,
        2,
      ),
    );
  }
}
