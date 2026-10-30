import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.js";
import { simulationIdentity, makeObserver } from "../src/observation.js";
import { makePayment, requirements } from "../src/payment.js";
import { Service } from "../src/service.js";
import { createApp } from "../src/app.js";

export function fixture(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "fieldproof-test-"));
  const identity = simulationIdentity(join(dir, "key.json"));
  const config = { mode: "simulation", spendAuthorized: false };
  const profile = {
    mode: "simulation",
    contact: {
      provider: "fixture",
      sensor: "simulated-contact",
      location: "demo-gate",
    },
    publicKey: identity.publicKey,
    requirements: requirements("simulation-no-funds"),
  };
  const db = join(dir, "ledger.sqlite");
  const store = new Store(db);
  store.bindConfig(JSON.stringify(profile));
  const service = new Service({
    store,
    profile,
    config,
    payment: makePayment(config),
    observe: makeObserver(config, identity),
    ...overrides,
  });
  t.after(() => {
    service.store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { service, identity, dir, db, profile, config };
}

export async function server(t, service) {
  const http = createApp(service).listen(0, "127.0.0.1");
  await new Promise((resolve) => http.once("listening", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        http.closeAllConnections();
        http.close(resolve);
      }),
  );
  return `http://127.0.0.1:${http.address().port}`;
}
