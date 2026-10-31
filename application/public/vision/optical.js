import { validateOpticalTracking } from "./optical-region.js";
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

const round = (value) => Math.round(value * 10) / 10;
const quantile = (sorted, fraction) =>
  sorted[Math.floor((sorted.length - 1) * fraction)];

function fitTransitions(edges, indices) {
  const count = indices.length;
  const meanIndex = indices.reduce((sum, value) => sum + value, 0) / count;
  const origin = edges[0].atMs;
  const meanTime =
    edges.reduce((sum, edge) => sum + edge.atMs - origin, 0) / count;
  let numerator = 0;
  let denominator = 0;
  indices.forEach((value, index) => {
    numerator += (value - meanIndex) * (edges[index].atMs - origin - meanTime);
    denominator += (value - meanIndex) ** 2;
  });
  const halfSymbolMs = numerator / denominator;
  const startAtMs = origin + meanTime - meanIndex * halfSymbolMs;
  return {
    startAtMs,
    halfSymbolMs,
    residualMs: Math.max(
      ...indices.map((value, index) =>
        Math.abs(edges[index].atMs - startAtMs - value * halfSymbolMs),
      ),
    ),
  };
}

/**
 * Find one complete emission from its observed preamble and transitions.
 * Device epoch seconds constrain freshness elsewhere. They never establish optical phase.
 * Timestamp and brightness claims remain unauthenticated browser evidence.
 */
