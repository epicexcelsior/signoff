const finite = (value) => typeof value === "number" && Number.isFinite(value);
const point = (value) => value && finite(value.x) && finite(value.y);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const DICTIONARY = "DICT_4X4_50";

/** The operator supplies dimensions and tolerances before capture. */
export function normalizePolicy(policy) {
  if (
    !policy ||
    ![policy.referenceMarkerId, policy.deviceMarkerId].every(
      (id) => Number.isInteger(id) && id >= 0 && id < 50,
    ) ||
    policy.referenceMarkerId === policy.deviceMarkerId ||
    !finite(policy.referenceSizeMm) ||
    policy.referenceSizeMm <= 0 ||
    !point(policy.target && { x: policy.target.xMm, y: policy.target.yMm }) ||
    !finite(policy.target.angleDeg) ||
    !finite(policy.tolerance?.positionMm) ||
    policy.tolerance.positionMm < 0 ||
    !finite(policy.tolerance.angleDeg) ||
    policy.tolerance.angleDeg < 0 ||
    policy.tolerance.angleDeg > 180
  ) {
    throw new TypeError(
      "Use distinct marker IDs, a measured reference size, and valid placement tolerances.",
    );
  }
  return {
    referenceMarkerId: policy.referenceMarkerId,
    deviceMarkerId: policy.deviceMarkerId,
    referenceSizeMm: policy.referenceSizeMm,
    target: {
      xMm: policy.target.xMm,
      yMm: policy.target.yMm,
      angleDeg: policy.target.angleDeg,
    },
    tolerance: {
      positionMm: policy.tolerance.positionMm,
      angleDeg: policy.tolerance.angleDeg,
    },
  };
}

export function angleDifference(a, b) {
  return ((((a - b + 180) % 360) + 360) % 360) - 180;
}

/** Solve eight homography coefficients with scaled partial pivoting. */
export function homography(from, to) {
  if (
    from.length !== 4 ||
    to.length !== 4 ||
    !from.every(point) ||
    !to.every(point)
  ) {
    throw new TypeError("A planar transform requires four finite point pairs.");
  }
  const rows = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const scales = rows.map((row) => Math.max(...row.slice(0, 8).map(Math.abs)));
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) {
      if (
        Math.abs(rows[row][col]) / scales[row] >
        Math.abs(rows[pivot][col]) / scales[pivot]
      )
        pivot = row;
    }
    if (!scales[pivot] || Math.abs(rows[pivot][col]) / scales[pivot] < 1e-12) {
      throw new RangeError("The marker plane is degenerate.");
    }
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    [scales[col], scales[pivot]] = [scales[pivot], scales[col]];
    const divisor = rows[col][col];
    for (let j = col; j <= 8; j++) rows[col][j] /= divisor;
    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const factor = rows[row][col];
      for (let j = col; j <= 8; j++) rows[row][j] -= factor * rows[col][j];
    }
  }
  return [...rows.map((row) => row[8]), 1];
}

export function transformPoint(matrix, value) {
  const denominator = matrix[6] * value.x + matrix[7] * value.y + matrix[8];
  if (!finite(denominator) || Math.abs(denominator) < 1e-10)
    throw new RangeError("The point lies outside the usable marker plane.");
  const result = {
    x: (matrix[0] * value.x + matrix[1] * value.y + matrix[2]) / denominator,
    y: (matrix[3] * value.x + matrix[4] * value.y + matrix[5]) / denominator,
  };
  if (!point(result))
    throw new RangeError("The planar projection is not finite.");
  return result;
}

