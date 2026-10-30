import { createVisionController } from "/vision/controller.js";

const $ = (id) => document.getElementById(id);
let config;
let order = null;
let current = null;
let orders = [];
let sessions = [];
let camera = null;
let busy = false;
let orderIntent = null;
let attemptIntent = null;

async function api(path, body) {
  const response = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-FieldProof-Token": config.token,
          },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(`${result.code}: ${result.error}`);
    error.code = result.code;
    throw error;
  }
  return result;
}
function feedback(text, error = false) {
  $("feedback").textContent = text;
  $("feedback").dataset.error = String(error);
}
async function act(run) {
  if (busy) return;
  busy = true;
  renderControls();
  try {
    await run();
  } catch (error) {
    feedback(error.message, true);
  } finally {
    busy = false;
    renderControls();
  }
}
function renderControls() {
  $("approve").disabled = busy || !config || Boolean(order);
  $("asset").disabled = busy || Boolean(order);
  $("run-rehearsal").disabled = busy || !order;
  $("begin-capture").disabled = busy || !order;
  $("scenario").disabled = busy;
  $("history").disabled = busy;
  $("new-order").hidden = !order;
  const active = current?.state === "CAPTURING";
  $("capture-frame").disabled =
    busy ||
    !active ||
    Boolean(current?.vision) ||
    camera?.getState().phase !== "ACTIVE";
  $("contact-step").disabled =
    busy || !active || Boolean(current?.pending) || current?.device.length >= 3;
  $("inspect").disabled = busy || !active || Boolean(current?.pending);
  $("verify").disabled = busy || !current?.report;
  $("tamper").disabled = busy || !current?.report;
  const instruction = current?.pending
    ? "The original contact read is pending or interrupted. Start a new attempt for another read."
    : active && current.device.length < 3
      ? `Set the contact ${current.sequence[current.device.length] ? "CLOSED" : "OPEN"}, then read step ${current.device.length + 1} of 3.`
      : "The contact sequence is complete. Close the capture for inspection.";
  $("contact-instruction").textContent = instruction;
}
function showOrder() {
  if (order) {
    $("asset").value = order.asset;
    $("order-status").textContent =
      `Approved · ${order.id}. Each attempt uses these fixed requirements.`;
  } else
    $("order-status").textContent =
      "The approved requirements stay fixed for every capture attempt.";
}
function showSession(session) {
  current = session;
  order = orders.find((item) => item.id === session.workOrderId) ?? order;
  showOrder();
  $("capture-state").textContent =
    session.state === "INSPECTED"
      ? "Capture sealed"
      : `Contact ${session.device.length} / 3`;
  for (const id of ["flow-order", "flow-capture", "flow-report"])
    $(id).removeAttribute("aria-current");
  $(session.report ? "flow-report" : "flow-capture").setAttribute(
    "aria-current",
    "step",
  );
  $("record-reference").textContent =
    `Attempt ${session.id} · ${session.sourceMode === "fixture" ? "synthetic rehearsal" : "configured physical adapter"}`;
  $("results").replaceChildren();
  $("acceptance-gates").replaceChildren();
  $("acceptance-gates").hidden = !session.report;
  $("download").hidden = !session.report;
  $("packet-status").textContent = "";
  $("acceptance-decision").textContent =
    session.acceptance?.decision ?? "REVIEW";
  $("decision-block").dataset.decision =
    session.acceptance?.decision ?? "REVIEW";
  $("inspection-outcome").textContent = session.report
    ? `Local inspection: ${session.report.outcome}`
    : "Capture in progress";
  $("report-description").textContent =
    session.report?.outcome === "FAIL"
      ? "A required check failed. Correct the defect and start a new attempt."
      : session.report
        ? "Inspect the missing evidence before accepting this installation."
        : "Follow the contact sequence and save the camera measurement before inspection.";
  if (session.report) {
    for (const predicate of session.report.predicates) {
      const row = document.createElement("div");
      row.className = "result";
      for (const [className, value] of [
        ["result-name", predicate.id],
        ["outcome", predicate.outcome],
        ["result-reason", predicate.reason],
      ]) {
        const cell = document.createElement("span");
        cell.className = className;
        cell.textContent = value;
        if (className === "outcome") cell.dataset.outcome = value;
        row.append(cell);
      }
      $("results").append(row);
    }
    for (const predicate of session.acceptance.predicates.filter(
      (entry) => entry.id !== "inspection",
    )) {
      const gate = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `${predicate.id.replaceAll("-", " ")} · ${predicate.outcome}`;
      const reason = document.createElement("p");
      reason.textContent = predicate.reason;
      gate.append(title, reason);
      $("acceptance-gates").append(gate);
    }
    $("download").href = `/api/commissioning/sessions/${session.id}/packet`;
    $("limitations-list").replaceChildren();
    for (const limit of session.report.limitations) {
      const li = document.createElement("li");
      li.textContent = limit;
      $("limitations-list").append(li);
    }
  } else {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = `Requested sequence: ${session.sequence.map((value) => (value ? "CLOSED" : "OPEN")).join(" → ")}. Each state receives its own fresh challenge.`;
    $("results").append(p);
  }
  renderControls();
}
async function refreshHistory() {
  const result = await api("/api/commissioning");
  orders = result.workOrders;
  sessions = result.sessions;
  $("history").replaceChildren();
  if (!sessions.length) {
    const option = new Option("No attempts yet", "");
    $("history").append(option);
  }
  for (const session of sessions) {
    const asset =
      orders.find((item) => item.id === session.workOrderId)?.asset ??
      session.workOrderId;
    $("history").append(
      new Option(
        `${asset} · ${session.acceptance?.decision ?? "CAPTURING"} · ${session.id.slice(0, 6)}`,
        session.id,
      ),
    );
  }
  if (current) $("history").value = current.id;
}
async function approve() {
  const asset = $("asset").value.trim();
  if (!orderIntent || orderIntent.asset !== asset)
    orderIntent = { asset, idempotency_key: crypto.randomUUID() };
  order = await api("/api/commissioning/work-orders", orderIntent);
  orders.unshift(order);
  showOrder();
  feedback("Work order approved. Start a capture attempt.");
  $("flow-order").removeAttribute("aria-current");
  $("flow-capture").setAttribute("aria-current", "step");
}
async function startAttempt() {
  const scenario =
    config.mode === "simulation" ? $("scenario").value : "correct";
  if (
    !attemptIntent ||
    attemptIntent.scenario !== scenario ||
    attemptIntent.orderId !== order.id
  )
    attemptIntent = {
      scenario,
      orderId: order.id,
      idempotency_key: crypto.randomUUID(),
    };
  const session = await api(
    `/api/commissioning/work-orders/${order.id}/sessions`,
    { scenario, idempotency_key: attemptIntent.idempotency_key },
  );
  showSession(session);
  await refreshHistory();
  return session;
}
$("approve").addEventListener("click", () => act(approve));
$("run-rehearsal").addEventListener("click", () =>
  act(async () => {
    feedback(
      "Capturing a synthetic placement and three fresh signed contact states. No funds move.",
    );
    await startAttempt();
    if (current.state === "INSPECTED") {
      attemptIntent = null;
      await startAttempt();
    }
    if (!current.vision)
      showSession(
        await api(
          `/api/commissioning/sessions/${current.id}/fixture-vision`,
          {},
        ),
      );
    for (let step = current.device.length; step < 3; step++)
      showSession(
        await api(`/api/commissioning/sessions/${current.id}/contact`, {
          step,
        }),
      );
    showSession(
      await api(`/api/commissioning/sessions/${current.id}/inspect`, {}),
    );
    attemptIntent = null;
    await refreshHistory();
    feedback(
      current.report.outcome === "FAIL"
        ? "The inspection found a defect. Review the failed predicate, then run a corrected attempt."
        : "Rehearsal inspected. Physical origin, optical binding, paid inspection, and deployed software policy still need evidence.",
    );
  }),
);
$("begin-capture").addEventListener("click", () =>
  act(async () => {
    attemptIntent = null;
    await startAttempt();
    feedback("Capture started. Follow the requested contact sequence.");
  }),
);
$("contact-step").addEventListener("click", () =>
  act(async () =>
    showSession(
      await api(`/api/commissioning/sessions/${current.id}/contact`, {
        step: current.device.length,
      }),
    ),
  ),
);
$("inspect").addEventListener("click", () =>
  act(async () => {
    showSession(
      await api(`/api/commissioning/sessions/${current.id}/inspect`, {}),
    );
    await refreshHistory();
  }),
);
$("history").addEventListener("change", () =>
  act(async () => {
    if ($("history").value)
      showSession(
        await api(`/api/commissioning/sessions/${$("history").value}`),
      );
  }),
);
$("new-order").addEventListener("click", () => {
  sessionStorage.setItem("proof-ready-new-order", "true");
  location.reload();
});
$("verify").addEventListener("click", () =>
  act(async () => {
    const packet = await api(
      `/api/commissioning/sessions/${current.id}/packet`,
    );
    const result = await api("/api/commissioning/verify", {
      packet,
      expectedWorkOrderDigest: current.workOrderDigest,
    });
    $("packet-status").textContent =
      `Packet verified against the saved work order. Inspection ${result.report}; acceptance ${result.decision}.`;
  }),
);
$("tamper").addEventListener("click", () =>
  act(async () => {
    const packet = await api(
      `/api/commissioning/sessions/${current.id}/packet`,
    );
    const signed = packet.evidence.device.find((item) => item.receipt)?.receipt;
    if (!signed)
      throw new Error("Capture a signed observation before testing an edit.");
    signed.result.closed = !signed.result.closed;
    try {
      await api("/api/commissioning/verify", {
        packet,
        expectedWorkOrderDigest: current.workOrderDigest,
      });
      $("packet-status").textContent =
        "Unexpected verification result. Inspect the packet.";
    } catch (error) {
      if (error.code !== "PACKET_MISMATCH") throw error;
      $("packet-status").textContent =
        `Edited packet rejected. ${error.message}`;
    }
  }),
);
$("start-camera").addEventListener("click", () =>
  act(async () => {
    if (!order)
      throw new Error(
        "Approve the work order before starting camera guidance.",
      );
    camera?.stop();
    $("camera").hidden = false;
    $("overlay").hidden = false;
    $("placement-preview").hidden = true;
    camera = createVisionController({
      video: $("camera"),
      canvas: $("overlay"),
      policy: order.vision,
      onState: (state) => {
        $("camera-status").textContent =
          state.error?.message ?? `Camera ${state.phase.toLowerCase()}`;
        renderControls();
      },
      onMeasurement: (measurement) => {
        $("camera-status").textContent =
          measurement.state === "PASS"
            ? "Target aligned · save a measurement during capture"
            : measurement.predicates
                .filter((p) => p.state !== "PASS")
                .map((p) => p.reason)
                .join(" ");
      },
    });
    try {
      await camera.start();
      $("stop-camera").disabled = false;
      feedback("Camera guidance started. Frames stay on this device.");
    } catch (error) {
      stopCamera();
      throw error;
    }
  }),
);
function stopCamera() {
  camera?.stop();
  camera = null;
  $("camera").hidden = true;
  $("overlay").hidden = true;
  $("placement-preview").hidden = false;
  $("camera-status").textContent = "Camera off · frames stay on this device";
  $("stop-camera").disabled = true;
  renderControls();
}
$("stop-camera").addEventListener("click", stopCamera);
$("capture-frame").addEventListener("click", () =>
  act(async () => {
    const capture = await camera.capture({ sessionId: current.id });
    const frame = {
      markers: capture.markers,
      resolution: capture.resolution,
      capturedAt: capture.capturedAt,
      calibrationId: capture.calibrationId,
    };
    showSession(
      await api(`/api/commissioning/sessions/${current.id}/vision`, {
        frame,
        frameDigest: capture.frameDigest,
        source: "browser-camera",
        camera: capture.camera ?? null,
      }),
    );
    feedback(
      "Camera measurement saved. The server recomputed placement from the marker corners.",
    );
  }),
);
window.addEventListener("pagehide", () => camera?.stop());

try {
  config = await api("/api/config");
  $("mode").textContent =
    config.mode === "simulation" ? "Local rehearsal" : "Physical adapter";
  $("rehearsal-controls").hidden = config.mode !== "simulation";
  $("physical-controls").hidden = config.mode === "simulation";
  await refreshHistory();
  const newOrder = sessionStorage.getItem("proof-ready-new-order");
  sessionStorage.removeItem("proof-ready-new-order");
  if (sessions.length && !newOrder) showSession(sessions[0]);
  feedback(
    config.mode === "simulation"
      ? "Local rehearsal uses synthetic physical evidence. No funds move. Contact readings are simulated."
      : "Physical reads use the configured device. Start a fresh capture for each attempt.",
  );
  renderControls();
} catch (error) {
  feedback(error.message, true);
}
