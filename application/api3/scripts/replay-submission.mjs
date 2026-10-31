import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { judgeReadOnly, verifyFinalization } from "../src/judge.mjs";

// Public originals only. This command has no wallet, signing, or payment client.
const original = (name) =>
  JSON.parse(
    readFileSync(new URL(`../../submission/evidence/${name}`, import.meta.url)),
  );
try {
  const deployment = original("deployment.json");
  const savedCheck = original("api3-five-deployed-cases.json");
  const savedProof = original("api3-finalization-proof.json");
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org", {
      retryCount: 0,
      timeout: 20000,
    }),
  });
  const check = await judgeReadOnly({
    client,
    contract: deployment.contract,
    runtimeCodeHash: deployment.runtimeCodeHash,
    jobId: savedCheck.jobId,
    blockNumber: BigInt(savedCheck.blockNumber),
    validResponse: original("nvd-paid-final-original.json"),
    staleResponse: original("nvd-paid-first-original.json"),
    wrongRequestResponse: original("api3-other-request-original.json"),
    wrongKeyResponse: original("api3-wrong-key-deliberate-test.json"),
  });
  assert.deepEqual(check, savedCheck);
  const proof = await verifyFinalization({
    client,
    check,
    transactionHash: savedProof.transactionHash,
  });
  assert.deepEqual(proof, savedProof);
  console.log(
    JSON.stringify(
      {
        networkWrites: false,
        historical: true,
        judgeBlockNumber: check.blockNumber,
        results: check.results,
        nativeSourcePolicy: check.validSourcePolicy,
        finalization: proof,
        scope:
          "Historical paid REVIEW on synthetic input. No physical acceptance or current installation authorization.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    `SUBMISSION_REPLAY_FAILED: ${error.code ?? error.name}. Check the original public artifacts and historical RPC availability. No transaction was sent.`,
  );
  process.exitCode = 1;
}
