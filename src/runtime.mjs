import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, renameSync, statSync, unlinkSync, watch, writeFileSync } from "node:fs";
import path from "node:path";
import * as sdk from "../packages/sdk/src/index.ts";
import { buildTsxRuntimeTree } from "./tsx-runtime.mjs";
import {
  checkWorkspace,
  markWorkspaceStopped,
  promoteSnapshot,
  recordFailure,
  restoreSnapshot,
  statusWorkspace
} from "./workspace.mjs";
import { extractManifest, updateManifest, validateManifest } from "./manifest.mjs";
import { readPreferences, writePreferences } from "./preferences.mjs";

// Receipt: perf/receipts/phase8-worker.json
const SUPERVISOR_STARTUP_TIMEOUT_MS = 5000;
const SUPPORTED_ACTIONS = new Set(sdk.WIDGET_ACTION_NAMES);
const SUPPORTED_PROVIDERS = new Set(sdk.WIDGET_PROVIDER_NAMES);

export function buildRuntimeTree(source, filename = "widget.tsx", options = {}) {
  const manifest = extractManifest(source);
  const mode = options.mode ?? manifest.adjustable?.responsive?.default ?? "auto";
  const tree = buildTsxRuntimeTree(source, { sdk, filename, renderContext: { mode, size: options.size } });
  const subscriptions = new Set(manifest.subscribe);
  const accounts = new Map((manifest.accounts ?? []).map((account) => [account.connector, new Set(account.scopes)]));
  validateRuntimeTree(tree, "root", subscriptions, new Set(manifest.capabilities), accounts);
  return JSON.parse(JSON.stringify(tree));
}

