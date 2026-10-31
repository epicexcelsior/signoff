// Draw only coordinates and readings stored in this attempt. This is not a camera still.
export function renderMeasurement(container, measurement, policy) {
  container.replaceChildren();
  const quality = measurement?.quality;
  if (!quality || !measurement.markers?.length) {
    container.textContent =
      "Not measured. No camera coordinates are available.";
    return;
  }
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute(
    "viewBox",
    `0 0 ${measurement.calibration.resolution.width} ${measurement.calibration.resolution.height}`,
  );
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    "Diagram of saved camera coordinates: reference marker, observed device marker, and approved target. Not a camera photo.",
  );
  const add = (tag, attributes, text) => {
    const node = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attributes))
      node.setAttribute(name, value);
    if (text) node.textContent = text;
    svg.append(node);
    return node;
  };
  for (const marker of measurement.markers) {
    const reference = marker.id === policy.referenceMarkerId;
    add("polygon", {
      points: marker.corners.map((p) => `${p.x},${p.y}`).join(" "),
      class: reference ? "measured-reference" : "measured-device",
    });
    const center = marker.corners.reduce(
      (p, c) => ({ x: p.x + c.x / 4, y: p.y + c.y / 4 }),
      { x: 0, y: 0 },
    );
    add(
      "text",
      {
        x: center.x,
        y: center.y + 12,
        "text-anchor": "middle",
        class: "marker-id",
      },
      String(marker.id),
    );
    add(
      "text",
      {
        x: center.x,
        y: Math.max(...marker.corners.map((p) => p.y)) + 44,
        "text-anchor": "middle",
        class: "diagram-label",
      },
      reference ? "REFERENCE" : "DEVICE",
    );
  }
  const target = measurement.guidance?.targetCenter;
  const observed = measurement.markers.find(
    (m) => m.id === policy.deviceMarkerId,
  );
  if (target && observed) {
    const center = observed.corners.reduce(
      (p, c) => ({ x: p.x + c.x / 4, y: p.y + c.y / 4 }),
      { x: 0, y: 0 },
    );
    add("path", {
      d: `M ${target.x - 24} ${target.y} h 48 M ${target.x} ${target.y - 24} v 48`,
      class: "measured-target",
    });
    add("line", {
      x1: center.x,
      y1: center.y,
      x2: target.x,
      y2: target.y,
      class: "measurement-leader",
    });
    add(
      "text",
      {
        x: target.x,
        y: target.y + 75,
        "text-anchor": "middle",
        class: "diagram-label",
      },
      "TARGET",
    );
  }
  container.append(svg);
  const metrics = document.createElement("div");
  metrics.className = "measurement-values";
  for (const [value, label, limit] of [
    [
      quality.offsetMm.toFixed(1) + " mm",
      "from target",
      policy.tolerance.positionMm + " mm",
    ],
    [
      quality.angleErrorDeg.toFixed(1) + "°",
      "rotation error",
      policy.tolerance.angleDeg + "°",
    ],
  ]) {
    const reading = document.createElement("div");
    const number = document.createElement("strong");
    number.textContent = value;
    const description = document.createElement("span");
    description.textContent = label;
    const allowed = document.createElement("small");
    allowed.textContent = "Allowed: ±" + limit;
    reading.append(number, description, allowed);
    metrics.append(reading);
  }
  container.append(metrics);
}