function markerQuality(marker) {
  const sides = marker.corners.map((corner, index) =>
    distance(corner, marker.corners[(index + 1) % 4]),
  );
  const area =
    Math.abs(
      marker.corners.reduce((sum, corner, index) => {
        const next = marker.corners[(index + 1) % 4];
        return sum + corner.x * next.y - next.x * corner.y;
      }, 0),
    ) / 2;
  // This is an image-quality gate, not a calibrated error estimate.
  const minimumSidePx = Math.min(...sides);
  const sideRatio = Math.max(...sides) / minimumSidePx;
  const turns = marker.corners.map((a, index) => {
    const b = marker.corners[(index + 1) % 4];
    const c = marker.corners[(index + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  const convex =
    turns.every((turn) => turn > 0) || turns.every((turn) => turn < 0);
  return {
    id: marker.id,
    minimumSidePx,
    areaPx: area,
    sideRatio,
    convex,
    usable: convex && minimumSidePx >= 24 && area >= 500 && sideRatio <= 4,
  };
}

/**
 * Geometry guidance assumes a measured reference and coplanar markers.
 * It does not estimate lens distortion, camera origin, mounting, or physical truth.
 */
export function evaluateGeometry(frame, suppliedPolicy) {
  const policy = normalizePolicy(suppliedPolicy);
  const resolution = frame?.resolution;
  const validResolution =
    resolution &&
    Number.isInteger(resolution.width) &&
    resolution.width > 0 &&
    Number.isInteger(resolution.height) &&
    resolution.height > 0;
  const predicates = [];
  const add = (id, state, reason, actual = null, expected = null) =>
    predicates.push({ id, state, reason, actual, expected });
  const measurement = {
    capturedAt: finite(frame?.capturedAt) ? frame.capturedAt : null,
    markers: [],
    pose: null,
    calibration: {
      mode: "planar",
      id: frame?.calibrationId ?? null,
      resolution: validResolution ? { ...resolution } : null,
    },
    quality: {
      scope: "planar-placement-guidance",
      cameraSource: "browser-unattested",
      assumptions: [
        "measured-reference-size",
        "coplanar-markers",
        "unmodeled-lens-distortion",
      ],
      markerQuality: [],
    },
    state: "REVIEW",
    predicates,
  };
  const markers = frame?.markers;
  if (
    !validResolution ||
    !Array.isArray(markers) ||
    markers.length > 50 ||
    markers.some(
      (marker) =>
        !Number.isInteger(marker?.id) ||
        marker.id < 0 ||
        marker.id >= 50 ||
        !Array.isArray(marker.corners) ||
        marker.corners.length !== 4 ||
        marker.corners.some(
          (corner) =>
            !point(corner) ||
            corner.x < 0 ||
            corner.y < 0 ||
            corner.x > resolution.width ||
            corner.y > resolution.height,
        ),
    )
  ) {
    add("frame", "REVIEW", "The detector frame is invalid.");
    return measurement;
  }
  measurement.markers = markers.map(({ id, corners }) => ({
    id,
    corners: corners.map((corner) => ({ x: corner.x, y: corner.y })),
  }));
  const referenceMatches = markers.filter(
    ({ id }) => id === policy.referenceMarkerId,
  );
  const deviceMatches = markers.filter(
    ({ id }) => id === policy.deviceMarkerId,
  );
  for (const [id, matches, expected] of [
    ["reference-marker", referenceMatches, policy.referenceMarkerId],
    ["device-marker", deviceMatches, policy.deviceMarkerId],
  ]) {
    add(
      id,
      matches.length === 1 ? "PASS" : "REVIEW",
      matches.length === 1
        ? "One required marker is visible."
        : matches.length
          ? "Repeated marker IDs make placement ambiguous."
          : "The required marker is not visible.",
      matches.length,
      expected,
    );
  }
  if (referenceMatches.length !== 1 || deviceMatches.length !== 1)
    return measurement;
  const reference = referenceMatches[0];
  const device = deviceMatches[0];
  measurement.quality.markerQuality = [
    markerQuality(reference),
    markerQuality(device),
  ];
  const usable = measurement.quality.markerQuality.every(
    (value) => value.usable,
  );
  add(
    "image-quality",
    usable ? "PASS" : "REVIEW",
    usable
      ? "Marker edges support planar guidance."
      : "Move closer and reduce marker tilt or blur.",
  );
  if (!usable) return measurement;
  const half = policy.referenceSizeMm / 2;
  const plane = [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ];
  try {
    const imageToPlane = homography(reference.corners, plane);
    const planeToImage = homography(plane, reference.corners);
    const corners = device.corners.map((corner) =>
      transformPoint(imageToPlane, corner),
    );
    // Center is the intersection of diagonals, not the image-corner average.
    const deviceToPlane = homography(
      [
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
      ],
      corners,
    );
    const origin = transformPoint(deviceToPlane, { x: 0, y: 0 });
    const axis = transformPoint(deviceToPlane, { x: 1, y: 0 });
    const angleDeg = angleDifference(
      (Math.atan2(axis.y - origin.y, axis.x - origin.x) * 180) / Math.PI,
      0,
    );
    measurement.pose = { xMm: origin.x, yMm: origin.y, angleDeg };
    const offsetMm = distance(origin, {
      x: policy.target.xMm,
      y: policy.target.yMm,
    });
    const angleErrorDeg = Math.abs(
      angleDifference(angleDeg, policy.target.angleDeg),
    );
    measurement.quality.offsetMm = offsetMm;
    measurement.quality.angleErrorDeg = angleErrorDeg;
    // A reference fit uses exactly four points. Its fit residual is not an accuracy estimate.
    measurement.guidance = {
      referenceCenter: transformPoint(planeToImage, { x: 0, y: 0 }),
      targetCenter: transformPoint(planeToImage, {
        x: policy.target.xMm,
        y: policy.target.yMm,
      }),
      targetAxis: transformPoint(planeToImage, {
        x:
          policy.target.xMm +
          half * Math.cos((policy.target.angleDeg * Math.PI) / 180),
        y:
          policy.target.yMm +
          half * Math.sin((policy.target.angleDeg * Math.PI) / 180),
      }),
    };
    add(
      "position",
      offsetMm <= policy.tolerance.positionMm ? "PASS" : "FAIL",
      "Planar offset uses the declared reference size.",
      offsetMm,
      policy.tolerance.positionMm,
    );
    add(
      "orientation",
      angleErrorDeg <= policy.tolerance.angleDeg ? "PASS" : "FAIL",
      "Planar angle is clockwise from the reference marker axis.",
      angleErrorDeg,
      policy.tolerance.angleDeg,
    );
    measurement.state = predicates.some((entry) => entry.state === "FAIL")
      ? "FAIL"
      : "PASS";
  } catch {
    add(
      "geometry",
      "REVIEW",
      "The marker plane cannot support a stable transform.",
    );
  }
  return measurement;
}
