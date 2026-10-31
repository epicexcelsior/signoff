const labels = {
  cardano: "Paid independent inspection",
  api3: "Authenticated security policy",
  hardware: "Physical commissioning",
  submission: "Submission",
};
const caseLabels = {
  "valid-causes-state-change": "Valid source changes contract state",
  "edited-rejects": "Edited evidence rejects",
  "stale-rejects": "Stale evidence rejects",
  "other-request-rejects": "Another request rejects",
  "wrong-key-rejects": "Another signing key rejects",
};
const recordLabels = {
  "esp32-optical-diagnostic": "Real device response · 72 of 72 optical symbols",
  "esp32-optical-flash": "Device firmware and startup",
  "api3-faucet-mint": "Test funding",
  "api3-paid-nvd-first": "Paid original NVD response",
  "api3-policy-deployment": "Deployed security policy",
  "deployed-policy-helper-historical": "Historical policy evaluation",
  "masumi-hosted-execution-only": "Hosted execution-only inspection",
  "cardano-seller-registration": "Cardano seller registration",
  "cardano-paid-inspection-delivery": "Paid independent inspection",
  "cardano-seller-collection": "Confirmed inspector payment",
  "api3-paid-nvd-final": "Final paid NVD response",
  "api3-deployed-five-cases": "Five deployed source checks",
  "api3-paid-review-finalization": "Mined policy rejection",
};
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function cardanoLink(hash, label) {
  if (!/^[0-9a-f]{64}$/i.test(hash ?? "")) return null;
  const link = element("a", label);
  link.href = `https://preprod.cardanoscan.io/transaction/${hash}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

async function paidInspectionSummary(records) {
  const section = document.getElementById("judge-paid-inspection");
  section.replaceChildren();
  const delivery = records.find(
    (record) => record.id === "cardano-paid-inspection-delivery",
  );
  if (!delivery) return;
  const collection = records.find(
    (record) => record.id === "cardano-seller-collection",
  );
  const report = await inspectorReport(delivery);
  section.replaceChildren(
    element("h3", "One inspection. Trace its result and payment."),
    element(
      "p",
      "Historical inspection of synthetic input. The useful REVIEW identifies missing physical evidence. It does not approve this installation.",
      "note",
    ),
  );
  const steps = element("ol", undefined, "judge-lifecycle");
  for (const [title, text, hash] of [
    ["Original input", "Synthetic capture, preserved unchanged"],
    ["Useful report", delivery.outcome],
    [
      "Result on chain",
      "Confirmed result transaction",
      delivery.resultTransactionHash,
    ],
    [
      "Seller payment",
      delivery.sellerPaid
        ? "Positive seller receipt confirmed"
        : "Collection pending",
      collection?.transactionHash,
    ],
  ]) {
    const item = element("li");
    item.append(element("strong", title), element("span", text));
    const link = cardanoLink(hash, "Open original transaction ↗");
    if (link) item.append(link);
    steps.append(item);
  }
  section.append(steps, report);
}

async function inspectorReport(record) {
  const details = element("details", undefined, "judge-report");
  details.append(
    element(
      "summary",
      `Read the original inspection report · ${record.outcome}`,
    ),
  );
  const response = await fetch(
    "/api/submission-evidence/artifacts/paid-inspection-report",
  );
  if (!response.ok)
    throw new Error("The original inspection report is unavailable.");
  const bytes = await response.arrayBuffer();
  const digest = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  ]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  if (digest !== record.usefulReportSha256)
    throw new Error(
      "The inspection report differs from its saved manifest hash.",
    );
  const report = JSON.parse(new TextDecoder().decode(bytes));
  details.append(
    element(
      "p",
      "Original capture: synthetic. Inspection purchase: real Cardano Preprod escrow. This report does not establish physical acceptance.",
    ),
  );
  for (const predicate of report.predicates) {
    const row = element("div", undefined, "result");
    row.append(
      element("strong", predicate.id),
      element("span", predicate.outcome, "outcome"),
      element("span", predicate.reason),
    );
    details.append(row);
  }
  details.append(
    element(
      "p",
      "The original file hash matches the saved manifest. Seller collection and physical acceptance remain separate checks.",
      "note",
    ),
  );
  return details;
}

export async function refreshJudgeEvidence() {
  const status = document.getElementById("judge-status");
  status.textContent = "Reading saved original evidence…";
  try {
    const response = await fetch("/api/submission-evidence");
    if (!response.ok)
      throw new Error(`Evidence read failed: HTTP ${response.status}.`);
    const { manifest, artifacts, scope } = await response.json();
    const requirements = document.getElementById("judge-requirements");
    requirements.replaceChildren();
    for (const [id, value] of Object.entries(manifest.mandatoryEvidence)) {
      const card = element("div");
      card.append(
        element("strong", labels[id] ?? id),
        element("span", value.status.replaceAll("-", " ")),
      );
      if (value.remaining?.length)
        card.append(element("p", value.remaining[0]));
      requirements.append(card);
    }
    await paidInspectionSummary(manifest.liveEvidence);
    const records = document.getElementById("judge-records");
    records.replaceChildren();
    for (const record of manifest.liveEvidence) {
      const row = element("article", undefined, "judge-record");
      row.append(element("h3", recordLabels[record.id] ?? record.id));
      row.append(
        element(
          "p",
          `${record.status.replaceAll("-", " ")}${record.signedAt ? ` · source ${new Date(Number(record.signedAt) * 1000).toISOString()}` : ""}`,
        ),
      );
      const scopeText =
        record.qualificationScope ?? record.scope ?? record.verification;
      if (scopeText) row.append(element("p", scopeText));
      if (
        record.transactionHash &&
        record.chainId === 84532 &&
        /^0x[0-9a-f]{64}$/i.test(record.transactionHash)
      ) {
        const link = element("a", record.transactionHash);
        link.href = `https://sepolia.basescan.org/tx/${record.transactionHash}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        row.append(link);
      }
      if (
        record.network === "Cardano Preprod" &&
        /^[0-9a-f]{64}$/i.test(record.transactionHash ?? "")
      ) {
        const link = element("a", record.transactionHash);
        link.href = `https://preprod.cardanoscan.io/transaction/${record.transactionHash}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        row.append(link);
      }
      if (record.taskId) row.append(element("code", `Task ${record.taskId}`));
      records.append(row);
    }
    const cases = document.getElementById("judge-cases");
    cases.replaceChildren();
    for (const [id, value] of Object.entries(
      manifest.mandatoryEvidence.api3.judgeCases,
    )) {
      cases.append(
        element("dt", caseLabels[id] ?? id),
        element("dd", value.replaceAll("-", " ")),
      );
    }
    const downloads = document.getElementById("judge-artifacts");
    downloads.replaceChildren();
    for (const artifact of artifacts) {
      const item = element("div");
      const link = element(
        "a",
        `Download ${artifact.id.replaceAll("-", " ")} ↓`,
        "secondary",
      );
      // Paths come from an explicit server allowlist, never from runtime records.
      link.href = `/api/submission-evidence/artifacts/${encodeURIComponent(artifact.id)}`;
      link.download = `${artifact.id}.json`;
      item.append(link, element("code", `SHA-256 ${artifact.sha256}`));
      downloads.append(item);
    }
    status.textContent = `${scope} Manifest checked ${manifest.checkedAt}.`;
  } catch (error) {
    status.textContent = `${error.message} Refresh evidence to try again.`;
  }
}
