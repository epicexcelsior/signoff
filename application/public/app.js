const $ = (id) => document.getElementById(id);
let config;
let selected;
let busy = false;
let editorJob;
let latestJob;
let polling = false;

async function api(path, body) {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "X-Fieldproof-Token": config.token,
          },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(body === undefined ? 5000 : 120000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? `Request failed (${response.status}).`);
  return result;
}

function feedback(message, error = false) {
  $("feedback").textContent = message;
  $("feedback").classList.toggle("error", error);
}

function renderDecision(job) {
  const now = Math.floor(Date.now() / 1000);
  const expired = job.decision.accepted && now > job.decision.valid_until;
  const decision = expired
    ? {
        ...job.decision,
        accepted: false,
        decision: "WAIT",
        reason: "The cached observation expired. Request a new physical check.",
      }
    : job.decision;
  $("decision-heading").textContent = decision.decision;
  $("reason").textContent = decision.reason;
  $("contact-state").textContent = decision.accepted
    ? `Verified ${decision.state.toLowerCase()} contact`
    : "Awaiting fresh evidence";
  $("gate").dataset.state = decision.accepted
    ? decision.state.toLowerCase()
    : "unknown";
  $("freshness").textContent = decision.accepted
    ? `Fresh · ${Math.max(0, decision.valid_until - now)}s left`
    : job.verification
      ? "Observation expired"
      : "No fresh observation";
  $("age").textContent =
    decision.completed_at === undefined
      ? "—"
      : `${Math.max(0, now - decision.completed_at)}s`;
  $("samples").textContent = job.verification?.sample_agreement ?? "—";
}

function render(job) {
  selected = job.id;
  latestJob = job;
  $("record-id").textContent =
    `Check ${job.id} · ${job.contact.provider} · ${job.contact.sensor}`;
  renderDecision(job);
  $("payment-state").textContent = job.payment
    ? ({
        simulated: "Simulated · no funds moved",
        confirmed: "Confirmed on Preprod",
        unknown: "Unresolved",
        unsubmitted: "Not submitted",
      }[job.payment.status] ?? job.payment.status)
    : "Awaiting payment";
  $("payment-detail").textContent =
    job.mode === "simulation"
      ? "Simulation exercises the local ledger and signature checks. It does not prove a Cardano payment or physical observation."
      : "2 tADA direct payment. A failed observation has no automatic refund.";
  $("transaction").textContent = job.payment?.transaction ?? "";
  $("recovery").hidden =
    job.mode === "simulation" ||
    !["PAID", "PAYMENT_UNKNOWN"].includes(job.state);
  $("reconcile").hidden = job.state !== "PAYMENT_UNKNOWN";
  $("observe").hidden = job.state !== "PAID";
  $("events").replaceChildren(
    ...job.events.map((event) => {
      const item = document.createElement("li");
      const kind = document.createElement("strong");
      kind.textContent = event.kind.replaceAll("_", " ");
      const detail = document.createElement("span");
      detail.textContent = event.detail;
      const at = document.createElement("time");
      at.dateTime = new Date(event.at * 1000).toISOString();
      at.textContent = new Date(event.at * 1000).toLocaleTimeString();
      item.append(kind, detail, at);
      return item;
    }),
  );
  if (job.receipt && editorJob !== job.id) {
    $("receipt").value = JSON.stringify(job.receipt, null, 2);
    editorJob = job.id;
    $("verification").textContent =
      "The stored evidence stays unchanged when you test a copy.";
    delete $("verification").dataset.valid;
  } else if (!job.receipt) {
    $("receipt").value = "";
    editorJob = undefined;
  }
  for (const name of ["original", "change", "verify"])
    $(name).disabled = !job.receipt;
}

async function history() {
  const jobs = await api("/jobs");
  $("history").replaceChildren(
    ...(jobs.length
      ? jobs.map((job) => {
          const option = document.createElement("option");
          option.value = job.id;
          option.textContent = `${job.id} / ${job.state.toLowerCase().replaceAll("_", " ")}`;
          return option;
        })
      : [new Option("No checks yet", "")]),
  );
  if (selected && jobs.some((job) => job.id === selected))
    $("history").value = selected;
  else if (jobs[0]) render(jobs[0]);
}

async function action(run) {
  if (busy) return;
  busy = true;
  $("run").disabled = true;
  try {
    await run();
    await history();
  } catch (error) {
    feedback(error.message, true);
  } finally {
    busy = false;
    $("run").disabled = false;
  }
}

