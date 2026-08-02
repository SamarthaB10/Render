import type { WidgetNode, WidgetManifest } from "./index.ts";

export const RENDER_WORKER_PROTOCOL_VERSION = 1 as const;

export type WorkerMessageKind =
  | "hello"
  | "helloAck"
  | "ready"
  | "render"
  | "failure"
  | "shutdown";

export interface WorkerDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface WorkerMessage {
  protocolVersion: typeof RENDER_WORKER_PROTOCOL_VERSION;
  kind: WorkerMessageKind;
  messageID: string;
  workerID: string;
  supportedVersions?: number[];
  selectedVersion?: number;
  workspace?: string;
  sourcePath?: string;
  tree?: WidgetNode;
  manifest?: WidgetManifest;
  diagnostics?: WorkerDiagnostic[];
}
