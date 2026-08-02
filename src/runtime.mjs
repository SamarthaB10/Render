import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import * as sdk from "../packages/sdk/src/index.ts";
import { checkWorkspace } from "./workspace.mjs";

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
  validateRuntimeTree(tree, "root");
  return JSON.parse(JSON.stringify(tree));
}

export function prepareRun(workspace, requestId = randomUUID()) {
  const check = checkWorkspace(workspace, requestId);
  if (!check.ok) return { ...check, operation: "run" };

  const root = path.resolve(workspace);
  const sourcePath = path.join(root, "widget.tsx");
  const source = readFileSync(sourcePath, "utf8");
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

  return {
    requestId,
    operation: "run",
    workspace: root,
    ok: true,
    runtimeTreePath: runtimePath,
    diagnostics: []
  };
}

export function runWorkspace(workspace, requestId = randomUUID()) {
  const prepared = prepareRun(workspace, requestId);
  if (!prepared.ok) return prepared;

  const root = path.resolve(workspace);
  const hostPath = findHostPath();
  if (!hostPath) {
    return {
      ...prepared,
      ok: false,
      diagnostics: [{
        code: "host-not-built",
        path: ".build/debug/RenderHost",
        message: "build the RenderHost executable before running a widget"
      }]
    };
  }

  const child = spawn(hostPath, ["--workspace", root], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, RENDER_WORKSPACE: root }
  });
  child.unref();
  return { ...prepared, running: true, processId: child.pid };
}

function validateRuntimeTree(node, pathName) {
  if (!node || typeof node !== "object") {
    throw new Error(`${pathName}: render() must return a widget node`);
  }
  const kinds = new Set(["column", "row", "stack", "text", "shape", "gauge"]);
  if (!kinds.has(node.kind)) {
    throw new Error(`${pathName}.kind: unknown widget primitive`);
  }
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) throw new Error(`${pathName}.children: must be an array`);
    node.children.forEach((child, index) => validateRuntimeTree(child, `${pathName}.children[${index}]`));
  }
  if (node.kind === "text" && typeof node.text !== "string") {
    throw new Error(`${pathName}.text: text nodes require text`);
  }
  if (node.kind === "gauge" &&
      (typeof node.value !== "number" || typeof node.maximum !== "number" || node.maximum <= 0)) {
    throw new Error(`${pathName}: gauge nodes require a positive maximum`);
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
