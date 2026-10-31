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
import { NVD_REQUEST_HASH, NVD_SIGNER } from "../src/index.mjs";
import {
  admissionAbi,
  prepareAdmissionCall,
  judgeAdmissionCandidate,
  verifyAdmission,
} from "../src/admission.mjs";
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
        "--chain-id",
        "84532",
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
        id: 84532,
        name: "Local commissioning fixture",
        nativeCurrency: { name: "Fixture ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [`http://127.0.0.1:${port}`] } },
      });
      const client = createPublicClient({
        chain,
        transport: http(),
        pollingInterval: 20,
      });
      const wallet = createWalletClient({
        account,
        chain,
        transport: http(),
        pollingInterval: 20,
      });
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
      const config = { chainId: 84532, contract: receipt.contractAddress };
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
        return hash;
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

      // Rehearse admission with genuine saved signatures at their historical time.
      // This remains a disposable local Anvil chain, not live Base Sepolia evidence.
      const original = async (name) =>
        JSON.parse(
          await readFile(
            new URL(`../../submission/evidence/${name}`, import.meta.url),
            "utf8",
          ),
        );
      const genuine = await original("nvd-paid-final-original.json");
      await client.request({
        method: "evm_setNextBlockTimestamp",
        params: [Number(genuine.timestamp)],
      });
      await client.request({ method: "evm_mine" });
      const admissionArtifact = JSON.parse(
        await readFile(
          join(
            contracts,
            "out/SourceGatedCommissioningPolicy.sol/SourceGatedCommissioningPolicy.json",
          ),
          "utf8",
        ),
      );
      assert.deepEqual(admissionArtifact.abi, admissionAbi);
      const admissionDeployment = await wallet.deployContract({
        abi: admissionAbi,
        bytecode: admissionArtifact.bytecode.object,
        args: [account.address, NVD_SIGNER, NVD_REQUEST_HASH],
      });
      const deployed = await client.waitForTransactionReceipt({
        hash: admissionDeployment,
      });
      const admissionConfig = {
        chainId: 84532,
        contract: deployed.contractAddress,
      };
      await send(
        prepareEnrollBuild(admissionConfig, {
          manifestDigest: expected.buildManifestDigest,
          version: 1_009_000,
        }),
      );
      const vulnerableDigest = commitment("fixture vulnerable declared build");
      await send(
        prepareEnrollBuild(admissionConfig, {
          manifestDigest: vulnerableDigest,
          version: 1_008_000,
        }),
      );
      const pinned = await client.getBlock();
      const snapshot = {
        ...admissionConfig,
        operator: account.address,
        jobId: commitment("fixture source-gated work order"),
        blockNumber: String(pinned.number),
        blockHash: pinned.hash,
        buildVersion: 1_009_000,
        runtimeCodeHash: keccak256(
          await client.getBytecode({ address: admissionConfig.contract }),
        ),
        spec: {
          workOrderDigest: expected.workOrderDigest,
          buildManifestDigest: expected.buildManifestDigest,
          deadline: Number(pinned.timestamp) + 3600,
          maxCvssTenths: 70,
        },
      };
      const nonceBeforeChecks = await client.getTransactionCount({
        address: account.address,
      });
      const validAdmission = await judgeAdmissionCandidate({
        client,
        snapshot,
        candidate: genuine,
      });
      assert.equal(validAdmission.observed, "SUCCEEDED");
      for (const [name, candidate, expectedError] of [
        [
          "edited",
          { ...genuine, data: genuine.data + " " },
          "NotSignedByAirnode",
        ],
        [
          "stale",
          await original("nvd-paid-first-original.json"),
          "InvalidOracle",
        ],
        [
          "other-request",
          await original("api3-other-request-original.json"),
          "NotSignedByAirnode",
        ],
        [
          "wrong-key",
          await original("api3-wrong-key-deliberate-test.json"),
          "NotSignedByAirnode",
        ],
      ]) {
        const result = await judgeAdmissionCandidate({
          client,
          snapshot,
          candidate,
        });
        assert.equal(result.observed, "REVERTED", name);
        assert.equal(result.observedRevert, expectedError, name);
      }
      const vulnerable = await judgeAdmissionCandidate({
        client,
        snapshot: {
          ...snapshot,
          jobId: commitment("fixture vulnerable work order"),
          buildVersion: 1_008_000,
          spec: { ...snapshot.spec, buildManifestDigest: vulnerableDigest },
        },
        candidate: genuine,
      });
      assert.equal(vulnerable.observedRevert, "SoftwareNotEligible");
      assert.equal(
        await client.getTransactionCount({ address: account.address }),
        nonceBeforeChecks,
        "Judge checks wrote a transaction",
      );
      await assert.rejects(
        client.simulateContract({
          address: admissionConfig.contract,
          abi: admissionAbi,
          account: account.address,
          functionName: "openJob",
          args: [
            snapshot.jobId,
            { ...snapshot.spec, deadline: BigInt(snapshot.spec.deadline) },
          ],
        }),
      );
      const admittedHash = await send(prepareAdmissionCall(snapshot, genuine));
      const proof = await verifyAdmission({
        client,
        snapshot,
        candidate: genuine,
        transactionHash: admittedHash,
      });
      assert.equal(proof.sourceDependentAction, true);
      assert.equal(proof.inspectionRecorded, false);
      assert.equal(proof.jobDecision, "OPEN");
      await send(
        prepareRecordInspection(admissionConfig, {
          jobId: snapshot.jobId,
          ...expected,
          inspectionDigest: commitment("fixture failed physical inspection"),
          passed: false,
          sellerReceived: true,
        }),
      );
      await send(
        prepareFinalize(admissionConfig, {
          jobId: snapshot.jobId,
          response: genuine,
        }),
      );
      const rejected = await client.readContract({
        address: admissionConfig.contract,
        abi: admissionAbi,
        functionName: "getJob",
        args: [snapshot.jobId],
      });
      assert.equal(
        Number(rejected.decision),
        3,
        "Software admission must not approve a failed installation",
      );
    } finally {
      proc.kill("SIGTERM");
      if (proc.exitCode === null)
        await new Promise((resolve) => proc.once("exit", resolve));
    }
  },
);
