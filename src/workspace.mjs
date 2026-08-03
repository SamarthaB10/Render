import { randomUUID } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { extractManifest, validateManifest } from "./manifest.mjs";
import { buildRuntimeTree } from "./runtime.mjs";
import { transpileTsx } from "./tsx-runtime.mjs";
import { CANONICAL_WIDGET_SOURCE } from "../packages/sdk/src/catalog.ts";

export function initWorkspace(workspace, requestId = randomUUID()) {
  return createWorkspace(workspace, requestId, "init");
}

export function scaffoldWorkspace(workspace, requestId = randomUUID()) {
  return createWorkspace(workspace, requestId, "scaffold");
}

function createWorkspace(workspace, requestId, operation) {
  const root = path.resolve(workspace);
  const widgetPath = path.join(root, "widget.tsx");
  if (existsSync(widgetPath)) {
    throw new Error("workspace already contains widget.tsx");
  }

  const renderRoot = path.join(root, ".render");
  mkdirSync(path.join(renderRoot, "snapshots"), { recursive: true });
  mkdirSync(path.join(renderRoot, "logs"), { recursive: true });
  mkdirSync(path.join(renderRoot, "runtime"), { recursive: true });
  mkdirSync(path.join(root, "assets"), { recursive: true });
  writeFileSync(widgetPath, CANONICAL_WIDGET_SOURCE, "utf8");

  const state = {
    schemaVersion: 1,
    widgetId: randomUUID(),
    workspace: root,
    running: false,
    activeVersion: null,
    lastKnownGoodVersion: null,
    successfulVersions: [],
    processId: null,
    lastFailure: null
  };
  writeFileSync(
    path.join(renderRoot, "metadata.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8"
  );

  return { requestId, operation, workspace: root, ok: true, state, diagnostics: [] };
}

export function promoteSnapshot(workspace, requestId = randomUUID()) {
  const root = path.resolve(workspace);
  const renderRoot = path.join(root, ".render");
  const version = `snapshot-${randomUUID()}`;
  const snapshotPath = path.join(renderRoot, "snapshots", version);
  mkdirSync(snapshotPath, { recursive: true });

  writeFileSync(path.join(snapshotPath, "widget.tsx"), readFileSync(path.join(root, "widget.tsx")), "utf8");
  writeFileSync(
    path.join(snapshotPath, "tree.json"),
    readFileSync(path.join(renderRoot, "runtime", "tree.json")),
    "utf8"
  );
  writeFileSync(
    path.join(snapshotPath, "manifest.json"),
    readFileSync(path.join(renderRoot, "runtime", "manifest.json")),
    "utf8"
  );
  copyAssets(root, snapshotPath);

  const state = readState(root);
  const nextState = {
    ...state,
    activeVersion: version,
    lastKnownGoodVersion: version,
    successfulVersions: [...state.successfulVersions, version],
    lastFailure: null
  };
  writeState(root, nextState);
  return { requestId, operation: "promote", workspace: root, ok: true, version, snapshotPath, state: nextState, diagnostics: [] };
}

export function restoreSnapshot(workspace, version, requestId = randomUUID()) {
  const root = path.resolve(workspace);
  const snapshotPath = path.join(root, ".render", "snapshots", version);
  if (!existsSync(snapshotPath)) {
    return result(requestId, "rollback", root, false, [{
      code: "missing-snapshot",
      path: `.render/snapshots/${version}`,
      message: "snapshot version does not exist"
    }]);
  }

  const runtimeRoot = path.join(root, ".render", "runtime");
  writeAtomically(path.join(root, "widget.tsx"), readFileSync(path.join(snapshotPath, "widget.tsx")));
  writeAtomically(path.join(runtimeRoot, "tree.json"), readFileSync(path.join(snapshotPath, "tree.json")));
  writeAtomically(path.join(runtimeRoot, "manifest.json"), readFileSync(path.join(snapshotPath, "manifest.json")));
  copyAssets(snapshotPath, root);

  const state = readState(root);
  const nextState = {
    ...state,
    activeVersion: version,
    lastKnownGoodVersion: version,
    lastFailure: null
  };
  writeState(root, nextState);
  return { requestId, operation: "rollback", workspace: root, ok: true, version, state: nextState, diagnostics: [] };
}

export function recordFailure(workspace, diagnostics) {
  const root = path.resolve(workspace);
  if (!existsSync(path.join(root, ".render", "metadata.json"))) return null;
  const state = readState(root);
  const nextState = {
    ...state,
    lastFailure: { at: new Date().toISOString(), diagnostics }
  };
  writeState(root, nextState);
  return nextState;
}

export function checkWorkspace(workspace, requestId = randomUUID()) {
  const root = path.resolve(workspace);
  const widgetPath = path.join(root, "widget.tsx");
  if (!existsSync(widgetPath)) {
    return result(requestId, "check", root, false, [{
      code: "missing-widget",
      path: "widget.tsx",
      message: "workspace must contain widget.tsx"
    }]);
  }

  const source = readFileSync(widgetPath, "utf8");
  const diagnostics = validateImports(source);
  if (diagnostics.length > 0) {
    return result(requestId, "check", root, false, diagnostics);
  }

  try {
    transpileTsx(source, widgetPath);
  } catch (error) {
    return result(requestId, "check", root, false, (error.diagnostics ?? [{
      code: error.code ?? "invalid-widget-source",
      path: "widget.tsx",
      message: error.message
    }]).map((diagnostic) => ({
      code: diagnostic.code ?? error.code ?? "invalid-widget-source",
      path: diagnostic.path ?? "widget.tsx",
      message: diagnostic.message ?? error.message
    })));
  }

  try {
    const manifest = extractManifest(source);
    const issues = validateManifest(manifest, { workspace: root });
    if (issues.length > 0) {
      return result(requestId, "check", root, false, issues.map((issue) => ({
        code: "invalid-manifest",
        path: issue.path,
        message: issue.message
      })));
    }
  } catch (error) {
    return result(requestId, "check", root, false, [{
      code: "invalid-widget-source",
      path: "widget.tsx",
      message: error.message
    }]);
  }

  try {
    buildRuntimeTree(source, widgetPath);
  } catch (error) {
    return result(requestId, "check", root, false, [{
      code: error.code ?? "invalid-widget-tree",
      path: "widget.tsx",
      message: error.message
    }]);
  }

  return result(requestId, "check", root, true, []);
}

export function statusWorkspace(workspace, requestId = randomUUID()) {
  const root = path.resolve(workspace);
  const metadataPath = path.join(root, ".render", "metadata.json");
  if (!existsSync(metadataPath)) {
    return result(requestId, "status", root, false, [{
      code: "missing-workspace",
      path: ".render/metadata.json",
      message: "run render init before inspecting status"
    }]);
  }

  try {
    const state = readState(root);
    const workerStatePath = state.workerStatePath ?? path.join(root, ".render/runtime/worker-state.json");
    const worker = existsSync(workerStatePath)
      ? JSON.parse(readFileSync(workerStatePath, "utf8"))
      : null;
    return { requestId, operation: "status", workspace: root, ok: true, state, worker, diagnostics: [] };
  } catch {
    return result(requestId, "status", root, false, [{
      code: "invalid-metadata",
      path: ".render/metadata.json",
      message: "metadata must be valid JSON"
    }]);
  }
}

function validateImports(source) {
  const diagnostics = [];
  const imports = [
    ...source.matchAll(/\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)
  ];
  for (const match of imports) {
    if (match[1] !== "@render/sdk") {
      diagnostics.push({
        code: "unsupported-import",
        path: `widget.tsx:${lineNumber(source, match.index)}`,
        message: "imports must come from @render/sdk"
      });
    }
  }
  return diagnostics;
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function result(requestId, operation, workspace, ok, diagnostics) {
  return { requestId, operation, workspace, ok, diagnostics };
}

function readState(root) {
  const state = JSON.parse(readFileSync(path.join(root, ".render", "metadata.json"), "utf8"));
  return {
    successfulVersions: [],
    processId: null,
    lastFailure: null,
    ...state,
    successfulVersions: Array.isArray(state.successfulVersions) ? state.successfulVersions : []
  };
}

function writeState(root, state) {
  writeAtomically(
    path.join(root, ".render", "metadata.json"),
    `${JSON.stringify(state, null, 2)}\n`
  );
}

function writeAtomically(filePath, data) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, data);
  renameSync(temporaryPath, filePath);
}

function copyAssets(sourceRoot, destinationRoot) {
  const source = path.join(sourceRoot, "assets");
  const destination = path.join(destinationRoot, "assets");
  const replacement = `${destination}.${randomUUID()}.tmp`;
  const backup = `${destination}.${randomUUID()}.bak`;

  try {
    if (existsSync(source)) {
      cpSync(source, replacement, { recursive: true, force: true });
    }
    if (existsSync(destination)) renameSync(destination, backup);
    if (existsSync(replacement)) renameSync(replacement, destination);
    if (existsSync(backup)) rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(replacement)) rmSync(replacement, { recursive: true, force: true });
    if (!existsSync(destination) && existsSync(backup)) renameSync(backup, destination);
    throw error;
  }
}
