import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodePacked,
  http,
  keccak256,
  sha256,
  stringToHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { NVD_REQUEST_HASH } from "../src/index.mjs";
import {
  commissioningAbi,
  prepareEnrollBuild,
  prepareOpenJob,
  prepareRecordInspection,
  prepareFinalize,
  readAcceptance,
  sourceResponseDigest,
} from "../src/abi.mjs";

test(
  "local Anvil contract governs acceptance and JS reads the same commitments",
  { timeout: 30000 },
  async () => {
    const foundryBin = process.env.FIELDPROOF_FOUNDRY_BIN;
    assert.ok(
      foundryBin,
      "Set FIELDPROOF_FOUNDRY_BIN to a directory with Foundry forge and anvil",
    );
    const forge = join(resolve(foundryBin), "forge");
    const anvil = join(resolve(foundryBin), "anvil");
    const version = spawnSync(forge, ["--version"], { encoding: "utf8" });
    assert.match(
      version.stdout ?? "",
      /^forge Version:/,
      "The forge command must be Foundry",
    );
    const here = dirname(fileURLToPath(import.meta.url));
    const contracts = resolve(here, "../../contracts");
    const compiled = spawnSync(forge, ["build", "--quiet"], {
      cwd: contracts,
      encoding: "utf8",
    });
    assert.equal(compiled.status, 0, compiled.stderr);
    const artifact = JSON.parse(
      await readFile(
        join(contracts, "out/CommissioningPolicy.sol/CommissioningPolicy.json"),
        "utf8",
      ),
    );
    assert.deepEqual(
      artifact.abi,
      commissioningAbi,
      "Regenerate the exported ABI after contract changes",
    );
    const body = await readFile(
      new URL("./fixtures/nvd-cve-unsigned-projection.json", import.meta.url),
      "utf8",
    );
    const time =
      Math.floor(Date.parse(`${JSON.parse(body).sourceGeneratedAt}Z`) / 1000) +
      1;
    const reservation = createServer();
    await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    const key = generatePrivateKey(); // Disposable local-chain fixture only.
    const account = privateKeyToAccount(key);
    const proc = spawn(
      anvil,
      [
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--timestamp",
        String(time),
        "--accounts",
        "0",
        "--fund-accounts",
        `${account.address}:100`,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    try {
      await new Promise((resolve, reject) => {
        let output = "";
        const timeout = setTimeout(
          () => reject(new Error("Local Anvil did not start")),
          10000,
        );
        proc.once("error", reject);
        proc.once("exit", () => {
          clearTimeout(timeout);
          reject(new Error("Local Anvil exited before startup"));
        });
        proc.stdout.on("data", (chunk) => {
          output = (output + chunk).slice(-4096);
          if (output.includes("Listening on")) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      const chain = defineChain({
        id: 31337,
        name: "Local commissioning fixture",
        nativeCurrency: { name: "Fixture ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [`http://127.0.0.1:${port}`] } },
      });
      const client = createPublicClient({ chain, transport: http() });
      const wallet = createWalletClient({ account, chain, transport: http() });
      const deployment = await wallet.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode.object,
        args: [
          account.address,
          account.address,
          NVD_REQUEST_HASH,
          300n,
          86400n,
        ],
      });
      const receipt = await client.waitForTransactionReceipt({
        hash: deployment,
      });
      assert.equal(receipt.status, "success");
      const config = { chainId: 31337, contract: receipt.contractAddress };
      const commitment = (text) => sha256(stringToHex(text));
      const jobId = commitment("fixture job corrected");
      const expected = {
        workOrderDigest: commitment("fixture approved work order"),
        buildManifestDigest: commitment(
          "fixture declared NimBLE 1.9.0 manifest",
        ),
        inspectionDigest: commitment("fixture inspection passed"),
        paymentEvidenceDigest: commitment("fixture operator payment assertion"),
      };
      const send = async (prepared) => {
        assert.equal(prepared.authorization, "UNSIGNED");
        const hash = await wallet.sendTransaction({
          to: prepared.to,
          data: prepared.data,
          value: 0n,
        });
        assert.equal(
          (await client.waitForTransactionReceipt({ hash })).status,
          "success",
        );
      };
      await send(
        prepareEnrollBuild(config, {
          manifestDigest: expected.buildManifestDigest,
          version: 1_009_000,
        }),
      );
      await send(
        prepareOpenJob(config, { jobId, ...expected, deadline: time + 3600 }),
      );
      await send(
        prepareRecordInspection(config, {
          jobId,
          ...expected,
          passed: true,
          sellerReceived: true,
        }),
      );
      const signedAt = (await client.getBlock()).timestamp;
      const response = {
        airnode: account.address,
        requestHash: NVD_REQUEST_HASH,
        timestamp: String(signedAt),
        data: body,
      };
      response.signature = await account.signMessage({
        message: {
          raw: keccak256(
            encodePacked(
              ["bytes32", "uint256", "bytes"],
              [NVD_REQUEST_HASH, signedAt, stringToHex(body)],
            ),
          ),
        },
      });
      expected.sourceResponseDigest = sourceResponseDigest(response);
      const judgeBlock = await client.getBlock();
      const simulate = (candidate) =>
        client.simulateContract({
          address: config.contract,
          abi: commissioningAbi,
          functionName: "finalize",
          args: [
            jobId,
            BigInt(candidate.timestamp),
            stringToHex(candidate.data),
            candidate.signature,
          ],
          blockNumber: judgeBlock.number,
        });
      await simulate(response);
      const signedNegative = async (
        timestamp,
        requestHash,
        signer = account,
      ) => ({
        ...response,
        timestamp: String(timestamp),
        requestHash,
        signature: await signer.signMessage({
          message: {
            raw: keccak256(
              encodePacked(
                ["bytes32", "uint256", "bytes"],
                [requestHash, BigInt(timestamp), stringToHex(body)],
              ),
            ),
          },
        }),
      });
      const wrongRequest = await signedNegative(
        signedAt,
        commitment("another request"),
      );
      const wrongKey = await signedNegative(
        signedAt,
        NVD_REQUEST_HASH,
        privateKeyToAccount(generatePrivateKey()),
      );
      const stale = await signedNegative(signedAt - 301n, NVD_REQUEST_HASH);
      for (const [name, negative, intendedError] of [
        ["edited", { ...response, data: body + " " }, "NotSignedByAirnode"],
        ["stale", stale, "InvalidOracle"],
        ["other-request", wrongRequest, "NotSignedByAirnode"],
        ["wrong-key", wrongKey, "NotSignedByAirnode"],
      ]) {
        await assert.rejects(
          simulate(negative),
          (error) => {
            for (let cause = error; cause; cause = cause.cause)
              if (cause.name === "ContractFunctionRevertedError")
                return cause.data?.errorName === intendedError;
            return false;
          },
          `${name} must fail for its intended evidence defect`,
        );
      }
      assert.equal(
        Number(
          (
            await client.readContract({
              address: config.contract,
              abi: commissioningAbi,
              functionName: "getJob",
              args: [jobId],
            })
          ).decision,
        ),
        1,
        "Negative simulations must leave the job open",
      );
      await send(prepareFinalize(config, { jobId, response }));
      const accepted = await readAcceptance({
        ...config,
        client,
        jobId,
        expected,
        signer: account.address,
      });
      assert.equal(accepted.verdict, "PASS");
      assert.equal(accepted.decision, "ACCEPTED");
      const substituted = await readAcceptance({
        ...config,
        client,
        jobId,
        expected: {
          ...expected,
          paymentEvidenceDigest: commitment("different payment"),
        },
        signer: account.address,
      });
      assert.equal(substituted.verdict, "REVIEW");
      assert.equal(
        (
          await readAcceptance({
            ...config,
            chainId: 1,
            client,
            jobId,
            expected,
            signer: account.address,
          })
        ).verdict,
        "REVIEW",
      );
    } finally {
      proc.kill("SIGTERM");
      if (proc.exitCode === null)
        await new Promise((resolve) => proc.once("exit", resolve));
    }
  },
);
