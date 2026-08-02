#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describeSdkCatalog, listSdkCatalog } from "../packages/sdk/src/catalog.ts";
import { checkWorkspace, initWorkspace, statusWorkspace } from "../src/workspace.mjs";
import { rollbackWorkspace, runWorkspace, watchWorkspace } from "../src/runtime.mjs";

export function execute(argv, cwd = process.cwd()) {
  const command = argv[0];
  const options = parseOptions(argv.slice(1), cwd);
  const workspace = options.workspace;

  if (command === "sdk") return executeSdk(argv[1], argv[2]);
  if (command === "init") return initWorkspace(workspace);
  if (command === "check") return checkWorkspace(workspace);
  if (command === "status") return statusWorkspace(workspace);
  if (command === "run") return runWorkspace(workspace);
  if (command === "rollback") return rollbackWorkspace(workspace, options.version);
  return {
    requestId: "unassigned",
    operation: command ?? "help",
    workspace,
    ok: false,
    diagnostics: [{
      code: "unknown-command",
      path: "command",
      message: "use render init, render check, render run, render status, render rollback, or render sdk list/describe"
    }]
  };
}

function executeSdk(action, name) {
  if (action === "list") {
    return { requestId: "unassigned", operation: "sdk.list", ok: true, items: listSdkCatalog() };
  }
  if (action === "describe" && name) {
    const item = describeSdkCatalog(name);
    if (item) return { requestId: "unassigned", operation: "sdk.describe", ok: true, item };
    return {
      requestId: "unassigned",
      operation: "sdk.describe",
      ok: false,
      diagnostics: [{
        code: "unknown-sdk-item",
        path: "name",
        message: `no SDK catalog item named ${name}`
      }]
    };
  }
  return {
    requestId: "unassigned",
    operation: "sdk",
    ok: false,
    diagnostics: [{
      code: "unknown-sdk-command",
      path: "command",
      message: "use render sdk list or render sdk describe <name>"
    }]
  };
}

export function parseOptions(args, cwd = process.cwd()) {
  let workspace = cwd;
  let json = false;
  let watch = false;
  let version = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--json") {
      json = true;
    } else if (args[index] === "--watch") {
      watch = true;
    } else if (args[index] === "--version" && args[index + 1]) {
      version = args[index + 1];
      index += 1;
    } else if (args[index] === "--workspace" && args[index + 1]) {
      workspace = path.resolve(cwd, args[index + 1]);
      index += 1;
    }
  }
  return { workspace, json, watch, version };
}

function printResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.ok) {
    if (result.operation === "sdk.list") {
      for (const item of result.items) console.log(`${item.name}\t${item.kind}\t${item.summary}`);
      return;
    }
    if (result.operation === "sdk.describe") {
      console.log(`${result.item.name} (${result.item.kind})`);
      console.log(result.item.summary);
      if (result.item.inputs) console.log(`inputs: ${result.item.inputs.join(", ")}`);
      if (result.item.fields) console.log(`fields: ${result.item.fields.join(", ")}`);
      if (result.item.value) console.log(`value: ${result.item.value}`);
      return;
    }
    console.log(`${result.operation} ok: ${result.workspace}`);
  } else {
    console.error(`${result.operation} failed`);
    for (const diagnostic of result.diagnostics) {
      console.error(`${diagnostic.path}: ${diagnostic.message}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main(process.argv.slice(2));
}

async function main(argv) {
  const options = parseOptions(argv.slice(1));
  try {
    if (argv[0] === "run" && options.watch) {
      const session = watchWorkspace(options.workspace, undefined, (result) => {
        printResult(result, options.json);
      });
      printResult(session.initial, options.json);
      if (!session.initial.ok) {
        process.exitCode = 1;
        return;
      }
      const close = () => {
        session.close();
        process.exit(0);
      };
      process.once("SIGINT", close);
      process.once("SIGTERM", close);
      await new Promise(() => {});
    }

    const result = execute(argv);
    printResult(result, options.json);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(`render failed: ${error.message}`);
    process.exitCode = 1;
  }
}
