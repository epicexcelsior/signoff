export const OPTICAL_PROTOCOL = "proof-of-ready-optical-v1";
const PREAMBLE = Object.freeze([0, 0, 0, 1, 1, 1, 0, 1]);
const finite = (value) => typeof value === "number" && Number.isFinite(value);

/** Bits are a fresh 32-bit challenge. A signed device record must bind the job and session separately. */
export function encodeOpticalChallenge({
  bits,
  halfSymbolMs = 250,
  protocol = OPTICAL_PROTOCOL,
} = {}) {
  if (
    protocol !== OPTICAL_PROTOCOL ||
    typeof bits !== "string" ||
    !/^[0-9a-f]{8}$/.test(bits) ||
    !Number.isInteger(halfSymbolMs) ||
    halfSymbolMs < 100 ||
    halfSymbolMs > 1000
  ) {
    throw new TypeError(
      "Use eight lowercase hexadecimal challenge digits and a half-symbol duration from 100 to 1000 milliseconds.",
    );
  }
  const payload = Array.from(bits, (digit) =>
    parseInt(digit, 16).toString(2).padStart(4, "0"),
  ).join("");
  const symbols = [...PREAMBLE];
  for (const bit of payload) symbols.push(...(bit === "0" ? [0, 1] : [1, 0]));
  return {
    protocol: OPTICAL_PROTOCOL,
    bits,
    halfSymbolMs,
    preamble: [...PREAMBLE],
    symbols,
    durationMs: symbols.length * halfSymbolMs,
  };
}

/**
 * Compare completed camera samples with the declared emission interval.
 * This checks sample agreement. It does not authenticate the camera, execution clock, or physical emitter.
 */
export function evaluateOpticalChallenge({
  challenge,
  samples,
  startAtMs,
  captureStartedAtMs,
  captureEndedAtMs,
} = {}) {
  const encoded = encodeOpticalChallenge(challenge);
  const result = {
    protocol: OPTICAL_PROTOCOL,
    source: "optical-samples-unattested",
    state: "REVIEW",
    matchedSymbols: 0,
    totalSymbols: encoded.symbols.length,
    predicates: [],
  };
  const add = (id, state, reason) =>
    result.predicates.push({ id, state, reason });
  const endAtMs = startAtMs + encoded.durationMs;
  if (
    ![startAtMs, captureStartedAtMs, captureEndedAtMs].every(finite) ||
    captureStartedAtMs > startAtMs ||
    captureEndedAtMs < endAtMs ||
    !Array.isArray(samples) ||
    samples.length > 5000 ||
    samples.some(
      (sample, index) =>
        !finite(sample?.atMs) ||
        !finite(sample.brightness) ||
        sample.brightness < 0 ||
        sample.brightness > 1 ||
        typeof sample.tracked !== "boolean" ||
        sample.atMs < captureStartedAtMs ||
        sample.atMs > captureEndedAtMs ||
        (index > 0 && sample.atMs <= samples[index - 1].atMs),
    )
  ) {
    add(
      "optical-capture",
      "REVIEW",
      "Use an ordered, bounded capture that covers the complete emission interval.",
    );
    return result;
  }
  add(
    "optical-capture",
    "PASS",
    "The declared capture covers the complete emission interval.",
  );
  const active = samples.filter(
    (sample) => sample.atMs >= startAtMs && sample.atMs < endAtMs,
  );
  if (active.some((sample) => !sample.tracked)) {
    add(
      "optical-tracking",
      "REVIEW",
      "Marker tracking was interrupted during optical capture.",
    );
    return result;
  }
  add(
    "optical-tracking",
    "PASS",
    "The supplied samples retain marker tracking.",
  );
  for (let index = 0; index < encoded.symbols.length; index++) {
    const from = startAtMs + (index + 0.2) * encoded.halfSymbolMs;
    const to = startAtMs + (index + 0.8) * encoded.halfSymbolMs;
    const central = active.filter(
      (sample) => sample.atMs >= from && sample.atMs <= to,
    );
    if (
      central.length < 2 ||
      central.at(-1).atMs - central[0].atMs < encoded.halfSymbolMs * 0.25 ||
      central.some(
        (sample) => sample.brightness > 0.35 && sample.brightness < 0.65,
      )
    ) {
      add(
        "optical-symbols",
        "REVIEW",
        `Symbol ${index + 1} lacks two unambiguous central samples.`,
      );
      return result;
    }
    if (
      central.some(
        (sample) =>
          (sample.brightness >= 0.65 ? 1 : 0) !== encoded.symbols[index],
      )
    ) {
      add(
        "optical-symbols",
        "FAIL",
        `Symbol ${index + 1} differs from the fresh challenge.`,
      );
      result.state = "FAIL";
      return result;
    }
    result.matchedSymbols++;
  }
  add(
    "optical-symbols",
    "PASS",
    "The supplied camera samples match every preamble and Manchester symbol.",
  );
  result.state = "PASS";
  return result;
}
