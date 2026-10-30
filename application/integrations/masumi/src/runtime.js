import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { IntegrationError } from "./contracts.js";

export function taskTarget({
  coworkerId,
  organizationId = null,
  organizationSlug = null,
}) {
  if (
    typeof coworkerId !== "string" ||
    !/^[A-Za-z0-9_-]+$/.test(coworkerId) ||
    Boolean(organizationId) !== Boolean(organizationSlug) ||
    (organizationId && !/^[A-Za-z0-9_-]+$/.test(organizationId)) ||
    (organizationSlug && !/^[A-Za-z0-9_-]+$/.test(organizationSlug))
  ) {
    throw new IntegrationError(
      "INVALID_TASK_TARGET",
      "Set the dedicated Coworker and both Workspace identifiers, or leave both Workspace identifiers blank.",
    );
  }
  return {
    coworkerId,
    organizationId,
    organizationSlug,
    taskArgs: organizationSlug
      ? ["--organization-slug", organizationSlug]
      : ["--personal"],
    runtimeArgs: organizationId
      ? ["--organization-id", organizationId]
      : ["--personal"],
  };
}
export function assertTaskTarget(task, target) {
  if (
    (task?.coworkerId ?? task?.assigneeId) !== target.coworkerId ||
    task.organizationId !== target.organizationId
  ) {
    throw new IntegrationError(
      "TASK_SCOPE_MISMATCH",
      "The Task must belong to the configured Coworker and Workspace.",
    );
  }
}
const execute = promisify(execFile);
export function createSokosumiRuntime({
  coworkerId,
  organizationId,
  organizationSlug,
  accountApiKey,
  writesAuthorized = false,
  runCommand = execute,
  core: suppliedCore,
}) {
  const target = taskTarget({ coworkerId, organizationId, organizationSlug });
  if (
    accountApiKey !== undefined &&
    (typeof accountApiKey !== "string" ||
      accountApiKey.length < 16 ||
      accountApiKey.length > 4096 ||
      /\s/u.test(accountApiKey))
  )
    throw new IntegrationError(
      "INVALID_ACCOUNT_KEY",
      "Use the saved Sokosumi account API key without whitespace.",
    );
  const binary = fileURLToPath(
    new URL("../node_modules/.bin/sokosumi", import.meta.url),
  );
  const commandEnv = Object.fromEntries(
    [
      "PATH",
      "HOME",
      "XDG_CONFIG_HOME",
      "XDG_DATA_HOME",
      "XDG_RUNTIME_DIR",
      "DBUS_SESSION_BUS_ADDRESS",
      "DISPLAY",
      "WAYLAND_DISPLAY",
    ]
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
  // Account actions use the owner-supplied key. Task reads still use the
  // independently scoped Coworker credential from the supported CLI vault.
  if (accountApiKey !== undefined) commandEnv.SOKOSUMI_API_KEY = accountApiKey;
  async function cli(args, writes = false) {
    if (writes && !writesAuthorized)
      throw new IntegrationError(
        "EXTERNAL_AUTHORIZATION_REQUIRED",
        "The owner must authorize Sokosumi account and Task writes.",
      );
    try {
      const result = await runCommand(
        binary,
        ["--preprod", ...args, "--json"],
        {
          encoding: "utf8",
          timeout: 30_000,
          maxBuffer: 1_000_000,
          env: commandEnv,
        },
      );
      return JSON.parse(result.stdout);
    } catch (error) {
      if (error instanceof IntegrationError) throw error;
      throw new IntegrationError(
        "SOKOSUMI_UNAVAILABLE",
        "The Sokosumi command failed. Inspect the saved operation before recovery.",
      );
    }
  }
  let core = suppliedCore;
  async function getCore() {
    if (!core) {
      let skills;
      try {
        skills = (
          await runCommand(binary, ["skills", "path"], {
            encoding: "utf8",
            timeout: 30_000,
            maxBuffer: 10_000,
            env: commandEnv,
          })
        ).stdout.trim();
      } catch {
        throw new IntegrationError(
          "RUNTIME_UNAVAILABLE",
          "The pinned local CLI cannot locate its supported runtime modules.",
        );
      }
      if (!isAbsolute(skills) || !skills.endsWith("/skills"))
        throw new IntegrationError(
          "INVALID_RUNTIME_PATH",
          "The CLI returned an invalid runtime package path.",
        );
      const root = join(dirname(skills), "dist", "src");
      const credentials = await import(
        pathToFileURL(join(root, "coworker/runtime-credentials.js")).href
      );
      const http = await import(
        pathToFileURL(join(root, "api/http-client.js")).href
      );
      core = http.createCoworkerHttpClient({
        apiKey: credentials.readRuntimeCredential(target.coworkerId),
      });
    }
    return core;
  }
  async function readTask(id) {
    const { data } = await (
      await getCore()
    ).get(`/v1/tasks/${encodeURIComponent(id)}`, AbortSignal.timeout(30_000));
    if (data?.id !== id)
      throw new IntegrationError(
        "TASK_SCOPE_MISMATCH",
        "The runtime returned a different Task.",
      );
    assertTaskTarget(data, target);
    return data;
  }
  async function postEvent(id, body) {
    if (!writesAuthorized)
      throw new IntegrationError(
        "EXTERNAL_AUTHORIZATION_REQUIRED",
        "The owner must authorize Sokosumi Task writes.",
      );
    await readTask(id);
    return (
      await (
        await getCore()
      ).post(
        `/v1/tasks/${encodeURIComponent(id)}/events`,
        body,
        AbortSignal.timeout(30_000),
      )
    ).data;
  }
  return {
    kind: "sokosumi-preprod",
    identity: {
      coworkerId: target.coworkerId,
      organizationId: target.organizationId,
    },
    async createTask({ name, description }) {
      const response = await cli(
        [
          "tasks",
          "create",
          ...target.taskArgs,
          "--coworker-id",
          target.coworkerId,
          "--name",
          name,
          "--description",
          description,
          "--status",
          "READY",
        ],
        true,
      );
      const task = response.task ?? response;
      if (typeof task.id !== "string" || !task.id)
        throw new IntegrationError(
          "INVALID_TASK_RESPONSE",
          "Task creation did not return an identifier. Reconcile before retrying.",
        );
      return { id: task.id };
    },
    async findTask({ name, description }) {
      const { tasks } = await cli([
        "tasks",
        "list",
        ...target.taskArgs,
        "--coworker-id",
        target.coworkerId,
      ]);
      if (!Array.isArray(tasks))
        throw new IntegrationError(
          "INVALID_TASK_RESPONSE",
          "The Task list is unavailable.",
        );
      const matches = tasks.filter(
        (task) => task.name === name && task.description === description,
      );
      for (const task of matches) assertTaskTarget(task, target);
      if (matches.length > 1)
        throw new IntegrationError(
          "AMBIGUOUS_TASK",
          "Multiple remote Tasks match this inspection. Inspect them before recovery.",
        );
      return matches[0] ?? null;
    },
    async startTask(id) {
      await readTask(id);
      return cli(
        [
          "runtime",
          "start",
          id,
          ...target.runtimeArgs,
          "--coworker-id",
          target.coworkerId,
        ],
        true,
      );
    },
    readTask,
    async readEvents(id) {
      await readTask(id);
      const events = [];
      const cursors = new Set();
      let cursor;
      for (let page = 0; page < 20; page += 1) {
        const params = new URLSearchParams({ limit: "100" });
        if (cursor) params.set("cursor", cursor);
        const response = await (
          await getCore()
        ).get(
          `/v1/tasks/${encodeURIComponent(id)}/events?${params}`,
          AbortSignal.timeout(30_000),
        );
        if (!Array.isArray(response.data))
          throw new IntegrationError(
            "INVALID_TASK_RESPONSE",
            "Task event evidence is unavailable.",
          );
        events.push(...response.data);
        cursor = response.meta?.pagination?.nextCursor;
        if (!cursor) return events;
        if (cursors.has(cursor)) break;
        cursors.add(cursor);
      }
      throw new IntegrationError(
        "TASK_EVENT_LIMIT",
        "Inspect the Task event history before recovery. The event limit was reached.",
      );
    },
    requestPayment: (id, payload) =>
      postEvent(id, {
        comment: "Payment requested for one inspection: 1 test USDM.",
        masumiPayment: payload,
      }),
    completeTask: (id, resultText) =>
      postEvent(id, { status: "COMPLETED", comment: resultText }),
    async readReceipt(id) {
      await readTask(id);
      return (
        await (
          await getCore()
        ).get(
          `/v1/tasks/${encodeURIComponent(id)}/receipt`,
          AbortSignal.timeout(30_000),
        )
      ).data;
    },
  };
}

export function createFixtureRuntime() {
  const tasks = new Map();
  const counts = { created: 0, started: 0, completed: 0 };
  return {
    kind: "fixture",
    identity: { fixture: "local-execution-only" },
    counts,
    async createTask({ name, description }) {
      const id = `fixture-${randomUUID()}`;
      tasks.set(id, { id, name, description, status: "READY", events: [] });
      counts.created += 1;
      return { id };
    },
    async findTask({ name, description }) {
      return (
        [...tasks.values()].find(
          (task) => task.name === name && task.description === description,
        ) ?? null
      );
    },
    async startTask(id) {
      const task = tasks.get(id);
      task.status = "IN_PROGRESS";
      counts.started += 1;
      return { description: task.description };
    },
    async readTask(id) {
      return structuredClone(tasks.get(id));
    },
    async readEvents(id) {
      return structuredClone(tasks.get(id).events);
    },
    async completeTask(id, resultText) {
      Object.assign(tasks.get(id), { status: "COMPLETED", resultText });
      counts.completed += 1;
      const event = {
        id: `fixture-event-${counts.completed}`,
        status: "COMPLETED",
        comment: resultText,
      };
      tasks.get(id).events.push(event);
      return event;
    },
    async readReceipt() {
      return { settled: false, fixture: true };
    },
  };
}
