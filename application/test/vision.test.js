import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateGeometry,
  normalizePolicy,
  homography,
  transformPoint,
} from "../public/vision/geometry.js";
import {
  encodeOpticalChallenge,
  evaluateOpticalChallenge,
} from "../public/vision/optical.js";

const policy = {
  referenceMarkerId: 0,
  deviceMarkerId: 10,
  referenceSizeMm: 60,
  target: { xMm: 100, yMm: 0, angleDeg: 0 },
  tolerance: { positionMm: 5, angleDeg: 5 },
};
const marker = (id, x, y, side = 60) => ({
  id,
  corners: [
    { x: x - side / 2, y: y - side / 2 },
    { x: x + side / 2, y: y - side / 2 },
    { x: x + side / 2, y: y + side / 2 },
    { x: x - side / 2, y: y + side / 2 },
  ],
});
const frame = (...markers) => ({
  markers,
  resolution: { width: 640, height: 480 },
  calibrationId: "test-planar",
  capturedAt: 1000,
});

test("planar placement checks position, rotation, identity, ambiguity, and quality", () => {
  const reference = marker(0, 100, 100);
  const device = marker(10, 200, 100, 30);
  assert.equal(
    evaluateGeometry(frame(reference, device), policy).state,
    "PASS",
  );
  const pose = evaluateGeometry(frame(reference, device), policy).pose;
  assert(Math.abs(pose.xMm - 100) < 1e-8);
  assert(Math.abs(pose.yMm) < 1e-8);
  assert.equal(pose.angleDeg, 0);
  assert.equal(
    evaluateGeometry(frame(reference, marker(10, 220, 100)), policy).state,
    "FAIL",
  );
  const rotated = structuredClone(device);
  rotated.corners.push(rotated.corners.shift());
  assert.equal(
    evaluateGeometry(frame(reference, rotated), policy).state,
    "FAIL",
  );
  assert.equal(
    evaluateGeometry(frame(reference, marker(11, 200, 100)), policy).state,
    "REVIEW",
  );
  assert.equal(evaluateGeometry(frame(device), policy).state, "REVIEW");
  assert.equal(
    evaluateGeometry(frame(reference, device, device), policy).state,
    "REVIEW",
  );
  assert.equal(
    evaluateGeometry(frame(reference, marker(10, 200, 100, 12)), policy).state,
    "REVIEW",
  );
  const concave = {
    id: 10,
    corners: [
      { x: 170, y: 70 },
      { x: 230, y: 70 },
      { x: 190, y: 90 },
      { x: 170, y: 130 },
    ],
  };
  assert.equal(
    evaluateGeometry(frame(reference, concave), policy).state,
    "REVIEW",
  );
  assert.equal(
    evaluateGeometry(
      frame(reference, { id: 10, corners: [{ x: NaN, y: 0 }] }),
      policy,
    ).state,
    "REVIEW",
  );
  assert.throws(
    () => normalizePolicy({ ...policy, referenceMarkerId: 10 }),
    TypeError,
  );
});

test("planar transform preserves target-relative geometry under perspective", () => {
  const square = [
    { x: -30, y: -30 },
    { x: 30, y: -30 },
    { x: 30, y: 30 },
    { x: -30, y: 30 },
  ];
  const projected = [
    { x: 100, y: 100 },
    { x: 260, y: 90 },
    { x: 240, y: 260 },
    { x: 80, y: 230 },
  ];
  const matrix = homography(square, projected);
  const physicalDevice = marker(10, 100, 0, 30);
  const imageDevice = {
    id: 10,
    corners: physicalDevice.corners.map((point) =>
      transformPoint(matrix, point),
    ),
  };
  const result = evaluateGeometry(
    {
      ...frame({ id: 0, corners: projected }, imageDevice),
      resolution: { width: 1000, height: 1000 },
    },
    policy,
  );
  assert.equal(result.state, "PASS");
  assert(Math.abs(result.pose.xMm - 100) < 1e-8);
  assert(Math.abs(result.pose.yMm) < 1e-8);
  assert(Math.abs(result.pose.angleDeg) < 1e-8);
  assert.throws(
    () => homography(Array(4).fill({ x: 1, y: 1 }), square),
    RangeError,
  );
});

function opticalFixture() {
  const challenge = { bits: "a19bf030", halfSymbolMs: 250 };
  const encoded = encodeOpticalChallenge(challenge);
  const startAtMs = 10000;
  const samples = encoded.symbols.flatMap((symbol, index) =>
    [0.3, 0.5, 0.7].map((fraction) => ({
      atMs: startAtMs + (index + fraction) * encoded.halfSymbolMs,
      brightness: symbol ? 0.95 : 0.05,
      tracked: true,
    })),
  );
  return {
    challenge,
    samples,
    startAtMs,
    captureStartedAtMs: 9900,
    captureEndedAtMs: startAtMs + encoded.durationMs + 100,
  };
}

test("optical evaluator matches full 32-bit Manchester capture and rejects defects", () => {
  const fixture = opticalFixture();
  assert.equal(encodeOpticalChallenge(fixture.challenge).symbols.length, 72);
  assert.equal(evaluateOpticalChallenge(fixture).state, "PASS");
  assert.equal(
    evaluateOpticalChallenge({
      ...fixture,
      challenge: { ...fixture.challenge, bits: "a19bf031" },
    }).state,
    "FAIL",
  );
  assert.equal(
    evaluateOpticalChallenge({ ...fixture, samples: fixture.samples.slice(3) })
      .state,
    "REVIEW",
  );
  const ambiguous = structuredClone(fixture);
  ambiguous.samples[10].brightness = 0.5;
  assert.equal(evaluateOpticalChallenge(ambiguous).state, "REVIEW");
  const untracked = structuredClone(fixture);
  untracked.samples[10].tracked = false;
  assert.equal(evaluateOpticalChallenge(untracked).state, "REVIEW");
  assert.equal(
    evaluateOpticalChallenge({
      ...fixture,
      captureEndedAtMs: fixture.startAtMs + 100,
    }).state,
    "REVIEW",
  );
  assert.equal(
    evaluateOpticalChallenge({
      ...fixture,
      samples: [...fixture.samples].reverse(),
    }).state,
    "REVIEW",
  );
  assert.throws(
    () => encodeOpticalChallenge({ bits: "00", halfSymbolMs: 250 }),
    TypeError,
  );
  assert.throws(
    () => encodeOpticalChallenge({ bits: "a19bf030", halfSymbolMs: 1 }),
    TypeError,
  );
});
