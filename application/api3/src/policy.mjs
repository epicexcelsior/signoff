export const CVE_ID = "CVE-2025-62235";
export const NIMBLE_CRITERIA = "cpe:2.3:a:apache:nimble:*:*:*:*:*:*:*:*";
export const METRIC_SOURCE = "134c704f-9b21-4f2e-91b3-4a467353bcc0";
export const MAX_DATA_BYTES = 32768;

export function encodeVersion(version) {
  if (
    typeof version !== "string" ||
    !/^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.test(version)
  ) {
    throw new Error("Use a three-part version with each component below 1000");
  }
  const [major, minor, patch] = version.split(".").map(Number);
  return major * 1_000_000 + minor * 1000 + patch;
}

function keys(value, allowed, required = allowed) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key)) &&
    required.every((key) => Object.hasOwn(value, key))
  );
}

function nvdTime(text) {
  if (
    typeof text !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}$/.test(text)
  )
    return NaN;
  const ms = Date.parse(`${text}Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== `${text}Z`)
    return NaN;
  return Math.floor(ms / 1000);
}

function uniqueKeys(data) {
  const stack = [];
  for (const [token] of data.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\]:,]/g)) {
    if (token === "{" || token === "[") {
      stack.push({
        object: token === "{",
        key: token === "{",
        keys: new Set(),
      });
      if (stack.length > 64) return false;
    } else if (token === "}" || token === "]") stack.pop();
    else if (stack.at(-1)?.object) {
      const state = stack.at(-1);
      if (token === ",") state.key = true;
      else if (token === ":") state.key = false;
      else if (state.key && token.startsWith('"')) {
        const key = JSON.parse(token);
        if (key !== token.slice(1, -1) || state.keys.has(key)) return false;
        state.keys.add(key);
        state.key = false;
      }
    }
  }
  return true;
}

// The supported applicability is the complete single-node NimBLE range in the
// recorded NVD response. Additional branches and unknown keys require review.
export function evaluateNvdPolicy(
  data,
  {
    buildVersion,
    maxCvssTenths = 70,
    now = Math.floor(Date.now() / 1000),
    signedAt = now,
    sourceMaxAgeSeconds = 86400,
  } = {},
) {
  const review = (reason) => ({ verdict: "REVIEW", reason, cveId: CVE_ID });
  if (typeof data !== "string" || Buffer.byteLength(data) > MAX_DATA_BYTES)
    return review("Unsupported data size");
  if (
    !Number.isInteger(now) ||
    !Number.isInteger(signedAt) ||
    !Number.isInteger(sourceMaxAgeSeconds) ||
    sourceMaxAgeSeconds < 1
  )
    return review("Invalid freshness policy");
  if (
    !Number.isInteger(maxCvssTenths) ||
    maxCvssTenths < 0 ||
    maxCvssTenths > 100
  )
    return review("Invalid severity policy");
  let version;
  try {
    version = encodeVersion(buildVersion);
  } catch {
    return review("Unsupported build version");
  }
  let p;
  try {
    p = JSON.parse(data);
  } catch {
    return review("Invalid projected JSON");
  }
  if (!uniqueKeys(data))
    return review("Duplicate, escaped, or deeply nested fields");
  if (
    !keys(p, [
      "configurations",
      "cveId",
      "cvssV31",
      "lastModified",
      "sourceGeneratedAt",
      "status",
      "totalResults",
    ])
  )
    return review("Unsupported projection fields");
  if (p.cveId !== CVE_ID || p.totalResults !== 1 || p.status !== "Analyzed")
    return review("Wrong or incomplete CVE record");
  const generatedAt = nvdTime(p.sourceGeneratedAt);
  const modifiedAt = nvdTime(p.lastModified);
  if (
    !Number.isFinite(generatedAt) ||
    !Number.isFinite(modifiedAt) ||
    generatedAt > signedAt ||
    generatedAt > now ||
    now - generatedAt > sourceMaxAgeSeconds ||
    modifiedAt > generatedAt
  )
    return review("Invalid or stale source generation time");
  if (!Array.isArray(p.configurations) || p.configurations.length !== 1)
    return review("Unsupported applicability branches");
  const config = p.configurations[0];
  if (
    !keys(config, ["nodes"]) ||
    !Array.isArray(config.nodes) ||
    config.nodes.length !== 1
  )
    return review("Unsupported configuration structure");
  const node = config.nodes[0];
  if (
    !keys(node, ["cpeMatch", "negate", "operator"]) ||
    node.negate !== false ||
    node.operator !== "OR" ||
    !Array.isArray(node.cpeMatch) ||
    node.cpeMatch.length !== 1
  )
    return review("Unsupported applicability Boolean structure");
  const match = node.cpeMatch[0];
  if (
    !keys(match, [
      "criteria",
      "matchCriteriaId",
      "versionEndExcluding",
      "vulnerable",
    ]) ||
    match.criteria !== NIMBLE_CRITERIA ||
    match.vulnerable !== true ||
    match.versionEndExcluding !== "1.9.0" ||
    match.matchCriteriaId !== "DC033019-AA62-465E-AD0A-8018D8C89ED3"
  )
    return review("Unsupported product or version bounds");
  if (!Array.isArray(p.cvssV31) || p.cvssV31.length !== 1)
    return review("Ambiguous severity metric");
  const metric = p.cvssV31[0];
  if (
    !keys(metric, [
      "cvssData",
      "exploitabilityScore",
      "impactScore",
      "source",
      "type",
    ]) ||
    metric.source !== METRIC_SOURCE ||
    metric.type !== "Secondary"
  )
    return review("Unapproved severity source");
  const score = metric.cvssData;
  if (
    !keys(score, [
      "attackComplexity",
      "attackVector",
      "availabilityImpact",
      "baseScore",
      "baseSeverity",
      "confidentialityImpact",
      "integrityImpact",
      "privilegesRequired",
      "scope",
      "userInteraction",
      "vectorString",
      "version",
    ]) ||
    score.version !== "3.1"
  )
    return review("Unsupported CVSS version or shape");
  // Pin the complete known metric shape. New authenticated semantics require a
  // policy revision rather than an implicit interpretation by a different parser.
  const expected = {
    attackComplexity: "LOW",
    attackVector: "ADJACENT_NETWORK",
    availabilityImpact: "NONE",
    baseSeverity: "HIGH",
    confidentialityImpact: "HIGH",
    integrityImpact: "HIGH",
    privilegesRequired: "NONE",
    scope: "UNCHANGED",
    userInteraction: "NONE",
    vectorString: "CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
  };
  if (Object.entries(expected).some(([key, value]) => score[key] !== value))
    return review("Unsupported CVSS semantics");
  if (
    score.baseScore !== 8.1 ||
    metric.exploitabilityScore !== 2.8 ||
    metric.impactScore !== 5.2
  )
    return review("Unsupported or inconsistent severity values");
  for (const [field, raw] of [
    ["baseScore", "8.1"],
    ["exploitabilityScore", "2.8"],
    ["impactScore", "5.2"],
    ["totalResults", "1"],
  ]) {
    const match = data.match(new RegExp(`"${field}"\\s*:\\s*([^,}\\s]+)`));
    if (!match || match[1] !== raw)
      return review("Unsupported numeric representation");
  }
  const affected = version < encodeVersion("1.9.0");
  const verdict = affected && 81 > maxCvssTenths ? "FAIL" : "PASS";
  return {
    verdict,
    reason:
      verdict === "FAIL"
        ? "Enrolled build falls in the prohibited NimBLE range"
        : "Enrolled build satisfies the declared CVE policy",
    cveId: CVE_ID,
    buildVersion,
    affected,
    cvssTenths: 81,
    generatedAt,
    modifiedAt,
    limitations: [
      "Build identity is operator-enrolled",
      "This policy does not measure installed firmware",
      "Missing KEV fields have no policy meaning",
    ],
  };
}
