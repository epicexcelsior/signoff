import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { encodePacked, keccak256, toHex } from "viem";
import {
  NVD_REQUEST,
  NVD_REQUEST_HASH,
  deriveRequestHash,
  verifySignedResponse,
  verifyNvdResponse,
  evaluateNvdPolicy,
  encodeVersion,
} from "../src/index.mjs";

const fixture = async (name) =>
  JSON.parse(
    await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"),
  );
const projected = await fixture("nvd-cve-unsigned-projection.json");
const data = JSON.stringify(projected);
const now =
  Math.floor(Date.parse(`${projected.sourceGeneratedAt}Z`) / 1000) + 1;
const options = { now, signedAt: now, buildVersion: "1.9.0" };
const account = privateKeyToAccount(generatePrivateKey());
async function sign(
  body = data,
  { requestHash = NVD_REQUEST_HASH, timestamp = now, signer = account } = {},
) {
  const signature = await signer.signMessage({
    message: {
      raw: keccak256(
        encodePacked(
          ["bytes32", "uint256", "bytes"],
          [requestHash, BigInt(timestamp), toHex(body)],
        ),
      ),
    },
  });
  return {
    airnode: signer.address,
    requestHash,
    timestamp: String(timestamp),
    data: body,
    signature,
  };
}

test("request includes complete applicability and metric arrays", () => {
  assert.equal(
    deriveRequestHash(NVD_REQUEST),
    "0x3f0881fb062ac6b989c133e0b5651d19947e38aebe4d94750627fa612f447d15",
  );
  assert.equal(
    NVD_REQUEST.responseProjection.configurations,
    "/vulnerabilities/0/cve/configurations",
  );
  assert.equal(
    NVD_REQUEST.responseProjection.cvssV31,
    "/vulnerabilities/0/cve/metrics/cvssMetricV31",
  );
});
test("genuine saved CPE fixture authenticates with native upstream verifier only", async () => {
  const response = await fixture("nvd-cpe-signed-response.json");
  const request = await fixture("nvd-cpe-request.json");
  await verifySignedResponse(
    response,
    response.airnode,
    deriveRequestHash(request),
  );
  await assert.rejects(
    verifySignedResponse(
      { ...response, data: response.data + " " },
      response.airnode,
      response.requestHash,
    ),
  );
  await assert.rejects(
    verifySignedResponse(response, response.airnode, NVD_REQUEST_HASH),
  );
});
test("fixture policy distinguishes affected and corrected declared builds", () => {
  assert.equal(evaluateNvdPolicy(data, options).verdict, "PASS");
  assert.equal(
    evaluateNvdPolicy(data, { ...options, buildVersion: "1.8.0" }).verdict,
    "FAIL",
  );
  assert.equal(
    evaluateNvdPolicy(data, {
      ...options,
      buildVersion: "1.8.0",
      maxCvssTenths: 81,
    }).verdict,
    "PASS",
  );
  assert.equal(encodeVersion("1.9.0"), 1_009_000);
  assert.throws(() => encodeVersion("1.9.0-beta"));
});
test("authenticated fixture remains exact-byte-bound and rejects wrong key/request/times", async () => {
  const response = await sign();
  const config = { ...options, signer: account.address };
  assert.equal((await verifyNvdResponse(response, config)).verdict, "PASS");
  await assert.rejects(
    verifyNvdResponse(
      { ...response, data: JSON.stringify(projected, null, 2) },
      config,
    ),
  );
  await assert.rejects(
    verifyNvdResponse(
      await sign(data, { requestHash: `0x${"11".repeat(32)}` }),
      config,
    ),
  );
  const other = privateKeyToAccount(generatePrivateKey());
  await assert.rejects(
    verifyNvdResponse(
      { ...(await sign(data, { signer: other })), airnode: account.address },
      config,
    ),
  );
  await assert.rejects(
    verifyNvdResponse(await sign(data, { timestamp: now - 301 }), config),
  );
  await assert.rejects(
    verifyNvdResponse(await sign(data, { timestamp: now + 1 }), config),
  );
});
test("unsupported complete applicability and metric shapes produce REVIEW", () => {
  const changes = [
    (p) => p.configurations.push(structuredClone(p.configurations[0])),
    (p) => (p.configurations[0].nodes[0].operator = "AND"),
    (p) => (p.configurations[0].nodes[0].negate = true),
    (p) =>
      p.configurations[0].nodes[0].cpeMatch.push(
        structuredClone(p.configurations[0].nodes[0].cpeMatch[0]),
      ),
    (p) =>
      (p.configurations[0].nodes[0].cpeMatch[0].versionStartIncluding =
        "1.0.0"),
    (p) =>
      (p.configurations[0].nodes[0].cpeMatch[0].criteria =
        "cpe:2.3:a:other:product:*:*:*:*:*:*:*:*"),
    (p) => p.cvssV31.push(structuredClone(p.cvssV31[0])),
    (p) => (p.cvssV31[0].source = "other source"),
    (p) => (p.cvssV31[0].cvssData.baseScore = 1e100),
    (p) => (p.cvssV31[0].cvssData.version = "4.0"),
    (p) => (p.cveId = "CVE-2025-11111"),
    (p) => (p.status = "Rejected"),
    (p) => (p.totalResults = 0),
    (p) => (p.kev = false),
  ];
  for (const change of changes) {
    const p = structuredClone(projected);
    change(p);
    assert.equal(
      evaluateNvdPolicy(JSON.stringify(p), options).verdict,
      "REVIEW",
    );
  }
});
test("source timestamp and parser boundaries fail closed", () => {
  assert.equal(
    evaluateNvdPolicy(data, {
      ...options,
      now: now + 86401,
      signedAt: now + 86401,
    }).verdict,
    "REVIEW",
  );
  assert.equal(
    evaluateNvdPolicy(data, { ...options, signedAt: now - 2 }).verdict,
    "REVIEW",
  );
  assert.equal(
    evaluateNvdPolicy(
      data.replace('"totalResults":1', '"totalResults":1,"totalResults":1'),
      options,
    ).verdict,
    "REVIEW",
  );
  assert.equal(
    evaluateNvdPolicy(
      data.replace('"baseScore":8.1', '"baseScore":8.1e0'),
      options,
    ).verdict,
    "REVIEW",
  );
  assert.equal(evaluateNvdPolicy("{broken", options).verdict, "REVIEW");
  assert.equal(evaluateNvdPolicy(" ".repeat(32769), options).verdict, "REVIEW");
  assert.equal(
    evaluateNvdPolicy(data, { ...options, maxCvssTenths: 101 }).verdict,
    "REVIEW",
  );
  const invalid = {
    ...projected,
    sourceGeneratedAt: "2026-02-30T11:36:42.113",
  };
  assert.equal(
    evaluateNvdPolicy(JSON.stringify(invalid), options).verdict,
    "REVIEW",
  );
});