export function prepareRun(workspace, requestId = randomUUID()) {
  const check = checkWorkspace(workspace, requestId);
  if (!check.ok) return { ...check, operation: "run" };

  const root = path.resolve(workspace);
  const sourcePath = path.join(root, "widget.tsx");
  const source = readFileSync(sourcePath, "utf8");
  const manifest = extractManifest(source);
  let tree;
  try {
    tree = buildRuntimeTree(source, sourcePath);
  } catch (error) {
    return {
      requestId,
      operation: "run",
      workspace: root,
      ok: false,
      diagnostics: [{ code: "runtime-error", path: "widget.tsx", message: error.message }]
    };
  }

  const runtimePath = path.join(root, ".render/runtime/tree.json");
  const manifestPath = path.join(root, ".render/runtime/manifest.json");
  if (!existsSync(path.dirname(runtimePath))) {
    return {
      requestId,
      operation: "run",
      workspace: root,
      ok: false,
      diagnostics: [{
        code: "missing-runtime-directory",
        path: ".render/runtime",
        message: "run render init before running a widget"
      }]
    };
  }
  const candidatePath = `${runtimePath}.${randomUUID()}.tmp`;
  writeFileSync(candidatePath, `${JSON.stringify(tree, null, 2)}\n`, "utf8");
  renameSync(candidatePath, runtimePath);
  const manifestCandidatePath = `${manifestPath}.${randomUUID()}.tmp`;
  writeFileSync(manifestCandidatePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  renameSync(manifestCandidatePath, manifestPath);

  return {
    requestId,
    operation: "run",
    workspace: root,
    ok: true,
    runtimeTreePath: runtimePath,
    runtimeManifestPath: manifestPath,
    diagnostics: []
  };
}

export function runWorkspace(workspace, requestId = randomUUID(), options = {}) {
  const root = path.resolve(workspace);
  const hostPath = options.hostPath === undefined ? findHostPath() : options.hostPath;
  if (isNativeHost(hostPath) && options.supervised !== false) {
    return runSupervisedWorkspace(root, requestId, hostPath);
  }

  const prepared = prepareRun(workspace, requestId);
  if (!prepared.ok) {
    recordFailure(workspace, prepared.diagnostics);
    return prepared;
  }

  if (!hostPath || !existsSync(hostPath)) {
    const result = {
      ...prepared,
      ok: false,
      diagnostics: [{
        code: "host-not-built",
        path: ".build/debug/RenderHost.app/Contents/MacOS/RenderHost",
        message: "run npm run package:host before running a native widget"
      }]
    };
    recordFailure(root, result.diagnostics);
    return result;
  }

  const promotion = promoteSnapshot(root, requestId);
  stopPreviousHost(root);
  const hostLogPath = createHostLogPath(root);
  const logHandle = openSync(hostLogPath, "a");
  let child;
  try {
    child = spawn(hostPath, ["--workspace", root], {
      detached: true,
      stdio: ["ignore", logHandle, logHandle],
      env: { ...process.env, RENDER_WORKSPACE: root }
    });
  } finally {
    closeSync(logHandle);
  }
  child.unref();
  const state = {
    ...promotion.state,
    status: "running",
    running: true,
    stopRequested: false,
    processId: child.pid,
    workerProcessId: null,
    hostLogPath,
    lastTransitionAt: new Date().toISOString()
  };
  updateState(root, state);
  return {
    ...prepared,
    running: true,
    processId: child.pid,
    hostLogPath,
    activeVersion: promotion.version,
    lastKnownGoodVersion: promotion.version
  };
}

function runSupervisedWorkspace(root, requestId, hostPath) {
  const check = checkWorkspace(root, requestId);
  if (!check.ok) {
    recordFailure(root, check.diagnostics);
    return { ...check, operation: "run" };
  }

  const source = readFileSync(path.join(root, "widget.tsx"), "utf8");
  const manifest = extractManifest(source);
  const runtimeRoot = path.join(root, ".render/runtime");
  if (!existsSync(runtimeRoot)) {
    const result = {
      requestId,
      operation: "run",
      workspace: root,
      ok: false,
      diagnostics: [{
        code: "missing-runtime-directory",
        path: ".render/runtime",
        message: "run render init before running a widget"
      }]
    };
    recordFailure(root, result.diagnostics);
    return result;
  }

  writeAtomically(
    path.join(runtimeRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  const launched = launchNativeSupervisor(root, hostPath);
  if (!launched.ok) {
    recordFailure(root, launched.diagnostics);
    return {
      requestId,
      operation: "run",
      workspace: root,
      ok: false,
      diagnostics: launched.diagnostics
    };
  }

  stopPreviousHost(root);
  const promotion = promoteSnapshot(root, requestId);
  const state = {
    ...promotion.state,
    status: "running",
    running: true,
    stopRequested: false,
    processId: launched.processId,
    workerProcessId: launched.worker?.processId ?? null,
    workerStatePath: launched.workerStatePath,
    hostLogPath: launched.hostLogPath,
    lastTransitionAt: new Date().toISOString()
  };
  updateState(root, state);
  return {
    requestId,
    operation: "run",
    workspace: root,
    ok: true,
    running: true,
    processId: launched.processId,
    workerProcessId: launched.worker?.processId ?? null,
    activeVersion: promotion.version,
    lastKnownGoodVersion: promotion.version,
    worker: launched.worker,
    workerStatePath: launched.workerStatePath,
    hostLogPath: launched.hostLogPath
  };
}

function launchNativeSupervisor(root, hostPath) {
  const supervisorID = randomUUID();
  const workerSourcePath = path.join(root, `.render/runtime/source-${supervisorID}.tsx`);
  const workerStatePath = path.join(root, `.render/runtime/worker-state-${supervisorID}.json`);
  const workerTreePath = path.join(root, `.render/runtime/tree-${supervisorID}.json`);
  writeAtomically(workerSourcePath, readFileSync(path.join(root, "widget.tsx")));
  try {
    unlinkSync(workerStatePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const workerScript = process.env.RENDER_WORKER_SCRIPT ?? path.resolve("src/worker.mjs");
  const hostLogPath = path.join(root, ".render", "logs", `host-${supervisorID}.log`);
  const logHandle = openSync(hostLogPath, "a");
  let child;
  try {
    child = spawn(hostPath, [
      "--workspace", root,
      "--worker-script", workerScript,
      "--worker-source-path", workerSourcePath,
      "--worker-state-path", workerStatePath,
      "--worker-tree-path", workerTreePath
    ], {
      detached: true,
      stdio: ["ignore", logHandle, logHandle],
      env: { ...process.env, RENDER_WORKER_SCRIPT: workerScript }
    });
  } finally {
    closeSync(logHandle);
  }
  child.unref();

  const worker = waitForWorkerState(workerStatePath, SUPERVISOR_STARTUP_TIMEOUT_MS);
  if (!worker || worker.status !== "ready") {
    try {
      process.kill(child.pid);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    return {
      ok: false,
      diagnostics: worker?.diagnostics ?? [{
        code: "worker-start-timeout",
        path: workerStatePath,
        message: `native supervisor did not report a ready worker within ${SUPERVISOR_STARTUP_TIMEOUT_MS}ms`
      }]
    };
  }
  if (!existsSync(workerTreePath)) {
    try {
      process.kill(child.pid);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    return {
      ok: false,
      diagnostics: [{
        code: "worker-tree-missing",
        path: workerTreePath,
        message: "native supervisor reported ready without publishing a runtime tree"
      }]
    };
  }
  writeAtomically(
    path.join(root, ".render/runtime/tree.json"),
    readFileSync(workerTreePath)
  );
  return { ok: true, processId: child.pid, worker, workerSourcePath, workerStatePath, workerTreePath, hostLogPath };
}

function waitForWorkerState(workerStatePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(workerStatePath)) {
      try {
        return JSON.parse(readFileSync(workerStatePath, "utf8"));
      } catch {
        // The native supervisor writes the state atomically; try again if a partial file is observed.
      }
    }
    sleepSynchronously(25);
  }
  return null;
}

function sleepSynchronously(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function moveWorkspace(
  workspace,
  { corner, offsetX, offsetY } = {},
  requestId = randomUUID(),
  options = {}
) {
  const root = path.resolve(workspace);
  const check = checkWorkspace(root, requestId);
  if (!check.ok) return { ...check, operation: "move" };

  const sourcePath = path.join(root, "widget.tsx");
  const runtimeManifestPath = path.join(root, ".render/runtime/manifest.json");
  const sourceBefore = readFileSync(sourcePath, "utf8");
  const runtimeManifestBefore = existsSync(runtimeManifestPath)
    ? readFileSync(runtimeManifestPath, "utf8")
    : null;
  const current = extractManifest(sourceBefore);
  const nextAnchor = {
    corner: corner ?? current.anchor.corner,
    offset: {
      x: offsetX ?? current.anchor.offset.x,
      y: offsetY ?? current.anchor.offset.y
    }
  };
  const issues = validateManifest({ ...current, anchor: nextAnchor });
  const anchorIssues = issues.filter((issue) => issue.path.startsWith("anchor."));
  if (anchorIssues.length > 0) {
    return {
      requestId,
      operation: "move",
      workspace: root,
      ok: false,
      diagnostics: anchorIssues.map((issue) => ({
        code: "invalid-move",
        path: issue.path,
        message: issue.message
      }))
    };
  }

  const sourceAfter = updateManifest(sourceBefore, (manifest) => ({
    ...manifest,
    anchor: nextAnchor
  }));
  writeAtomically(sourcePath, sourceAfter);

  const restoreMoveCandidate = () => {
    writeAtomically(sourcePath, sourceBefore);
    if (runtimeManifestBefore === null) {
      try {
        unlinkSync(runtimeManifestPath);
      } catch {
        // The runtime manifest was not present before the move.
      }
    } else {
      writeAtomically(runtimeManifestPath, runtimeManifestBefore);
    }
  };

  let result;
  try {
    result = runWorkspace(root, requestId, options);
  } catch (error) {
    restoreMoveCandidate();
    return {
      requestId,
      operation: "move",
      workspace: root,
      ok: false,
      diagnostics: [{
        code: "move-failed",
        path: ".render",
        message: `move could not be applied: ${error.message}`
      }]
    };
  }

  if (!result.ok) {
    restoreMoveCandidate();
    return { ...result, operation: "move" };
  }

  return { ...result, operation: "move", anchor: nextAnchor };
}

export function resizeWorkspace(workspace, { width, height } = {}, requestId = randomUUID()) {
  const root = path.resolve(workspace);
  const check = checkWorkspace(root, requestId);
  if (!check.ok) return { ...check, operation: "resize" };
  const manifest = extractManifest(readFileSync(path.join(root, "widget.tsx"), "utf8"));
  const adjustable = manifest.adjustable;
  if (!adjustable?.enabled) return {
    requestId,
    operation: "resize",
    workspace: root,
    ok: false,
    diagnostics: [{ code: "resize-disabled", path: "adjustable.enabled", message: "widget does not declare adjustable resizing" }]
  };
  const invalidDimension = ["width", "height"].find((axis) => {
    const value = { width, height }[axis];
    return value !== undefined && value !== null && (!Number.isFinite(Number(value)) || Number(value) <= 0);
  });
  if (invalidDimension) return {
    requestId,
    operation: "resize",
    workspace: root,
    ok: false,
    diagnostics: [{
      code: "invalid-size",
      path: invalidDimension,
      message: `${invalidDimension} must be a finite positive number`
    }]
  };
  const current = readPreferences(root);
  const next = {
    ...current,
    width: clampDimension(width ?? current.width ?? manifest.size.width, adjustable, "width"),
    height: clampDimension(height ?? current.height ?? manifest.size.height, adjustable, "height")
  };
  writePreferences(root, next);
  const launched = runWorkspace(root, requestId);
  return { ...launched, operation: "resize", preferences: next };
}

export function setWidgetMode(workspace, mode = "auto", requestId = randomUUID()) {
  const root = path.resolve(workspace);
  const check = checkWorkspace(root, requestId);
  if (!check.ok) return { ...check, operation: "mode" };
  const manifest = extractManifest(readFileSync(path.join(root, "widget.tsx"), "utf8"));
  const modes = manifest.adjustable?.responsive?.modes ?? {};
  if (mode !== "auto" && !Object.hasOwn(modes, mode)) {
    return {
      requestId,
      operation: "mode",
      workspace: root,
      ok: false,
      diagnostics: [{ code: "invalid-mode", path: "adjustable.responsive.modes", message: `mode '${mode}' is not declared by the widget` }]
    };
  }
  const current = readPreferences(root);
  const selected = modes[mode];
  const next = {
    ...current,
    mode,
    width: selected ? Math.max(current.width ?? manifest.size.width, selected.minWidth) : current.width,
    height: selected ? Math.max(current.height ?? manifest.size.height, selected.minHeight) : current.height
  };
  writePreferences(root, next);
  const launched = runWorkspace(root, requestId);
  return { ...launched, operation: "mode", preferences: next };
}

export function resetWidgetSize(workspace, requestId = randomUUID()) {
  const root = path.resolve(workspace);
  const check = checkWorkspace(root, requestId);
  if (!check.ok) return { ...check, operation: "reset-size" };
  const next = { ...readPreferences(root), width: null, height: null };
  writePreferences(root, next);
  const launched = runWorkspace(root, requestId);
  return { ...launched, operation: "reset-size", preferences: next };
}

function clampDimension(value, adjustable, axis) {
  const minimum = adjustable.minSize?.[axis] ?? 1;
  const maximum = adjustable.maxSize?.[axis] ?? Number.POSITIVE_INFINITY;
  return Math.min(Math.max(Number(value), minimum), maximum);
}

export function rollbackWorkspace(workspace, version, requestId = randomUUID(), options = {}) {
  const root = path.resolve(workspace);
  const status = statusWorkspace(root, requestId);
  if (!status.ok) return { ...status, operation: "rollback" };
  const target = version ?? previousVersion(status.state);
  if (!target) {
    return {
      requestId,
      operation: "rollback",
      workspace: root,
      ok: false,
      diagnostics: [{
        code: "no-rollback-target",
        path: ".render/snapshots",
        message: "no earlier successful snapshot is available"
      }]
    };
  }

  const hostPath = options.hostPath === undefined ? findHostPath() : options.hostPath;
  if (!hostPath || !existsSync(hostPath)) {
    return {
      requestId,
      operation: "rollback",
      workspace: root,
      ok: false,
      diagnostics: [{
        code: "host-not-built",
        path: ".build/debug/RenderHost.app/Contents/MacOS/RenderHost",
        message: "run npm run package:host before rolling back a native widget"
      }]
    };
  }

  const restored = restoreSnapshot(root, target, requestId);
  if (!restored.ok) return restored;
  if (isNativeHost(hostPath) && options.supervised !== false) {
    const launched = launchNativeSupervisor(root, hostPath);
    if (!launched.ok) {
      recordFailure(root, launched.diagnostics);
      return {
        ...launched,
        operation: "rollback",
        workspace: root
      };
    }
    stopPreviousHost(root);
    updateState(root, {
      ...restored.state,
      status: "running",
      running: true,
      stopRequested: false,
      processId: launched.processId,
      workerProcessId: launched.worker?.processId ?? null,
      workerStatePath: launched.workerStatePath,
      hostLogPath: launched.hostLogPath,
      lastTransitionAt: new Date().toISOString()
    });
    return {
      ...restored,
      running: true,
      processId: launched.processId,
      workerProcessId: launched.worker?.processId ?? null,
      worker: launched.worker,
      workerStatePath: launched.workerStatePath,
      hostLogPath: launched.hostLogPath
    };
  }
  stopPreviousHost(root);
  const hostLogPath = createHostLogPath(root);
  const logHandle = openSync(hostLogPath, "a");
  let child;
  try {
    child = spawn(hostPath, ["--workspace", root], {
      detached: true,
      stdio: ["ignore", logHandle, logHandle],
      env: { ...process.env, RENDER_WORKSPACE: root }
    });
  } finally {
    closeSync(logHandle);
  }
  child.unref();
  updateState(root, { ...restored.state, status: "running", running: true, stopRequested: false, processId: child.pid, workerProcessId: null, hostLogPath, lastTransitionAt: new Date().toISOString() });
  return { ...restored, running: true, processId: child.pid, hostLogPath };
}

function createHostLogPath(root) {
  return path.join(root, ".render", "logs", `host-${randomUUID()}.log`);
}

export function stopWorkspace(workspace, requestId = randomUUID()) {
  const root = path.resolve(workspace);
  const status = statusWorkspace(root, requestId);
  if (!status.ok) return { ...status, operation: "stop" };

  const processId = status.state.processId;
  if (processId && processId !== process.pid) {
    try {
      process.kill(processId);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }

  const state = markWorkspaceStopped(root, true);
  return {
    requestId,
    operation: "stop",
    workspace: root,
    ok: true,
    stopped: Boolean(processId),
    state,
    diagnostics: []
  };
}

export function watchWorkspace(workspace, requestId = randomUUID(), onResult = () => {}, options = {}) {
  const root = path.resolve(workspace);
  const initial = runWorkspace(root, requestId, options);
  if (!initial.ok) return { initial, close: () => {} };

  let debounceTimer;
  const watcher = watch(root, { persistent: true }, (_event, filename) => {
    if (filename && String(filename) !== "widget.tsx") return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onResult(runWorkspace(root, undefined, options));
    }, 50);
  });
  return {
    initial,
    close: () => {
      clearTimeout(debounceTimer);
      watcher.close();
      stopPreviousHost(root);
    }
  };
}

function validateRuntimeTree(node, pathName, subscriptions, capabilities, accounts) {
  if (!node || typeof node !== "object") {
    throw new Error(`${pathName}: render() must return a widget node`);
  }
  const kinds = new Set(sdk.WIDGET_NODE_KINDS);
  if (!kinds.has(node.kind)) {
    throw new Error(`${pathName}.kind: unknown widget primitive`);
  }
  if (node.key !== undefined && !(["string", "number"].includes(typeof node.key))) {
    throw new Error(`${pathName}.key: keys must be strings or numbers`);
  }
  const containers = new Set(["column", "row", "stack", "box", "glassPanel", "mediaCard", "scrollView", "grid", "button"]);
  if (containers.has(node.kind) && node.text !== undefined) {
    throw new Error(`${pathName}.text: container nodes cannot define text`);
  }
  if (!containers.has(node.kind) && node.children !== undefined && node.children.length > 0) {
    throw new Error(`${pathName}.children: leaf nodes cannot define children`);
  }
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) throw new Error(`${pathName}.children: must be an array`);
    const childKeys = new Set();
    node.children.forEach((child, index) => validateRuntimeTree(child, `${pathName}.children[${index}]`, subscriptions, capabilities, accounts));
    node.children.forEach((child, index) => {
      if (child.key === undefined) return;
      const key = `${typeof child.key}:${String(child.key)}`;
      if (childKeys.has(key)) throw new Error(`${pathName}.children[${index}].key: sibling keys must be unique`);
      childKeys.add(key);
    });
  }
  if (node.provider !== undefined && (typeof node.provider !== "string" || node.provider.length === 0)) {
    throw new Error(`${pathName}.provider: provider bindings require a name`);
  }
  if (node.provider !== undefined && !subscriptions.has(node.provider)) {
    throw new Error(`${pathName}.provider: ${node.provider} must be listed in manifest.subscribe`);
  }
  if (node.provider !== undefined && !SUPPORTED_PROVIDERS.has(node.provider)) {
    throw new Error(`${pathName}.provider: unsupported provider '${node.provider}'; use render sdk list to choose a host provider`);
  }
  const providerConnector = connectorForName(node.provider);
  if (providerConnector && !accounts.has(providerConnector)) {
    throw new Error(`${pathName}.provider: ${node.provider} requires a ${providerConnector} account requirement; add manifest.accounts and ask the user for permission`);
  }
  if (providerConnector === "reminders" && !accounts.get(providerConnector).has("reminders.read")) {
    throw new Error(`${pathName}.provider: ${node.provider} requires the reminders.read scope; add it to manifest.accounts and ask the user for permission`);
  }
  if ((node.kind === "text" || node.kind === "textField") && (typeof node.text !== "string" || node.text.length === 0) && node.provider === undefined) {
    throw new Error(`${pathName}.text: text nodes require text or a provider`);
  }
  if (node.kind === "textEditor" && node.text !== undefined && typeof node.text !== "string") {
    throw new Error(`${pathName}.text: textEditor content must be a string`);
  }
  if (node.placeholder !== undefined && (node.kind !== "textEditor" || typeof node.placeholder !== "string")) {
    throw new Error(`${pathName}.placeholder: only textEditor nodes may define a string placeholder`);
  }
  if (node.dateTimeMode !== undefined && !["date", "time", "dateTime"].includes(node.dateTimeMode)) {
    throw new Error(`${pathName}.dateTimeMode: mode must be date, time, or dateTime`);
  }
  if (node.kind === "dateTime" && (typeof node.dateTime !== "string" || !Number.isFinite(Date.parse(node.dateTime)))) {
    throw new Error(`${pathName}.dateTime: DateTime nodes require a valid ISO date-time string`);
  }
  if (node.kind === "dateTimePicker" && node.dateTime !== undefined && (typeof node.dateTime !== "string" || !Number.isFinite(Date.parse(node.dateTime)))) {
    throw new Error(`${pathName}.dateTime: DateTimePicker values must be valid ISO date-time strings`);
  }
  if (!new Set(["dateTime", "dateTimePicker"]).has(node.kind) && node.dateTime !== undefined) {
    throw new Error(`${pathName}.dateTime: only dateTime nodes may define a date-time value`);
  }
  if (!new Set(["dateTime", "dateTimePicker"]).has(node.kind) && node.dateTimeMode !== undefined) {
    throw new Error(`${pathName}.dateTimeMode: only dateTime nodes may define a date-time mode`);
  }
  if (node.kind === "toggle" && node.value !== 0 && node.value !== 1) {
    throw new Error(`${pathName}.value: toggle value must be boolean`);
  }
  if (node.kind === "timer" && (!Number.isInteger(node.durationSeconds) || node.durationSeconds <= 0)) {
    throw new Error(`${pathName}.durationSeconds: timer duration must be a positive integer in seconds`);
  }
  if (node.kind === "taskList") {
    if (!Array.isArray(node.tasks)) throw new Error(`${pathName}.tasks: task lists require an array of items`);
    const ids = new Set();
    node.tasks.forEach((task, index) => {
      if (!task || typeof task !== "object") throw new Error(`${pathName}.tasks[${index}]: task must be an object`);
      if (typeof task.id !== "string" || task.id.length === 0) throw new Error(`${pathName}.tasks[${index}].id: task id must be non-empty`);
      if (ids.has(task.id)) throw new Error(`${pathName}.tasks[${index}].id: task ids must be unique`);
      ids.add(task.id);
      if (typeof task.text !== "string" || task.text.length === 0) throw new Error(`${pathName}.tasks[${index}].text: task text must be non-empty`);
      if (task.completed !== undefined && typeof task.completed !== "boolean") throw new Error(`${pathName}.tasks[${index}].completed: task completion must be boolean`);
    });
  }
  if (node.kind === "list") {
    if (node.provider === undefined && !Array.isArray(node.items)) {
      throw new Error(`${pathName}.items: list nodes require an array of items or a provider`);
    }
    if (node.items !== undefined) validateListItems(node.items, `${pathName}.items`);
  }
  if (node.kind === "visualizer") {
    if (node.visualizerMode !== undefined && !new Set(["bars", "waveform", "rings"]).has(node.visualizerMode)) {
      throw new Error(`${pathName}.visualizerMode: mode must be bars, waveform, or rings`);
    }
    if (node.visualizerTempo !== undefined && (typeof node.visualizerTempo !== "number" || !Number.isFinite(node.visualizerTempo) || node.visualizerTempo <= 0)) {
      throw new Error(`${pathName}.visualizerTempo: tempo must be a positive number`);
    }
  }
  if (node.kind !== "visualizer" && (node.visualizerMode !== undefined || node.visualizerTempo !== undefined)) {
    throw new Error(`${pathName}: visualizer fields may only be used by visualizer nodes`);
  }
  if (node.kind !== "list" && node.items !== undefined) {
    throw new Error(`${pathName}.items: only list nodes may define items`);
  }
  if (node.kind === "youtubePlayer") {
    if (!capabilities.has("network")) {
      throw new Error(`${pathName}: YouTubePlayer requires the \"network\" capability; add it to manifest.capabilities and ask the user for permission`);
    }
    if (node.videoId === undefined && node.allowLinkInput !== true) {
      throw new Error(`${pathName}.videoId: YouTubePlayer requires a video ID or allowLinkInput: true`);
    }
    if (node.videoId !== undefined && (typeof node.videoId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(node.videoId))) {
      throw new Error(`${pathName}.videoId: YouTubePlayer requires an 11-character YouTube video ID`);
    }
    if (node.allowLinkInput !== undefined && typeof node.allowLinkInput !== "boolean") {
      throw new Error(`${pathName}.allowLinkInput: YouTubePlayer allowLinkInput must be boolean`);
    }
    if (node.autoplay !== undefined && typeof node.autoplay !== "boolean") {
      throw new Error(`${pathName}.autoplay: YouTubePlayer autoplay must be boolean`);
    }
    if (node.controls !== undefined && typeof node.controls !== "boolean") {
      throw new Error(`${pathName}.controls: YouTubePlayer controls must be boolean`);
    }
    if (node.startSeconds !== undefined && (!Number.isFinite(node.startSeconds) || node.startSeconds < 0)) {
      throw new Error(`${pathName}.startSeconds: YouTubePlayer startSeconds must be a non-negative number`);
    }
  }
  if (node.kind !== "youtubePlayer" && (node.videoId !== undefined || node.allowLinkInput !== undefined || node.autoplay !== undefined || node.controls !== undefined || node.startSeconds !== undefined)) {
    throw new Error(`${pathName}: YouTubePlayer fields may only be used by youtubePlayer nodes`);
  }
  if ((node.kind === "gauge" || node.kind === "progress")) {
    const hasProvider = typeof node.provider === "string" && node.provider.length > 0;
    const hasValue = typeof node.value === "number";
    if ((!hasProvider && !hasValue) || typeof node.maximum !== "number" || !Number.isFinite(node.maximum) || node.maximum <= 0) {
      throw new Error(`${pathName}: ${node.kind} nodes require a provider or value and a positive maximum`);
    }
    if (hasValue && (!Number.isFinite(node.value) || node.value < 0 || node.value > node.maximum)) {
      throw new Error(`${pathName}.value: ${node.kind} value must be between zero and maximum`);
    }
  }
  if (node.kind === "icon" && (typeof node.name !== "string" || node.name.length === 0)) {
    throw new Error(`${pathName}.name: icon nodes require a non-empty symbol name`);
  }
  if (node.kind === "image") {
    if (!node.source || typeof node.source !== "object") throw new Error(`${pathName}.source: image nodes require an explicit source`);
    const sourceKinds = new Set(["asset", "url", "provider"]);
    if (!sourceKinds.has(node.source.kind)) throw new Error(`${pathName}.source.kind: image source kind must be asset, url, or provider`);
    const sourceValue = node.source.kind === "url" ? node.source.url : node.source.name;
    if (typeof sourceValue !== "string" || sourceValue.length === 0) throw new Error(`${pathName}.source: image source value must be non-empty`);
    if (node.source.kind === "url" && !capabilities.has("network")) throw new Error(`${pathName}.source: URL images require the manifest capability \"network\" and user permission`);
    if (node.source.kind !== "asset") throw new Error(`${pathName}.source.kind: ${node.source.kind} image sources are deferred until their capability-backed provider ships; use an asset source`);
  }
  if (node.kind === "divider" && node.orientation !== "horizontal" && node.orientation !== "vertical") {
    throw new Error(`${pathName}.orientation: divider orientation must be horizontal or vertical`);
  }
  if (node.kind === "grid" && (!Number.isInteger(node.columns) || node.columns <= 0)) {
    throw new Error(`${pathName}.columns: grid columns must be a positive integer`);
  }
  if (node.action !== undefined) {
    if (node.kind !== "button") throw new Error(`${pathName}.action: only button nodes may define an action`);
    validateAction(node.action, `${pathName}.action`, accounts);
  }
  validateStyle(node.style, `${pathName}.style`);
}

function validateAction(action, pathName, accounts) {
  if (!action || typeof action !== "object" || !["invoke", "set"].includes(action.type)) {
    throw new Error(`${pathName}: action type must be invoke or set`);
  }
  if (typeof action.name !== "string" || action.name.length === 0) {
    throw new Error(`${pathName}.name: action name must be non-empty`);
  }
  if (!SUPPORTED_ACTIONS.has(action.name)) {
    throw new Error(`${pathName}.name: unsupported action '${action.name}'; use render sdk describe WidgetActionName`);
  }
  const actionConnector = connectorForName(action.name);
  if (actionConnector && !accounts.has(actionConnector)) {
    throw new Error(`${pathName}.name: ${action.name} requires a ${actionConnector} account requirement; add manifest.accounts and ask the user for permission`);
  }
  if (actionConnector === "reminders" && !accounts.get(actionConnector).has("reminders.write")) {
    throw new Error(`${pathName}.name: ${action.name} requires the reminders.write scope; add it to manifest.accounts and ask the user for permission`);
  }
  if (action.name === "spotify.set-volume") {
    if (action.type !== "set" || typeof action.value !== "number" || !Number.isInteger(action.value) || action.value < 0 || action.value > 100) {
      throw new Error(`${pathName}: spotify.set-volume requires an integer set value between 0 and 100`);
    }
  } else if (action.name.startsWith("reminders.")) {
    if (action.type !== "invoke") throw new Error(`${pathName}: ${action.name} requires an invoke action`);
    validateReminderAction(action.name, action.payload, pathName);
  } else if (action.type !== "invoke") {
    throw new Error(`${pathName}: ${action.name} requires an invoke action`);
  }
  if (action.type === "invoke" && action.payload !== undefined) validateJsonValue(action.payload, `${pathName}.payload`);
  if (action.type === "set") validateJsonValue(action.value, `${pathName}.value`);
}

function connectorForName(name) {
  if (typeof name !== "string") return undefined;
  if (name.startsWith("spotify.")) return "spotify";
  if (name.startsWith("reminders.")) return "reminders";
  return undefined;
}

function validateReminderAction(name, payload, pathName) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`${pathName}.payload: ${name} requires an object payload; use render sdk describe ${name}`);
  }
  const requiredString = (field) => {
    if (typeof payload[field] !== "string" || payload[field].trim() === "") {
      throw new Error(`${pathName}.payload.${field}: ${name} requires a non-empty string`);
    }
  };
  if (name === "reminders.create") requiredString("title");
  if (["reminders.update", "reminders.complete", "reminders.delete"].includes(name)) requiredString("id");
  if (name === "reminders.update" && payload.completed !== undefined && typeof payload.completed !== "boolean") {
    throw new Error(`${pathName}.payload.completed: reminders.update requires a boolean when completed is supplied`);
  }
  if (name === "reminders.complete" && payload.completed !== undefined && typeof payload.completed !== "boolean") {
    throw new Error(`${pathName}.payload.completed: reminders.complete requires a boolean when completed is supplied`);
  }
  for (const field of ["listName", "dueDate", "title"]) {
    if (payload[field] !== undefined && typeof payload[field] !== "string") {
      throw new Error(`${pathName}.payload.${field}: ${name} requires a string when supplied`);
    }
  }
  for (const field of ["dueDate"]) {
    if (payload[field] !== undefined && (typeof payload[field] !== "string" || !Number.isFinite(Date.parse(payload[field])))) {
      throw new Error(`${pathName}.payload.${field}: ${name} requires a valid ISO date string when supplied`);
    }
  }
}

