import { renderMeasurement } from "/measurement.js";
const $ = (id) => document.getElementById(id);
let bundle;
const urls = [];
function message(id, text, error = false) {
  $(id).textContent = text;
  $(id).dataset.error = String(error);
}
async function verifyFiles() {
  if (!bundle) throw new Error("The saved evidence did not load.");
  for (const file of bundle.files) {
    const bytes = new TextEncoder().encode(file.text);
    const digest = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    if (digest !== file.sha256)
      throw new Error(
        `Saved file changed: ${file.name}. Reconnect USB and reload before using this demo.`,
      );
  }
  message(
    "verification",
    `${bundle.files.length} saved file hashes match the reviewed snapshot. This checks file integrity, not fresh payment or physical acceptance.`,
  );
}
$("verify-files").addEventListener("click", async () => {
  $("verify-files").disabled = true;
  try {
    await verifyFiles();
  } catch (error) {
    message("verification", error.message, true);
  } finally {
    $("verify-files").disabled = !bundle;
  }
});
try {
  const response = await fetch("/demo/evidence.json", {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(
      "The saved evidence is unavailable. Reconnect USB and reload this page.",
    );
  bundle = await response.json();
  await verifyFiles();
  const file = (id) =>
    JSON.parse(bundle.files.find((entry) => entry.id === id).text);
  const packet = file("physical-camera-rework-packet");
  $("saved-heading").textContent = "Installation requires rework.";
  $("saved-reason").textContent =
    "Monitoring device placement failed. Move and rotate the device marker, then repeat the missing device tests.";
  const quality = packet.evidence.vision.measurement.quality;
  renderMeasurement(
    $("saved-measurement"),
    packet.evidence.vision.measurement,
    packet.workOrder.vision,
  );
  $("placement").textContent =
    `Placement failed. ${quality.offsetMm.toFixed(1)} mm from target (allowed ${packet.workOrder.vision.tolerance.positionMm} mm). Rotation error: ${quality.angleErrorDeg.toFixed(1)}° (allowed ${packet.workOrder.vision.tolerance.angleDeg}°).`;
  for (const [hash, label] of [
    [bundle.inspection.transactionHash, "Escrow transaction"],
    [bundle.inspection.resultTransactionHash, "Result transaction"],
    [bundle.inspection.sellerReceiptTransactionHash, "Inspector payment"],
  ]) {
    if (!/^[0-9a-f]{64}$/.test(hash))
      throw new Error("An original transaction reference is invalid.");
    const link = document.createElement("a");
    link.textContent = `${label} ↗`;
    link.href = `https://preprod.cardanoscan.io/transaction/${hash}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    $("transactions").append(link);
  }
  for (const predicate of file("physical-paid-inspection-report").predicates) {
    const row = document.createElement("div");
    row.className = "result";
    const title = document.createElement("strong");
    title.textContent = `${predicate.id} · ${predicate.outcome}`;
    const reason = document.createElement("p");
    reason.textContent = predicate.reason;
    row.append(title, reason);
    $("report").append(row);
  }
  $("receipt").textContent = JSON.stringify(
    file("physical-paid-seller-receipt"),
    null,
    2,
  );
  for (const original of bundle.files) {
    const link = document.createElement("a");
    link.textContent = `Download ${original.name} ↓`;
    link.href = URL.createObjectURL(
      new Blob([original.text], { type: "application/json" }),
    );
    link.download = `${original.id}.json`;
    urls.push(link.href);
    $("files").append(link);
  }
  for (const section of document.querySelectorAll("[data-proof]"))
    section.hidden = false;
  $("verify-files").disabled = false;
  try {
    if (!("serviceWorker" in navigator))
      throw new Error("Offline storage is unavailable in this browser.");
    const existing = await navigator.serviceWorker.getRegistration("/demo/");
    let savedOffline = false;
    try {
      await Promise.race([
        navigator.serviceWorker.register("/demo/sw.js", { scope: "/demo/" }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Cannot update phone storage.")),
            8000,
          ),
        ),
      ]);
    } catch (error) {
      if (!existing?.active) throw error;
      // Existing offline storage is intentional. No live evidence is substituted.
      savedOffline = true;
    }
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Phone storage did not complete.")),
          15000,
        ),
      ),
    ]);
    message(
      "phone-status",
      savedOffline
        ? "Offline saved view. File hashes match the saved snapshot. Reconnect USB to update it. Fresh tests require the live station."
        : "Saved in this browser. This evidence viewer can reopen without the laptop. Fresh tests still require the live station.",
    );
  } catch (error) {
    message(
      "phone-status",
      `${error.message} Keep USB connected and reload to save this demo.`,
      true,
    );
  }
} catch (error) {
  bundle = null;
  message(
    "verification",
    `${error.message} No evidence check completed.`,
    true,
  );
  message(
    "phone-status",
    "Saved evidence did not load. Reconnect USB, then reload. Do not treat this screen as a completed check.",
    true,
  );
}
window.addEventListener("pagehide", () => {
  for (const url of urls) URL.revokeObjectURL(url);
});

function updateExplorerLinks() {
  for (const link of document.querySelectorAll("#transactions a")) {
    const offline = !navigator.onLine;
    link.setAttribute("aria-disabled", String(offline));
    link.title = offline
      ? "Internet is needed. The saved receipt is still available below."
      : "Open original transaction";
  }
}
window.addEventListener("online", updateExplorerLinks);
window.addEventListener("offline", updateExplorerLinks);
$("transactions").addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (link?.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
    message(
      "verification",
      "Internet is needed for the explorer. The saved report and payment receipt are still available.",
    );
  }
});
updateExplorerLinks();
