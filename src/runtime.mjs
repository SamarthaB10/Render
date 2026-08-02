import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, renameSync, watch, writeFileSync } from "node:fs";
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
import { extractManifest } from "./manifest.mjs";

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
  const prepared = prepareRun(workspace, requestId);
  if (!prepared.ok) {
    recordFailure(workspace, prepared.diagnostics);
    return prepared;
  }

  const root = path.resolve(workspace);
  const hostPath = options.hostPath === undefined ? findHostPath() : options.hostPath;
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
