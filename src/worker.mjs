#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { buildRuntimeTree } from "./runtime.mjs";
import { extractManifest } from "./manifest.mjs";
import { RENDER_WORKER_PROTOCOL_VERSION } from "../packages/sdk/src/worker-protocol.ts";

const workerID = randomUUID();
const protocolVersion = RENDER_WORKER_PROTOCOL_VERSION;
let negotiated = false;

send({
  kind: "hello",
  supportedVersions: [protocolVersion]
});

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  if (line.trim() === "") return;

  let message;
  try {
    message = JSON.parse(line);
  } catch {
    sendFailure("invalid-message", "worker protocol input must be valid JSON");
    return;
  }

  if (message.kind === "helloAck") {
    if (message.selectedVersion !== protocolVersion) {
      sendFailure("protocol-version-mismatch", `worker supports protocol version ${protocolVersion}`);
      process.exitCode = 1;
      input.close();
      return;
    }
    negotiated = true;
    send({ kind: "ready" });
    return;
  }

  if (!negotiated) {
    sendFailure("protocol-not-negotiated", "supervisor must complete hello negotiation before rendering");
    return;
  }

  if (message.kind === "render") {
    render(message);
    return;
  }

  if (message.kind === "shutdown") {
    input.close();
    process.exit(0);
  }

  sendFailure("unsupported-message", `worker does not support message kind ${String(message.kind)}`);
});

function render(message) {
  const sourcePath = typeof message.sourcePath === "string" ? message.sourcePath : null;
  if (sourcePath === null) {
    sendFailure("missing-source-path", "render messages require sourcePath");
    return;
  }

  try {
    const source = readFileSync(sourcePath, "utf8");
    const tree = buildRuntimeTree(source, sourcePath);
    const manifest = extractManifest(source);
    send({ kind: "render", messageID: message.messageID, tree, manifest });
  } catch (error) {
    sendFailure("worker-render-failed", error instanceof Error ? error.message : String(error), message.messageID);
  }
}

function send(fields) {
  process.stdout.write(`${JSON.stringify({
    protocolVersion,
    messageID: randomUUID(),
    workerID,
    ...fields
  })}\n`);
}

function sendFailure(code, message, requestID = randomUUID()) {
  send({
    kind: "failure",
    messageID: requestID,
    diagnostics: [{ code, path: "worker", message }]
  });
}
