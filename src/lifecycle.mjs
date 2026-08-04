import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const LIFECYCLE_RECEIPT_VERSION = 1;
export const LIFECYCLE_STATES = Object.freeze([
  "stopped",
  "candidate",
  "starting",
  "running",
  "recovering",
  "quarantined"
]);

const ALLOWED_TRANSITIONS = new Map([
  [null, new Set(["stopped", "quarantined"])],
  ["stopped", new Set(LIFECYCLE_STATES)],
  ["candidate", new Set(["candidate", "starting", "running", "recovering", "quarantined", "stopped"])],
  ["starting", new Set(["starting", "running", "recovering", "quarantined", "stopped"])],
  ["running", new Set(["candidate", "starting", "running", "recovering", "quarantined", "stopped"])],
  ["recovering", new Set(["candidate", "starting", "running", "recovering", "quarantined", "stopped"])],
  ["quarantined", new Set(["candidate", "starting", "running", "recovering", "quarantined", "stopped"])]
]);

export function persistLifecycleState(workspace, nextState, transition = {}) {
  const root = path.resolve(workspace);
  const renderRoot = path.join(root, ".render");
  const metadataPath = path.join(renderRoot, "metadata.json");
  const receiptPath = path.join(renderRoot, "logs", "lifecycle.jsonl");
  const previous = readExistingState(metadataPath);
  const from = previous?.lifecycleState ?? inferLifecycleState(previous);
  const to = transition.to ?? nextState.lifecycleState ?? inferLifecycleState(nextState);
  assertTransition(from, to);

  const transitionedAt = new Date().toISOString();
  const state = {
    ...nextState,
    lifecycleState: to,
    lastTransitionAt: transitionedAt,
    lifecycleReceiptPath: receiptPath
  };

  mkdirSync(path.dirname(metadataPath), { recursive: true });
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeAtomically(metadataPath, `${JSON.stringify(state, null, 2)}\n`);
  appendFileSync(receiptPath, `${JSON.stringify({
    receiptVersion: LIFECYCLE_RECEIPT_VERSION,
    receiptId: randomUUID(),
    at: transitionedAt,
    workspace: root,
    widgetId: state.widgetId ?? null,
    requestId: transition.requestId ?? null,
    event: transition.event ?? "state.updated",
    from,
    to,
    reason: transition.reason ?? "lifecycle state updated",
    activeVersion: state.activeVersion ?? null,
    lastKnownGoodVersion: state.lastKnownGoodVersion ?? null,
    running: state.running === true,
    processId: state.processId ?? null,
    diagnostics: transition.diagnostics ?? state.lastFailure?.diagnostics ?? []
  })}\n`, "utf8");
  return state;
}

export function readLifecycleReceipts(workspace) {
  const receiptPath = path.join(path.resolve(workspace), ".render/logs/lifecycle.jsonl");
  if (!existsSync(receiptPath)) return [];
  return readFileSync(receiptPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function assertLifecycleTransition(from, to) {
  assertTransition(from, to);
  return true;
}

function assertTransition(from, to) {
  if (!LIFECYCLE_STATES.includes(to)) {
    throw new Error(`unsupported lifecycle state '${to}'`);
  }
  if (from !== null && !LIFECYCLE_STATES.includes(from)) {
    throw new Error(`unsupported current lifecycle state '${from}'`);
  }
  if (!ALLOWED_TRANSITIONS.get(from)?.has(to)) {
    throw new Error(`invalid lifecycle transition from '${from ?? "none"}' to '${to}'`);
  }
}

function inferLifecycleState(state) {
  if (!state) return null;
  return state.lifecycleState ?? (state.running === true ? "running" : "stopped");
}

function readExistingState(metadataPath) {
  if (!existsSync(metadataPath)) return null;
  return JSON.parse(readFileSync(metadataPath, "utf8"));
}

function writeAtomically(filePath, data) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, data, "utf8");
  renameSync(temporaryPath, filePath);
}
