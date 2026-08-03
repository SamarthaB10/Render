import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import * as defaultSdk from "../packages/sdk/src/index.ts";

const require = createRequire(import.meta.url);
const SDK_IMPORT = "@render/sdk";
const JSX_RUNTIME_NAME = "__render_jsx";

export class TsxRuntimeError extends Error {
  constructor(code, message, diagnostics = []) {
    super(message);
    this.name = "TsxRuntimeError";
    this.code = code;
    this.diagnostics = diagnostics.length > 0
      ? diagnostics
      : [{ code, path: "widget.tsx", message }];
  }
}

export function transpileTsx(source, filename = "widget.tsx") {
  if (typeof source !== "string" || source.trim() === "") {
    throw new TsxRuntimeError("empty-widget-source", "widget.tsx must contain TSX source");
  }
  rejectBrowserConstructs(source, filename);

  const compilerPath = findTypeScriptCompiler();
  if (compilerPath === null) {
    throw new TsxRuntimeError(
      "typescript-unavailable",
      "TSX requires the existing TypeScript compiler; install TypeScript or run the call-style widget source"
    );
  }

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "render-tsx-"));
  const inputPath = path.join(tempRoot, "widget.tsx");
  const declarationPath = path.join(tempRoot, "render-sdk.d.ts");
  const outputRoot = path.join(tempRoot, "out");
  const compilerSource = `declare const ${JSX_RUNTIME_NAME}: any;\n${source}`;
  writeFileSync(inputPath, compilerSource, "utf8");
  writeFileSync(declarationPath, sdkDeclaration(source), "utf8");

  try {
    execFileSync(compilerPath, [
      inputPath,
      declarationPath,
      "--jsx", "react",
      "--jsxFactory", `${JSX_RUNTIME_NAME}.createElement`,
      "--jsxFragmentFactory", `${JSX_RUNTIME_NAME}.Fragment`,
      "--module", "commonjs",
      "--target", "es2020",
      "--skipLibCheck",
      "--noEmitOnError", "false",
      "--outDir", outputRoot,
      "--pretty", "false"
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const outputPath = path.join(outputRoot, "widget.js");
    if (!readableFile(outputPath)) {
      const compilerMessage = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
      throw new TsxRuntimeError(
        "tsx-syntax-error",
        `${filename}: TypeScript could not compile this widget${compilerMessage ? `: ${compilerMessage}` : ""}`
      );
    }
  }

  try {
    return readFileSync(path.join(outputRoot, "widget.js"), "utf8");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function buildTsxRuntimeTree(source, options = {}) {
  const sdk = options.sdk ?? defaultSdk;
  const filename = options.filename ?? "widget.tsx";
  const code = isPlainWidgetSource(source)
    ? transpilePlainWidget(source, filename)
    : transpileTsx(source, filename);
  const sandbox = {
    exports: {},
    sdk,
    __render_jsx: createRenderJsxRuntime(sdk),
    require(specifier) {
      if (specifier === SDK_IMPORT) return sdk;
      throw new TsxRuntimeError(
        "unsupported-module",
        `widget imports ${specifier}; only ${SDK_IMPORT} is available inside Render widgets`
      );
    }
  };
  const context = vm.createContext(sandbox);

  try {
    new vm.Script(code, { filename })
      .runInContext(context, { timeout: options.timeoutMs ?? 1000 });
  } catch (error) {
    if (error instanceof TsxRuntimeError) throw error;
    throw new TsxRuntimeError(
      "tsx-runtime-error",
      `${options.filename ?? "widget.tsx"}: ${error.message}`
    );
  }

  const definition = sandbox.exports.default;
  if (!definition || typeof definition.render !== "function") {
    throw new TsxRuntimeError(
      "invalid-widget-export",
      "widget.tsx must export the result of widget(manifest, render)"
    );
  }

  let tree;
  try {
    const renderContext = options.renderContext ?? { mode: "auto" };
    context.__render_context = renderContext;
    new vm.Script("exports.__rendered = exports.default.render(__render_context);", { filename })
      .runInContext(context, { timeout: options.timeoutMs ?? 1000 });
    tree = context.exports.__rendered;
  } catch (error) {
    throw new TsxRuntimeError("tsx-render-error", `widget.tsx render failed: ${error.message}`);
  }
  if (tree?.kind === "fragment") {
    tree = sdk.Column(tree.children);
  }
  return ensureSerializableWidgetTree(tree);
}

function isPlainWidgetSource(source) {
  return !/<\s*(?:[A-Za-z_$][\w$.-]*|>)/.test(source)
    && !/\b(?:interface|type|enum|namespace)\s+[A-Za-z_$]/.test(source)
    && !/\)\s*:\s*[A-Za-z_$]/.test(source);
}

function transpilePlainWidget(source, filename) {
  rejectBrowserConstructs(source, filename);
  const imports = [...source.matchAll(/\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g)];
  for (const [, specifier] of imports) {
    if (specifier !== SDK_IMPORT) {
      throw new TsxRuntimeError(
        "unsupported-module",
        `${filename}: widget imports ${specifier}; only ${SDK_IMPORT} is available inside Render widgets`
      );
    }
  }
  return source
    .replace(
      /import\s*\{([^}]+)\}\s*from\s*["']@render\/sdk["']\s*;?/g,
      "const {$1} = sdk;"
    )
    .replace(/export\s+default\s+/, "exports.default = ");
}

export function createRenderJsxRuntime(sdk = defaultSdk) {
  const nativeJsx = typeof sdk.jsx === "function" ? sdk.jsx : null;
  const fragment = nativeJsx ? sdk.Fragment : Symbol("RenderFragment");
  return {
    Fragment: fragment,
    createElement(type, props, ...children) {
      if (!nativeJsx && type === fragment) {
        return { kind: "fragment", children: normalizeChildren(sdk, children) };
      }
      if (typeof type !== "function") {
        throw new TsxRuntimeError(
          "unsupported-jsx-element",
          `Render JSX only supports SDK components; use a catalog primitive instead of <${String(type)}>`
        );
      }
      const jsxKey = props?.key;
      const elementProps = { ...(props ?? {}) };
      delete elementProps.key;
      if (children.length > 0) elementProps.children = children;
      if (nativeJsx) {
        return nativeJsx(type, elementProps, jsxKey);
      }
      const nextProps = { ...elementProps, children: normalizeChildren(sdk, children) };
      return invokeComponent(type, nextProps);
    }
  };
}

function invokeComponent(component, props) {
  const name = component.name;
  const children = props.children ?? [];
  const style = props.style;
  if (name === "Column" || name === "Row" || name === "Stack") return component(children, style);
  if (name === "Text") return component(children[0] ?? "", style);
  if (name === "Shape") return component(style);
  if (name === "Gauge") return component(props.value ?? children[0], props.maximum, style);
  return component(props);
}

function normalizeChildren(sdk, value) {
  const result = [];
  for (const child of value.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (child && child.kind === "fragment") {
      result.push(...child.children);
    } else if (typeof child === "string" || typeof child === "number") {
      result.push(sdk.Text(String(child)));
    } else {
      result.push(child);
    }
  }
  return result;
}

function ensureSerializableWidgetTree(tree) {
  if (!tree || typeof tree !== "object" || typeof tree.kind !== "string") {
    throw new TsxRuntimeError("invalid-widget-tree", "widget render() must return a serializable Render node with a string kind");
  }
  try {
    return JSON.parse(JSON.stringify(tree));
  } catch (error) {
    throw new TsxRuntimeError("non-serializable-widget-tree", `widget render() returned a non-serializable tree: ${error.message}`);
  }
}

function rejectBrowserConstructs(source, filename) {
  const checks = [
    [/<\s*(div|span|button|input|img|svg|canvas|a|p|section|main|header|footer|ul|li)\b/, "browser JSX element"],
    [/\b(document|window|navigator|localStorage|sessionStorage|HTMLElement|ReactDOM)\b/, "browser API"]
  ];
  for (const [pattern, label] of checks) {
    if (pattern.test(source)) {
      throw new TsxRuntimeError(
        "unsupported-browser-construct",
        `${filename}: unsupported ${label}; use Render SDK primitives and host-owned providers instead of DOM/browser APIs`
      );
    }
  }
  validateJsxBalance(source, filename);
}

function validateJsxBalance(source, filename) {
  const tags = [];
  const tagPattern = /<\s*(\/?)\s*([A-Za-z_$][\w$.-]*|)(?:\s[^<>]*?)?(\/?)\s*>/g;
  for (const match of source.matchAll(tagPattern)) {
    const [, closing, name, selfClosing] = match;
    if (!name) continue;
    if (closing) {
      const open = tags.pop();
      if (open !== name) {
        throw new TsxRuntimeError(
          "tsx-syntax-error",
          `${filename}: JSX closing tag </${name}> does not match <${open ?? "nothing"}>`
        );
      }
    } else if (!selfClosing) {
      tags.push(name);
    }
  }
  if (tags.length > 0) {
    throw new TsxRuntimeError(
      "tsx-syntax-error",
      `${filename}: JSX element <${tags.at(-1)}> is not closed; add a matching closing tag`
    );
  }
}

function sdkDeclaration(source) {
  const names = new Set(["widget"]);
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']@render\/sdk["']/g)) {
    for (const item of match[1].split(",")) {
      const name = item.trim().split(/\s+as\s+/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  return `declare module "@render/sdk" {\n${[...names].map((name) => `  export const ${name}: any;`).join("\n")}\n}\n`;
}

function findTypeScriptCompiler() {
  try {
    const packageJson = require.resolve("typescript/package.json");
    return path.join(path.dirname(packageJson), "bin", "tsc");
  } catch {
    return null;
  }
}

function readableFile(filePath) {
  try {
    return readFileSync(filePath, "utf8").length > 0;
  } catch {
    return false;
  }
}