function validateListItems(items, pathName) {
  const ids = new Set();
  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${pathName}[${index}]: list item must be an object`);
    if (typeof item.id !== "string" || item.id.trim() === "") throw new Error(`${pathName}[${index}].id: list item id must be non-empty`);
    if (ids.has(item.id)) throw new Error(`${pathName}[${index}].id: list item ids must be unique`);
    ids.add(item.id);
    if (typeof item.title !== "string" || item.title.trim() === "") throw new Error(`${pathName}[${index}].title: list item title must be non-empty`);
    if (item.subtitle !== undefined && typeof item.subtitle !== "string") throw new Error(`${pathName}[${index}].subtitle: list item subtitle must be a string`);
    if (item.completed !== undefined && typeof item.completed !== "boolean") throw new Error(`${pathName}[${index}].completed: list item completion must be boolean`);
  });
}

function validateJsonValue(value, pathName) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new Error(`${pathName}: JSON numbers must be finite`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJsonValue(item, `${pathName}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => validateJsonValue(item, `${pathName}.${key}`));
    return;
  }
  throw new Error(`${pathName}: action values must be JSON-compatible`);
}

function validateStyle(style, pathName) {
  if (style === undefined) return;
  if (!style || typeof style !== "object" || Array.isArray(style)) throw new Error(`${pathName}: style must be an object`);
  const allowed = new Set([
    "width", "height", "color", "backgroundColor", "opacity", "padding", "margin", "gap",
    "alignItems", "justifyContent", "radius", "border", "shadow", "font", "material", "role", "density", "tokens"
  ]);
  for (const key of Object.keys(style)) if (!allowed.has(key)) throw new Error(`${pathName}.${key}: unknown style property`);
  for (const key of ["width", "height"]) {
    if (style[key] !== undefined && !(typeof style[key] === "number" || style[key] === "fill" || style[key] === "fit")) {
      throw new Error(`${pathName}.${key}: length must be a number, fill, or fit`);
    }
    if (typeof style[key] === "number" && (!Number.isFinite(style[key]) || style[key] <= 0)) throw new Error(`${pathName}.${key}: length must be greater than zero`);
  }
  for (const key of ["opacity", "gap", "radius"]) {
    if (style[key] !== undefined && (typeof style[key] !== "number" || !Number.isFinite(style[key]) || style[key] < 0 || (key === "opacity" && style[key] > 1))) {
      throw new Error(`${pathName}.${key}: must be a valid non-negative number${key === "opacity" ? " between zero and one" : ""}`);
    }
  }
  for (const key of ["color", "backgroundColor"]) if (style[key] !== undefined && typeof style[key] !== "string") throw new Error(`${pathName}.${key}: color must be a string`);
  const alignments = new Set(["leading", "center", "trailing", "top", "bottom", "fill", "space-between"]);
  for (const key of ["alignItems", "justifyContent"]) if (style[key] !== undefined && !alignments.has(style[key])) throw new Error(`${pathName}.${key}: unsupported alignment`);
  validateSpacing(style.padding, `${pathName}.padding`);
  validateSpacing(style.margin, `${pathName}.margin`);
  if (style.border !== undefined) {
    if (!style.border || typeof style.border !== "object" || Array.isArray(style.border)) throw new Error(`${pathName}.border: border must be an object`);
    validateObjectKeys(style.border, ["color", "width", "radius"], `${pathName}.border`);
    for (const key of ["width", "radius"]) if (style.border[key] !== undefined && (typeof style.border[key] !== "number" || !Number.isFinite(style.border[key]) || style.border[key] < 0)) throw new Error(`${pathName}.border.${key}: must be non-negative`);
    if (style.border.color !== undefined && typeof style.border.color !== "string") throw new Error(`${pathName}.border.color: color must be a string`);
  }
  if (style.shadow !== undefined) {
    if (!style.shadow || typeof style.shadow !== "object" || Array.isArray(style.shadow)) throw new Error(`${pathName}.shadow: shadow must be an object`);
    validateObjectKeys(style.shadow, ["color", "radius", "x", "y", "opacity"], `${pathName}.shadow`);
    for (const key of ["radius", "x", "y"]) if (style.shadow[key] !== undefined && (typeof style.shadow[key] !== "number" || !Number.isFinite(style.shadow[key]))) throw new Error(`${pathName}.shadow.${key}: must be a finite number`);
    if (style.shadow.opacity !== undefined && (typeof style.shadow.opacity !== "number" || style.shadow.opacity < 0 || style.shadow.opacity > 1)) throw new Error(`${pathName}.shadow.opacity: must be between zero and one`);
    if (style.shadow.color !== undefined && typeof style.shadow.color !== "string") throw new Error(`${pathName}.shadow.color: color must be a string`);
  }
  if (style.font !== undefined) {
    if (!style.font || typeof style.font !== "object" || Array.isArray(style.font)) throw new Error(`${pathName}.font: font must be an object`);
    validateObjectKeys(style.font, ["family", "size", "weight", "monospace"], `${pathName}.font`);
    if (style.font.size !== undefined && (typeof style.font.size !== "number" || style.font.size <= 0)) throw new Error(`${pathName}.font.size: must be greater than zero`);
    if (style.font.weight !== undefined && !new Set(["regular", "medium", "semibold", "bold"]).has(style.font.weight)) throw new Error(`${pathName}.font.weight: unsupported font weight`);
    if (style.font.family !== undefined && typeof style.font.family !== "string") throw new Error(`${pathName}.font.family: family must be a string`);
    if (style.font.monospace !== undefined && typeof style.font.monospace !== "boolean") throw new Error(`${pathName}.font.monospace: must be boolean`);
  }
  if (style.material !== undefined && !new Set(["solid", "thin", "thick"]).has(style.material)) throw new Error(`${pathName}.material: unsupported material`);
  if (style.role !== undefined && !new Set(["surface", "panel", "control", "status", "media"]).has(style.role)) throw new Error(`${pathName}.role: unsupported semantic role`);
  if (style.density !== undefined && !new Set(["compact", "comfortable"]).has(style.density)) throw new Error(`${pathName}.density: unsupported density`);
  if (style.tokens !== undefined && (!Array.isArray(style.tokens) || style.tokens.some((token) => !new Set(["surface", "surface.elevated", "surface.panel", "surface.control", "surface.status", "text.primary", "text.secondary", "text.tertiary", "border.subtle", "accent", "accent.muted", "danger", "success", "mono"]).has(token)))) throw new Error(`${pathName}.tokens: contains an unsupported style token`);
}

