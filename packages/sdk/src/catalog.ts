export type SdkCatalogKind = "primitive" | "style" | "provider" | "capability" | "function" | "type";

export const SDK_PACKAGE = "@render/sdk" as const;
export const SDK_VERSION = "0.1.0" as const;

export interface SdkCatalogItem {
  name: string;
  kind: SdkCatalogKind;
  summary: string;
  importPath: typeof SDK_PACKAGE;
  signature?: string;
  inputs?: string[];
  fields?: string[];
  value?: string;
  example: string;
  notes?: string[];
}

export const CANONICAL_WIDGET_SOURCE = [
  'import { Column, Gauge, Text, useProvider, widget } from "@render/sdk";',
  "",
  "export default widget({",
  '  "schemaVersion": 1,',
  '  "name": "System Monitor",',
  `  "sdkVersion": "${SDK_VERSION}",`,
  '  "size": { "width": 320, "height": 180 },',
  '  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },',
  '  "capabilities": [],',
  '  "subscribe": ["system.cpu", "system.memory"]',
  "}, () => Column([",
  '  Text("CPU"),',
  '  Gauge(useProvider("system.cpu"), 100),',
  '  Text("Memory"),',
  '  Gauge(useProvider("system.memory"), 100)',
  "]));",
  ""
].join("\n");

