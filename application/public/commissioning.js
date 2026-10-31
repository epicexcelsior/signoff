import { createVisionController } from "/vision/controller.js";
import { refreshJudgeEvidence } from "/judge-evidence.js";

const $ = (id) => document.getElementById(id);
let config;
let order = null;
let current = null;
let orders = [];
let sessions = [];
let camera = null;
let busy = false;
let outcomeUnknown = false;
const uncertainMessage =
  "OUTCOME_UNKNOWN: The station response was lost. Refresh to inspect the saved attempt before starting another operation.";
let orderIntent = null;
let attemptIntent = null;

async function api(path, body) {
  let response;
  let result;
  try {
    response = await fetch(path, {
      // Exceeds the bounded BLE adapter timeout. Aborting observation never retries a write.
      signal: AbortSignal.timeout(65000),
      ...(body === undefined
        ? {}
        : {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-FieldProof-Token": config.token,
            },
            body: JSON.stringify(body),
          }),
    });
    result = await response.json();
  } catch {
    if (body !== undefined) outcomeUnknown = true;
    const error = new Error(
      body === undefined
        ? "CONNECTION_FAILED: Cannot read the station. Check the local connection, then refresh."
        : uncertainMessage,
    );
    error.code = body === undefined ? "CONNECTION_FAILED" : "OUTCOME_UNKNOWN";
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`${result.code}: ${result.error}`);
    error.code = result.code;
    throw error;
  }
  return result;
}
function feedback(text, error = false) {
  if (outcomeUnknown) {
    text = uncertainMessage;
    error = true;
  }
  $("feedback").textContent = text;
  $("feedback").dataset.error = String(error);
}
async function act(run) {
  if (busy || outcomeUnknown) return;
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
function opticalCameraReady() {
  const state = camera?.getState();
  return (
    state?.phase === "ACTIVE" &&
    current?.vision?.source === "browser-camera" &&
    current.vision.measurement?.state === "PASS" &&
    Boolean(state.camera?.id) &&
    state.camera.id === current.vision.camera?.id &&
    state.calibrationId === current.vision.frame.calibrationId
  );
}
function renderControls() {
  const blocked = busy || outcomeUnknown;
  $("start-camera").disabled = blocked || !order;
  $("approve").disabled = blocked || !config || Boolean(order);
  $("asset").disabled = blocked || Boolean(order);
  $("run-rehearsal").disabled = blocked || !order;
  $("begin-capture").disabled = blocked || !order;
  $("scenario").disabled = blocked;
  $("camera-device").disabled =
    blocked || current?.optical?.stage === "EXECUTING";
  $("history").disabled = blocked;
  $("new-order").hidden = !order;
  $("new-order").disabled = blocked;
  $("reset-presentation").disabled = blocked || !config;
  $("focus-view").disabled = !config;
  document.body.dataset.busy = String(busy);
  for (const id of ["open-real-inspection", "check-demo"])
    $(id).disabled = blocked || !config || config.mode === "simulation";
  const active = current?.state === "CAPTURING";
  const beforeCaptureWindow = active && Date.now() < current.startedAt;
  const expired = active && Date.now() > current.expiresAt;
  $("capture-deadline").textContent = !active
    ? ""
    : beforeCaptureWindow
      ? "Waiting for the camera clock to enter the capture window. If this persists, synchronize the phone and station clocks."
      : expired
        ? "Capture window expired. Start a new attempt, or close this attempt to preserve its result."
        : `Capture window: ${Math.max(0, Math.ceil((current.expiresAt - Date.now()) / 1000))} seconds remain.`;
  $("capture-frame").disabled =
    blocked ||
    beforeCaptureWindow ||
    expired ||
    !active ||
    Boolean(current?.vision) ||
    camera?.getState().phase !== "ACTIVE";
  $("contact-step").disabled =
    blocked ||
    config?.contact_enabled === false ||
    expired ||
    !active ||
    Boolean(current?.pending) ||
    current?.device.length >= 3;
  $("inspect").disabled =
    blocked ||
    !active ||
    Boolean(current?.pending) ||
    current?.optical?.stage === "EXECUTING";
  $("capture-optical").disabled =
    blocked ||
    expired ||
    !active ||
    !order?.optical ||
    !current?.vision ||
    current?.vision.source !== "browser-camera" ||
    Boolean(current?.optical && current.optical.stage !== "PREPARED") ||
    !opticalCameraReady() ||
    !config?.optical_authorized;
  if (
    active &&
    !current.optical?.capture &&
    current?.vision?.source === "browser-camera" &&
    !opticalCameraReady()
  )
    $("optical-status").textContent =
      "Start a new attempt and save a passing measurement from the active camera before the LED test.";
  for (const id of [
    "prepare-inspection",
    "reconcile-acceptance",
    "contract-plan",
  ])
    $(id).disabled = blocked || !current?.report;
  $("verify").disabled = blocked || !current?.report;
  $("tamper").disabled = blocked || !current?.report;
  const instruction =
    config?.contact_enabled === false
      ? "This board disables contact input. Contact testing requires reviewed hardware and a new enrolled profile."
      : expired
        ? "The capture window expired. Start a new attempt for another physical read."
        : current?.pending
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
  const paidOutcome =
    session.acceptance?.predicates.find(
      (entry) => entry.id === "paid-inspection",
    )?.outcome ?? "REVIEW";
  for (const [id, outcome, description] of [
    [
      "camera",
      session.vision?.measurement?.state ?? "REVIEW",
      session.vision
        ? `Placement ${session.vision.measurement.state} · inspect measurement`
        : "No saved measurement",
    ],
    ["inspector", paidOutcome, `Payment ${paidOutcome} · open saved evidence`],
    [
      "decision",
      session.acceptance?.decision === "REWORK"
        ? "FAIL"
        : session.acceptance?.decision === "READY"
          ? "PASS"
          : "REVIEW",
      `${session.acceptance?.decision ?? "REVIEW"} · see the required next step`,
    ],
  ]) {
    $("trail-" + id).dataset.outcome = outcome;
    $("trail-" + id).querySelector(".trail-icon").textContent =
      outcome === "FAIL" ? "!" : outcome === "PASS" ? "✓" : "…";
    $("trail-" + id + "-state").textContent = description;
  }
  $("history").value = session.id;
  order = orders.find((item) => item.id === session.workOrderId) ?? null;
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
  $("evidence-origin").textContent =
    session.sourceMode === "fixture"
      ? "Current attempt · synthetic rehearsal · no physical or payment claim"
      : "Current attempt · physical adapter · inspect every acceptance requirement";
  $("optical-status").textContent =
    session.optical?.evaluation?.reason ??
    session.optical?.error?.message ??
    (session.optical
      ? `Optical ${session.optical.stage.toLowerCase()}`
      : "Place the LED beside the device marker in the approved optical region. Emission requires explicit authorization.");
  $("results").replaceChildren();
  $("acceptance-gates").replaceChildren();
  $("adapter-status").replaceChildren();
  $("adapter-status").hidden = !session.report;
  $("acceptance-gates").hidden = !session.report;
  $("download").hidden = !session.report;
  $("packet-status").textContent = "";
  const geometry = session.vision?.measurement?.quality;
  $("placement-summary").hidden = !geometry || !session.report;
  $("placement-summary").textContent = geometry
    ? `Camera placement · ${session.vision.measurement.state}. Offset ${geometry.offsetMm.toFixed(1)} mm / limit ${order.vision.tolerance.positionMm} mm. Angle ${geometry.angleErrorDeg.toFixed(1)}° / limit ${order.vision.tolerance.angleDeg}°.`
    : "";
  $("acceptance-decision").textContent =
    session.acceptance?.decision ?? "REVIEW";
  $("decision-block").dataset.decision =
    session.acceptance?.decision ?? "REVIEW";
  $("inspection-outcome").textContent = session.report
    ? `Local inspection: ${session.report.outcome}`
    : "Capture in progress";
  const incomplete = session.report
    ? [...session.report.predicates, ...session.acceptance.predicates]
    : [];
  const failed = incomplete.filter((p) => p.outcome === "FAIL");
  const next =
    ["session", "device", "vision"]
      .map((id) => failed.find((predicate) => predicate.id === id))
      .find(Boolean) ??
    failed[0] ??
    incomplete.find((p) => p.outcome === "REVIEW");
  const actions = {
    session: "Start a fresh attempt within the capture window.",
    device:
      "Check the device connection and enrolled identity before another attempt.",
    function:
      "Check the button, then follow the requested states in a new attempt.",
    delivery: "Check the receiving monitor before another attempt.",
    vision:
      "Align both markers with the approved target, then save a new camera measurement.",
    optical: "Capture the complete signed LED test with both markers visible.",
    "physical-origin":
      "Capture the actual installation with the physical adapter.",
    "paid-inspection":
      "Complete the independent paid inspection and verify its seller receipt.",
    "software-policy":
      "Check the authenticated security policy for the declared build.",
  };
  $("next-action").textContent =
    `Next action: ${session.report ? (actions[next?.id] ?? next?.reason ?? "Check external acceptance again before handover.") : "Follow the contact sequence and save a camera measurement."}`;
  $("report-description").textContent =
    session.acceptance?.decision === "READY"
      ? "The configured readers verified every acceptance requirement. Check external evidence again before using an expired decision."
      : session.report?.outcome === "FAIL"
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
        const geometry = session.vision?.measurement?.quality;
        if (
          className === "result-reason" &&
          predicate.id === "vision" &&
          Number.isFinite(geometry?.offsetMm) &&
          Number.isFinite(geometry?.angleErrorDeg)
        )
          cell.textContent += ` Estimated offset: ${geometry.offsetMm.toFixed(1)} mm (limit ${order.vision.tolerance.positionMm} mm). Estimated angle difference: ${geometry.angleErrorDeg.toFixed(1)}° (limit ${order.vision.tolerance.angleDeg}°). Values use the declared reference size.`;
        if (className === "outcome") cell.dataset.outcome = value;
        row.append(cell);
      }
      $("results").append(row);
    }
    for (const predicate of session.acceptance.predicates.filter(
      (entry) => entry.id !== "inspection",
    )) {
      const gate = document.createElement("div");
      gate.dataset.outcome = predicate.outcome;
      const title = document.createElement("strong");
      title.textContent = `${predicate.id === "physical-origin" ? "physical adapter mode" : predicate.id.replaceAll("-", " ")} · ${predicate.outcome}`;
      const reason = document.createElement("p");
      reason.textContent =
        predicate.id === "physical-origin" && predicate.outcome === "PASS"
          ? "Configuration only. Device signatures and camera-origin authentication remain separate checks."
          : predicate.reason;
      gate.append(title, reason);
      $(
        predicate.id === "physical-origin"
          ? "adapter-status"
          : "acceptance-gates",
      ).append(gate);
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
  if (!sessions.length || !current) {
    const option = new Option(
      sessions.length ? "Select a saved attempt" : "No attempts yet",
      "",
    );
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
  if (busy || outcomeUnknown) return;
  sessionStorage.setItem("proof-ready-new-order", "true");
  location.reload();
});
$("reset-presentation").addEventListener("click", () => {
  stopCamera();
  sessionStorage.setItem("proof-ready-new-order", "true");
  sessionStorage.setItem("proof-ready-reset", "true");
  location.reload();
});
$("focus-view").addEventListener("click", () => {
  const focused = document.body.dataset.focus !== "true";
  document.body.dataset.focus = String(focused);
  $("focus-view").setAttribute("aria-pressed", String(focused));
  $("focus-view").textContent = focused ? "Exit focus view" : "Focus view";
});
$("trail-camera").addEventListener("click", () => {
  $("physical-checks").open = true;
  $("physical-checks").scrollIntoView({
    block: "center",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
});
$("trail-inspector").addEventListener("click", () => {
  const report = document.querySelector(".judge-physical-report");
  if (report) report.open = true;
  $("judge-panel").scrollIntoView({
    block: "start",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
});
$("trail-decision").addEventListener("click", () => {
  $("report-heading").scrollIntoView({
    block: "start",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
});
async function openRealInspection() {
  $("demo-status").textContent =
    "Opening saved evidence. The payment check has not run in this view.";
  feedback("Opening the original real-camera inspection…");
  const { manifest } = await api("/api/submission-evidence");
  const record = manifest.liveEvidence.find(
    (entry) =>
      entry.id === "cardano-physical-camera-inspection" &&
      entry.physicalCameraEvidence === true &&
      entry.sellerPaid === true,
  );
  if (!record)
    throw new Error(
      "No reviewed real-camera paid inspection is available. Use Saved attempts to inspect existing evidence.",
    );
  await refreshHistory();
  for (const session of sessions.filter(
    (entry) =>
      entry.sourceMode === "physical" &&
      entry.report &&
      entry.workOrderDigest === record.workOrderDigest,
  )) {
    const packet = await api(
      `/api/commissioning/sessions/${session.id}/packet`,
    );
    if (packet.digests.evidence !== record.evidenceBundleDigest) continue;
    const saved = await api(`/api/commissioning/sessions/${session.id}`);
    if (camera) stopCamera();
    showSession(saved);
    $("inspection-setup").open = false;
    $("physical-checks").open = false;
    $("report-heading").scrollIntoView({ block: "start" });
    return;
  }
  throw new Error(
    "The original real-camera inspection is absent from this station. Open the real-evidence station on port 4022.",
  );
}
$("open-real-inspection").addEventListener("click", () =>
  act(async () => {
    await openRealInspection();
    feedback(
      "Real inspection opened. The saved camera placement failed. Open Judge evidence to trace the paid report and original payment.",
    );
  }),
);
async function checkDemo() {
  try {
    await openRealInspection();
    $("demo-status").textContent =
      "Checking the original inspector payment and evidence packet…";
    feedback("Checking the original inspector payment and evidence packet…");
    showSession(
      await api(
        `/api/commissioning/sessions/${current.id}/reconcile-acceptance`,
        {},
      ),
    );
    const packet = await api(
      `/api/commissioning/sessions/${current.id}/packet`,
    );
    const verified = await api("/api/commissioning/verify", {
      packet,
      expectedWorkOrderDigest: current.workOrderDigest,
    });
    $("packet-status").textContent =
      `Packet verified against the saved work order. Inspection ${verified.report}; acceptance ${verified.decision}.`;
    await refreshHistory();
    const paid = current.acceptance.predicates.find(
      (entry) => entry.id === "paid-inspection",
    );
    if (paid?.outcome !== "PASS")
      throw new Error(
        `Payment check needs attention: ${paid?.reason ?? "No verified receipt is available."} Open Phone demo for the saved real report and receipts. Check the internet connection and inspector service before another Check demo.`,
      );
    $("demo-status").textContent =
      `Demo checked at ${new Date().toLocaleTimeString()}. Packet verified. Inspector payment PASS. Installation ${current.acceptance.decision}.`;
    feedback(
      "Demo check complete. Packet verified and inspector payment PASS. The installation remains " +
        current.acceptance.decision +
        ".",
    );
  } catch (error) {
    $("demo-status").textContent =
      `Demo check did not complete. ${error.message}`;
    throw error;
  }
}
$("check-demo").addEventListener("click", () => act(checkDemo));
$("refresh-evidence").addEventListener("click", () => refreshJudgeEvidence());
void refreshJudgeEvidence();
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
async function populateCameraDevices(activeCamera) {
  try {
    const selectedDevice = $("camera-device").value;
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (camera !== activeCamera || activeCamera.getState().phase !== "ACTIVE")
      return;
    $("camera-device").replaceChildren(new Option("Automatic rear camera", ""));
    for (const device of devices.filter((item) => item.kind === "videoinput")) {
      $("camera-device").add(
        new Option(device.label || "Camera", device.deviceId),
      );
    }
    $("camera-device").value = selectedDevice;
  } catch {
    if (camera === activeCamera && activeCamera.getState().phase === "ACTIVE")
      feedback(
        "Camera active. Cannot list camera choices. Stop the camera and start again to retry.",
        true,
      );
  }
}
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
      opticalRoi: order.optical?.roi,
      deviceId: $("camera-device").value || null,
      onState: (state) => {
        $("stop-camera").disabled = !["STARTING", "ACTIVE"].includes(
          state.phase,
        );
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
                .map((p) => {
                  if (
                    Number.isFinite(p.actual) &&
                    Number.isFinite(p.expected)
                  ) {
                    if (p.id === "position")
                      return `Move the device marker toward the target. Estimated offset: ${p.actual.toFixed(1)} mm. Limit: ${p.expected.toFixed(1)} mm.`;
                    if (p.id === "orientation")
                      return `Rotate the device marker toward the target arrow. Estimated angle difference: ${p.actual.toFixed(1)}°. Limit: ${p.expected.toFixed(1)}°.`;
                  }
                  return p.reason;
                })
                .join(" ");
      },
    });
    const startingCamera = camera;
    try {
      await startingCamera.start();
      if (
        camera !== startingCamera ||
        startingCamera.getState().phase !== "ACTIVE"
      )
        return;
      void populateCameraDevices(startingCamera);
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
  feedback("Camera stopped. Saved evidence remains unchanged.");
  renderControls();
}
$("stop-camera").addEventListener("click", stopCamera);
$("camera-device").addEventListener("change", () => {
  stopCamera();
  feedback("Camera changed. Start camera and save a new measurement.");
});
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

function downloadJson(value, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("prepare-inspection").addEventListener("click", () =>
  act(async () => {
    const request = await api(
      `/api/commissioning/sessions/${current.id}/inspection-request`,
      {},
    );
    downloadJson(request, `proof-of-ready-inspection-${current.id}.json`);
    feedback(
      "Original inspection request exported. No external Task or payment started.",
    );
  }),
);
$("reconcile-acceptance").addEventListener("click", () =>
  act(async () => {
    showSession(
      await api(
        `/api/commissioning/sessions/${current.id}/reconcile-acceptance`,
        {},
      ),
    );
    await refreshHistory();
    feedback(
      "External evidence checked through the configured readers. Inspect each acceptance requirement.",
    );
  }),
);
$("contract-plan").addEventListener("click", () =>
  act(async () => {
    const plan = await api(
      `/api/commissioning/sessions/${current.id}/contract-plan`,
      {},
    );
    downloadJson(plan, `proof-of-ready-unsigned-${current.id}.json`);
    feedback(
      "Unsigned contract calls exported. No transaction was signed or broadcast.",
    );
  }),
);
$("capture-optical").addEventListener("click", () =>
  act(async () => {
    if (!opticalCameraReady())
      throw new Error(
        "Start a new attempt and save a passing measurement from the active camera before the LED test.",
      );
    const challenge = await api(
      `/api/commissioning/sessions/${current.id}/optical-challenge`,
      {},
    );
    const capture = await camera.startOpticalCapture({
      sessionId: current.id,
      challenge: {
        bits: challenge.bits,
        halfSymbolMs: challenge.half_symbol_ms,
      },
      roi: order.optical.roi,
      maxDurationMs: 40000,
      onSample: (state) => {
        $("optical-status").textContent =
          `Keep both markers visible · ${state.sampleCount} camera samples`;
      },
    });
    try {
      await capture.ready;
      if (!opticalCameraReady())
        throw new Error(
          "The camera changed. Start a new attempt before another LED test.",
        );
      feedback(
        "Optical capture is ready. Keep the camera steady throughout the signed test.",
      );
      const executed = await api(
        `/api/commissioning/sessions/${current.id}/optical-execution`,
        {},
      );
      showSession(executed);
      if (executed.optical.stage !== "EXECUTED")
        throw new Error(
          executed.optical.error?.message ??
            "The signed optical execution did not complete.",
        );
      const evidence = await capture.finish();
      showSession(
        await api(`/api/commissioning/sessions/${current.id}/optical`, {
          capture: evidence,
        }),
      );
      feedback(
        "Original optical samples saved. The server reconstructed the complete signed test.",
      );
    } catch (error) {
      await capture.cancel();
      throw error;
    }
  }),
);
setInterval(() => {
  renderControls();
  if (current?.acceptance?.decision === "READY" && !busy)
    void act(async () => {
      showSession(await api(`/api/commissioning/sessions/${current.id}`));
      await refreshHistory();
    });
}, 1000);

try {
  config = await api("/api/config");
  $("mode").textContent =
    config.mode === "simulation" ? "Local rehearsal" : "Physical adapter";
  $("rehearsal-controls").hidden = config.mode !== "simulation";
  $("physical-controls").hidden = config.mode === "simulation";
  $("demo-launch").hidden = config.mode === "simulation";
  await refreshHistory();
  const newOrder = sessionStorage.getItem("proof-ready-new-order");
  sessionStorage.removeItem("proof-ready-new-order");
  if (sessions.length && !newOrder) {
    showSession(sessions[0]);
    if (config.mode !== "simulation" && current.report) {
      $("inspection-setup").open = false;
      $("physical-checks").open = false;
    }
  }
  feedback(
    config.mode === "simulation"
      ? "Local rehearsal uses synthetic physical evidence. No funds move. Contact readings are simulated."
      : current?.report
        ? "Saved inspection restored. Select Check demo to verify the packet and recheck the original payment."
        : "Physical reads use the configured device. Start a fresh capture for each attempt.",
  );
  renderControls();
  if (sessionStorage.getItem("proof-ready-reset")) {
    sessionStorage.removeItem("proof-ready-reset");
    feedback(
      "Presentation reset. All saved attempts, receipts, and device state remain intact. Approve a work order to begin.",
    );
  }
} catch (error) {
  feedback(error.message, true);
}
