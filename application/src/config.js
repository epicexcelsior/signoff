import { homedir } from "node:os";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { receiptPublicKey, validateContact } from "./evidence.js";

export function loadConfig(env = process.env) {
  const mode = env.FIELDPROOF_MODE ?? "simulation";
  const port = Number(env.FIELDPROOF_PORT ?? 4021);
  if (
    !["simulation", "preprod"].includes(mode) ||
    !Number.isInteger(port) ||
    port < 0 ||
    port > 65535
  ) {
    throw new Error(
      "Configure simulation or preprod mode and a port from 0 through 65535.",
    );
  }
  const config = {
    mode,
    port,
    stateDir: resolve(
      env.FIELDPROOF_STATE_DIR ??
        resolve(homedir(), ".local/state/fieldproof-cardano"),
    ),
    spendAuthorized: env.FIELDPROOF_SPEND_AUTHORIZED === "true",
    python: env.FIELDPROOF_PYTHON ?? "python3",
    sellerAddress: env.SELLER_ADDRESS,
    projectId: env.BLOCKFROST_PROJECT_ID,
    facilitatorUrl:
      env.FACILITATOR_URL ??
      "https://x402.preprod.dev.ecosyseng.cf-deployments.org",
  };
  if (mode === "preprod") {
    if (
      !/^addr_test1[0-9a-z]{30,120}$/.test(config.sellerAddress ?? "") ||
      !config.projectId?.startsWith("preprod")
    ) {
      throw new Error(
        "Preprod mode requires a seller testnet address and a Preprod Blockfrost project identifier.",
      );
    }
    const facilitator = new URL(config.facilitatorUrl);
    if (
      facilitator.username ||
      facilitator.password ||
      facilitator.search ||
      facilitator.hash ||
      !(
        facilitator.protocol === "https:" ||
        (facilitator.protocol === "http:" &&
          ["127.0.0.1", "localhost"].includes(facilitator.hostname))
      )
    ) {
      throw new Error(
        "Use an HTTPS facilitator or a local HTTP facilitator without URL credentials.",
      );
    }
    const pins = JSON.parse(readFileSync(env.FIELDPROOF_RECEIPT_PINS, "utf8"));
    config.contact = validateContact(pins.contact);
    if (config.contact.sensor === "simulated-contact")
      throw new Error("Preprod mode requires a physical contact sensor.");
    receiptPublicKey(pins.publicKey);
    config.publicKey = pins.publicKey;
    if (
      !/^(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(
        env.FIELDPROOF_BLE_ADDRESS ?? "",
      ) ||
      (env.FIELDPROOF_DEVICE_SECRET?.length ?? 0) < 16
    ) {
      throw new Error(
        "Preprod mode requires the configured board address and authorization secret.",
      );
    }
  }
  return config;
}
