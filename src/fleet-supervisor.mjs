#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runWorkspace } from "./runtime.mjs";
import { statusWorkspace } from "./workspace.mjs";

const DEFAULT_MONITOR_INTERVAL_MS = 1000;
const SUPERVISOR_SCHEMA_VERSION = 1;
let shuttingDown = false;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}

function main(args) {
  const options = parseOptions(args);
  if (!options.registryPath || !options.statePath) {
    writeState(options.statePath, {
      schemaVersion: SUPERVISOR_SCHEMA_VERSION,
      status: "failed",
      processId: process.pid,
      diagnostics: [{
        code: "missing-supervisor-path",
        path: "arguments",
        message: "fleet supervisor requires --registry-path and --state-path"
      }]
    });
    process.exitCode = 1;
    return;
  }

  const shutdown = () => {
    shuttingDown = true;
    writeState(options.statePath, {
      schemaVersion: SUPERVISOR_SCHEMA_VERSION,
      status: "stopped",
      processId: process.pid,
      updatedAt: new Date().toISOString()
    });
    process.exit(0);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  writeState(options.statePath, {
    schemaVersion: SUPERVISOR_SCHEMA_VERSION,
    status: "ready",
    processId: process.pid,
    updatedAt: new Date().toISOString()
  });
  monitor(options);
}

function monitor(options) {
  if (shuttingDown) return;
  const registry = readRegistry(options.registryPath);
  const active = registry.widgets.filter((widget) => widget.running);
  if (active.length === 0) {
    writeState(options.statePath, {
      schemaVersion: SUPERVISOR_SCHEMA_VERSION,
      status: "stopped",
      processId: process.pid,
      updatedAt: new Date().toISOString()
    });
    process.exit(0);
    return;
  }

  const recovered = [];
  for (const widget of active) {
    const status = statusWorkspace(widget.workspace, randomUUID());
    if (!status.ok || !status.state.running || processIsAlive(status.state.processId)) continue;

    const runOptions = options.hostPath ? { hostPath: options.hostPath } : {};
    const result = runWorkspace(widget.workspace, randomUUID(), runOptions);
    recovered.push({
      workspace: widget.workspace,
      ok: result.ok,
      processId: result.processId ?? null,
      diagnostics: result.diagnostics ?? []
    });
  }

  writeState(options.statePath, {
    schemaVersion: SUPERVISOR_SCHEMA_VERSION,
    status: "ready",
    processId: process.pid,
    recovered,
    updatedAt: new Date().toISOString()
  });
  setTimeout(() => monitor(options), options.monitorIntervalMs).unref();
}

function parseOptions(args) {
  const options = { monitorIntervalMs: DEFAULT_MONITOR_INTERVAL_MS };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--registry-path") options.registryPath = args[++index];
    else if (args[index] === "--state-path") options.statePath = args[++index];
    else if (args[index] === "--host-path") options.hostPath = args[++index];
    else if (args[index] === "--interval-ms") options.monitorIntervalMs = Number(args[++index]);
  }
  return options;
}

function readRegistry(filePath) {
  if (!existsSync(filePath)) return { widgets: [] };
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return { widgets: Array.isArray(parsed.widgets) ? parsed.widgets : [] };
  } catch {
    return { widgets: [] };
  }
}

function processIsAlive(processId) {
  if (!Number.isInteger(processId) || processId <= 0) return false;
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function writeState(filePath, state) {
  if (!filePath) return;
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, filePath);
}
