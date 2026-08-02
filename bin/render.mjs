#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkWorkspace, initWorkspace, statusWorkspace } from "../src/workspace.mjs";

export function execute(argv, cwd = process.cwd()) {
  const command = argv[0];
  const options = parseOptions(argv.slice(1), cwd);
  const workspace = options.workspace;

  if (command === "init") return initWorkspace(workspace);
  if (command === "check") return checkWorkspace(workspace);
  if (command === "status") return statusWorkspace(workspace);
  return {
    requestId: "unassigned",
    operation: command ?? "help",
    workspace,
    ok: false,
    diagnostics: [{
      code: "unknown-command",
      path: "command",
      message: "use render init, render check, or render status"
    }]
  };
}

export function parseOptions(args, cwd = process.cwd()) {
  let workspace = cwd;
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--json") {
      json = true;
    } else if (args[index] === "--workspace" && args[index + 1]) {
      workspace = path.resolve(cwd, args[index + 1]);
      index += 1;
    }
  }
  return { workspace, json };
}

function printResult(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.ok) {
    console.log(`${result.operation} ok: ${result.workspace}`);
  } else {
    console.error(`${result.operation} failed`);
    for (const diagnostic of result.diagnostics) {
      console.error(`${diagnostic.path}: ${diagnostic.message}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseOptions(process.argv.slice(3));
  try {
    const result = execute(process.argv.slice(2));
    printResult(result, options.json);
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(`render failed: ${error.message}`);
    process.exitCode = 1;
  }
}
