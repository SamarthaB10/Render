export type SdkCatalogKind = "primitive" | "style" | "provider" | "connector" | "capability" | "action" | "function" | "type";

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
  status?: "implemented" | "contract-only" | "planned";
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
    example: "Column([Text(\"CPU\"), Gauge(42, 100)])",
    status: "implemented"
  },
  {
    name: "Row",
    kind: "primitive",
    summary: "Horizontal layout container",
    importPath: SDK_PACKAGE,
    signature: "Row(children: WidgetNode[], style?: WidgetStyle): WidgetNode",
    inputs: ["children", "style"],
    example: "Row([Text(\"Left\"), Text(\"Right\")])",
    status: "implemented"
  },
  {
    name: "Stack",
    kind: "primitive",
    summary: "Layered layout container",
    importPath: SDK_PACKAGE,
    signature: "Stack(children: WidgetNode[], style?: WidgetStyle): WidgetNode",
    inputs: ["children", "style"],
    example: "Stack([Shape({ width: 320, height: 180 }), Text(\"Overlay\")])",
    status: "implemented"
  },
  {
    name: "Box",
    kind: "primitive",
    summary: "General native container for grouping and styling children",
    importPath: SDK_PACKAGE,
    signature: "Box(children: WidgetChildren, style?: WidgetStyle): WidgetNode",
    inputs: ["children", "style"],
    example: 'Box([Text("Now playing")], { padding: 12, radius: 8 })',
    status: "implemented",
    notes: ["The native renderer supports box layout and constrained style fields."]
  },
  {
    name: "Spacer",
    kind: "primitive",
    summary: "Flexible or fixed empty native space between children",
    importPath: SDK_PACKAGE,
    signature: "Spacer(style?: WidgetStyle): WidgetNode",
    inputs: ["style"],
    example: "Spacer({ width: 8 })",
    status: "implemented",
    notes: ["The native renderer supports explicit size and spacing; spacer remains non-interactive."]
  },
  {
    name: "Divider",
    kind: "primitive",
    summary: "Horizontal or vertical native separator",
    importPath: SDK_PACKAGE,
    signature: 'Divider(orientation?: "horizontal" | "vertical", style?: WidgetStyle): WidgetNode',
    inputs: ["orientation", "style"],
    example: 'Divider("horizontal", { color: "#334155" })',
    status: "implemented",
    notes: ["The native renderer draws horizontal or vertical dividers with native shapes."]
  },
  {
    name: "Text",
    kind: "primitive",
    summary: "Text label or provider value",
    importPath: SDK_PACKAGE,
    signature: "Text(text: string | ProviderBinding, style?: WidgetStyle): WidgetNode",
    inputs: ["text", "style"],
    example: 'Text("CPU")',
    status: "implemented",
    notes: ["Pass useProvider(name) to render a provider value."]
  },
  {
    name: "Shape",
    kind: "primitive",
    summary: "Rounded shape; the current native host renders it blue",
    importPath: SDK_PACKAGE,
    signature: "Shape(style?: WidgetStyle): WidgetNode",
    inputs: ["style"],
    example: "Shape({ width: 320, height: 180, color: \"#1565c0\" })",
    status: "implemented"
  },
  {
    name: "Icon",
    kind: "primitive",
    summary: "Native symbol or cataloged icon glyph",
    importPath: SDK_PACKAGE,
    signature: "Icon(name: string, style?: WidgetStyle): WidgetNode",
    inputs: ["name", "style"],
    example: 'Icon("play.fill", { color: "#ffffff" })',
    status: "implemented",
    notes: ["Icon names are host-resolved; arbitrary image or browser glyphs are not part of the contract.", "The native renderer resolves SF Symbols and shows an explicit unavailable state when a symbol is missing."]
  },
  {
    name: "Image",
    kind: "primitive",
    summary: "Native image surface backed by an asset, URL, or provider",
    importPath: SDK_PACKAGE,
    signature: "Image(source: string | ImageSource, style?: WidgetStyle): WidgetNode",
    inputs: ["source", "style"],
    example: 'Image({ kind: "asset", name: "album-art" })',
    status: "implemented",
    notes: ["The native renderer resolves bundled asset sources.", "URL and provider sources are deferred until capability-backed providers ship; render check rejects them with an actionable diagnostic."]
  },
  {
    name: "Button",
    kind: "primitive",
    summary: "Native interactive control with an explicit serialized action",
    importPath: SDK_PACKAGE,
    signature: "Button(label: string | WidgetNode, action?: WidgetAction, style?: WidgetStyle): WidgetNode",
    inputs: ["label", "action", "style"],
    example: 'Button("Refresh", { type: "invoke", name: "widget.refresh" })',
    status: "implemented",
    notes: ["Actions are descriptors, never executable callbacks, so the tree remains serializable and permission-auditable.", "The native renderer dispatches buttons only through the host action boundary; unsupported operations are denied and logged."]
  },
  {
    name: "Gauge",
    kind: "primitive",
    summary: "Progress gauge with a maximum",
    importPath: SDK_PACKAGE,
    signature: "Gauge(value: number | ProviderBinding, maximum: number, style?: WidgetStyle): WidgetNode",
    inputs: ["value", "maximum", "style"],
    example: 'Gauge(useProvider("system.cpu"), 100)',
    status: "implemented",
    notes: ["Provider values must be declared in the manifest subscribe array."]
  },
  {
    name: "Progress",
    kind: "primitive",
    summary: "Native determinate progress indicator",
    importPath: SDK_PACKAGE,
    signature: "Progress(value: number | ProviderBinding, maximum?: number, style?: WidgetStyle): WidgetNode",
    inputs: ["value", "maximum", "style"],
    example: 'Progress(useProvider("system.cpu"), 100)',
    status: "implemented",
    notes: ["Provider values must be declared in the manifest subscribe array.", "The native renderer supports a determinate native progress indicator."]
  },
  {
    name: "Grid",
    kind: "primitive",
    summary: "Native equal-column layout container",
    importPath: SDK_PACKAGE,
    signature: "Grid(children: WidgetChildren, columns: number, style?: WidgetStyle): WidgetNode",
    inputs: ["children", "columns", "style"],
    example: 'Grid([Text("A"), Text("B")], 2, { gap: 8 })',
    status: "implemented",
    notes: ["Columns must be a positive integer.", "The native renderer uses a native equal-column grid."]
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
    name: "jsx",
    kind: "function",
    summary: "Automatic JSX runtime factory that produces a serializable WidgetNode",
    importPath: SDK_PACKAGE,
    signature: "jsx(type: WidgetElementType, props: WidgetComponentProps, key?: string | number): WidgetNode",
    inputs: ["type", "props", "key"],
    example: 'jsx(Text, { children: "CPU" })',
    status: "implemented",
    notes: ["Use the @render/sdk/jsx-runtime entry point for automatic TSX compilation.", "Intrinsic HTML elements are intentionally not supported."]
  },
  {
    name: "jsxs",
    kind: "function",
    summary: "Automatic JSX runtime factory for elements with multiple children",
    importPath: SDK_PACKAGE,
    signature: "jsxs(type: WidgetElementType, props: WidgetComponentProps, key?: string | number): WidgetNode",
    inputs: ["type", "props", "key"],
    example: 'jsxs(Row, { children: [Icon("play.fill"), Text("Play")] })',
    status: "implemented",
    notes: ["Intrinsic HTML elements are intentionally not supported."]
  },
  {
    name: "Fragment",
    kind: "function",
    summary: "JSX grouping component with no DOM or browser semantics",
    importPath: SDK_PACKAGE,
    signature: "Fragment(props: FragmentProps): WidgetNode",
    inputs: ["children"],
    example: "Fragment({ children: [Text(\"A\"), Text(\"B\")] })",
    status: "implemented",
    notes: ["Multiple children are grouped in a native Box because WidgetNode is a single-root contract."]
  },
  {
    name: "widget.refresh",
    kind: "action",
    summary: "Host-owned refresh operation for the active widget",
    importPath: SDK_PACKAGE,
    signature: 'WidgetActionName = "widget.refresh"',
    example: 'Button("Refresh", { type: "invoke", name: "widget.refresh" })',
    status: "implemented",
    notes: ["The native host accepts this descriptor through the explicit action boundary."]
  },
  {
    name: "widget.reload",
    kind: "action",
    summary: "Host-owned reload operation for the active widget",
    importPath: SDK_PACKAGE,
    signature: 'WidgetActionName = "widget.reload"',
    example: 'Button("Reload", { type: "invoke", name: "widget.reload" })',
    status: "implemented",
    notes: ["The native host accepts this descriptor through the explicit action boundary."]
  },
  {
    name: "WidgetStyle",
    kind: "style",
    summary: "Constrained native layout, typography, color, and surface styling",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetStyle { width?: WidgetLength; height?: WidgetLength; color?: string; backgroundColor?: string; opacity?: number; padding?: WidgetSpacing; margin?: WidgetSpacing; gap?: number; alignItems?: WidgetAlignment; justifyContent?: WidgetAlignment; radius?: number; border?: WidgetBorder; shadow?: WidgetShadow; font?: WidgetFont; tokens?: WidgetStyleToken[] }",
    fields: ["width", "height", "color", "backgroundColor", "opacity", "padding", "margin", "gap", "alignItems", "justifyContent", "radius", "border", "shadow", "font", "tokens"],
    example: 'Text("CPU", { color: "#1565c0", font: { size: 14, weight: "semibold" } })',
    status: "implemented",
    notes: [
      "Values are serializable native style fields, not arbitrary CSS declarations.",
      "Width, height, and font sizes must be positive; spacing, opacity, radii, and border widths are non-negative when provided.",
      "The native host applies layout, color, typography, surface, border, shadow, opacity, and token fields."
    ]
  },
  {
    name: "WidgetAction",
    kind: "type",
    summary: "Serializable explicit operation attached to an interactive primitive",
    importPath: SDK_PACKAGE,
    signature: 'type WidgetAction = { type: "invoke"; name: WidgetActionName; payload?: WidgetJsonValue } | { type: "set"; name: WidgetActionName; value: WidgetJsonValue }',
    fields: ["type", "name", "payload or value"],
    example: 'const refresh: WidgetAction = { type: "invoke", name: "widget.refresh" }',
    status: "implemented",
    notes: ["Actions are descriptors and cannot contain executable callbacks."]
  },
  {
    name: "WidgetActionName",
    kind: "type",
    summary: "Supported host action names for the active SDK version",
    importPath: SDK_PACKAGE,
    signature: 'type WidgetActionName = "widget.refresh" | "widget.reload"',
    fields: ["widget.refresh", "widget.reload"],
    example: 'const action: WidgetActionName = "widget.refresh"',
    status: "implemented",
    notes: ["Media, account, network, and filesystem operations are not available until their provider and permission contracts ship."]
  },
  {
    name: "ImageSource",
    kind: "type",
    summary: "Explicit image source descriptor for assets, URLs, and providers",
    importPath: SDK_PACKAGE,
    signature: 'type ImageSource = { kind: "asset"; name: string } | { kind: "url"; url: string } | { kind: "provider"; name: string }',
    fields: ["kind", "name or url"],
    example: 'const artwork: ImageSource = { kind: "asset", name: "album-art" }',
    status: "implemented",
    notes: ["URL sources require the network capability and user permission."]
  },
  {
    name: "WidgetNode",
    kind: "type",
    summary: "Serializable declarative tree node returned by SDK primitives",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetNode { kind: WidgetNodeKind; children?: WidgetNode[]; style?: WidgetStyle; ... }",
    fields: [
      'kind: "column" | "row" | "stack" | "box" | "spacer" | "divider" | "text" | "shape" | "icon" | "image" | "button" | "gauge" | "progress" | "grid"',
      "children?: WidgetNode[]",
      "text?: string",
      "provider?: string",
      "style?: WidgetStyle",
      "value?: number",
      "maximum?: number",
      "orientation?: horizontal | vertical",
      "name?: string",
      "source?: ImageSource",
      "action?: WidgetAction",
      "columns?: number"
    ],
    example: 'Column([Text("CPU")])',
    status: "implemented",
    notes: ["Do not return DOM, HTML, CSS, browser objects, or native AppKit values.", "Every listed node kind is decoded and rendered by the native host; unsupported external sources show an explicit unavailable state."]
  },
  {
    name: "WidgetNodeKind",
    kind: "type",
    summary: "Allowed discriminators for declarative widget nodes",
    importPath: SDK_PACKAGE,
    signature: 'type WidgetNodeKind = "column" | "row" | "stack" | "box" | "spacer" | "divider" | "text" | "shape" | "icon" | "image" | "button" | "gauge" | "progress" | "grid"',
    example: 'const kind: WidgetNodeKind = "box"',
    status: "implemented"
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
      "subscribe: string[]",
      "accounts?: WidgetAccountRequirement[]"
    ],
    example: 'widget({ "schemaVersion": 1, "name": "Example", "sdkVersion": "0.1.0", "size": { "width": 320, "height": 180 }, "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } }, "capabilities": [], "subscribe": [], "accounts": [] }, render)',
    notes: ["Keep manifest keys quoted so render check can provide source-oriented diagnostics."]
  },
  {
    name: "WidgetAccountRequirement",
    kind: "type",
    summary: "Declarative request for a host-managed connector account and exact scopes",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetAccountRequirement { connector: string; scopes: string[] }",
    fields: ["connector", "scopes"],
    example: 'const account: WidgetAccountRequirement = { connector: "spotify", scopes: ["user-read-playback-state"] }',
    status: "contract-only",
    notes: ["The host owns authorization and token storage; widget code never receives raw credentials."]
  },
  {
    name: "WidgetAccountState",
    kind: "type",
    summary: "Explicit host-owned account lifecycle state",
    importPath: SDK_PACKAGE,
    signature: 'type WidgetAccountState = "connected" | "needs-authorization" | "denied" | "expired" | "revoked" | "unavailable"',
    fields: ["connected", "needs-authorization", "denied", "expired", "revoked", "unavailable"],
    example: 'const state: WidgetAccountState = "needs-authorization"',
    status: "contract-only",
    notes: ["A missing account must leave the widget alive with a clear host-owned connect state."]
  },
  {
    name: "WidgetAccountBinding",
    kind: "type",
    summary: "Opaque reference to a host-managed connector account",
    importPath: SDK_PACKAGE,
    signature: 'interface WidgetAccountBinding { kind: "account"; connector: string }',
    fields: ['kind: "account"', "connector"],
    example: 'const spotify = useAccount("spotify")',
    status: "contract-only",
    notes: ["Bindings identify a connector but never contain access or refresh tokens."]
  },
  {
    name: "useAccount",
    kind: "function",
    summary: "Creates an opaque binding to a host-managed connector account",
    importPath: SDK_PACKAGE,
    signature: "useAccount(connector: string): WidgetAccountBinding",
    inputs: ["connector"],
    example: 'useAccount("spotify")',
    status: "contract-only",
    notes: ["The connector must also be declared in manifest.accounts with its exact scopes."]
  },
  {
    name: "spotify",
    kind: "connector",
    summary: "Trusted Spotify Web API connector for account identity and playback control",
    importPath: SDK_PACKAGE,
    signature: 'accounts: [{ connector: "spotify", scopes: string[] }]',
    inputs: ["user-read-playback-state", "user-read-currently-playing", "user-modify-playback-state"],
    example: '"accounts": [{ "connector": "spotify", "scopes": ["user-read-playback-state", "user-read-currently-playing", "user-modify-playback-state"] }]',
    status: "contract-only",
    notes: ["Render owns OAuth, secure credential storage, refresh, and API calls.", "Raw tokens never enter widget.tsx, the worker, the declarative tree, or logs.", "Playback controls require Spotify Premium according to the provider API; unavailable states are explicit."]
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
    name: "ProviderState",
    kind: "type",
    summary: "Explicit host-provider lifecycle state",
    importPath: SDK_PACKAGE,
    signature: 'type ProviderState = "loading" | "available" | "unavailable"',
    fields: ["loading", "available", "unavailable"],
    example: 'const state: ProviderState = "loading"',
    status: "implemented",
    notes: ["Widgets must render loading and unavailable states explicitly; the host never substitutes fake data."]
  },
  {
    name: "ProviderValue",
    kind: "type",
    summary: "Serializable host-provider value envelope",
    importPath: SDK_PACKAGE,
    signature: "interface ProviderValue { name: string; state: ProviderState; value?: number; message?: string }",
    fields: ["name", "state", "value", "message"],
    example: 'const value: ProviderValue = { name: "system.cpu", state: "loading" }',
    status: "implemented",
    notes: ["Available values contain a number; loading and unavailable values carry an actionable message when known."]
  },
  {
    name: "WidgetCapability",
    kind: "type",
    summary: "Narrow capability names that may be declared in a manifest",
    importPath: SDK_PACKAGE,
    signature: 'type WidgetCapability = "network" | "filesystem.read" | "filesystem.write"',
    fields: ["network", "filesystem.read", "filesystem.write"],
    example: 'const capabilities: WidgetCapability[] = ["network"]',
    status: "implemented",
    notes: ["A capability declaration is not consent; ask the user before an operation that needs it."]
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
    value: "number | loading | unavailable",
    signature: 'useProvider("system.cpu"): ProviderBinding',
    example: 'Gauge(useProvider("system.cpu"), 100)',
    notes: ['Declare "system.cpu" in the widget manifest subscribe array.', "Render loading and unavailable states explicitly; do not substitute fake values."]
  },
  {
    name: "system.memory",
    kind: "provider",
    summary: "Host memory utilization percentage, sampled once per second",
    importPath: SDK_PACKAGE,
    value: "number | loading | unavailable",
    signature: 'useProvider("system.memory"): ProviderBinding',
    example: 'Gauge(useProvider("system.memory"), 100)',
    notes: ['Declare "system.memory" in the widget manifest subscribe array.', "Render loading and unavailable states explicitly; do not substitute fake values."]
  },
  {
    name: "system.time",
    kind: "provider",
    summary: "Host local time, sampled once per second",
    importPath: SDK_PACKAGE,
    value: "number | loading | unavailable",
    signature: 'useProvider("system.time"): ProviderBinding',
    example: 'Text(useProvider("system.time"))',
    status: "implemented",
    notes: ['Declare "system.time" in the widget manifest subscribe array.', "Text renders the host-local time from the provider value; use a Text node rather than Gauge or Progress.", "Render loading and unavailable states explicitly; do not substitute fake values."]
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
