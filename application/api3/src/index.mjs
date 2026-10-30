import {
  deriveRequestHash,
  verifySignedResponse,
} from "./vendor/airnode-v2.ts";
import { evaluateNvdPolicy, MAX_DATA_BYTES } from "./policy.mjs";

export { evaluateNvdPolicy, encodeVersion } from "./policy.mjs";
export {
  deriveRequestHash,
  verifySignedResponse,
} from "./vendor/airnode-v2.ts";
export const NVD_SIGNER = "0x41dd84D5B6503D9aA3c374a49F546e335423a1b8";
export const NVD_REQUEST = Object.freeze({
  operation: "getCve",
  parameters: Object.freeze({ cveId: "CVE-2025-62235" }),
  responseProjection: Object.freeze({
    configurations: "/vulnerabilities/0/cve/configurations",
    cveId: "/vulnerabilities/0/cve/id",
    cvssV31: "/vulnerabilities/0/cve/metrics/cvssMetricV31",
    lastModified: "/vulnerabilities/0/cve/lastModified",
    sourceGeneratedAt: "/timestamp",
    status: "/vulnerabilities/0/cve/vulnStatus",
    totalResults: "/totalResults",
  }),
});
export const NVD_REQUEST_HASH = deriveRequestHash(NVD_REQUEST);

export async function verifyNvdResponse(
  response,
  {
    now = Math.floor(Date.now() / 1000),
    maxAgeSeconds = 300,
    signer = NVD_SIGNER,
    requestHash = NVD_REQUEST_HASH,
    ...policy
  } = {},
) {
  if (
    !response ||
    typeof response.data !== "string" ||
    Buffer.byteLength(response.data) > MAX_DATA_BYTES ||
    typeof response.timestamp !== "string" ||
    !/^[1-9]\d{0,11}$/.test(response.timestamp)
  )
    throw new Error("Malformed signed response");
  if (
    typeof response.airnode !== "string" ||
    response.airnode.toLowerCase() !== signer.toLowerCase()
  )
    throw new Error("Wrong advertised Airnode");
  if (
    !Number.isSafeInteger(now) ||
    !Number.isSafeInteger(maxAgeSeconds) ||
    maxAgeSeconds < 1
  )
    throw new Error("Invalid signature freshness policy");
  const signedAt = Number(response.timestamp);
  if (signedAt > now || now - signedAt > maxAgeSeconds)
    throw new Error("Stale or future signed response");
  await verifySignedResponse(response, signer, requestHash);
  return {
    authenticated: true,
    requestHash,
    signer,
    signedAt,
    ...evaluateNvdPolicy(response.data, { ...policy, now, signedAt }),
  };
}
