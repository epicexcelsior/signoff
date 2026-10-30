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
  "api3-faucet-mint": "Test funding",
  "api3-paid-nvd-first": "Paid original NVD response",
  "api3-policy-deployment": "Deployed security policy",
  "deployed-policy-helper-historical": "Historical policy evaluation",
  "masumi-hosted-execution-only": "Hosted execution-only inspection",
};
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
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
        element("span", value.status),
      );
      if (value.remaining?.length)
        card.append(element("p", value.remaining[0]));
      requirements.append(card);
    }
    const records = document.getElementById("judge-records");
    records.replaceChildren();
    for (const record of manifest.liveEvidence) {
      const row = element("article", undefined, "judge-record");
      row.append(element("h3", recordLabels[record.id] ?? record.id));
      row.append(
        element(
          "p",
          `${record.status}${record.signedAt ? ` · source ${new Date(Number(record.signedAt) * 1000).toISOString()}` : ""}`,
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
