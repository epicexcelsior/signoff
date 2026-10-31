import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPublicKey } from "node:crypto";
import { verifyOpticalExecution } from "../src/optical.js";

// Replay the actual device receipt at its original verification time. No BLE call.
test("preserved physical diagnostic verifies and rejects edited challenge evidence", () => {
  const evidence = JSON.parse(
    readFileSync(
      new URL(
        "../submission/evidence/esp32-optical-diagnostic.json",
        import.meta.url,
      ),
    ),
  );
  const key = createPublicKey({ key: evidence.publicKeyJwk, format: "jwk" });
  const jwk = key.export({ format: "jwk" });
  const publicKey =
    "04" +
    Buffer.from(jwk.x, "base64url").toString("hex") +
    Buffer.from(jwk.y, "base64url").toString("hex");
  const input = {
    receipt: evidence.receipt,
    challenge: evidence.challenge,
    provider: evidence.receipt.provider,
    publicKey,
    verifiedAt: evidence.finishedAt,
  };
  assert.doesNotThrow(() => verifyOpticalExecution(input));
  assert.throws(() =>
    verifyOpticalExecution({
      ...input,
      receipt: { ...input.receipt, bits: "00000000" },
    }),
  );
  assert.throws(() =>
    verifyOpticalExecution({
      ...input,
      challenge: { ...input.challenge, nonce: input.challenge.nonce + 1 },
    }),
  );
  assert.equal(evidence.cameraDiagnostic.matched, 72);
  assert.equal(evidence.cameraDiagnostic.trackedCommissioningCapture, false);
  assert.equal(evidence.claimsAfter, 62);
  assert.equal(Object.hasOwn(evidence, "recording"), false);
});

test("original real-camera negative packet preserves disabled contact and rejects edits", async () => {
  const { verifyPacket } = await import("../src/commissioning.js");
  const manifest = JSON.parse(
    readFileSync(
      new URL("../submission/evidence-manifest.json", import.meta.url),
    ),
  );
  const record = manifest.liveEvidence.find(
    (item) => item.id === "physical-camera-placement-rework",
  );
  const bytes = readFileSync(
    new URL(
      "../submission/evidence/physical-camera-rework-packet.json",
      import.meta.url,
    ),
  );
  const packet = JSON.parse(bytes);
  const { createHash } = await import("node:crypto");
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    record.artifactSha256,
  );
  assert.equal(packet.evidence.sourceMode, "physical");
  assert.equal(packet.evidence.vision.source, "browser-camera");
  assert.equal(packet.evidence.vision.measurement.state, "FAIL");
  assert.equal(packet.evidence.device.length, 0);
  assert.equal(packet.evidence.optical, null);
  assert.equal(packet.workOrder.device.contact.sensor, "disabled-contact");
  assert.equal(verifyPacket(packet, record.workOrderDigest).decision, "REWORK");
  packet.evidence.vision.frame.markers[0].corners[0].x++;
  assert.throws(() => verifyPacket(packet, record.workOrderDigest));
});
