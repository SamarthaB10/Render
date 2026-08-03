import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, renameSync, unlinkSync, watch, writeFileSync } from "node:fs";
import path from "node:path";
import * as sdk from "../packages/sdk/src/index.ts";
import { buildTsxRuntimeTree } from "./tsx-runtime.mjs";
import {
  checkWorkspace,
  promoteSnapshot,
  recordFailure,
  restoreSnapshot,
  statusWorkspace
} from "./workspace.mjs";
import { extractManifest, updateManifest, validateManifest } from "./manifest.mjs";

// Receipt: perf/receipts/phase8-worker.json
const SUPERVISOR_STARTUP_TIMEOUT_MS = 5000;
const SUPPORTED_ACTIONS = new Set([
  "widget.refresh",
  "widget.reload",
  "spotify.play",
  "spotify.pause",
  "spotify.next",
  "spotify.previous",
  "spotify.set-volume"
]);
const SUPPORTED_PROVIDERS = new Set([
  "system.cpu",
  "system.memory",
  "system.time",
  "spotify.account",
  "spotify.track.title",
  "spotify.track.artist",
  "spotify.playback.isPlaying",
  "spotify.playback.progress",
  "spotify.playback.volume"
]);

export function buildRuntimeTree(source, filename = "widget.tsx") {
  const tree = buildTsxRuntimeTree(source, { sdk, filename });
  const manifest = extractManifest(source);
  const subscriptions = new Set(manifest.subscribe);
  const accounts = new Set((manifest.accounts ?? []).map((account) => account.connector));
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
        path: ".build/debug/RenderHost",
        message: "build the RenderHost executable before running a widget"
      }]
    };
    recordFailure(root, result.diagnostics);
    return result;
  }

  const promotion = promoteSnapshot(root, requestId);
  stopPreviousHost(root);
  const child = spawn(hostPath, ["--workspace", root], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, RENDER_WORKSPACE: root }
  });
  child.unref();
  const state = {
    ...promotion.state,
    running: true,
    processId: child.pid
  };
  updateState(root, state);
  return {
    ...prepared,
    running: true,
    processId: child.pid,
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
    running: true,
    processId: launched.processId,
    workerStatePath: launched.workerStatePath
  };
  updateState(root, state);
  return {
    requestId,
    operation: "run",
    workspace: root,
    ok: true,
    running: true,
    processId: launched.processId,
    activeVersion: promotion.version,
    lastKnownGoodVersion: promotion.version,
    worker: launched.worker,
    workerStatePath: launched.workerStatePath
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
  const child = spawn(hostPath, [
    "--workspace", root,
    "--worker-script", workerScript,
    "--worker-source-path", workerSourcePath,
    "--worker-state-path", workerStatePath,
    "--worker-tree-path", workerTreePath
  ], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, RENDER_WORKER_SCRIPT: workerScript }
  });
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
  return { ok: true, processId: child.pid, worker, workerSourcePath, workerStatePath, workerTreePath };
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
        path: ".build/debug/RenderHost",
        message: "build the RenderHost executable before rolling back"
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
      running: true,
      processId: launched.processId,
      workerStatePath: launched.workerStatePath
    });
    return {
      ...restored,
      running: true,
      processId: launched.processId,
      worker: launched.worker,
      workerStatePath: launched.workerStatePath
    };
  }
  stopPreviousHost(root);
  const child = spawn(hostPath, ["--workspace", root], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, RENDER_WORKSPACE: root }
  });
  child.unref();
  updateState(root, { ...restored.state, running: true, processId: child.pid });
  return { ...restored, running: true, processId: child.pid };
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
  const kinds = new Set([
    "column", "row", "stack", "box", "spacer", "divider", "text", "textField", "shape",
    "icon", "image", "button", "gauge", "progress", "grid"
  ]);
  if (!kinds.has(node.kind)) {
    throw new Error(`${pathName}.kind: unknown widget primitive`);
  }
  if (node.key !== undefined && !(["string", "number"].includes(typeof node.key))) {
    throw new Error(`${pathName}.key: keys must be strings or numbers`);
  }
  const containers = new Set(["column", "row", "stack", "box", "grid", "button"]);
  if (containers.has(node.kind) && node.text !== undefined) {
    throw new Error(`${pathName}.text: container nodes cannot define text`);
  }
  if (!containers.has(node.kind) && node.children !== undefined && node.children.length > 0) {
    throw new Error(`${pathName}.children: leaf nodes cannot define children`);
  }
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) throw new Error(`${pathName}.children: must be an array`);
    node.children.forEach((child, index) => validateRuntimeTree(child, `${pathName}.children[${index}]`, subscriptions, capabilities, accounts));
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
  if (node.provider?.startsWith("spotify.") && !accounts.has("spotify")) {
    throw new Error(`${pathName}.provider: ${node.provider} requires a spotify account requirement; add manifest.accounts and ask the user for permission`);
  }
  if ((node.kind === "text" || node.kind === "textField") && (typeof node.text !== "string" || node.text.length === 0) && node.provider === undefined) {
    throw new Error(`${pathName}.text: text nodes require text or a provider`);
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
  if (action.name.startsWith("spotify.") && !accounts.has("spotify")) {
    throw new Error(`${pathName}.name: ${action.name} requires a spotify account requirement; add manifest.accounts and ask the user for permission`);
  }
  if (action.name === "spotify.set-volume") {
    if (action.type !== "set" || typeof action.value !== "number" || !Number.isInteger(action.value) || action.value < 0 || action.value > 100) {
      throw new Error(`${pathName}: spotify.set-volume requires an integer set value between 0 and 100`);
    }
  } else if (action.type !== "invoke") {
    throw new Error(`${pathName}: ${action.name} requires an invoke action`);
  }
  if (action.type === "invoke" && action.payload !== undefined) validateJsonValue(action.payload, `${pathName}.payload`);
  if (action.type === "set") validateJsonValue(action.value, `${pathName}.value`);
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
    "alignItems", "justifyContent", "radius", "border", "shadow", "font", "tokens"
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
  if (style.tokens !== undefined && (!Array.isArray(style.tokens) || style.tokens.some((token) => !new Set(["surface", "surface.elevated", "text.primary", "text.secondary", "accent", "danger", "success", "mono"]).has(token)))) throw new Error(`${pathName}.tokens: contains an unsupported style token`);
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
  const candidates = [
    process.env.RENDER_HOST_PATH,
    path.resolve(".build/debug/RenderHost"),
    path.resolve(".build/arm64-apple-macosx/debug/RenderHost")
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
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
