import {
  encodeDeployData,
  getContractAddress,
  keccak256,
  stringToHex,
} from "viem";
import { estimateL1Fee, estimateOperatorFee } from "viem/op-stack";
import {
  commissioningAbi,
  prepareCall,
  sourceResponseDigest,
  acceptanceHash,
  DECISIONS,
} from "./abi.mjs";
import {
  NVD_SIGNER,
  NVD_REQUEST_HASH,
  verifyNvdResponse,
  verifySignedResponse,
} from "./index.mjs";
import {
  address,
  sameAddress,
  fail,
  ACCESS_CHAIN_ID,
} from "./access-policy.mjs";

export function prepareDeployment({ artifact, operator }) {
  operator = address(operator);
  if (
    JSON.stringify(artifact?.abi) !== JSON.stringify(commissioningAbi) ||
    !/^0x[0-9a-fA-F]+$/.test(artifact?.bytecode?.object ?? "")
  )
    fail(
      "INVALID_DEPLOYMENT_ARTIFACT",
      "Build the reviewed CommissioningPolicy artifact before preparing deployment.",
    );
  const data = encodeDeployData({
    abi: commissioningAbi,
    bytecode: artifact.bytecode.object,
    args: [operator, NVD_SIGNER, NVD_REQUEST_HASH, 300n, 300n],
  });
  return {
    schema: "proof-of-ready/api3-deployment/v1",
    authorization: "UNSIGNED",
    chainId: ACCESS_CHAIN_ID,
    operator,
    airnode: NVD_SIGNER,
    requestHash: NVD_REQUEST_HASH,
    maxAttestationAge: 300,
    maxSourceAge: 300,
    bytecodeHash: keccak256(artifact.bytecode.object),
    transaction: { from: operator, data, value: "0x0" },
  };
}

export async function estimateDeployment({
  client,
  plan,
  l1Fee = estimateL1Fee,
  operatorFee = estimateOperatorFee,
}) {
  if (
    plan?.authorization !== "UNSIGNED" ||
    plan.chainId !== ACCESS_CHAIN_ID ||
    (await client.getChainId()) !== ACCESS_CHAIN_ID
  )
    fail(
      "DEPLOYMENT_CHAIN_MISMATCH",
      "Use the pinned Base Sepolia reader and unsigned deployment plan.",
    );
  const args = {
    account: plan.operator,
    data: plan.transaction.data,
    value: 0n,
  };
  const [gas, fees, l1, operator, nonce, balance, block] = await Promise.all([
    client.estimateGas(args),
    client.estimateFeesPerGas(),
    l1Fee(client, args),
    operatorFee(client, args),
    client.getTransactionCount({ address: plan.operator, blockTag: "pending" }),
    client.getBalance({ address: plan.operator }),
    client.getBlock(),
  ]);
  if (
    typeof fees.maxFeePerGas !== "bigint" ||
    typeof fees.maxPriorityFeePerGas !== "bigint"
  )
    fail(
      "FEE_ESTIMATE_UNAVAILABLE",
      "The reader did not return EIP-1559 fee estimates.",
    );
  const gasLimit = (gas * 120n + 99n) / 100n;
  return {
    ...plan,
    checkedAt: Number(block.timestamp),
    expectedContract: getContractAddress({
      from: plan.operator,
      nonce: BigInt(nonce),
    }),
    transaction: {
      ...plan.transaction,
      nonce,
      gas: gasLimit.toString(),
      maxFeePerGas: fees.maxFeePerGas.toString(),
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas.toString(),
    },
    fees: {
      gasEstimate: gas.toString(),
      l2ExecutionCapWei: (gasLimit * fees.maxFeePerGas).toString(),
      l1DataEstimateWei: l1.toString(),
      operatorEstimateWei: operator.toString(),
      estimatedTotalWithExecutionCapWei: (
        gasLimit * fees.maxFeePerGas +
        l1 +
        operator
      ).toString(),
      walletBalanceWei: balance.toString(),
      limitation:
        "L1 data and operator fees are current estimates, not enforced transaction fee caps. Re-estimate before approval. No signature or broadcast occurred.",
    },
  };
}