$("run").addEventListener("click", () =>
  action(async () => {
    feedback("Creating one observation request…");
    const body = { idempotency_key: crypto.randomUUID() };
    if (config.mode === "simulation")
      body.closed =
        document.querySelector("input[name=contact]:checked").value ===
        "closed";
    let job = await api("/jobs", body);
    render(job);
    if (config.mode === "simulation") {
      feedback("Accepting a simulated payment. No funds move.");
      job = await api(`/jobs/${job.id}/payment`, { simulation: job.id });
      render(job);
      job = await api(`/jobs/${job.id}/observe`, {});
      render(job);
      feedback(
        job.state === "COMPLETE"
          ? "Check complete. Inspect the signed response below."
          : job.error,
        job.state !== "COMPLETE",
      );
    } else {
      feedback(
        `Check created. Use the authorized buyer CLI to prepare and send payment for ${job.id}.`,
      );
    }
  }),
);
$("history").addEventListener("change", () =>
  action(async () => {
    if ($("history").value) render(await api(`/jobs/${$("history").value}`));
  }),
);
$("original").addEventListener("click", () =>
  action(async () => {
    editorJob = undefined;
    render(await api(`/jobs/${selected}`));
  }),
);
$("change").addEventListener("click", () => {
  try {
    const receipt = JSON.parse($("receipt").value);
    receipt.result.closed = !receipt.result.closed;
    $("receipt").value = JSON.stringify(receipt, null, 2);
    $("verification").textContent =
      "One contact value changed. Verify the edited receipt.";
    delete $("verification").dataset.valid;
  } catch {
    $("verification").textContent =
      "Use a valid JSON receipt before changing a value.";
  }
});
$("verify").addEventListener("click", async () => {
  $("verify").disabled = true;
  try {
    const result = await api(
      `/jobs/${selected}/verify`,
      JSON.parse($("receipt").value),
    );
    $("verification").textContent =
      `ACCEPTED · ${result.state} · ${result.decision}. The signature, request, and age pass.`;
    $("verification").dataset.valid = "true";
  } catch (error) {
    $("verification").textContent = `REJECTED · WAIT. ${error.message}`;
    $("verification").dataset.valid = "false";
  } finally {
    $("verify").disabled = false;
  }
});
for (const name of ["reconcile", "observe"]) {
  $(name).addEventListener("click", () =>
    action(async () => {
      feedback(
        name === "reconcile"
          ? "Checking the original transaction. No payment is submitted."
          : "Requesting one fresh contact observation…",
      );
      const job = await api(`/jobs/${selected}/${name}`, {});
      render(job);
      feedback(
        job.error ??
          `Check state: ${job.state.toLowerCase().replaceAll("_", " ")}.`,
        Boolean(job.error),
      );
    }),
  );
}

try {
  config = await api("/config");
  $("mode").textContent =
    config.mode === "simulation"
      ? "Simulation / no funds"
      : "Cardano / Preprod";
  $("simulation-controls").hidden = config.mode !== "simulation";
  $("mode-description").textContent =
    config.mode === "simulation"
      ? "Choose a simulated contact state. Run the full local flow with a signed test observation."
      : "Buy a fresh reading from the pinned physical contact. Sign and send the payment through the authorized buyer CLI.";
  $("run").firstChild.textContent =
    config.mode === "simulation"
      ? "Run simulated check "
      : "Create paid check ";
  await history();
  $("run").disabled = false;
  feedback(
    config.mode === "simulation"
      ? "Ready. Simulation uses a local signing key."
      : "Ready. No payment starts from this browser.",
  );
  setInterval(async () => {
    if (latestJob) renderDecision(latestJob);
    if (!selected || busy || polling) return;
    polling = true;
    const id = selected;
    try {
      const job = await api(`/jobs/${id}`);
      if (id === selected && !busy) render(job);
    } catch (error) {
      if (id !== selected || busy) return;
      latestJob = {
        ...latestJob,
        decision: {
          ...latestJob.decision,
          accepted: false,
          decision: "WAIT",
          reason:
            "The local service is unavailable. Obtain a fresh answer before dispatch.",
        },
      };
      renderDecision(latestJob);
      feedback(error.message, true);
    } finally {
      polling = false;
    }
  }, 1000);
} catch (error) {
  feedback(error.message, true);
}
