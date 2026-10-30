import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Verify public historical evidence with the unmodified official verifier. No network or wallet is used.
const checkout = process.argv[2];
if (!checkout)
  throw new Error("Pass the path to the official API3 starter checkout.");
const expectedRevision = "52933ae1fb9371446a927338473466c3d320e19a";
const revision = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
assert.equal(
  revision,
  expectedRevision,
  "Use the documented official starter revision.",
);
execFileSync(
  "git",
  ["-C", checkout, "diff", "--exit-code", "HEAD", "--", "src/airnode-v2.ts"],
  { stdio: "pipe" },
);
const { deriveRequestHash, verifySignedResponse, recoverSigner } = await import(
  pathToFileURL(resolve(checkout, "src/airnode-v2.ts")).href
);
const read = (name) =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"),
  );
const request = read("nvd-cpe-request.json");
const response = read("nvd-cpe-signed-response.json");
const signer = "0x41dd84D5B6503D9aA3c374a49F546e335423a1b8";
const requestHash = deriveRequestHash(request);
assert.equal(
  requestHash,
  "0xcb527c8b970e9d8bc2db6d2432e280011142b21f7749619c83956a41215f1276",
);
await verifySignedResponse(response, signer, requestHash);
assert.equal(
  (await recoverSigner(response)).toLowerCase(),
  signer.toLowerCase(),
);
const editedData = response.data.replace(
  '"totalResults":2',
  '"totalResults":1',
);
assert.notEqual(
  editedData,
  response.data,
  "The rejection test must change one value.",
);
await assert.rejects(() =>
  verifySignedResponse({ ...response, data: editedData }, signer, requestHash),
);
assert.equal(
  deriveRequestHash(read("nvd-cve-candidate-request.json")),
  "0xf28aed06e9cbf7d70e5bedbfd4c36c54c12e3f36e04914a276c864cc08a7dd06",
);
const otherHash = deriveRequestHash({
  operation: "listSources",
  parameters: {},
});
await assert.rejects(() => verifySignedResponse(response, signer, otherHash));
console.log(
  JSON.stringify(
    {
      historical_signature: "PASS",
      edited_data: "REJECTED",
      other_request: "REJECTED",
      requestHash,
      signer,
      signed_at: new Date(Number(response.timestamp) * 1000).toISOString(),
      scope:
        "Historical CPE authenticity only. No CVE attestation, freshness decision, Solidity execution, or product qualification.",
    },
    null,
    2,
  ),
);
