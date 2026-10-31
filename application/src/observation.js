import { generateKeyPairSync, randomInt, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { receiptMessage } from "./evidence.js";
import { AppError } from "./store.js";

const execute = promisify(execFile);

export function simulationIdentity(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const jwk = publicKey.export({ format: "jwk" });
  const identity = {
    publicKey: `04${Buffer.from(jwk.x, "base64url").toString("hex")}${Buffer.from(jwk.y, "base64url").toString("hex")}`,
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
  };
  try {
    writeFileSync(path, JSON.stringify(identity), { mode: 0o600, flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    return JSON.parse(readFileSync(path, "utf8"));
  }
  return identity;
}

export function createChallenge(id, now = Math.floor(Date.now() / 1000)) {
  return {
    request_id: id,
    nonce: randomInt(1, 0x7fffffff),
    timestamp: now,
    expiration: now + 30,
  };
}

export function simulatedReceipt(challenge, contact, privateKey, closed) {
  const now = Math.floor(Date.now() / 1000);
  const receipt = {
    protocol: "capmesh/0.1",
    request_id: challenge.request_id,
    status: "success",
    provider: contact.provider,
    capability: "state.observe",
    parameters: { location: contact.location },
    nonce: challenge.nonce,
    result: {
      metric: "gate.closed",
      sensor: contact.sensor,
      closed,
      stable_samples: 5,
      total_samples: 5,
    },
    started_at: now,
    completed_at: now,
  };
  receipt.receipt_signature = `v3:${sign(
    "sha256",
    Buffer.from(receiptMessage(receipt)),
    { key: privateKey, dsaEncoding: "ieee-p1363" },
  ).toString("base64")}`;
  return receipt;
}

export function makeObserver(config, identity) {
  if (config.contact?.sensor === "disabled-contact")
    return async () => {
      throw new AppError(
        "CONTACT_DISABLED",
        "The enrolled board disables contact input. No device request ran.",
        403,
      );
    };
  if (config.mode === "simulation") {
    return async (job) =>
      simulatedReceipt(
        job.challenge,
        job.contact,
        identity.privateKey,
        job.input.closed,
      );
  }
  return async (job) => {
    const env = Object.fromEntries(
      [
        "PATH",
        "HOME",
        "LANG",
        "DBUS_SESSION_BUS_ADDRESS",
        "XDG_RUNTIME_DIR",
        "FIELDPROOF_BLE_ADDRESS",
        "FIELDPROOF_DEVICE_SECRET",
      ]
        .filter((name) => process.env[name] !== undefined)
        .map((name) => [name, process.env[name]]),
    );
    const { stdout } = await execute(
      config.python,
      [fileURLToPath(new URL("../scripts/observe.py", import.meta.url))],
      {
        timeout: 25000,
        maxBuffer: 16384,
        // The bounded request and credentials stay out of argv and public error messages.
        env: {
          ...env,
          FIELDPROOF_OBSERVATION: JSON.stringify({
            challenge: job.challenge,
            contact: job.contact,
          }),
        },
      },
    );
    return JSON.parse(stdout);
  };
}
