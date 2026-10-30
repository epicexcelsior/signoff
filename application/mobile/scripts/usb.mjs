import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function usbPlan({ serial, port = 4022 } = {}) {
  if (typeof serial !== "string" || !/^[A-Za-z0-9._:-]{1,100}$/.test(serial))
    throw new Error("Select one explicit adb device serial.");
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Select a coordinator port from 1024 through 65535.");
  return {
    executed: false,
    coordinator: `http://127.0.0.1:${port}`,
    serial,
    command: ["adb", "-s", serial, "reverse", `tcp:${port}`, `tcp:${port}`],
    recoveryCommand: [
      "adb",
      "-s",
      serial,
      "reverse",
      "--remove",
      `tcp:${port}`,
    ],
    boundary:
      "USB forwarding reaches the laptop loopback coordinator. It does not expose a LAN listener or authorize installation, camera capture, BLE writes, or payments.",
  };
}
export function connectUsb(plan, env = process.env) {
  const checked = usbPlan({
    serial: plan.serial,
    port: Number(new URL(plan.coordinator).port),
  });
  if (env.PROOFREADY_USB_AUTHORIZED !== "true")
    throw new Error(
      "Set PROOFREADY_USB_AUTHORIZED=true only after targeted USB-forwarding authorization.",
    );
  const adb =
    env.PROOFREADY_ADB ??
    resolve(
      env.ANDROID_HOME ??
        env.ANDROID_SDK_ROOT ??
        resolve(env.HOME ?? "", "Android/Sdk"),
      "platform-tools/adb",
    );
  const devices = execFileSync(adb, ["devices"], {
    encoding: "utf8",
    timeout: 5000,
  });
  if (
    !devices
      .split(/\r?\n/)
      .some((line) => line.trim() === `${checked.serial}\tdevice`)
  )
    throw new Error(
      "The selected adb device is not connected and authorized. No forwarding ran.",
    );
  execFileSync(adb, checked.command.slice(1), { timeout: 5000, stdio: "pipe" });
  return { ...checked, executed: true };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const [operation = "plan", serial, rawPort = "4022"] =
      process.argv.slice(2);
    if (!["plan", "connect"].includes(operation))
      throw new Error(
        "Use plan or connect with an explicit device serial and optional port.",
      );
    const plan = usbPlan({ serial, port: Number(rawPort) });
    console.log(
      JSON.stringify(
        operation === "connect" ? connectUsb(plan) : plan,
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
