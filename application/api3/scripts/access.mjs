import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createNvdAccess,
  probeNvd,
  privatePath,
  fail,
  AccessError,
  ACCESS_CHAIN_ID,
  AUSD,
} from "../src/access.mjs";

process.umask(0o077);
const textFile = (path, max = 250000) => {
  path = privatePath(path);
  const bytes = readFileSync(path);
  if (bytes.length > max)
    fail("PRIVATE_FILE_LIMIT", "The private input exceeds its supported size.");
  return bytes.toString("utf8");
};
const writePrivate = (path, text) => {
  path = privatePath(path);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, text, { flag: "wx", mode: 0o600 });
};
const grant = () => {
  if (process.env.PROOFREADY_API3_PAYMENTS_AUTHORIZED !== "true")
    fail(
      "ACCESS_PAYMENT_DISABLED",
      "Signing and submission require an explicit bounded payment grant.",
    );
};
const summary = (state) => ({
  id: state.id,
  stage: state.stage,
  price: "0.01 aUSD",
  authorization: state.stage === "PREPARED" ? "UNSIGNED" : "PRIVATE_LEDGER",
  sourceAuthenticated: Boolean(state.source),
  paymentCurrentlyVerified: state.paymentCurrentlyVerified ?? false,
  transaction:
    state.paymentConfirmation?.transaction ??
    state.settlementClaim?.transaction ??
    null,
  error: state.error,
});
let service;
try {
  const [action, value, extra] = process.argv.slice(2);
  if (action === "probe") {
    const probe = await probeNvd();
    if (value) {
      writePrivate(value, JSON.stringify(probe, null, 2) + "\n");
      console.log(
        JSON.stringify({
          status: 402,
          paid: false,
          price: probe.price,
          requestHash: probe.requestHash,
          saved: true,
        }),
      );
    } else console.log(JSON.stringify(probe, null, 2));
  } else {
    if (
      ![
        "prepare",
        "show",
        "sign",
        "import-signature",
        "send",
        "reconcile",
        "export-response",
        "wallet",
      ].includes(action) ||
      (action !== "wallet" && !value)
    )
      fail(
        "USAGE",
        "Use probe [PRIVATE_FILE], prepare INTENT PROBE_FILE, show ID, sign ID, import-signature ID FILE, send ID, reconcile ID [TX], export-response ID FILE, or wallet.",
      );
    const config = JSON.parse(
      textFile(process.env.PROOFREADY_API3_ACCESS_CONFIG, 16000),
    );
    if (
      config.schema !== "proof-of-ready/api3-access-config/v1" ||
      Object.keys(config).some(
        (k) =>
          ![
            "schema",
            "payer",
            "ledgerFile",
            "budgetAtomicUnits",
            "rpcUrl",
          ].includes(k),
      )
    )
      fail(
        "INVALID_ACCESS_CONFIG",
        "Use the dedicated wallet, private ledger, total budget, and optional Base Sepolia RPC configuration.",
      );
    let client = null;
    if (config.rpcUrl) {
      const url = new URL(config.rpcUrl);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !(
          url.protocol === "https:" ||
          (url.protocol === "http:" &&
            ["127.0.0.1", "localhost"].includes(url.hostname))
        )
      )
        fail(
          "INVALID_ACCESS_RPC",
          "Use HTTPS or a local HTTP RPC without URL credentials.",
        );
      client = createPublicClient({
        transport: http(url.href, { retryCount: 0, timeout: 15000 }),
      });
    }
    if (action === "wallet") {
      if (!client || (await client.getChainId()) !== ACCESS_CHAIN_ID)
        fail(
          "ACCESS_CHAIN_MISMATCH",
          "Use a Base Sepolia reader for the selected wallet.",
        );
      const [gasWei, tokenAtomic] = await Promise.all([
        client.getBalance({ address: config.payer }),
        client.readContract({
          address: AUSD,
          abi: [
            {
              type: "function",
              name: "balanceOf",
              stateMutability: "view",
              inputs: [{ type: "address", name: "owner" }],
              outputs: [{ type: "uint256" }],
            },
          ],
          functionName: "balanceOf",
          args: [config.payer],
        }),
      ]);
      console.log(
        JSON.stringify({
          chainId: ACCESS_CHAIN_ID,
          gasWei: gasWei.toString(),
          aUsdAtomicUnits: tokenAtomic.toString(),
          costPerCallAtomicUnits: "10000",
          networkWrites: false,
        }),
      );
    } else {
      service = createNvdAccess({
        ...config,
        client,
        paymentsAuthorized:
          process.env.PROOFREADY_API3_PAYMENTS_AUTHORIZED === "true",
      });
      let state;
      if (action === "prepare") {
        state = service.prepare(value, JSON.parse(textFile(extra)));
        console.log(
          JSON.stringify({ ...summary(state), plan: state.plan }, null, 2),
        );
      }
      if (action === "show")
        console.log(JSON.stringify(summary(service.get(value)), null, 2));
      if (action === "sign") {
        grant();
        const privateKey = textFile(
          process.env.PROOFREADY_API3_PRIVATE_KEY_FILE,
          256,
        ).trim();
        if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey))
          fail(
            "INVALID_ACCESS_KEY",
            "Use the dedicated test-wallet key from its private file.",
          );
        state = await service.sign(value, privateKeyToAccount(privateKey));
        console.log(JSON.stringify(summary(state), null, 2));
      }
      if (action === "import-signature") {
        grant();
        state = await service.importSignature(
          value,
          textFile(extra, 256).trim(),
        );
        console.log(JSON.stringify(summary(state), null, 2));
      }
      if (action === "send") {
        grant();
        state = await service.send(value);
        console.log(JSON.stringify(summary(state), null, 2));
      }
      if (action === "reconcile") {
        state = await service.reconcile(value, extra);
        console.log(JSON.stringify(summary(state), null, 2));
      }
      if (action === "export-response") {
        state = service.get(value);
        if (!state.source || !state.rawResponseText)
          fail(
            "SOURCE_UNAVAILABLE",
            "The original request has no authenticated saved source response.",
          );
        writePrivate(extra, state.rawResponseText);
        console.log(
          JSON.stringify({
            exported: true,
            sourceAuthenticated: true,
            paymentCurrentlyVerified: state.paymentCurrentlyVerified ?? false,
          }),
        );
      }
    }
  }
} catch (error) {
  console.error(
    `${error instanceof AccessError ? error.code : "ACCESS_COMMAND_FAILED"}: ${error instanceof AccessError ? error.message : "Inspect private configuration and the saved original request. No automatic retry occurred."}`,
  );
  process.exitCode = 1;
} finally {
  service?.close();
}
