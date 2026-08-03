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
  '  "subscribe": ["system.cpu", "system.memory"],',
  '  "theme": { "default": "dark-glass", "options": ["dark-glass", "light", "monochrome", "retro"] }',
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
    signature: "widget(manifest: WidgetManifest, render: (context?: WidgetRenderContext) => WidgetNode): WidgetDefinition",
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
    name: "ScrollView",
    kind: "primitive",
    summary: "Native vertically scrollable content container",
    importPath: SDK_PACKAGE,
    signature: "ScrollView(children: WidgetNode[], style?: WidgetStyle): WidgetNode",
    inputs: ["children", "style"],
    example: "ScrollView([Text(\"Long notes\")], { height: 320 })",
    status: "implemented",
    notes: ["The native renderer owns scrolling and keeps overflowing content inside the widget frame."]
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
    name: "GlassPanel",
    kind: "primitive",
    summary: "Native material panel with the Render surface hierarchy and theme-aware borders",
    importPath: SDK_PACKAGE,
    signature: "GlassPanel(children: WidgetChildren, style?: WidgetStyle): WidgetNode",
    inputs: ["children", "style"],
    example: 'GlassPanel([Text("Now playing")])',
    status: "implemented",
    notes: ["The native renderer resolves material, semantic role, radius, and border tokens through the active Render theme."]
  },
  {
    name: "MediaCard",
    kind: "primitive",
    summary: "Native media surface with compact theme-aware hierarchy",
    importPath: SDK_PACKAGE,
    signature: "MediaCard(children: WidgetChildren, style?: WidgetStyle): WidgetNode",
    inputs: ["children", "style"],
    example: 'MediaCard([Artwork({ kind: "asset", name: "album-art" }), Text("Track")])',
    status: "implemented",
    notes: ["MediaCard is a composable container; use Artwork and TransportControls inside it for a complete native media surface.", "The native renderer applies the media surface hierarchy and clips the child content to the declared curve."]
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
    name: "TextField",
    kind: "primitive",
    summary: "Native editable single-line text control",
    importPath: SDK_PACKAGE,
    signature: "TextField(text: string, style?: WidgetStyle): WidgetNode",
    inputs: ["text", "style"],
    example: 'TextField("Write a task", { backgroundColor: "#172126" })',
    status: "implemented",
    notes: [
      "The native renderer keeps the edited value interactive for the current widget session.",
      "Persistent widget-owned state is a separate storage contract; do not put filesystem writes in widget source."
    ]
  },
  {
    name: "TextEditor",
    kind: "primitive",
    summary: "Native persistent multiline text editor",
    importPath: SDK_PACKAGE,
    signature: "TextEditor(text?: string, style?: WidgetStyle): WidgetNode",
    inputs: ["text", "style"],
    example: 'TextEditor({ key: "notes", text: "", placeholder: "Write a note…" })',
    status: "implemented",
    notes: ["The native renderer persists editor content by stable key or node path; widget source supplies the default text."]
  },
  {
    name: "DateTime",
    kind: "primitive",
    summary: "Native localized date or time display",
    importPath: SDK_PACKAGE,
    signature: "DateTime(value: string, style?: WidgetStyle): WidgetNode",
    inputs: ["value", "style"],
    example: 'DateTime({ value: "2026-08-03T14:30:00Z", mode: "dateTime" })',
    status: "implemented",
    notes: ["The native renderer parses an ISO date-time value and formats it using the local macOS locale."]
  },
  {
    name: "DateTimePicker",
    kind: "primitive",
    summary: "Native editable and persisted date/time picker",
    importPath: SDK_PACKAGE,
    signature: "DateTimePicker(props?: DateTimePickerProps): WidgetNode",
    inputs: ["value", "mode", "style"],
    example: 'DateTimePicker({ key: "deadline", mode: "dateTime" })',
    status: "implemented",
    notes: ["The native renderer owns date/time selection and persists the selected value by stable key or node path."]
  },
  {
    name: "Toggle",
    kind: "primitive",
    summary: "Native interactive checkbox control",
    importPath: SDK_PACKAGE,
    signature: "Toggle(checked: boolean, style?: WidgetStyle): WidgetNode",
    inputs: ["checked", "style"],
    example: "Toggle(false, { color: \"#8be9a8\" })",
    status: "implemented",
    notes: [
      "The native renderer keeps the checked value interactive for the current widget session.",
      "Shared state between controls and persistent widget-owned state are separate planned contracts."
    ]
  },
  {
    name: "Timer",
    kind: "primitive",
    summary: "Host-owned countdown timer with start, pause, reset, and persisted state",
    importPath: SDK_PACKAGE,
    signature: "Timer(durationSeconds: number, style?: WidgetStyle): WidgetNode",
    inputs: ["durationSeconds", "style"],
    example: "Timer(1500, { color: \"#ffffff\" })",
    status: "implemented",
    notes: ["The native renderer owns timer controls, duration editing, wall-clock recovery, and persistence. Users can enter minutes or MM:SS directly in the widget."]
  },
  {
    name: "TaskList",
    kind: "primitive",
    summary: "Host-owned editable task list with completion, editing, adding, and persistence",
    importPath: SDK_PACKAGE,
    signature: "TaskList(items: WidgetTaskItem[], style?: WidgetStyle): WidgetNode",
    inputs: ["items", "style"],
    example: 'TaskList([{ id: "read", text: "Read chapter 3" }])',
    status: "implemented",
    notes: ["The native renderer owns task editing, completion, adding, removal, reordering, clear-completed, and persistence."]
  },
  {
    name: "List",
    kind: "primitive",
    summary: "Native read-only list of static rows or structured provider rows",
    importPath: SDK_PACKAGE,
    signature: "List(items: WidgetListItem[] | ProviderBinding, style?: WidgetStyle): WidgetNode",
    inputs: ["items", "style"],
    example: 'List(useProvider("reminders.items"), { gap: 8 })',
    status: "implemented",
    notes: ["The native renderer owns row layout and structured provider decoding.", "Provider rows must be structured objects with id, title, optional subtitle, and optional completed fields.", "This slice renders rows natively; dynamic per-row actions are a later action-binding contract."]
  },
  {
    name: "YouTubePlayer",
    kind: "primitive",
    summary: "Native embedded YouTube player with user-controlled playback",
    importPath: SDK_PACKAGE,
    signature: "YouTubePlayer(videoId: string, style?: WidgetStyle): WidgetNode",
    inputs: ["videoId", "allowLinkInput", "autoplay", "controls", "startSeconds", "style"],
    example: 'YouTubePlayer({ videoId: "M7lc1UVf-VE", allowLinkInput: true, controls: true })',
    status: "implemented",
    notes: ["The native renderer owns the isolated WKWebView and official YouTube embed surface.", "The manifest must declare the network capability; source defaults use 11-character YouTube video IDs only.", "The SDK supplies a 480x270 neutral glass surface with a 16-point radius, clipped content, border, and shadow when style fields are omitted; explicit style fields override these defaults.", "Set allowLinkInput to true to expose a native persisted link editor in the widget's hover settings panel for pasted youtube.com or youtu.be links.", "Autoplay is opt-in and may still be restricted by macOS or YouTube playback policy."]
  },
  {
    name: "Visualizer",
    kind: "primitive",
    summary: "Native animated visualizer that reacts to an optional provider without fabricating audio data",
    importPath: SDK_PACKAGE,
    signature: 'Visualizer(props?: { provider?: ProviderBinding; mode?: "bars" | "waveform" | "rings"; tempo?: number; style?: WidgetStyle }): WidgetNode',
    inputs: ["provider", "mode", "tempo", "style"],
    example: 'Visualizer({ provider: useProvider("spotify.playback.isPlaying"), mode: "bars" })',
    status: "implemented",
    notes: ["The native renderer uses a host animation clock and displays an explicit unavailable state when its provider is unavailable.", "Tempo controls visual response rate; it does not claim to change third-party playback speed."]
  },
  {
    name: "Artwork",
    kind: "primitive",
    summary: "Theme-aware artwork composition with a bounded media surface",
    importPath: SDK_PACKAGE,
    signature: "Artwork(source: string | ImageSource, style?: WidgetStyle): WidgetNode",
    inputs: ["source", "style"],
    example: 'Artwork({ kind: "asset", name: "album-art" })',
    status: "implemented",
    notes: ["Artwork composes the native Image primitive with a media role and intentional radius; explicit style fields override the defaults.", "The native renderer resolves the artwork surface and clips it to the declared curve."]
  },
  {
    name: "TransportControls",
    kind: "primitive",
    summary: "Composable native previous, play, pause, and next control row",
    importPath: SDK_PACKAGE,
    signature: "TransportControls(props: TransportControlsProps): WidgetNode",
    inputs: ["previousAction", "playAction", "pauseAction", "nextAction", "style"],
    example: 'TransportControls({ playAction: { type: "invoke", name: "spotify.play" } })',
    status: "implemented",
    notes: ["Controls remain explicit serialized actions and inherit the active Render theme.", "The native renderer supplies the accessible control row and dispatches actions through the host boundary.", "Supply only the operations supported by the provider; unavailable controls remain visibly disabled."]
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
    name: "spotify.play",
    kind: "action",
    summary: "Request the host to resume Spotify playback",
    importPath: SDK_PACKAGE,
    signature: 'WidgetActionName = "spotify.play"',
    example: 'Button("Play", { type: "invoke", name: "spotify.play" })',
    status: "implemented",
    notes: ["Requires the Spotify account scope user-modify-playback-state.", "The host reports authorization, Premium-account, device, rate-limit, and provider errors explicitly."]
  },
  {
    name: "spotify.pause",
    kind: "action",
    summary: "Request the host to pause Spotify playback",
    importPath: SDK_PACKAGE,
    signature: 'WidgetActionName = "spotify.pause"',
    example: 'Button("Pause", { type: "invoke", name: "spotify.pause" })',
    status: "implemented",
    notes: ["Requires the Spotify account scope user-modify-playback-state."]
  },
  {
    name: "spotify.next",
    kind: "action",
    summary: "Request the host to skip to the next Spotify track",
    importPath: SDK_PACKAGE,
    signature: 'WidgetActionName = "spotify.next"',
    example: 'Button("Next", { type: "invoke", name: "spotify.next" })',
    status: "implemented",
    notes: ["Requires the Spotify account scope user-modify-playback-state."]
  },
  {
    name: "spotify.previous",
    kind: "action",
    summary: "Request the host to skip to the previous Spotify track",
    importPath: SDK_PACKAGE,
    signature: 'WidgetActionName = "spotify.previous"',
    example: 'Button("Previous", { type: "invoke", name: "spotify.previous" })',
    status: "implemented",
    notes: ["Requires the Spotify account scope user-modify-playback-state."]
  },
  {
    name: "spotify.set-volume",
    kind: "action",
    summary: "Request the host to set Spotify playback volume from 0 to 100",
    importPath: SDK_PACKAGE,
    signature: 'WidgetActionName = "spotify.set-volume"',
    example: 'Button("Volume", { type: "set", name: "spotify.set-volume", value: 50 })',
    status: "implemented",
    notes: ["Values must be integers from 0 through 100.", "Requires the Spotify account scope user-modify-playback-state."]
  },
  {
    name: "reminders.create",
    kind: "action",
    summary: "Create a macOS Reminder through the host-owned Reminders connector",
    importPath: SDK_PACKAGE,
    signature: 'WidgetActionName = "reminders.create"',
    example: 'Button("Add", { type: "invoke", name: "reminders.create", payload: { title: "Review notes" } })',
    status: "implemented",
    notes: ["Requires a reminders account with the reminders.write scope.", "The host owns EventKit permission and never exposes the event store to widget code."]
  },
  {
    name: "reminders.update",
    kind: "action",
    summary: "Edit a macOS Reminder title, due date, or completion state",
    importPath: SDK_PACKAGE,
    signature: 'WidgetActionName = "reminders.update"',
    example: 'Button("Rename", { type: "invoke", name: "reminders.update", payload: { id: reminderId, title: "Updated" } })',
    status: "implemented",
    notes: ["The payload requires a reminder id and accepts title, dueDate, or completed fields."]
  },
  {
    name: "reminders.complete",
    kind: "action",
    summary: "Complete or reopen a macOS Reminder",
    importPath: SDK_PACKAGE,
    signature: 'WidgetActionName = "reminders.complete"',
    example: 'Button("Done", { type: "invoke", name: "reminders.complete", payload: { id: reminderId, completed: true } })',
    status: "implemented",
    notes: ["The completed field defaults to true when omitted."]
  },
  {
    name: "reminders.delete",
    kind: "action",
    summary: "Delete a macOS Reminder through an explicit host operation",
    importPath: SDK_PACKAGE,
    signature: 'WidgetActionName = "reminders.delete"',
    example: 'Button("Delete", { type: "invoke", name: "reminders.delete", payload: { id: reminderId } })',
    status: "implemented",
    notes: ["Requires a reminders account with the reminders.write scope."]
  },
  {
    name: "WidgetBorder",
    kind: "type",
    summary: "Native border stroke configuration for a widget surface",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetBorder { color?: string; width?: number; radius?: number }",
    fields: ["color", "width", "radius"],
    example: 'const border: WidgetBorder = { color: "#22d3ee", width: 1, radius: 18 }',
    status: "implemented",
    notes: ["radius controls the stroke corner independently; set WidgetStyle.radius as well when the child content must be clipped to the same curve."]
  },
  {
    name: "WidgetShadow",
    kind: "type",
    summary: "Native shadow configuration for a widget surface",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetShadow { color?: string; radius?: number; x?: number; y?: number; opacity?: number }",
    fields: ["color", "radius", "x", "y", "opacity"],
    example: 'const shadow: WidgetShadow = { color: "#22d3ee", radius: 18, opacity: 0.25 }',
    status: "implemented",
    notes: ["Shadow is rendered by the native host outside the rounded surface and is not clipped by WidgetStyle.radius."]
  },
  {
    name: "WidgetStyle",
    kind: "style",
    summary: "Constrained native layout, typography, semantic surface, and theme styling",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetStyle { width?: WidgetLength; height?: WidgetLength; color?: string; backgroundColor?: string; opacity?: number; padding?: WidgetSpacing; margin?: WidgetSpacing; gap?: number; alignItems?: WidgetAlignment; justifyContent?: WidgetAlignment; radius?: number; border?: WidgetBorder; shadow?: WidgetShadow; font?: WidgetFont; material?: WidgetMaterial; role?: WidgetSemanticRole; density?: WidgetDensity; tokens?: WidgetStyleToken[] }",
    fields: ["width", "height", "color", "backgroundColor", "opacity", "padding", "margin", "gap", "alignItems", "justifyContent", "radius", "border", "shadow", "font", "material", "role", "density", "tokens"],
    example: 'Text("CPU", { tokens: ["text.primary"], font: { size: 14, weight: "semibold" } })',
    status: "implemented",
    notes: [
      "Values are serializable native style fields, not arbitrary CSS declarations.",
      "Width, height, and font sizes must be positive; spacing, opacity, radii, and border widths are non-negative when provided.",
      "The native host applies layout, color, typography, semantic role, material, density, surface, border, shadow, opacity, and token fields; radius also clips native child content to the rounded surface."
    ]
  },
  {
    name: "WidgetThemeConfig",
    kind: "type",
    summary: "Declared default and user-selectable Render theme variants",
    importPath: SDK_PACKAGE,
    signature: 'interface WidgetThemeConfig { default: "dark-glass" | "light" | "monochrome" | "retro"; options?: WidgetThemeName[] }',
    fields: ["default", "options"],
    example: 'theme: { default: "dark-glass", options: ["dark-glass", "light", "monochrome"] }',
    status: "implemented",
    notes: ["The host persists a user-selected theme locally; source declares the available variants and default only."]
  },
  {
    name: "WidgetThemeName",
    kind: "type",
    summary: "Supported Render semantic theme names",
    importPath: SDK_PACKAGE,
    signature: 'type WidgetThemeName = "dark-glass" | "light" | "monochrome" | "retro"',
    fields: ["dark-glass", "light", "monochrome", "retro"],
    example: 'const theme: WidgetThemeName = "dark-glass"',
    status: "implemented"
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
    signature: 'type WidgetActionName = "widget.refresh" | "widget.reload" | "spotify.play" | "spotify.pause" | "spotify.next" | "spotify.previous" | "spotify.set-volume" | "reminders.create" | "reminders.update" | "reminders.complete" | "reminders.delete"',
    fields: ["widget.refresh", "widget.reload", "spotify.play", "spotify.pause", "spotify.next", "spotify.previous", "spotify.set-volume", "reminders.create", "reminders.update", "reminders.complete", "reminders.delete"],
    example: 'const action: WidgetActionName = "widget.refresh"',
    status: "implemented",
    notes: ["Actions are descriptors and never executable callbacks.", "Connector actions require the matching manifest account requirement and host permission."]
  },
  {
    name: "ReminderCreateActionPayload",
    kind: "type",
    summary: "Typed payload for creating a macOS Reminder",
    importPath: SDK_PACKAGE,
    signature: "interface ReminderCreateActionPayload { title: string; listName?: string; dueDate?: string }",
    fields: ["title: string", "listName?: string", "dueDate?: string"],
    example: 'const payload: ReminderCreateActionPayload = { title: "Review notes" }',
    status: "implemented",
    notes: ["dueDate is an ISO date-time string when supplied."]
  },
  {
    name: "ReminderUpdateActionPayload",
    kind: "type",
    summary: "Typed payload for editing a macOS Reminder",
    importPath: SDK_PACKAGE,
    signature: "interface ReminderUpdateActionPayload { id: string; title?: string; dueDate?: string | null; completed?: boolean }",
    fields: ["id: string", "title?: string", "dueDate?: string | null", "completed?: boolean"],
    example: 'const payload: ReminderUpdateActionPayload = { id: reminderId, completed: true }',
    status: "implemented"
  },
  {
    name: "ReminderCompleteActionPayload",
    kind: "type",
    summary: "Typed payload for completing or reopening a macOS Reminder",
    importPath: SDK_PACKAGE,
    signature: "interface ReminderCompleteActionPayload { id: string; completed?: boolean }",
    fields: ["id: string", "completed?: boolean"],
    example: 'const payload: ReminderCompleteActionPayload = { id: reminderId }',
    status: "implemented",
    notes: ["completed defaults to true in the native host."]
  },
  {
    name: "ReminderDeleteActionPayload",
    kind: "type",
    summary: "Typed payload for deleting a macOS Reminder",
    importPath: SDK_PACKAGE,
    signature: "interface ReminderDeleteActionPayload { id: string }",
    fields: ["id: string"],
    example: 'const payload: ReminderDeleteActionPayload = { id: reminderId }',
    status: "implemented"
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
      'kind: "column" | "row" | "stack" | "box" | "glassPanel" | "mediaCard" | "scrollView" | "spacer" | "divider" | "text" | "textField" | "textEditor" | "toggle" | "timer" | "taskList" | "list" | "visualizer" | "youtubePlayer" | "shape" | "icon" | "image" | "button" | "gauge" | "progress" | "grid"',
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
      "columns?: number",
      "durationSeconds?: number",
      "tasks?: WidgetTaskItem[]",
      "items?: WidgetListItem[]",
      "videoId?: string",
      "allowLinkInput?: boolean",
      "autoplay?: boolean",
      "controls?: boolean",
      "startSeconds?: number",
      "placeholder?: string",
      "dateTime?: string",
      'dateTimeMode?: "date" | "time" | "dateTime"',
      'visualizerMode?: "bars" | "waveform" | "rings"',
      "visualizerTempo?: number"
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
    signature: 'type WidgetNodeKind = "column" | "row" | "stack" | "box" | "glassPanel" | "mediaCard" | "scrollView" | "spacer" | "divider" | "text" | "textField" | "textEditor" | "dateTime" | "dateTimePicker" | "toggle" | "timer" | "taskList" | "list" | "visualizer" | "youtubePlayer" | "shape" | "icon" | "image" | "button" | "gauge" | "progress" | "grid"',
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
      "adjustable?: WidgetAdjustable",
      'capabilities: Array<"network" | "filesystem.read" | "filesystem.write">',
      "subscribe: string[]",
      "accounts?: WidgetAccountRequirement[]",
      "theme?: WidgetThemeConfig"
    ],
    example: 'widget({ "schemaVersion": 1, "name": "Example", "sdkVersion": "0.1.0", "size": { "width": 320, "height": 180 }, "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } }, "capabilities": [], "subscribe": [], "accounts": [] }, render)',
    notes: ["Keep manifest keys quoted so render check can provide source-oriented diagnostics."]
  },
  {
    name: "WidgetSize",
    kind: "type",
    summary: "Width and height in native points",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetSize { width: number; height: number }",
    fields: ["width", "height"],
    example: "const size: WidgetSize = { width: 280, height: 300 }",
    status: "implemented"
  },
  {
    name: "WidgetResponsiveMode",
    kind: "type",
    summary: "Minimum dimensions for one responsive widget mode",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetResponsiveMode { minWidth: number; minHeight: number }",
    fields: ["minWidth", "minHeight"],
    example: "const compact: WidgetResponsiveMode = { minWidth: 180, minHeight: 180 }",
    status: "implemented"
  },
  {
    name: "WidgetResponsive",
    kind: "type",
    summary: "Declared responsive modes and default mode",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetResponsive { modes: Record<string, WidgetResponsiveMode>; default: string }",
    fields: ["modes", "default"],
    example: 'const responsive: WidgetResponsive = { modes: { compact: { minWidth: 180, minHeight: 180 } }, default: "compact" }',
    status: "implemented"
  },
  {
    name: "WidgetAdjustable",
    kind: "type",
    summary: "Widget-level live resizing and responsive layout contract",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetAdjustable { enabled: boolean; minSize?: WidgetSize; maxSize?: WidgetSize; responsive?: WidgetResponsive }",
    fields: ["enabled", "minSize", "maxSize", "responsive"],
    example: 'const adjustable: WidgetAdjustable = { enabled: true, minSize: { width: 180, height: 180 } }',
    status: "implemented",
    notes: ["The native host owns resize handles, persistence, lock state, and Settings controls."]
  },
  {
    name: "WidgetRenderContext",
    kind: "type",
    summary: "Host-provided responsive mode and current size during rendering",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetRenderContext { mode: string; size?: WidgetSize }",
    fields: ["mode", "size"],
    example: 'const render = ({ mode }: WidgetRenderContext) => mode === "compact" ? compactLayout() : regularLayout()',
    status: "implemented"
  },
  {
    name: "WidgetTaskItem",
    kind: "type",
    summary: "Portable default task row consumed by the host-owned task list",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetTaskItem { id: string; text: string; completed?: boolean }",
    fields: ["id", "text", "completed"],
    example: 'const task: WidgetTaskItem = { id: "read", text: "Read chapter 3" }',
    status: "implemented",
    notes: ["TaskList owns editing, completion, adding, and persistence; widget source supplies defaults."]
  },
  {
    name: "WidgetListItem",
    kind: "type",
    summary: "Portable row shape for the generic native List primitive",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetListItem { id: string; title: string; subtitle?: string; completed?: boolean }",
    fields: ["id", "title", "subtitle", "completed"],
    example: 'const row: WidgetListItem = { id: "read", title: "Read chapter 3", subtitle: "Today" }',
    status: "implemented",
    notes: ["The same shape is used by structured provider values such as reminders.items."]
  },
  {
    name: "YouTubePlayerProps",
    kind: "type",
    summary: "Configuration for the native YouTubePlayer primitive",
    importPath: SDK_PACKAGE,
    signature: "interface YouTubePlayerProps { videoId?: string; allowLinkInput?: boolean; autoplay?: boolean; controls?: boolean; startSeconds?: number; style?: WidgetStyle }",
    fields: ["videoId", "allowLinkInput", "autoplay", "controls", "startSeconds", "style"],
    example: 'const player: YouTubePlayerProps = { videoId: "M7lc1UVf-VE", allowLinkInput: true, controls: true }',
    status: "implemented",
    notes: ["Use an 11-character YouTube video ID as the source default, or set allowLinkInput to let the user paste a youtube.com or youtu.be link. Arbitrary URLs and HTML snippets are rejected.", "The native host owns link editing, media sizing, rounded clipping, glass material, border, and shadow behavior."]
  },
  {
    name: "WidgetDateTimeMode",
    kind: "type",
    summary: "Display components supported by date/time primitives",
    importPath: SDK_PACKAGE,
    signature: 'type WidgetDateTimeMode = "date" | "time" | "dateTime"',
    fields: ["date", "time", "dateTime"],
    example: 'const mode: WidgetDateTimeMode = "dateTime"',
    status: "implemented"
  },
  {
    name: "WidgetAccountRequirement",
    kind: "type",
    summary: "Declarative request for a host-managed connector account and exact scopes",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetAccountRequirement { connector: string; scopes: string[] }",
    fields: ["connector", "scopes"],
    example: 'const account: WidgetAccountRequirement = { connector: "spotify", scopes: ["user-read-playback-state"] }',
    status: "implemented",
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
    status: "implemented",
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
    status: "implemented",
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
    status: "implemented",
    notes: ["The connector must also be declared in manifest.accounts with its exact scopes."]
  },
  {
    name: "spotify",
    kind: "connector",
    summary: "Trusted Spotify Web API connector for account identity and playback control",
    importPath: SDK_PACKAGE,
    signature: 'accounts: [{ connector: "spotify", scopes: string[] }]',
    inputs: ["user-read-private", "user-read-playback-state", "user-read-currently-playing", "user-modify-playback-state"],
    example: '"accounts": [{ "connector": "spotify", "scopes": ["user-read-private", "user-read-playback-state", "user-read-currently-playing", "user-modify-playback-state"] }]',
    status: "implemented",
    notes: ["Render owns OAuth, secure credential storage, refresh, and API calls.", "Raw tokens never enter widget.tsx, the worker, the declarative tree, or logs.", "Playback controls require Spotify Premium according to the provider API; unavailable states are explicit."]
  },
  {
    name: "reminders",
    kind: "connector",
    summary: "Trusted macOS EventKit connector for reading and editing Reminders",
    importPath: SDK_PACKAGE,
    signature: 'accounts: [{ connector: "reminders", scopes: ["reminders.read", "reminders.write"] }]',
    inputs: ["reminders.read", "reminders.write"],
    example: '"accounts": [{ "connector": "reminders", "scopes": ["reminders.read", "reminders.write"] }]',
    status: "implemented",
    notes: ["Render requests native macOS Reminders permission only when the widget declares and uses this connector.", "The connector keeps EventKit objects and identifiers in the host; widgets receive redacted provider values and pass opaque ids back in explicit actions."]
  },
  {
    name: "WidgetDefinition",
    kind: "type",
    summary: "Serializable widget manifest and render function pair",
    importPath: SDK_PACKAGE,
    signature: "interface WidgetDefinition { manifest: WidgetManifest; render: (context?: WidgetRenderContext) => WidgetNode }",
    fields: ["manifest: WidgetManifest", "render: (context?: WidgetRenderContext) => WidgetNode"],
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
    signature: "interface ProviderValue { name: string; state: ProviderState; value?: WidgetJsonValue; message?: string }",
    fields: ["name", "state", "value", "message"],
    example: 'const value: ProviderValue = { name: "spotify.track.title", state: "loading" }',
    status: "implemented",
    notes: ["Available values may be numeric, textual, boolean, or structured JSON; loading and unavailable values carry an actionable message when known.", "Provider payloads are host-owned and never contain credentials."]
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
    name: "spotify.account",
    kind: "provider",
    summary: "Redacted Spotify account connection state",
    importPath: SDK_PACKAGE,
    value: "string | loading | unavailable",
    signature: 'useProvider("spotify.account"): ProviderBinding',
    example: 'Text(useProvider("spotify.account"))',
    status: "implemented",
    notes: ['Declare "spotify.account" in the widget manifest subscribe array.', "The value is a redacted status such as Connected, Connect Spotify, or Authorization expired; raw tokens never appear."]
  },
  {
    name: "spotify.track.title",
    kind: "provider",
    summary: "Currently playing Spotify track title",
    importPath: SDK_PACKAGE,
    value: "string | loading | unavailable",
    signature: 'useProvider("spotify.track.title"): ProviderBinding',
    example: 'Text(useProvider("spotify.track.title"))',
    status: "implemented",
    notes: ['Declare "spotify.track.title" in the widget manifest subscribe array.', "The host returns an explicit unavailable state when no playback is active."]
  },
  {
    name: "spotify.track.artist",
    kind: "provider",
    summary: "Currently playing Spotify artist name",
    importPath: SDK_PACKAGE,
    value: "string | loading | unavailable",
    signature: 'useProvider("spotify.track.artist"): ProviderBinding',
    example: 'Text(useProvider("spotify.track.artist"))',
    status: "implemented",
    notes: ['Declare "spotify.track.artist" in the widget manifest subscribe array.']
  },
  {
    name: "spotify.playback.isPlaying",
    kind: "provider",
    summary: "Whether Spotify playback is currently active",
    importPath: SDK_PACKAGE,
    value: "boolean | loading | unavailable",
    signature: 'useProvider("spotify.playback.isPlaying"): ProviderBinding',
    example: 'Text(useProvider("spotify.playback.isPlaying"))',
    status: "implemented",
    notes: ['Declare "spotify.playback.isPlaying" in the widget manifest subscribe array.']
  },
  {
    name: "spotify.playback.progress",
    kind: "provider",
    summary: "Current Spotify track progress in milliseconds",
    importPath: SDK_PACKAGE,
    value: "number | loading | unavailable",
    signature: 'useProvider("spotify.playback.progress"): ProviderBinding',
    example: 'Progress(useProvider("spotify.playback.progress"), 100)',
    status: "implemented",
    notes: ['Declare "spotify.playback.progress" in the widget manifest subscribe array.', "The first host slice normalizes the displayed progress to the track duration before rendering."]
  },
  {
    name: "spotify.playback.volume",
    kind: "provider",
    summary: "Current Spotify device volume percentage",
    importPath: SDK_PACKAGE,
    value: "number | loading | unavailable",
    signature: 'useProvider("spotify.playback.volume"): ProviderBinding',
    example: 'Progress(useProvider("spotify.playback.volume"), 100)',
    status: "implemented",
    notes: ['Declare "spotify.playback.volume" in the widget manifest subscribe array.', "The value is between 0 and 100 when the provider returns it."]
  },
  {
    name: "reminders.account",
    kind: "provider",
    summary: "Redacted macOS Reminders permission state",
    importPath: SDK_PACKAGE,
    value: "string | loading | unavailable",
    signature: 'useProvider("reminders.account"): ProviderBinding',
    example: 'Text(useProvider("reminders.account"))',
    status: "implemented",
    notes: ['Declare "reminders.account" in the widget manifest subscribe array.', "The value never contains reminder data or EventKit objects."]
  },
  {
    name: "reminders.items",
    kind: "provider",
    summary: "Structured macOS Reminders rows for the generic List primitive",
    importPath: SDK_PACKAGE,
    value: "Array<{ id: string; title: string; subtitle?: string; completed: boolean }> | loading | unavailable",
    signature: 'useProvider("reminders.items"): ProviderBinding',
    example: 'List(useProvider("reminders.items"))',
    status: "implemented",
    notes: ['Declare "reminders.items" in the widget manifest subscribe array.', "The provider never exposes EventKit objects; rows contain opaque IDs and display fields.", "Use reminders.read; dynamic row actions are not part of this slice yet."]
  },
  {
    name: "reminders.incompleteCount",
    kind: "provider",
    summary: "Count of incomplete macOS Reminders visible to the host",
    importPath: SDK_PACKAGE,
    value: "number | loading | unavailable",
    signature: 'useProvider("reminders.incompleteCount"): ProviderBinding',
    example: 'Text(useProvider("reminders.incompleteCount"))',
    status: "implemented",
    notes: ['Declare "reminders.incompleteCount" in the widget manifest subscribe array.', "The count is explicit unavailable when macOS permission is denied."]
  },
  {
    name: "reminders.next.title",
    kind: "provider",
    summary: "Title of the first incomplete macOS Reminder sorted by due date",
    importPath: SDK_PACKAGE,
    value: "string | loading | unavailable",
    signature: 'useProvider("reminders.next.title"): ProviderBinding',
    example: 'Text(useProvider("reminders.next.title"))',
    status: "implemented",
    notes: ['Declare "reminders.next.title" in the widget manifest subscribe array.', "The provider is unavailable when there is no incomplete reminder, rather than inventing a placeholder item."]
  },
  {
    name: "reminders.next.dueDate",
    kind: "provider",
    summary: "ISO due date for the first incomplete macOS Reminder when one exists",
    importPath: SDK_PACKAGE,
    value: "string | loading | unavailable",
    signature: 'useProvider("reminders.next.dueDate"): ProviderBinding',
    example: 'Text(useProvider("reminders.next.dueDate"))',
    status: "implemented",
    notes: ['Declare "reminders.next.dueDate" in the widget manifest subscribe array.', "Reminders without a due date report an explicit unavailable value."]
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
