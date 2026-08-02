import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, renameSync, unlinkSync, watch, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import * as sdk from "../packages/sdk/src/index.ts";
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

export function buildRuntimeTree(source, filename = "widget.tsx") {
  const transformed = source
    .replace(
      /import\s*\{([^}]+)\}\s*from\s*["']@render\/sdk["']\s*;?/m,
      "const {$1} = sdk;"
    )
    .replace(/export\s+default\s+/, "exports.default = ");

  const sandbox = { exports: {}, sdk };
  const script = new vm.Script(transformed, { filename });
  script.runInNewContext(sandbox, { timeout: 1000 });

  const definition = sandbox.exports.default;
  if (!definition || typeof definition.render !== "function") {
    throw new Error("widget.tsx must export the result of widget(manifest, render)");
  }
  const tree = definition.render();
  const subscriptions = new Set(definition.manifest?.subscribe ?? []);
  validateRuntimeTree(tree, "root", subscriptions);
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

function validateRuntimeTree(node, pathName, subscriptions) {
  if (!node || typeof node !== "object") {
    throw new Error(`${pathName}: render() must return a widget node`);
  }
  const kinds = new Set(["column", "row", "stack", "text", "shape", "gauge"]);
  if (!kinds.has(node.kind)) {
    throw new Error(`${pathName}.kind: unknown widget primitive`);
  }
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) throw new Error(`${pathName}.children: must be an array`);
    node.children.forEach((child, index) => validateRuntimeTree(child, `${pathName}.children[${index}]`, subscriptions));
  }
  if (node.provider !== undefined && (typeof node.provider !== "string" || node.provider.length === 0)) {
    throw new Error(`${pathName}.provider: provider bindings require a name`);
  }
  if (node.provider !== undefined && !subscriptions.has(node.provider)) {
    throw new Error(`${pathName}.provider: ${node.provider} must be listed in manifest.subscribe`);
  }
  if (node.kind === "text" && typeof node.text !== "string" && node.provider === undefined) {
    throw new Error(`${pathName}.text: text nodes require text or a provider`);
  }
  if (node.kind === "gauge") {
    const hasProvider = typeof node.provider === "string" && node.provider.length > 0;
    const hasValue = typeof node.value === "number";
    if ((!hasProvider && !hasValue) || typeof node.maximum !== "number" || node.maximum <= 0) {
      throw new Error(`${pathName}: gauge nodes require a provider or value and a positive maximum`);
    }
  }
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
