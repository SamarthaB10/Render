import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { extractManifest, validateManifest } from "./manifest.mjs";

const WIDGET_SOURCE = [
  'import { Column, Gauge, Text, widget } from "@render/sdk";',
  "",
  "export default widget({",
  '  "schemaVersion": 1,',
  '  "name": "System Monitor",',
  '  "sdkVersion": "0.1.0",',
  '  "size": { "width": 320, "height": 180 },',
  '  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },',
  '  "capabilities": [],',
  '  "subscribe": ["system.cpu", "system.memory"]',
  "}, () => Column([",
  '  Text("Render"),',
  "  Gauge(0, 100)",
  "]));",
  ""
].join("\n");

export function initWorkspace(workspace, requestId = randomUUID()) {
  const root = path.resolve(workspace);
  const widgetPath = path.join(root, "widget.tsx");
  if (existsSync(widgetPath)) {
    throw new Error("workspace already contains widget.tsx");
  }

  const renderRoot = path.join(root, ".render");
  mkdirSync(path.join(renderRoot, "snapshots"), { recursive: true });
  mkdirSync(path.join(renderRoot, "logs"), { recursive: true });
  mkdirSync(path.join(renderRoot, "runtime"), { recursive: true });
  writeFileSync(widgetPath, WIDGET_SOURCE, "utf8");

  const state = {
    schemaVersion: 1,
    widgetId: randomUUID(),
    workspace: root,
    running: false,
    activeVersion: null,
    lastKnownGoodVersion: null
  };
  writeFileSync(
    path.join(renderRoot, "metadata.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8"
  );

  return { requestId, operation: "init", workspace: root, ok: true, state, diagnostics: [] };
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
    const manifest = extractManifest(source);
    const issues = validateManifest(manifest);
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
    const state = JSON.parse(readFileSync(metadataPath, "utf8"));
    return { requestId, operation: "status", workspace: root, ok: true, state, diagnostics: [] };
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
