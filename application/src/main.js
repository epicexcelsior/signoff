import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./config.js";
import { Store } from "./store.js";
import { simulationIdentity, makeObserver } from "./observation.js";
import { makePayment, requirements } from "./payment.js";
import { Service } from "./service.js";
import { createApp } from "./app.js";
import { makeOpticalEmitter } from "./optical.js";
import { createExternalAcceptance } from "./external-acceptance.js";

process.umask(0o077);
const config = loadConfig();
mkdirSync(config.stateDir, { recursive: true, mode: 0o700 });
const identity =
  config.mode === "simulation"
    ? simulationIdentity(join(config.stateDir, "simulation-key.json"))
    : null;
const profile = {
  mode: config.mode,
  contact: config.contact ?? {
    provider: "fieldproof-simulator",
    sensor: "simulated-contact",
    location: "demo-gate",
  },
  publicKey: config.publicKey ?? identity.publicKey,
  requirements: requirements(
    config.mode === "preprod" ? config.sellerAddress : "simulation-no-funds",
  ),
};
const store = new Store(join(config.stateDir, "ledger.sqlite"));
store.bindConfig(JSON.stringify(profile));
const service = new Service({
  store,
  config,
  profile,
  payment: config.mode === "physical" ? null : makePayment(config),
  observe: makeObserver(config, identity),
  emitOptical: makeOpticalEmitter(config, identity),
  external: createExternalAcceptance(config.externalConfig),
});
const server = createApp(service).listen(config.port, "127.0.0.1", () => {
  console.log(
    `FieldProof: http://127.0.0.1:${server.address().port} (${config.mode})`,
  );
});
server.on("error", (error) => {
  console.error("FieldProof cannot listen:", error.code);
  store.close();
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 3000).unref();
  });
}
