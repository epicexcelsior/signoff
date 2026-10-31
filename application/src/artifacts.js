import { createHash } from "node:crypto";

/** Protocol v1: sorted object keys, preserved array order, finite JSON values. */
export function canonicalJson(value) {
  const encode = (item, depth) => {
    if (depth > 32) throw new TypeError("Artifact nesting exceeds 32 levels.");
    if (item === null || typeof item === "boolean" || typeof item === "string")
      return JSON.stringify(item);
    if (typeof item === "number" && Number.isFinite(item))
      return JSON.stringify(item);
    if (Array.isArray(item)) {
      if (Object.keys(item).length !== item.length)
        throw new TypeError(
          "Artifact arrays must contain only indexed values.",
        );
      return `[${item.map((entry) => encode(entry, depth + 1)).join(",")}]`;
    }
    if (item && Object.getPrototypeOf(item) === Object.prototype) {
      return `{${Object.keys(item)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${encode(item[key], depth + 1)}`)
        .join(",")}}`;
    }
    throw new TypeError("Artifacts require plain, finite JSON values.");
  };
  return encode(value, 0);
}

export const artifactDigest = (value) =>
  `0x${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;

export const isDigest = (value) =>
  typeof value === "string" && /^0x[0-9a-f]{64}$/.test(value);
