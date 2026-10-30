import { readFileSync } from "node:fs";
import { verifyEscrowOutput, verifyReportBytes } from "../src/chain-proof.js";
import { readBoundedText } from "../src/network.js";
const [proofPath, reportPath, requestPath] = process.argv.slice(2);
if (!proofPath || !reportPath || !requestPath)
  throw new Error(
    "Use verify-chain.js PROOF_JSON ORIGINAL_REPORT_TXT ORIGINAL_REQUEST_JSON.",
  );
const expected = JSON.parse(readFileSync(proofPath, "utf8")).expected;
if (
  !expected ||
  !/^[a-f0-9]{64}$/.test(expected.resultHash ?? "") ||
  !/^[a-f0-9]{64}$/.test(expected.inputHash ?? "") ||
  !/^[a-f0-9]{64}$/.test(expected.blockchainIdentifierSha256 ?? "")
)
  throw new Error("Load the original reviewed chain-proof expectations.");
const report = verifyReportBytes(
  readFileSync(reportPath, "utf8"),
  readFileSync(requestPath, "utf8"),
  expected,
);
const key = process.env.BLOCKFROST_API_KEY_PREPROD;
if (!key?.startsWith("preprod"))
  throw new Error(
    "Load a Preprod Blockfrost key through private environment configuration.",
  );
async function read(path) {
  const r = await fetch("https://cardano-preprod.blockfrost.io/api/v0" + path, {
    headers: { project_id: key },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Independent chain read failed HTTP ${r.status}.`);
  return JSON.parse(await readBoundedText(r, 2_000_000));
}
const records = {};
for (const stage of ["lock", "result"]) {
  const tx = expected.records[stage]?.transaction;
  if (!/^[a-f0-9]{64}$/.test(tx ?? ""))
    throw new Error("Load an original Cardano transaction hash.");
  const [transaction, utxos] = await Promise.all([
    read(`/txs/${tx}`),
    read(`/txs/${tx}/utxos`),
  ]);
  const block = await read(`/blocks/${transaction.block}`);
  if (!Number.isSafeInteger(block.confirmations) || block.confirmations < 1)
    throw new Error("The original transaction needs a chain confirmation.");
  records[stage] = {
    ...verifyEscrowOutput({ transaction, utxos }, expected, stage),
    confirmationsAtRead: block.confirmations,
  };
}
console.log(
  JSON.stringify(
    {
      schema: "proof-of-ready/independent-cardano-commitments/v1",
      checkedAt: new Date().toISOString(),
      report,
      records,
      sellerReceiptVerified: false,
      limitation:
        "This command authenticates original escrow and report commitments. Seller withdrawal requires separate receipt and positive seller-net verification.",
    },
    null,
    2,
  ),
);