const finalization = (config, jobId, response) =>
  prepareCall(config, "finalize", [
    jobId,
    BigInt(response.timestamp),
    stringToHex(response.data),
    response.signature,
  ]);
// Only the intended custom error counts as rejection evidence.
const revertName = (error) => {
  for (let e = error; e; e = e.cause)
    if (
      ["ContractFunctionRevertedError", "ExecutionRevertedError"].includes(
        e.name,
      )
    )
      return e.data?.errorName ?? null;
  return null;
};

export async function judgeReadOnly({
  client,
  contract,
  runtimeCodeHash,
  jobId,
  validResponse,
  staleResponse,
  wrongRequestResponse,
  wrongKeyResponse,
  blockNumber,
  verifyResponse = verifyNvdResponse,
  verifySignature = verifySignedResponse,
}) {
  contract = address(contract);
  if ((await client.getChainId()) !== ACCESS_CHAIN_ID)
    fail("JUDGE_CHAIN_MISMATCH", "Use the approved Base Sepolia deployment.");
  if (
    blockNumber !== undefined &&
    (typeof blockNumber !== "bigint" || blockNumber < 0n)
  )
    fail(
      "JUDGE_BLOCK_REQUIRED",
      "Use a nonnegative integer block number for historical checks.",
    );
  const block = await client.getBlock(
    blockNumber === undefined ? {} : { blockNumber },
  );
  if (
    typeof block.number !== "bigint" ||
    !/^0x[0-9a-fA-F]{64}$/.test(block.hash ?? "")
  )
    fail(
      "JUDGE_BLOCK_UNAVAILABLE",
      "The reader must return the original block number and hash.",
    );
  const pinnedBlock = { blockNumber: block.number };
  const code = await client.getBytecode({ address: contract, ...pinnedBlock });
  if (
    !/^0x[0-9a-f]{64}$/.test(runtimeCodeHash ?? "") ||
    !code ||
    keccak256(code) !== runtimeCodeHash
  )
    fail(
      "JUDGE_CODE_MISMATCH",
      "The contract code differs from the independently pinned deployed runtime.",
    );
  const read = (functionName, args = []) =>
    client.readContract({
      address: contract,
      abi: commissioningAbi,
      functionName,
      args,
      ...pinnedBlock,
    });
  const [signer, requestHash, maxAge, maxSourceAge, job] = await Promise.all([
    read("airnode"),
    read("requestHash"),
    read("maxAttestationAge"),
    read("maxSourceAge"),
    read("getJob", [jobId]),
  ]);
  if (
    !sameAddress(signer, NVD_SIGNER) ||
    requestHash !== NVD_REQUEST_HASH ||
    maxAge !== 300n ||
    maxSourceAge !== 300n
  )
    fail(
      "JUDGE_ORACLE_MISMATCH",
      "The deployed source or freshness policy differs from the reviewed plan.",
    );
  const now = Number(block.timestamp);
  if (
    Number(job.decision) !== 1 ||
    !job.inspectionRecorded ||
    !job.sellerReceived ||
    Number(job.deadline) <= now
  )
    fail(
      "JUDGE_JOB_NOT_READY",
      "Use an open original job with recorded inspection and verified seller-receipt assertion.",
    );
  const build = await read("builds", [job.buildManifestDigest]);
  if (!build[0])
    fail("JUDGE_BUILD_NOT_ENROLLED", "The job build manifest is not enrolled.");
  const valid = await verifyResponse(validResponse, {
    now,
    maxAgeSeconds: Number(maxAge),
    sourceMaxAgeSeconds: Number(maxSourceAge),
    buildVersion: Number(build[1]),
    maxCvssTenths: job.maxCvssTenths,
  });
  await verifySignature(staleResponse, NVD_SIGNER, NVD_REQUEST_HASH);
  if (Number(staleResponse.timestamp) >= now - Number(maxAge))
    fail(
      "JUDGE_STALE_NOT_OLD",
      "Preserve a genuine response older than the contract's freshness window.",
    );
  if (wrongRequestResponse.requestHash === NVD_REQUEST_HASH)
    fail(
      "JUDGE_OTHER_REQUEST_REQUIRED",
      "Use a genuine signed response to another request, such as the saved CPE lookup.",
    );
  await verifySignature(
    wrongRequestResponse,
    NVD_SIGNER,
    wrongRequestResponse.requestHash,
  );
  if (sameAddress(wrongKeyResponse.airnode, NVD_SIGNER))
    fail(
      "JUDGE_WRONG_KEY_REQUIRED",
      "Use a clearly labeled response signed by a different disposable test key.",
    );
  await verifySignature(
    wrongKeyResponse,
    wrongKeyResponse.airnode,
    NVD_REQUEST_HASH,
  );
  if (
    Number(wrongRequestResponse.timestamp) < now - Number(maxAge) ||
    Number(wrongKeyResponse.timestamp) < now - Number(maxAge) ||
    Number(wrongRequestResponse.timestamp) > now ||
    Number(wrongKeyResponse.timestamp) > now
  )
    fail(
      "JUDGE_NEGATIVE_NOT_FRESH",
      "Use fresh wrong-request and wrong-key responses to isolate signature rejection from expiry.",
    );
  const cases = [
    ["valid", validResponse, null],
    [
      "edited",
      { ...validResponse, data: validResponse.data + " " },
      "NotSignedByAirnode",
    ],
    ["stale", staleResponse, "InvalidOracle"],
    ["other-request", wrongRequestResponse, "NotSignedByAirnode"],
    ["wrong-key", wrongKeyResponse, "NotSignedByAirnode"],
  ];
  const results = [];
  for (const [name, response, expectedRevert] of cases) {
    let accepted = false;
    let observedRevert = null;
    try {
      await client.simulateContract({
        address: contract,
        abi: commissioningAbi,
        functionName: "finalize",
        ...pinnedBlock,
        args: [
          jobId,
          BigInt(response.timestamp),
          stringToHex(response.data),
          response.signature,
        ],
      });
      accepted = true;
    } catch (error) {
      observedRevert = revertName(error);
      if (!observedRevert) throw error;
    }
    results.push({
      case: name,
      expected: expectedRevert === null ? "SUCCEED" : "REVERT",
      expectedRevert,
      observed: accepted ? "SUCCEEDED" : "REVERTED",
      observedRevert,
      passed:
        expectedRevert === null
          ? accepted
          : !accepted && observedRevert === expectedRevert,
    });
  }
  if (results.some((result) => !result.passed))
    fail(
      "JUDGE_CASE_FAILED",
      "At least one deployed-contract simulation differs from the mandatory outcome.",
    );
  const after = await client.getBlock(pinnedBlock);
  if (after.hash !== block.hash)
    fail(
      "JUDGE_BLOCK_CHANGED",
      "The pinned block changed during checking. Preserve the original result and inspect the chain.",
    );
  return {
    schema: "proof-of-ready/api3-judge-read/v1",
    chainId: ACCESS_CHAIN_ID,
    contract,
    jobId,
    checkedAt: now,
    blockNumber: block.number.toString(),
    blockHash: block.hash,
    historical: blockNumber !== undefined,
    runtimeCodeHash,
    sourceResponseDigest: sourceResponseDigest(validResponse),
    mode: "ETH_CALL_ONLY",
    results,
    validSourcePolicy: valid.verdict,
    commitments: {
      workOrderDigest: job.workOrderDigest,
      buildManifestDigest: job.buildManifestDigest,
      inspectionDigest: job.inspectionDigest,
      paymentEvidenceDigest: job.paymentEvidenceDigest,
    },
    expectedTerminalDecision:
      !job.inspectionPassed || valid.verdict === "FAIL"
        ? "REJECTED"
        : valid.verdict === "PASS"
          ? "ACCEPTED"
          : "REVIEW",
    unsignedValidCall: finalization(
      { chainId: ACCESS_CHAIN_ID, contract },
      jobId,
      validResponse,
    ),
    limitation:
      "All five checks use eth_call against deployed code. No transaction or state change occurred. Actual valid finalization and its transaction hash remain required. Cardano seller receipt remains a separate independently verified operator assertion.",
  };
}

