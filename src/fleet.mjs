import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runWorkspace, stopWorkspace } from "./runtime.mjs";
import { markWorkspaceStopped, statusWorkspace } from "./workspace.mjs";

const REGISTRY_SCHEMA_VERSION = 1;
const FLEET_SUPERVISOR_SCHEMA_VERSION = 1;
const FLEET_SUPERVISOR_SCRIPT = fileURLToPath(new URL("./fleet-supervisor.mjs", import.meta.url));

export function fleetRun(workspaces, requestId = randomUUID(), options = {}) {
  const roots = normalizeWorkspaces(workspaces);
  if (roots.length === 0) return invalidFleetResult(requestId, "fleet.run", "at least one --workspace is required");

  const widgets = roots.map((root) => runOne(root, requestId, options));
  persistRegistry(options, widgets);
  return withSupervisor(requestId, "fleet.run", widgets, ensureSupervisor(options, widgets));
}

export function fleetStatus(workspaces, requestId = randomUUID(), options = {}) {
  const roots = normalizeWorkspaces(workspaces);
  const targets = roots.length > 0 ? roots : registeredWorkspaces(options);
  if (targets.length === 0) return invalidFleetResult(requestId, "fleet.status", "at least one --workspace is required or the fleet registry must contain a widget");

  const widgets = targets.map((root) => reconcileStatus(root, requestId));
  persistRegistry(options, widgets);
  return withSupervisor(requestId, "fleet.status", widgets, readSupervisorState(options));
}

export function fleetRelaunch(requestId = randomUUID(), options = {}) {
  const roots = registeredWorkspaces(options);
  if (roots.length === 0) return invalidFleetResult(requestId, "fleet.relaunch", "the fleet registry does not contain a widget workspace");

  const widgets = roots.map((root) => runOne(root, requestId, options));
  persistRegistry(options, widgets);
  return withSupervisor(requestId, "fleet.relaunch", widgets, ensureSupervisor(options, widgets));
}

export function fleetStop(workspaces, requestId = randomUUID(), options = {}) {
  const roots = normalizeWorkspaces(workspaces);
  if (roots.length === 0) return invalidFleetResult(requestId, "fleet.stop", "at least one --workspace is required");

  const widgets = roots.map((root) => {
    try {
      return stopWorkspace(root, requestId);
    } catch (error) {
      return failure(requestId, "stop", root, error);
    }
  });
  persistRegistry(options, widgets);
  return withSupervisor(requestId, "fleet.stop", widgets, stopSupervisorIfIdle(options));
}

function runOne(root, requestId, options) {
  try {
    return runWorkspace(root, requestId, options);
  } catch (error) {
    return failure(requestId, "run", root, error);
  }
}

function reconcileStatus(root, requestId) {
  try {
    const status = statusWorkspace(root, requestId);
    if (!status.ok || !status.state.running || !status.state.processId) return status;
    if (processIsAlive(status.state.processId)) return status;

    const state = markWorkspaceStopped(root);
    return {
      ...status,
      state,
      worker: null,
      diagnostics: [{
        code: "stale-process",
        path: ".render/metadata.json",
        message: "recorded widget process is no longer running; Render marked the widget stopped"
      }]
    };
  } catch (error) {
    return failure(requestId, "status", root, error);
  }
}

