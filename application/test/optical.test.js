import test from "node:test";
import assert from "node:assert/strict";
import {
  alignOpticalChallenge,
  encodeOpticalChallenge,
} from "../public/vision/optical.js";
import {
  measureOpticalRegion,
  normalizeOpticalRoi,
  validateOpticalTracking,
} from "../public/vision/optical-region.js";

const policy = {
  referenceMarkerId: 0,
  deviceMarkerId: 10,
  referenceSizeMm: 60,
  target: { xMm: 100, yMm: 0, angleDeg: 0 },
  tolerance: { positionMm: 5, angleDeg: 5 },
};
const square = (x, y, side) => [
  { x, y },
  { x: x + side, y },
  { x: x + side, y: y + side },
  { x, y: y + side },
];
const roi = { x: 1.2, y: 0.25, width: 0.4, height: 0.4 };
const referenceCorners = square(70, 70, 60);
const deviceCorners = square(185, 85, 30);

function fixture({ period = 250, repeated = false } = {}) {
  const challenge = { bits: "a19bf030", halfSymbolMs: 250 };
  const encoded = encodeOpticalChallenge(challenge);
  const captureStartedAtMs = 10000;
  const startAtMs = captureStartedAtMs + 750;
  const durationMs = encoded.symbols.length * period;
  const captureEndedAtMs =
    startAtMs + durationMs * (repeated ? 2 : 1) + (repeated ? 1250 : 500);
  const starts = repeated
    ? [startAtMs, startAtMs + durationMs + 750]
    : [startAtMs];
  const samples = [];
  for (
    let atMs = captureStartedAtMs + 25;
    atMs <= captureEndedAtMs;
    atMs += 50
  ) {
    let level = 0;
    for (const start of starts) {
      if (atMs >= start && atMs < start + durationMs)
        level = encoded.symbols[Math.floor((atMs - start) / period)];
    }
    samples.push({
      atMs,
      elapsedMs: atMs - captureStartedAtMs,
      brightness: level ? 0.85 : 0.15,
      contrast: 0.9,
      tracked: true,
      frameNumber: samples.length + 1,
      deviceCorners: structuredClone(deviceCorners),
      referenceCorners: structuredClone(referenceCorners),
    });
  }
  return {
    challenge,
    samples,
    captureStartedAtMs,
    captureEndedAtMs,
    policy,
    resolution: { width: 640, height: 480 },
    roi,
  };
}

test("optical phase comes from the observed preamble and full transition sequence", () => {
  const input = fixture();
  const result = alignOpticalChallenge(input);
  assert.equal(result.state, "PASS");
  assert.equal(result.matchedSymbols, 72);
  assert(Math.abs(result.alignment.startAtMs - 10750) < 1);
  assert(Math.abs(result.alignment.halfSymbolMs - 250) < 1);
  assert.equal(result.source, "optical-samples-unattested");
  assert.equal(alignOpticalChallenge(fixture({ period: 257.5 })).state, "PASS");
  assert.equal(
    alignOpticalChallenge({
      ...input,
      searchWindow: { earliestStartAtMs: 11000, latestStartAtMs: 11200 },
    }).state,
    "FAIL",
  );
  assert.equal(
    alignOpticalChallenge({
      ...input,
      challenge: { ...input.challenge, bits: "a19bf031" },
    }).state,
    "FAIL",
  );
  assert.equal(
    alignOpticalChallenge(fixture({ repeated: true })).state,
    "REVIEW",
  );
});

test("optical evidence rejects loss, ambiguity, incomplete coverage, and edited timing", () => {
  const change = (edit) => {
    const input = fixture();
    edit(input);
    return alignOpticalChallenge(input);
  };
  for (const edit of [
    (input) => {
      input.samples[50].tracked = false;
    },
    (input) => {
      input.samples.splice(40, 1);
    },
    (input) => {
      input.samples[50].elapsedMs += 3;
    },
    (input) => {
      input.samples.forEach((sample) => {
        delete sample.frameNumber;
      });
    },
    (input) => {
      input.samples.forEach((sample) => {
        delete sample.elapsedMs;
      });
    },
    (input) => {
      input.samples[50].atMs = input.samples[49].atMs;
    },
    (input) => {
      input.samples[50].brightness = NaN;
    },
    (input) => {
      input.samples.reverse();
    },
    (input) => {
      input.samples = input.samples.slice(0, 200);
      input.captureEndedAtMs = input.samples.at(-1).atMs;
    },
    (input) => {
      input.incidents = [{ code: "OPTICAL_FRAME_DROPPED" }];
    },
    (input) => {
      input.samples.forEach((sample) => {
        sample.brightness = 0.5;
      });
    },
    (input) => {
      input.samples[50].deviceCorners = square(300, 85, 30);
    },
    (input) => {
      input.samples[50].referenceCorners = null;
    },
    (input) => {
      input.samples[50].contrast = 0.1;
    },
    (input) => {
      input.roi = { x: 1.2, y: 0, width: 0.01, height: 0.01 };
    },
  ]) {
    assert.equal(change(edit).state, "REVIEW");
  }
  assert.equal(
    alignOpticalChallenge({ ...fixture(), samples: [] }).state,
    "REVIEW",
  );
  assert.equal(
    alignOpticalChallenge({
      ...fixture(),
      searchWindow: { fromMs: 10000, toMs: 11000 },
    }).state,
    "REVIEW",
  );
  assert.equal(
    validateOpticalTracking({ ...fixture(), samples: [null] }),
    false,
  );
});

test("marker-relative optical sampling measures pixels and rejects unusable regions", () => {
  const width = 320;
  const height = 240;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  const paint = (x, y, side, level) => {
    for (let row = y; row < y + side; row++)
      for (let column = x; column < x + side; column++) {
        const offset = (row * width + column) * 4;
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = level;
      }
  };
  const corners = square(100, 80, 60);
  paint(100, 80, 60, 0);
  paint(120, 100, 20, 255);
  paint(172, 95, 24, 0);
  const measurement = () =>
    measureOpticalRegion({ pixels, width, height, corners, roi });
  assert.equal(measurement().brightness, 0);
  assert.equal(measurement().contrast, 1);
  paint(172, 95, 24, 255);
  assert.equal(measurement().brightness, 1);
  assert.throws(
    () => normalizeOpticalRoi({ x: 0.2, y: 0.2, width: 0.4, height: 0.4 }),
    TypeError,
  );
  assert.throws(
    () =>
      measureOpticalRegion({
        pixels,
        width,
        height,
        corners: square(300, 80, 60),
        roi,
      }),
    RangeError,
  );
  pixels.fill(255);
  assert.throws(measurement, RangeError);
});