// A successful eth_call is separate from an actual mined state transition.
export async function verifyFinalization({ client, check, transactionHash }) {
  if (
    check?.schema !== "proof-of-ready/api3-judge-read/v1" ||
    check.mode !== "ETH_CALL_ONLY" ||
    check.results?.length !== 5 ||
    check.results.some((result) => !result.passed) ||
    !/^0x[0-9a-fA-F]{64}$/.test(transactionHash ?? "")
  )
    fail(
      "JUDGE_PROOF_INPUT",
      "Use the original five-case check and actual finalization transaction hash.",
    );
  if (
    (await client.getChainId()) !== ACCESS_CHAIN_ID ||
    check.chainId !== ACCESS_CHAIN_ID
  )
    fail("JUDGE_CHAIN_MISMATCH", "Use the approved Base Sepolia deployment.");
  const [transaction, receipt] = await Promise.all([
    client.getTransaction({ hash: transactionHash }),
    client.getTransactionReceipt({ hash: transactionHash }),
  ]);
  if (
    receipt.status !== "success" ||
    receipt.transactionHash !== transactionHash ||
    transaction.hash !== transactionHash ||
    !sameAddress(transaction.to, check.contract) ||
    transaction.input !== check.unsignedValidCall.data ||
    transaction.value !== 0n ||
    receipt.blockNumber <= BigInt(check.blockNumber) ||
    transaction.blockHash !== receipt.blockHash
  )
    fail(
      "JUDGE_FINALIZATION_MISMATCH",
      "The mined transaction must contain the original valid finalization call and succeed after the judge check.",
    );
  const at = { blockNumber: receipt.blockNumber };
  const [block, checkedBlock, code, job] = await Promise.all([
    client.getBlock(at),
    client.getBlock({ blockNumber: BigInt(check.blockNumber) }),
    client.getBytecode({ address: check.contract, ...at }),
    client.readContract({
      address: check.contract,
      abi: commissioningAbi,
      functionName: "getJob",
      args: [check.jobId],
      ...at,
    }),
  ]);
  if (
    block.hash !== receipt.blockHash ||
    checkedBlock.hash !== check.blockHash ||
    !code ||
    keccak256(code) !== check.runtimeCodeHash
  )
    fail(
      "JUDGE_PROOF_CHAIN_CHANGED",
      "The original check block, mined transaction block, and pinned contract code must match.",
    );
  if (
    !check.commitments ||
    Object.entries(check.commitments).length !== 4 ||
    ![
      "workOrderDigest",
      "buildManifestDigest",
      "inspectionDigest",
      "paymentEvidenceDigest",
    ].every(
      (field) =>
        /^0x[0-9a-f]{64}$/.test(check.commitments[field] ?? "") &&
        job[field] === check.commitments[field],
    ) ||
    !job.inspectionRecorded ||
    !job.sellerReceived ||
    job.sourceResponseDigest !== check.sourceResponseDigest ||
    DECISIONS[Number(job.decision)] !== check.expectedTerminalDecision ||
    ![2, 3, 4].includes(Number(job.decision)) ||
    job.acceptanceHash !==
      acceptanceHash({
        chainId: ACCESS_CHAIN_ID,
        contract: check.contract,
        jobId: check.jobId,
        job,
      })
  )
    fail(
      "JUDGE_FINAL_STATE_MISMATCH",
      "The mined terminal state must preserve the original job, inspection, seller receipt, and signed source commitments.",
    );
  return {
    schema: "proof-of-ready/api3-finalization-proof/v1",
    chainId: ACCESS_CHAIN_ID,
    contract: check.contract,
    jobId: check.jobId,
    transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    blockHash: receipt.blockHash,
    judgeBlockNumber: check.blockNumber,
    judgeBlockHash: check.blockHash,
    decision: DECISIONS[Number(job.decision)],
    sourceResponseDigest: job.sourceResponseDigest,
    acceptanceHash: job.acceptanceHash,
    gasUsed: receipt.gasUsed.toString(),
    mode: "MINED_TRANSACTION_AND_PINNED_STATE",
    limitation:
      "Cardano payment remains an independently verified operator assertion. The contract does not verify Cardano consensus or physical truth.",
  };
}