export function alignOpticalChallenge({
  challenge,
  samples,
  captureStartedAtMs,
  captureEndedAtMs,
  searchWindow = null,
  incidents = [],
  policy = null,
  resolution = null,
  roi = null,
} = {}) {
  const encoded = encodeOpticalChallenge(challenge);
  const result = {
    protocol: OPTICAL_PROTOCOL,
    source: "optical-samples-unattested",
    state: "REVIEW",
    matchedSymbols: 0,
    totalSymbols: encoded.symbols.length,
    alignment: null,
    levels: null,
    predicates: [],
  };
  const add = (id, state, reason) =>
    result.predicates.push({ id, state, reason });
  const interval = encoded.halfSymbolMs;
  const earliest =
    searchWindow === null
      ? captureStartedAtMs
      : searchWindow?.earliestStartAtMs;
  const latest =
    searchWindow === null
      ? captureEndedAtMs - encoded.durationMs * 0.95
      : searchWindow?.latestStartAtMs;
  if (
    ![captureStartedAtMs, captureEndedAtMs, earliest, latest].every(finite) ||
    captureEndedAtMs <= captureStartedAtMs ||
    captureEndedAtMs - captureStartedAtMs > 45000 ||
    earliest < captureStartedAtMs ||
    latest > captureEndedAtMs ||
    latest < earliest ||
    !Array.isArray(samples) ||
    samples.length < 2 ||
    samples.length > 1500 ||
    !Array.isArray(incidents) ||
    incidents.length > 16 ||
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
      "Use a bounded, ordered capture and a valid emission search interval.",
    );
    return result;
  }
  add(
    "optical-capture",
    "PASS",
    "The capture and emission search interval are bounded.",
  );
  if (incidents.length || samples.some((sample) => !sample.tracked)) {
    add(
      "optical-continuity",
      "REVIEW",
      "Capture incidents or interrupted marker tracking prevent optical acceptance.",
    );
    return result;
  }
  if (
    policy &&
    !validateOpticalTracking({ samples, resolution, policy, roi })
  ) {
    add(
      "optical-marker-binding",
      "REVIEW",
      "The declared region lacks usable device and reference marker evidence in every frame.",
    );
    return result;
  }
  if (policy)
    add(
      "optical-marker-binding",
      "PASS",
      "The declared region stays bound to usable device and reference markers.",
    );
  const hasFrameNumbers =
    Boolean(policy) ||
    samples.some((sample) => sample.frameNumber !== undefined);
  const hasElapsed =
    Boolean(policy) || samples.some((sample) => sample.elapsedMs !== undefined);
  if (
    samples.some(
      (sample, index) =>
        (hasFrameNumbers &&
          (!Number.isSafeInteger(sample.frameNumber) ||
            sample.frameNumber < 1 ||
            (index > 0 &&
              sample.frameNumber !== samples[index - 1].frameNumber + 1))) ||
        (hasElapsed &&
          (!finite(sample.elapsedMs) ||
            sample.elapsedMs < 0 ||
            Math.abs(sample.atMs - captureStartedAtMs - sample.elapsedMs) >
              1)) ||
        (index > 0 && sample.atMs - samples[index - 1].atMs > interval * 0.6),
    )
  ) {
    add(
      "optical-continuity",
      "REVIEW",
      "Dropped frames, a clock discontinuity, or a sampling gap prevents optical acceptance.",
    );
    return result;
  }
  add(
    "optical-continuity",
    "PASS",
    "Samples retain marker tracking and continuous frame timing.",
  );
  const sorted = samples
    .map((sample) => sample.brightness)
    .sort((a, b) => a - b);
  const low = quantile(sorted, 0.1);
  const high = quantile(sorted, 0.9);
  const contrast = high - low;
  result.levels = { low, high, contrast };
  if (contrast < 0.12) {
    add(
      "optical-contrast",
      "REVIEW",
      "The optical region has insufficient changing contrast.",
    );
    return result;
  }
  add(
    "optical-contrast",
    "PASS",
    "The measured optical region contains distinct dark and bright levels.",
  );
  const classified = samples.map((sample) => ({
    ...sample,
    level:
      sample.brightness <= low + contrast * 0.3
        ? 0
        : sample.brightness >= low + contrast * 0.7
          ? 1
          : null,
  }));
  const edges = [];
  let previous = null;
  for (const sample of classified) {
    if (sample.level === null) continue;
    if (previous && sample.level !== previous.level)
      edges.push({
        atMs: (previous.atMs + sample.atMs) / 2,
        uncertaintyMs: (sample.atMs - previous.atMs) / 2,
        to: sample.level,
      });
    previous = sample;
  }
  const transitionIndices = encoded.symbols.flatMap((symbol, index) =>
    index && symbol !== encoded.symbols[index - 1] ? [index] : [],
  );
  const candidates = new Map();
  let preambleSeen = false;
  let incompleteCandidateSeen = false;
  for (let base = 0; base + 2 < edges.length; base++) {
    if (
      edges[base].to !== 1 ||
      edges[base + 1].to !== 0 ||
      edges[base + 2].to !== 1 ||
      Math.abs(edges[base + 1].atMs - edges[base].atMs - 3 * interval) >
        interval * 0.35 ||
      Math.abs(edges[base + 2].atMs - edges[base + 1].atMs - interval) >
        interval * 0.3
    )
      continue;
    const nominalStart = edges[base].atMs - 3 * interval;
    if (nominalStart < earliest - interval || nominalStart > latest + interval)
      continue;
    preambleSeen = true;
    if (nominalStart + encoded.durationMs * 0.95 > captureEndedAtMs)
      incompleteCandidateSeen = true;
    for (let step = -25; step <= 25; step++) {
      const period = interval * (1 + step / 500);
      const start = edges[base].atMs - 3 * period;
      if (
        start < earliest ||
        start > latest ||
        start + encoded.symbols.length * period > captureEndedAtMs
      )
        continue;
      const selected = edges.slice(base, base + transitionIndices.length);
      if (
        selected.length !== transitionIndices.length ||
        selected.some(
          (edge, index) =>
            edge.to !== encoded.symbols[transitionIndices[index]] ||
            Math.abs(edge.atMs - start - transitionIndices[index] * period) >
              interval * 0.22,
        )
      )
        continue;
      const fit = fitTransitions(selected, transitionIndices);
      if (
        !finite(fit.halfSymbolMs) ||
        Math.abs(fit.halfSymbolMs - interval) > interval * 0.05 ||
        fit.residualMs > interval * 0.2 ||
        fit.startAtMs < earliest ||
        fit.startAtMs > latest ||
        fit.startAtMs + encoded.symbols.length * fit.halfSymbolMs >
          captureEndedAtMs
      )
        continue;
      const before = edges[base - 1];
      const after = edges[base + transitionIndices.length];
      if (
        (before && before.atMs > fit.startAtMs + interval * 0.2) ||
        (after &&
          after.atMs <
            fit.startAtMs + (encoded.symbols.length - 0.2) * fit.halfSymbolMs)
      )
        continue;
      let matched = 0;
      let incomplete = false;
      let mismatch = false;
      for (let symbol = 0; symbol < encoded.symbols.length; symbol++) {
        const from = fit.startAtMs + (symbol + 0.2) * fit.halfSymbolMs;
        const to = fit.startAtMs + (symbol + 0.8) * fit.halfSymbolMs;
        const central = classified.filter(
          (sample) => sample.atMs >= from && sample.atMs <= to,
        );
        if (
          central.length < 2 ||
          central.at(-1).atMs - central[0].atMs < fit.halfSymbolMs * 0.25 ||
          central.some((sample) => sample.level === null)
        ) {
          incomplete = true;
          break;
        }
        if (
          central.some((sample) => sample.level !== encoded.symbols[symbol])
        ) {
          mismatch = true;
          break;
        }
        matched++;
      }
      if (incomplete) {
        incompleteCandidateSeen = true;
        continue;
      }
      if (mismatch) continue;
      candidates.set(base, {
        startAtMs: fit.startAtMs,
        halfSymbolMs: fit.halfSymbolMs,
        endAtMs: fit.startAtMs + encoded.symbols.length * fit.halfSymbolMs,
        uncertaintyMs:
          Math.max(...selected.map((edge) => edge.uncertaintyMs)) +
          fit.residualMs,
        maxTransitionResidualMs: fit.residualMs,
        transitionCount: selected.length,
        matchedSymbols: matched,
      });
      break;
    }
  }
  if (candidates.size !== 1) {
    const state = candidates.size
      ? "REVIEW"
      : preambleSeen && !incompleteCandidateSeen
        ? "FAIL"
        : "REVIEW";
    add(
      "optical-alignment",
      state,
      candidates.size
        ? "More than one complete emission matches the challenge."
        : preambleSeen
          ? "No unique complete emission matches the challenge and measured timing."
          : "The complete preamble is absent from the capture.",
    );
    result.state = state;
    return result;
  }
  const match = [...candidates.values()][0];
  result.alignment = Object.fromEntries(
    Object.entries(match)
      .filter(([key]) => key !== "matchedSymbols")
      .map(([key, value]) => [key, round(value)]),
  );
  result.matchedSymbols = match.matchedSymbols;
  add(
    "optical-alignment",
    "PASS",
    "One measured preamble and transition sequence matches the complete fresh challenge.",
  );
  result.state = "PASS";
  return result;
}
