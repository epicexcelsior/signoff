import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import {
  prepareDeployment,
  estimateDeployment,
  judgeReadOnly,
  verifyFinalization,
} from "../src/judge.mjs";
import { privatePath, AccessError, fail } from "../src/access.mjs";
process.umask(0o077);
try {
  const [action, configFile, outputFile] = process.argv.slice(2);
  if (!["deploy-plan", "check", "finalized"].includes(action))
    fail(
      "JUDGE_USAGE",
      "Use deploy-plan, check, or finalized with PRIVATE_CONFIG PRIVATE_OUTPUT.",
    );
  const config = JSON.parse(readFileSync(privatePath(configFile), "utf8"));
  if (config.schema !== "proof-of-ready/api3-judge-config/v1")
    fail(
      "JUDGE_CONFIG",
      "Use the private deployment and original response configuration.",
    );
  const url = new URL(config.rpcUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    fail(
      "JUDGE_RPC",
      "Use an explicit HTTPS Base Sepolia RPC without URL credentials.",
    );
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(url.href, { retryCount: 0, timeout: 20000 }),
  });
  let result;
  if (action === "deploy-plan") {
    if (!isAbsolute(config.artifactFile))
      fail(
        "JUDGE_ARTIFACT",
        "Use the absolute reviewed local compiler artifact path.",
      );
    const artifact = JSON.parse(readFileSync(config.artifactFile, "utf8"));
    result = await estimateDeployment({
      client,
      plan: prepareDeployment({ artifact, operator: config.operator }),
    });
  } else {
    const response = (name) =>
      JSON.parse(readFileSync(privatePath(config[name]), "utf8"));
    const check = await judgeReadOnly({
      client,
      contract: config.contract,
      runtimeCodeHash: config.runtimeCodeHash,
      jobId: config.jobId,
      blockNumber:
        config.blockNumber === undefined
          ? undefined
          : BigInt(config.blockNumber),
      validResponse: response("validResponseFile"),
      staleResponse: response("staleResponseFile"),
      wrongRequestResponse: response("wrongRequestResponseFile"),
      wrongKeyResponse: response("wrongKeyResponseFile"),
    });
    result =
      action === "finalized"
        ? await verifyFinalization({
            client,
            check,
            transactionHash: config.finalizedTransactionHash,
          })
        : check;
  }
  const output = privatePath(outputFile);
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
  writeFileSync(output, JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      saved: true,
      authorization: "UNSIGNED",
      networkWrites: false,
      chainId: 84532,
      fees: result.fees ?? null,
      results: result.results ?? null,
    }),
  );
} catch (error) {
  console.error(
    `${error instanceof AccessError ? error.code : "JUDGE_PREPARATION_FAILED"}: ${error instanceof AccessError ? error.message : "Inspect the pinned configuration and original evidence. No signing or broadcast occurred."}`,
  );
  process.exitCode = 1;
}
