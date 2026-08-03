import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runWorkspace, stopWorkspace } from "./runtime.mjs";
import { markWorkspaceStopped, statusWorkspace } from "./workspace.mjs";

const REGISTRY_SCHEMA_VERSION = 1;

export function fleetRun(workspaces, requestId = randomUUID(), options = {}) {
  const roots = normalizeWorkspaces(workspaces);
  if (roots.length === 0) return invalidFleetResult(requestId, "fleet.run", "at least one --workspace is required");

  const widgets = roots.map((root) => runOne(root, requestId, options));
  persistRegistry(options, widgets);
  return fleetResult(requestId, "fleet.run", widgets);
}

export function fleetStatus(workspaces, requestId = randomUUID(), options = {}) {
  const roots = normalizeWorkspaces(workspaces);
  if (roots.length === 0) return invalidFleetResult(requestId, "fleet.status", "at least one --workspace is required");

  const widgets = roots.map((root) => reconcileStatus(root, requestId));
  persistRegistry(options, widgets);
  return fleetResult(requestId, "fleet.status", widgets);
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
  return fleetResult(requestId, "fleet.stop", widgets);
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

function registryPath(options) {
  return options.statePath
    ? path.resolve(options.statePath)
    : path.resolve(process.env.RENDER_FLEET_STATE_PATH ?? path.join(os.homedir(), ".render", "fleet.json"));
}

function persistRegistry(options, widgets) {
  const filePath = registryPath(options);
  const directory = path.dirname(filePath);
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
