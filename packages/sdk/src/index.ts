export type WidgetNodeKind = "column" | "row" | "stack" | "text" | "shape" | "gauge";

export interface WidgetStyle {
  width?: number;
  height?: number;
  color?: string;
}

export interface WidgetNode {
  kind: WidgetNodeKind;
  children?: WidgetNode[];
  text?: string;
  style?: WidgetStyle;
  value?: number;
  maximum?: number;
}

export interface WidgetManifest {
  schemaVersion: 1;
  name: string;
  sdkVersion: string;
  size: { width: number; height: number };
  anchor: {
    corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    offset: { x: number; y: number };
  };
  capabilities: Array<"network" | "filesystem.read" | "filesystem.write">;
  subscribe: string[];
}

export interface WidgetDefinition {
  manifest: WidgetManifest;
  render: () => WidgetNode;
}

export interface ProviderBinding {
  kind: "provider";
  name: string;
}

export interface TimerBinding {
  kind: "timer";
  intervalMs: number;
}

export function widget(manifest: WidgetManifest, render: () => WidgetNode): WidgetDefinition {
  return { manifest, render };
}

export function Column(children: WidgetNode[], style?: WidgetStyle): WidgetNode {
  return nodeWithOptionalStyle({ kind: "column", children }, style);
}

export function Row(children: WidgetNode[], style?: WidgetStyle): WidgetNode {
  return nodeWithOptionalStyle({ kind: "row", children }, style);
}

export function Stack(children: WidgetNode[], style?: WidgetStyle): WidgetNode {
  return nodeWithOptionalStyle({ kind: "stack", children }, style);
}

export function Text(text: string, style?: WidgetStyle): WidgetNode {
  return nodeWithOptionalStyle({ kind: "text", text }, style);
}

export function Shape(style?: WidgetStyle): WidgetNode {
  return nodeWithOptionalStyle({ kind: "shape" }, style);
}

export function Gauge(value: number, maximum: number, style?: WidgetStyle): WidgetNode {
  return nodeWithOptionalStyle({ kind: "gauge", value, maximum }, style);
}

export function useProvider(name: string): ProviderBinding {
  return { kind: "provider", name };
}

export function useTimer(intervalMs: number): TimerBinding {
  return { kind: "timer", intervalMs };
}

function nodeWithOptionalStyle(node: WidgetNode, style?: WidgetStyle): WidgetNode {
  return style === undefined ? node : { ...node, style };
}
