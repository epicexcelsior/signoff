import { evaluateGeometry, homography, transformPoint } from "./geometry.js";

const finite = (value) => typeof value === "number" && Number.isFinite(value);
const UNIT_CORNERS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** A declared emitter region stays near, and outside, the device marker. */
export function normalizeOpticalRoi(roi) {
  if (
    !roi ||
    ![roi.x, roi.y, roi.width, roi.height].every(finite) ||
    roi.width < 0.05 ||
    roi.height < 0.05 ||
    roi.width > 1 ||
    roi.height > 1 ||
    roi.x < -2 ||
    roi.y < -2 ||
    roi.x + roi.width > 3 ||
    roi.y + roi.height > 3 ||
    !(
      roi.x >= 1.05 ||
      roi.y >= 1.05 ||
      roi.x + roi.width <= -0.05 ||
      roi.y + roi.height <= -0.05
    )
  ) {
    throw new TypeError(
      "Place a bounded optical region beside the device marker without covering it.",
    );
  }
  return { x: roi.x, y: roi.y, width: roi.width, height: roi.height };
}

/** Check marker evidence independently from a browser-proposed tracked flag. */
export function validateOpticalTracking({ samples, resolution, policy, roi }) {
  try {
    normalizeOpticalRoi(roi);
  } catch {
    return false;
  }
  if (!Array.isArray(samples) || !samples.length || samples.length > 1500)
    return false;
  if (
    !resolution ||
    !Number.isInteger(resolution.width) ||
    !Number.isInteger(resolution.height) ||
    resolution.width < 1 ||
    resolution.height < 1 ||
    resolution.width > 640 ||
    resolution.height > 640
  )
    return false;
  return samples.every((sample) => {
    if (
      !finite(sample?.contrast) ||
      sample.contrast < 0.25 ||
      sample.contrast > 1
    )
      return false;
    const frame = {
      markers: [
        { id: policy.referenceMarkerId, corners: sample.referenceCorners },
        { id: policy.deviceMarkerId, corners: sample.deviceCorners },
      ],
      resolution,
    };
    try {
      const measurement = evaluateGeometry(frame, policy);
      if (measurement.state !== "PASS") return false;
      const matrix = homography(UNIT_CORNERS, sample.deviceCorners);
      return [
        { x: roi.x, y: roi.y },
        { x: roi.x + roi.width, y: roi.y },
        { x: roi.x + roi.width, y: roi.y + roi.height },
        { x: roi.x, y: roi.y + roi.height },
      ]
        .map((point) => transformPoint(matrix, point))
        .every(
          (point) =>
            point.x >= 0 &&
            point.y >= 0 &&
            point.x < resolution.width &&
            point.y < resolution.height,
        );
    } catch {
      return false;
    }
  });
}

/** Normalize emitter brightness against black/white samples from the same tracked marker. */
export function measureOpticalRegion({
  pixels,
  width,
  height,
  corners,
  roi: suppliedRoi,
}) {
  const roi = normalizeOpticalRoi(suppliedRoi);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 640 ||
    height > 640 ||
    !(pixels instanceof Uint8ClampedArray) ||
    pixels.length !== width * height * 4
  )
    throw new TypeError("Supply a bounded RGBA camera frame.");
  const matrix = homography(UNIT_CORNERS, corners);
  const sample = (x, y) => {
    const point = transformPoint(matrix, { x, y });
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height)
      throw new RangeError("The optical region leaves the camera image.");
    const index = (Math.floor(point.y) * width + Math.floor(point.x)) * 4;
    return {
      value:
        Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) / 255,
      index,
    };
  };
  const markerLevels = [];
  for (let row = 0; row < 12; row++)
    for (let column = 0; column < 12; column++)
      markerLevels.push(sample((column + 0.5) / 12, (row + 0.5) / 12).value);
  markerLevels.sort((a, b) => a - b);
  const black = markerLevels[Math.floor(markerLevels.length * 0.1)];
  const white = markerLevels[Math.floor(markerLevels.length * 0.9)];
  const contrast = white - black;
  if (contrast < 0.25)
    throw new RangeError("The device marker has insufficient contrast.");
  const values = [];
  const locations = new Set();
  for (let row = 0; row < 8; row++)
    for (let column = 0; column < 8; column++) {
      const value = sample(
        roi.x + ((column + 0.5) / 8) * roi.width,
        roi.y + ((row + 0.5) / 8) * roi.height,
      );
      values.push(value.value);
      locations.add(value.index);
    }
  if (locations.size < 16)
    throw new RangeError(
      "Move closer so the optical region contains at least sixteen camera pixels.",
    );
  const brightness = Math.max(
    0,
    Math.min(
      1,
      (values.reduce((sum, value) => sum + value, 0) / values.length - black) /
        contrast,
    ),
  );
  return { brightness, contrast };
}