function validateObjectKeys(value, allowed, pathName) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${pathName}.${key}: unknown style property`);
}

function validateSpacing(value, pathName) {
  if (value === undefined) return;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${pathName}: spacing must be non-negative`);
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${pathName}: spacing must be a number or insets`);
  validateObjectKeys(value, ["top", "right", "bottom", "left"], pathName);
  for (const key of ["top", "right", "bottom", "left"]) if (value[key] !== undefined && (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0)) throw new Error(`${pathName}.${key}: spacing must be non-negative`);
}

function findHostPath() {
  const configured = process.env.RENDER_HOST_PATH;
  if (configured && existsSync(configured)) return configured;

  const packaged = [
    path.resolve(".build/debug/RenderHost.app/Contents/MacOS/RenderHost"),
    path.resolve(".build/arm64-apple-macosx/debug/RenderHost.app/Contents/MacOS/RenderHost")
  ].find((candidate) => existsSync(candidate)) ?? null;
  const raw = [
    path.resolve(".build/debug/RenderHost"),
    path.resolve(".build/arm64-apple-macosx/debug/RenderHost")
  ].find((candidate) => existsSync(candidate)) ?? null;

  return selectHostPath(packaged, raw);
}

export function selectHostPath(packaged, raw) {
  if (!packaged || !raw) return packaged ?? raw;
  try {
    return statSync(packaged).mtimeMs >= statSync(raw).mtimeMs ? packaged : raw;
  } catch {
    return packaged;
  }
}

function isNativeHost(hostPath) {
  return typeof hostPath === "string" && existsSync(hostPath) && path.basename(hostPath) === "RenderHost";
}

function previousVersion(state) {
  const versions = state.successfulVersions ?? [];
  for (let index = versions.length - 1; index >= 0; index -= 1) {
    if (versions[index] !== state.activeVersion) return versions[index];
  }
  return null;
}

function stopPreviousHost(root) {
  const status = statusWorkspace(root);
  const processId = status.ok ? status.state.processId : null;
  if (!processId || processId === process.pid) return;
  try {
    process.kill(processId);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function updateState(root, state) {
  const metadataPath = path.join(root, ".render", "metadata.json");
  const temporaryPath = `${metadataPath}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, metadataPath);
}

function writeAtomically(filePath, data) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, data, "utf8");
  renameSync(temporaryPath, filePath);
}