const SDK_CATALOG: SdkCatalogItem[] = [
  {
    name: "widget",
    kind: "function",
    summary: "Defines a serializable widget manifest and render function",
    importPath: SDK_PACKAGE,
    signature: "widget(manifest: WidgetManifest, render: () => WidgetNode): WidgetDefinition",
    inputs: ["manifest", "render"],
    example: "export default widget(manifest, () => Column([Text(\"Hello\")]));",
    notes: ["The manifest must be a JSON-compatible object with quoted keys and values."]
  },
  {
    name: "Column",
    kind: "primitive",
    summary: "Vertical layout container",
    importPath: SDK_PACKAGE,
    signature: "Column(children: WidgetNode[], style?: WidgetStyle): WidgetNode",
    inputs: ["children", "style"],
    example: "Column([Text(\"CPU\"), Gauge(42, 100)])"
  },
  {
    name: "Row",
    kind: "primitive",
    summary: "Horizontal layout container",
    importPath: SDK_PACKAGE,
    signature: "Row(children: WidgetNode[], style?: WidgetStyle): WidgetNode",
    inputs: ["children", "style"],
    example: "Row([Text(\"Left\"), Text(\"Right\")])"
  },
  {
    name: "Stack",
    kind: "primitive",
    summary: "Layered layout container",
    importPath: SDK_PACKAGE,
    signature: "Stack(children: WidgetNode[], style?: WidgetStyle): WidgetNode",
    inputs: ["children", "style"],
    example: "Stack([Shape({ width: 320, height: 180 }), Text(\"Overlay\")])"
  },
  {
    name: "Text",
    kind: "primitive",
    summary: "Text label or provider value",
    importPath: SDK_PACKAGE,
    signature: "Text(text: string | ProviderBinding, style?: WidgetStyle): WidgetNode",
    inputs: ["text", "style"],
    example: 'Text("CPU")',
    notes: ["Pass useProvider(name) to render a provider value."]
  },
  {
    name: "Shape",
    kind: "primitive",
    summary: "Rounded shape; the current native host renders it blue",
    importPath: SDK_PACKAGE,
    signature: "Shape(style?: WidgetStyle): WidgetNode",
    inputs: ["style"],
    example: "Shape({ width: 320, height: 180, color: \"#1565c0\" })"
  },
  {
    name: "Gauge",
    kind: "primitive",
    summary: "Progress gauge with a maximum",
    importPath: SDK_PACKAGE,
    signature: "Gauge(value: number | ProviderBinding, maximum: number, style?: WidgetStyle): WidgetNode",
    inputs: ["value", "maximum", "style"],
    example: 'Gauge(useProvider("system.cpu"), 100)',
    notes: ["Provider values must be declared in the manifest subscribe array."]
  },
  {
    name: "useProvider",
    kind: "function",
    summary: "Binds a declarative node to a host-owned provider",
    importPath: SDK_PACKAGE,
    signature: "useProvider(name: string): ProviderBinding",
    inputs: ["name"],
    example: 'useProvider("system.cpu")',
    notes: ["The provider name must be present in manifest.subscribe."]
  },
  {
    name: "useTimer",
    kind: "function",
    summary: "Declares a timer binding in the serializable SDK contract",
    importPath: SDK_PACKAGE,
    signature: "useTimer(intervalMs: number): TimerBinding",
    inputs: ["intervalMs"],
    example: "useTimer(1000)",
    notes: ["Timer bindings are part of the contract but are not yet rendered by the native host."]
  },
  {
    name: "WidgetStyle",
    kind: "style",
    summary: "Size and color properties for a widget node",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetStyle { width?: number; height?: number; color?: string }",
    fields: ["width", "height", "color"],
    example: 'Text("CPU", { color: "#1565c0" })',
    notes: [
      "Width and height must be positive when provided.",
      "The current native host applies width and height; color is cataloged but not yet applied to rendered nodes."
    ]
  },
  {
    name: "WidgetNode",
    kind: "type",
    summary: "Serializable declarative tree node returned by SDK primitives",
    importPath: SDK_PACKAGE,
    signature: "type WidgetNode = Column | Row | Stack | Text | Shape | Gauge",
    fields: [
      'kind: "column" | "row" | "stack" | "text" | "shape" | "gauge"',
      "children?: WidgetNode[]",
      "text?: string",
      "provider?: string",
      "style?: WidgetStyle",
      "value?: number",
      "maximum?: number"
    ],
    example: 'Column([Text("CPU")])',
    notes: ["Do not return DOM, HTML, CSS, browser objects, or native AppKit values."]
  },
  {
    name: "WidgetNodeKind",
    kind: "type",
    summary: "Allowed discriminators for declarative widget nodes",
    importPath: SDK_PACKAGE,
    signature: 'type WidgetNodeKind = "column" | "row" | "stack" | "text" | "shape" | "gauge"',
    example: 'const kind: WidgetNodeKind = "column"'
  },
  {
    name: "WidgetManifest",
    kind: "type",
    summary: "Required JSON-compatible metadata for a widget",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetManifest",
    fields: [
      "schemaVersion: 1",
      "name: string",
      "sdkVersion: string",
      "size: { width: number; height: number }",
      'anchor: { corner: "top-left" | "top-right" | "bottom-left" | "bottom-right"; offset: { x: number; y: number } }',
      'capabilities: Array<"network" | "filesystem.read" | "filesystem.write">',
      "subscribe: string[]"
    ],
    example: 'widget({ "schemaVersion": 1, "name": "Example", "sdkVersion": "0.1.0", "size": { "width": 320, "height": 180 }, "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } }, "capabilities": [], "subscribe": [] }, render)',
    notes: ["Keep manifest keys quoted so render check can provide source-oriented diagnostics."]
  },
  {
    name: "WidgetDefinition",
    kind: "type",
    summary: "Serializable widget manifest and render function pair",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetDefinition { manifest: WidgetManifest; render: () => WidgetNode }",
    fields: ["manifest: WidgetManifest", "render: () => WidgetNode"],
    example: 'const definition: WidgetDefinition = widget(manifest, render)'
  },
  {
    name: "ProviderBinding",
    kind: "type",
    summary: "Declarative reference to a host-owned provider",
    importPath: SDK_PACKAGE,
    signature: 'interface ProviderBinding { kind: "provider"; name: string }',
    fields: ['kind: "provider"', "name: string"],
    example: 'const cpu = useProvider("system.cpu")'
  },
  {
    name: "TimerBinding",
    kind: "type",
    summary: "Declarative timer reference",
    importPath: SDK_PACKAGE,
    signature: 'interface TimerBinding { kind: "timer"; intervalMs: number }',
    fields: ['kind: "timer"', "intervalMs: number"],
    example: "const timer = useTimer(1000)"
  },
  {
    name: "system.cpu",
    kind: "provider",
    summary: "Host CPU utilization percentage, sampled once per second",
    importPath: SDK_PACKAGE,
    value: "number | unavailable",
    signature: 'useProvider("system.cpu"): ProviderBinding',
    example: 'Gauge(useProvider("system.cpu"), 100)',
    notes: ['Declare "system.cpu" in the widget manifest subscribe array.']
  },
  {
    name: "system.memory",
    kind: "provider",
    summary: "Host memory utilization percentage, sampled once per second",
    importPath: SDK_PACKAGE,
    value: "number | unavailable",
    signature: 'useProvider("system.memory"): ProviderBinding',
    example: 'Gauge(useProvider("system.memory"), 100)',
    notes: ['Declare "system.memory" in the widget manifest subscribe array.']
  },
  {
    name: "network",
    kind: "capability",
    summary: "Permission to access network resources",
    importPath: SDK_PACKAGE,
    signature: 'capabilities: ["network"]',
    example: '"capabilities": ["network"]',
    notes: ["Ask the user for permission before using this capability."]
  },
  {
    name: "filesystem.read",
    kind: "capability",
    summary: "Permission to read files",
    importPath: SDK_PACKAGE,
    signature: 'capabilities: ["filesystem.read"]',
    example: '"capabilities": ["filesystem.read"]',
    notes: ["Ask the user for permission before using this capability."]
  },
  {
    name: "filesystem.write",
    kind: "capability",
    summary: "Permission to write files",
    importPath: SDK_PACKAGE,
    signature: 'capabilities: ["filesystem.write"]',
    example: '"capabilities": ["filesystem.write"]',
    notes: ["Ask the user for permission before using this capability."]
  }
];

export function listSdkCatalog(): SdkCatalogItem[] {
  return SDK_CATALOG.map(cloneItem);
}

export function describeSdkCatalog(name: string): SdkCatalogItem | null {
  const item = SDK_CATALOG.find((candidate) => candidate.name === name);
  return item === undefined ? null : cloneItem(item);
}

function cloneItem(item: SdkCatalogItem): SdkCatalogItem {
  return JSON.parse(JSON.stringify(item));
}
