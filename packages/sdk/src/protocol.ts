export const RENDER_PROTOCOL_VERSION = 1 as const;

export type RuntimeMessageKind = "hello" | "render" | "providers" | "failure" | "shutdown";

export interface RuntimeProtocolIssue {
  path: string;
  message: string;
}

export interface RuntimeMessage {
  protocolVersion: typeof RENDER_PROTOCOL_VERSION;
  kind: RuntimeMessageKind;
  messageID: string;
  widgetID: string;
  tree?: WidgetNode;
  providers?: Record<string, ProviderState>;
  diagnostics?: RuntimeProtocolIssue[];
}

export interface ProviderState {
  state: "available" | "unavailable";
  value?: number;
  message?: string;
}

import type { WidgetNode } from "./index.ts";