function processIsAlive(processId) {
  if (!Number.isInteger(processId) || processId <= 0) return false;
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    if (error.code === "EPERM") return true;
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

function fleetResult(requestId, operation, widgets) {
  const diagnostics = widgets.flatMap((widget) => widget.diagnostics ?? []);
  return {
    requestId,
    operation,
    ok: widgets.every((widget) => widget.ok),
    widgets,
    diagnostics
  };
}

function withSupervisor(requestId, operation, widgets, supervisor) {
  const result = fleetResult(requestId, operation, widgets);
  return supervisor ? { ...result, supervisor } : result;
}

function invalidFleetResult(requestId, operation, message) {
  return {
    requestId,
    operation,
    ok: false,
    widgets: [],
    diagnostics: [{ code: "invalid-fleet", path: "workspace", message }]
  };
}

function failure(requestId, operation, workspace, error) {
  return {
    requestId,
    operation,
    workspace: path.resolve(workspace),
    ok: false,
    diagnostics: [{ code: "fleet-operation-failed", path: ".render", message: error.message }]
  };
}

function normalizeWorkspaces(workspaces) {
  return [...new Set((Array.isArray(workspaces) ? workspaces : [workspaces])
    .filter((workspace) => typeof workspace === "string" && workspace.length > 0)
    .map((workspace) => path.resolve(workspace)))];
}

function registeredWorkspaces(options) {
  return normalizeWorkspaces(readRegistry(registryPath(options)).widgets.map((widget) => widget.workspace));
}

function registryPath(options) {
  return options.statePath
    ? path.resolve(options.statePath)
    : path.resolve(process.env.RENDER_FLEET_STATE_PATH ?? path.join(os.homedir(), ".render", "fleet.json"));
}

function supervisorStatePath(options) {
  return `${registryPath(options)}.supervisor.json`;
}

function ensureSupervisor(options, widgets) {
  const eligible = widgets.some((widget) => widget.ok) && (
    options.supervise === true ||
    (options.supervise !== false && widgets.some((widget) => widget.worker))
  );
  if (!eligible) return readSupervisorState(options);

  const statePath = supervisorStatePath(options);
  const current = readSupervisorState(options);
  if (current && processIsAlive(current.processId)) return current;

  const args = [FLEET_SUPERVISOR_SCRIPT, "--registry-path", registryPath(options), "--state-path", statePath];
  if (typeof options.hostPath === "string" && options.hostPath.length > 0) args.push("--host-path", options.hostPath);
  if (Number.isFinite(options.monitorIntervalMs)) args.push("--interval-ms", String(options.monitorIntervalMs));
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
    env: { ...process.env, RENDER_FLEET_STATE_PATH: registryPath(options) }
  });
  child.unref();
  const starting = {
    schemaVersion: FLEET_SUPERVISOR_SCHEMA_VERSION,
    status: "starting",
    processId: child.pid,
    updatedAt: new Date().toISOString()
  };
  const observed = readSupervisorState(options);
  if (!observed || observed.processId !== child.pid) {
    writeFileAtomically(statePath, `${JSON.stringify(starting, null, 2)}\n`);
    return starting;
  }
  return observed;
}

function stopSupervisorIfIdle(options) {
  const registry = readRegistry(registryPath(options));
  if (registry.widgets.some((widget) => widget.running)) return readSupervisorState(options);

  const statePath = supervisorStatePath(options);
  const current = readSupervisorState(options);
  if (!current) return null;
  if (processIsAlive(current.processId) && current.processId !== process.pid) {
    try {
      process.kill(current.processId);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  const stopped = { ...current, status: "stopped", updatedAt: new Date().toISOString() };
  writeFileAtomically(statePath, `${JSON.stringify(stopped, null, 2)}\n`);
  return stopped;
}

function readSupervisorState(options) {
  const statePath = supervisorStatePath(options);
  if (!existsSync(statePath)) return null;
  try {
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    if (state.status !== "stopped" && !processIsAlive(state.processId)) {
      return {
        ...state,
        status: "stopped",
        diagnostics: [{
          code: "stale-supervisor",
          path: statePath,
          message: "fleet supervisor process is no longer running"
        }]
      };
    }
    return state;
  } catch {
    return {
      schemaVersion: FLEET_SUPERVISOR_SCHEMA_VERSION,
      status: "invalid",
      diagnostics: [{
        code: "invalid-supervisor-state",
        path: statePath,
        message: "fleet supervisor state must be valid JSON"
      }]
    };
  }
}

function persistRegistry(options, widgets) {
  const filePath = registryPath(options);
  const existing = readRegistry(filePath);
  const entries = new Map((existing.widgets ?? []).map((entry) => [entry.workspace, entry]));
  for (const widget of widgets) {
    if (!widget.workspace) continue;
    const state = widget.state ?? readWidgetState(widget.workspace);
    entries.set(widget.workspace, {
      workspace: widget.workspace,
      widgetId: state?.widgetId ?? null,
      running: state?.running ?? false,
      processId: state?.processId ?? null,
      activeVersion: state?.activeVersion ?? null,
      lastKnownGoodVersion: state?.lastKnownGoodVersion ?? null,
      lastFailure: state?.lastFailure ?? null,
      updatedAt: new Date().toISOString()
    });
  }
  const next = { schemaVersion: REGISTRY_SCHEMA_VERSION, widgets: [...entries.values()] };
  writeFileAtomically(filePath, `${JSON.stringify(next, null, 2)}\n`);
}

function readRegistry(filePath) {
  if (!existsSync(filePath)) return { schemaVersion: REGISTRY_SCHEMA_VERSION, widgets: [] };
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return { schemaVersion: REGISTRY_SCHEMA_VERSION, widgets: Array.isArray(parsed.widgets) ? parsed.widgets : [] };
  } catch {
    return { schemaVersion: REGISTRY_SCHEMA_VERSION, widgets: [] };
  }
}

function readWidgetState(workspace) {
  const metadataPath = path.join(workspace, ".render", "metadata.json");
  if (!existsSync(metadataPath)) return null;
  try {
    return JSON.parse(readFileSync(metadataPath, "utf8"));
  } catch {
    return null;
  }
}

function writeFileAtomically(filePath, data) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, data, "utf8");
  renameSync(temporaryPath, filePath);
}
