export type WidgetNodeKind =
  | "column"
  | "row"
  | "stack"
  | "box"
  | "spacer"
  | "divider"
  | "text"
  | "textField"
  | "toggle"
  | "shape"
  | "icon"
  | "image"
  | "button"
  | "gauge"
  | "progress"
  | "grid"
  | "timer"
  | "taskList"
  | "list"
  | "youtubePlayer"
  | "scrollView"
  | "textEditor"
  | "dateTime"
  | "dateTimePicker";

export { describeSdkCatalog, listSdkCatalog, SDK_PACKAGE, SDK_VERSION } from "./catalog.ts";
export type { SdkCatalogItem, SdkCatalogKind } from "./catalog.ts";
export { RENDER_WORKER_PROTOCOL_VERSION } from "./worker-protocol.ts";
export type { WorkerDiagnostic, WorkerMessage, WorkerMessageKind } from "./worker-protocol.ts";
export { Fragment, jsx, jsxs } from "./jsx-runtime.ts";
export type { WidgetComponent, WidgetElementType } from "./jsx-runtime.ts";

export type WidgetLength = number | "fill" | "fit";
export type WidgetSpacing = number | WidgetInsets;
export type WidgetAlignment =
  | "leading"
  | "center"
  | "trailing"
  | "top"
  | "bottom"
  | "fill"
  | "space-between";
export type WidgetFontWeight = "regular" | "medium" | "semibold" | "bold";
export type WidgetStyleToken =
  | "surface"
  | "surface.elevated"
  | "text.primary"
  | "text.secondary"
  | "accent"
  | "danger"
  | "success"
  | "mono";

export type WidgetCapability = "network" | "filesystem.read" | "filesystem.write";
export interface WidgetSize {
  width: number;
  height: number;
}

export interface WidgetResponsiveMode {
  minWidth: number;
  minHeight: number;
}

export interface WidgetResponsive {
  modes: Record<string, WidgetResponsiveMode>;
  default: string;
}

export interface WidgetAdjustable {
  enabled: boolean;
  minSize?: WidgetSize;
  maxSize?: WidgetSize;
  responsive?: WidgetResponsive;
}

export interface WidgetRenderContext {
  mode: string;
  size?: WidgetSize;
}

export type ProviderState = "loading" | "available" | "unavailable";
export type WidgetAccountState =
  | "connected"
  | "needs-authorization"
  | "denied"
  | "expired"
  | "revoked"
  | "unavailable";

export interface WidgetAccountRequirement {
  connector: string;
  scopes: string[];
}

export interface WidgetAccountBinding {
  kind: "account";
  connector: string;
}

export interface ProviderValue {
  name: string;
  state: ProviderState;
  value?: WidgetJsonValue;
  message?: string;
}

export interface WidgetInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface WidgetFont {
  family?: string;
  size?: number;
  weight?: WidgetFontWeight;
  monospace?: boolean;
}

export interface WidgetBorder {
  color?: string;
  width?: number;
  radius?: number;
}

export interface WidgetShadow {
  color?: string;
  radius?: number;
  x?: number;
  y?: number;
  opacity?: number;
}

export interface WidgetStyle {
  width?: WidgetLength;
  height?: WidgetLength;
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  padding?: WidgetSpacing;
  margin?: WidgetSpacing;
  gap?: number;
  alignItems?: WidgetAlignment;
  justifyContent?: WidgetAlignment;
  radius?: number;
  border?: WidgetBorder;
  shadow?: WidgetShadow;
  font?: WidgetFont;
  tokens?: WidgetStyleToken[];
}

export type WidgetJsonValue =
  | string
  | number
  | boolean
  | null
  | WidgetJsonValue[]
  | { [key: string]: WidgetJsonValue };

export type WidgetActionName =
  | "widget.refresh"
  | "widget.reload"
  | "spotify.play"
  | "spotify.pause"
  | "spotify.next"
  | "spotify.previous"
  | "spotify.set-volume"
  | "reminders.create"
  | "reminders.update"
  | "reminders.complete"
  | "reminders.delete";

export interface ReminderCreateActionPayload {
  title: string;
  listName?: string;
  dueDate?: string;
}

export interface ReminderUpdateActionPayload {
  id: string;
  title?: string;
  dueDate?: string | null;
  completed?: boolean;
}

export interface ReminderCompleteActionPayload {
  id: string;
  completed?: boolean;
}

export interface ReminderDeleteActionPayload {
  id: string;
}
export type WidgetAction =
  | { type: "invoke"; name: WidgetActionName; payload?: WidgetJsonValue }
  | { type: "set"; name: WidgetActionName; value: WidgetJsonValue };

export type ImageSource =
  | { kind: "asset"; name: string }
  | { kind: "url"; url: string }
  | { kind: "provider"; name: string };

export interface WidgetNode {
  kind: WidgetNodeKind;
  key?: string | number;
  children?: WidgetNode[];
  text?: string;
  provider?: string;
  style?: WidgetStyle;
  value?: number;
  maximum?: number;
  orientation?: "horizontal" | "vertical";
  name?: string;
  source?: ImageSource;
  action?: WidgetAction;
  columns?: number;
  durationSeconds?: number;
  tasks?: WidgetTaskItem[];
  items?: WidgetListItem[];
  videoId?: string;
  allowLinkInput?: boolean;
  autoplay?: boolean;
  controls?: boolean;
  startSeconds?: number;
  placeholder?: string;
  dateTime?: string;
  dateTimeMode?: WidgetDateTimeMode;
}

export type WidgetChild = WidgetNode | string | number | null | boolean | undefined;
export type WidgetChildren = WidgetChild | WidgetChild[];

export interface WidgetComponentProps {
  key?: string | number;
  children?: WidgetChildren;
  style?: WidgetStyle;
}

export interface ContainerProps extends WidgetComponentProps {}

export interface TextProps extends WidgetComponentProps {
  text?: string | ProviderBinding;
}

export interface TextFieldProps extends WidgetComponentProps {
  text?: string;
}

export interface TextEditorProps extends WidgetComponentProps {
  text?: string;
  placeholder?: string;
}

export interface ScrollViewProps extends ContainerProps {}

export type WidgetDateTimeMode = "date" | "time" | "dateTime";

export interface DateTimeProps extends WidgetComponentProps {
  value: string;
  mode?: WidgetDateTimeMode;
}

export interface DateTimePickerProps extends WidgetComponentProps {
  value?: string;
  mode?: WidgetDateTimeMode;
}

export interface ToggleProps extends WidgetComponentProps {
  checked?: boolean;
}

export interface TimerProps extends WidgetComponentProps {
  durationSeconds: number;
}

export interface WidgetTaskItem {
  id: string;
  text: string;
  completed?: boolean;
}

export interface WidgetListItem {
  id: string;
  title: string;
  subtitle?: string;
  completed?: boolean;
}

export interface TaskListProps extends WidgetComponentProps {
  items: WidgetTaskItem[];
}

export interface ListProps extends WidgetComponentProps {
  items: WidgetListItem[] | ProviderBinding;
}

export interface YouTubePlayerProps extends WidgetComponentProps {
  videoId?: string;
  allowLinkInput?: boolean;
  autoplay?: boolean;
  controls?: boolean;
  startSeconds?: number;
}

export interface ShapeProps extends WidgetComponentProps {}

export interface GaugeProps extends WidgetComponentProps {
  value: number | ProviderBinding;
  maximum: number;
}

export interface SpacerProps extends WidgetComponentProps {
  size?: number;
}

export interface DividerProps extends WidgetComponentProps {
  orientation?: "horizontal" | "vertical";
}

export interface IconProps extends WidgetComponentProps {
  name: string;
}

export interface ImageProps extends WidgetComponentProps {
  source: string | ImageSource;
}

export interface ButtonProps extends WidgetComponentProps {
  label?: string | WidgetNode;
  action?: WidgetAction;
}

export interface ProgressProps extends WidgetComponentProps {
  value: number | ProviderBinding;
  maximum?: number;
}

export interface GridProps extends WidgetComponentProps {
  columns: number;
}

export interface WidgetManifest {
  schemaVersion: 1;
  name: string;
  sdkVersion: string;
  size: WidgetSize;
  anchor: {
    corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    offset: { x: number; y: number };
  };
  capabilities: WidgetCapability[];
  subscribe: string[];
  adjustable?: WidgetAdjustable;
  accounts?: WidgetAccountRequirement[];
}

export interface WidgetDefinition {
  manifest: WidgetManifest;
  render: (context?: WidgetRenderContext) => WidgetNode;
}

export interface ProviderBinding {
  kind: "provider";
  name: string;
}

export function useAccount(connector: string): WidgetAccountBinding {
  return { kind: "account", connector };
}

export function widgetAccountRequirement(connector: string, scopes: string[]): WidgetAccountRequirement {
  return { connector, scopes: [...scopes] };
}

export interface TimerBinding {
  kind: "timer";
  intervalMs: number;
}

export function widget(manifest: WidgetManifest, render: (context?: WidgetRenderContext) => WidgetNode): WidgetDefinition {
  return { manifest, render };
}

export function Column(children: WidgetNode[], style?: WidgetStyle): WidgetNode;
export function Column(props: ContainerProps): WidgetNode;
export function Column(input: WidgetNode[] | ContainerProps, style?: WidgetStyle): WidgetNode {
  return containerNode("column", input, style);
}

export function Row(children: WidgetNode[], style?: WidgetStyle): WidgetNode;
export function Row(props: ContainerProps): WidgetNode;
export function Row(input: WidgetNode[] | ContainerProps, style?: WidgetStyle): WidgetNode {
  return containerNode("row", input, style);
}

export function Stack(children: WidgetNode[], style?: WidgetStyle): WidgetNode;
export function Stack(props: ContainerProps): WidgetNode;
export function Stack(input: WidgetNode[] | ContainerProps, style?: WidgetStyle): WidgetNode {
  return containerNode("stack", input, style);
}

export function ScrollView(children: WidgetNode[], style?: WidgetStyle): WidgetNode;
export function ScrollView(props: ScrollViewProps): WidgetNode;
export function ScrollView(input: WidgetNode[] | ScrollViewProps, style?: WidgetStyle): WidgetNode {
  return containerNode("scrollView", input, style);
}

export function Box(children: WidgetChildren, style?: WidgetStyle): WidgetNode;
export function Box(props: ContainerProps): WidgetNode;
export function Box(input: WidgetChildren | ContainerProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    return nodeWithOptionalStyle({ kind: "box", children: childrenFrom(input.children) }, input.style);
  }
  return nodeWithOptionalStyle({ kind: "box", children: childrenFrom(input as WidgetChildren) }, style);
}

export function Spacer(style?: WidgetStyle): WidgetNode;
export function Spacer(size: number, style?: WidgetStyle): WidgetNode;
export function Spacer(props: SpacerProps): WidgetNode;
export function Spacer(input: WidgetStyle | SpacerProps | number = {}, style?: WidgetStyle): WidgetNode {
  if (typeof input === "number") {
    return nodeWithOptionalStyle({ kind: "spacer" }, { width: input, height: input, ...style });
  }
  if (isProps(input) && "size" in input) {
    const { size, style: propsStyle } = input as SpacerProps;
    return nodeWithOptionalStyle({ kind: "spacer" }, size === undefined ? propsStyle : { width: size, height: size, ...propsStyle });
  }
  return nodeWithOptionalStyle({ kind: "spacer" }, input as WidgetStyle);
}

export function Divider(orientation?: "horizontal" | "vertical", style?: WidgetStyle): WidgetNode;
export function Divider(props: DividerProps): WidgetNode;
export function Divider(input: "horizontal" | "vertical" | DividerProps = "horizontal", style?: WidgetStyle): WidgetNode {
  if (typeof input === "object") {
    return nodeWithOptionalStyle({ kind: "divider", orientation: input.orientation ?? "horizontal" }, input.style);
  }
  return nodeWithOptionalStyle({ kind: "divider", orientation: input }, style);
}

export function Text(text: string | ProviderBinding, style?: WidgetStyle): WidgetNode;
export function Text(props: TextProps): WidgetNode;
export function Text(input: string | ProviderBinding | TextProps, style?: WidgetStyle): WidgetNode {
  if (isProviderBinding(input)) {
    return nodeWithOptionalStyle(textNode(input), style);
  }
  if (isProps(input)) {
    const props = input as TextProps;
    const value = props.text ?? firstChild(props.children);
    return nodeWithOptionalStyle(textNode(value), props.style);
  }
  return nodeWithOptionalStyle(textNode(input as string), style);
}

export function TextField(text: string, style?: WidgetStyle): WidgetNode;
export function TextField(props: TextFieldProps): WidgetNode;
export function TextField(input: string | TextFieldProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as TextFieldProps;
    return nodeWithOptionalStyle({ kind: "textField", text: String(props.text ?? firstChild(props.children) ?? "") }, props.style);
  }
  return nodeWithOptionalStyle({ kind: "textField", text: input as string }, style);
}

export function TextEditor(text?: string, style?: WidgetStyle): WidgetNode;
export function TextEditor(props: TextEditorProps): WidgetNode;
export function TextEditor(input: string | TextEditorProps = "", style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as TextEditorProps;
    return nodeWithOptionalStyle({
      kind: "textEditor",
      text: String(props.text ?? firstChild(props.children) ?? ""),
      placeholder: props.placeholder
    }, props.style, props.key);
  }
  return nodeWithOptionalStyle({ kind: "textEditor", text: input as string }, style);
}

export function DateTime(value: string, style?: WidgetStyle): WidgetNode;
export function DateTime(props: DateTimeProps): WidgetNode;
export function DateTime(input: string | DateTimeProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as DateTimeProps;
    return nodeWithOptionalStyle({
      kind: "dateTime",
      dateTime: props.value,
      dateTimeMode: props.mode ?? "dateTime"
    }, props.style, props.key);
  }
  return nodeWithOptionalStyle({ kind: "dateTime", dateTime: input as string, dateTimeMode: "dateTime" }, style);
}

export function DateTimePicker(value?: string, style?: WidgetStyle): WidgetNode;
export function DateTimePicker(props: DateTimePickerProps): WidgetNode;
export function DateTimePicker(input: string | DateTimePickerProps = "", style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as DateTimePickerProps;
    return nodeWithOptionalStyle({
      kind: "dateTimePicker",
      ...(props.value === undefined ? {} : { dateTime: props.value }),
      dateTimeMode: props.mode ?? "dateTime"
    }, props.style, props.key);
  }
  return nodeWithOptionalStyle({ kind: "dateTimePicker", dateTime: typeof input === "string" && input.length > 0 ? input : undefined, dateTimeMode: "dateTime" }, style);
}

export function Toggle(checked: boolean, style?: WidgetStyle): WidgetNode;
export function Toggle(props: ToggleProps): WidgetNode;
export function Toggle(input: boolean | ToggleProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as ToggleProps;
    return nodeWithOptionalStyle({ kind: "toggle", value: props.checked === true ? 1 : 0 }, props.style);
  }
  return nodeWithOptionalStyle({ kind: "toggle", value: input ? 1 : 0 }, style);
}

export function Timer(durationSeconds: number, style?: WidgetStyle): WidgetNode;
export function Timer(props: TimerProps): WidgetNode;
export function Timer(input: number | TimerProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as TimerProps;
    return nodeWithOptionalStyle({ kind: "timer", durationSeconds: props.durationSeconds }, props.style, props.key);
  }
  return nodeWithOptionalStyle({ kind: "timer", durationSeconds: input as number }, style);
}

export function TaskList(items: WidgetTaskItem[], style?: WidgetStyle): WidgetNode;
export function TaskList(props: TaskListProps): WidgetNode;
export function TaskList(input: WidgetTaskItem[] | TaskListProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as TaskListProps;
    return nodeWithOptionalStyle({ kind: "taskList", tasks: props.items.map(normalizeTask) }, props.style, props.key);
  }
  return nodeWithOptionalStyle({ kind: "taskList", tasks: (input as WidgetTaskItem[]).map(normalizeTask) }, style);
}

export function List(items: WidgetListItem[] | ProviderBinding, style?: WidgetStyle): WidgetNode;
export function List(props: ListProps): WidgetNode;
export function List(input: WidgetListItem[] | ProviderBinding | ListProps, style?: WidgetStyle): WidgetNode {
  if (isProviderBinding(input)) {
    return nodeWithOptionalStyle({ kind: "list", provider: input.name }, style);
  }
  if (isProps(input)) {
    const props = input as ListProps;
    const items = props.items;
    return nodeWithOptionalStyle(
      isProviderBinding(items) ? { kind: "list", provider: items.name } : { kind: "list", items: items.map(normalizeListItem) },
      props.style,
      props.key
    );
  }
  return nodeWithOptionalStyle({ kind: "list", items: (input as WidgetListItem[]).map(normalizeListItem) }, style);
}

export function YouTubePlayer(videoId: string, style?: WidgetStyle): WidgetNode;
export function YouTubePlayer(props: YouTubePlayerProps): WidgetNode;
export function YouTubePlayer(input: string | YouTubePlayerProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as YouTubePlayerProps;
    return nodeWithOptionalStyle({
      kind: "youtubePlayer",
      ...(props.videoId === undefined ? {} : { videoId: props.videoId }),
      allowLinkInput: props.allowLinkInput === true,
      autoplay: props.autoplay === true,
      controls: props.controls !== false,
      ...(props.startSeconds === undefined ? {} : { startSeconds: props.startSeconds })
    }, youtubePlayerStyle(props.style), props.key);
  }
  return nodeWithOptionalStyle({ kind: "youtubePlayer", videoId: input as string, allowLinkInput: false, autoplay: false, controls: true }, youtubePlayerStyle(style));
}

function youtubePlayerStyle(style?: WidgetStyle): WidgetStyle {
  const radius = style?.radius ?? 16;
  return {
    width: 480,
    height: 270,
    radius,
    ...style,
    border: {
      color: "#cbd5e1",
      width: 1,
      radius,
      ...style?.border
    },
    shadow: {
      color: "#ffffff",
      radius: 14,
      opacity: 0.12,
      ...style?.shadow
    },
    tokens: style?.tokens ?? ["surface"]
  };
}

export function Shape(style?: WidgetStyle): WidgetNode;
export function Shape(props: ShapeProps): WidgetNode;
export function Shape(input: WidgetStyle | ShapeProps = {}, style?: WidgetStyle): WidgetNode {
  if (hasProp(input, "children") || hasProp(input, "style")) {
    return nodeWithOptionalStyle({ kind: "shape" }, (input as ShapeProps).style);
  }
  return nodeWithOptionalStyle({ kind: "shape" }, input as WidgetStyle);
}

export function Icon(name: string, style?: WidgetStyle): WidgetNode;
export function Icon(props: IconProps): WidgetNode;
export function Icon(input: string | IconProps, style?: WidgetStyle): WidgetNode {
  if (typeof input === "object") {
    return nodeWithOptionalStyle({ kind: "icon", name: input.name }, input.style);
  }
  return nodeWithOptionalStyle({ kind: "icon", name: input }, style);
}

export function Image(source: string | ImageSource, style?: WidgetStyle): WidgetNode;
export function Image(props: ImageProps): WidgetNode;
export function Image(input: string | ImageSource | ImageProps, style?: WidgetStyle): WidgetNode {
  if (typeof input === "object" && "source" in input) {
    const props = input as ImageProps;
    return nodeWithOptionalStyle({ kind: "image", source: imageSource(props.source) }, props.style);
  }
  return nodeWithOptionalStyle({ kind: "image", source: imageSource(input) }, style);
}

export function Button(label: string | WidgetNode, action?: WidgetAction, style?: WidgetStyle): WidgetNode;
export function Button(props: ButtonProps): WidgetNode;
export function Button(input: string | WidgetNode | ButtonProps, action?: WidgetAction, style?: WidgetStyle): WidgetNode {
  if (isWidgetNode(input)) {
    return nodeWithOptionalStyle({ kind: "button", children: childrenFrom(input), action }, style);
  }
  if (isProps(input)) {
    const props = input as ButtonProps;
    const label = props.label ?? firstChild(props.children);
    return nodeWithOptionalStyle({
      kind: "button",
      children: childrenFrom(label as WidgetChildren),
      action: props.action
    }, props.style);
  }
  return nodeWithOptionalStyle({ kind: "button", children: childrenFrom(input as string), action }, style);
}

export function Gauge(value: number | ProviderBinding, maximum: number, style?: WidgetStyle): WidgetNode;
export function Gauge(props: GaugeProps): WidgetNode;
export function Gauge(input: number | ProviderBinding | GaugeProps, maximum?: number, style?: WidgetStyle): WidgetNode {
  if (isProviderBinding(input)) {
    return valueNode("gauge", input, maximum as number, style);
  }
  if (isProps(input)) {
    const props = input as GaugeProps;
    return valueNode("gauge", props.value, props.maximum, props.style);
  }
  return valueNode("gauge", input as number, maximum as number, style);
}

export function Progress(value: number | ProviderBinding, maximum?: number, style?: WidgetStyle): WidgetNode;
export function Progress(props: ProgressProps): WidgetNode;
export function Progress(input: number | ProviderBinding | ProgressProps, maximum = 100, style?: WidgetStyle): WidgetNode {
  if (typeof input === "object" && "value" in input) {
    const props = input as ProgressProps;
    return valueNode("progress", props.value, props.maximum ?? 100, props.style);
  }
  return valueNode("progress", input, maximum, style);
}

export function Grid(children: WidgetChildren, columns: number, style?: WidgetStyle): WidgetNode;
export function Grid(props: GridProps): WidgetNode;
export function Grid(input: WidgetChildren | GridProps, columns?: number, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as GridProps;
    return nodeWithOptionalStyle({ kind: "grid", children: childrenFrom(props.children), columns: props.columns }, props.style);
  }
  return nodeWithOptionalStyle({ kind: "grid", children: childrenFrom(input as WidgetChildren), columns: columns as number }, style);
}

export function useProvider(name: string): ProviderBinding {
  return { kind: "provider", name };
}

export function useTimer(intervalMs: number): TimerBinding {
  return { kind: "timer", intervalMs };
}

function containerNode(kind: "column" | "row" | "stack" | "scrollView", input: WidgetNode[] | ContainerProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    return nodeWithOptionalStyle({ kind, children: childrenFrom(input.children) }, input.style, input.key);
  }
  return nodeWithOptionalStyle({ kind, children: input as WidgetNode[] }, style);
}

function valueNode(kind: "gauge" | "progress", value: number | ProviderBinding, maximum: number, style?: WidgetStyle): WidgetNode {
  const node: WidgetNode = typeof value === "number"
    ? { kind, value, maximum }
    : { kind, provider: value.name, maximum };
  return nodeWithOptionalStyle(node, style);
}

function textNode(value: string | ProviderBinding | WidgetChild | undefined): WidgetNode {
  if (isProviderBinding(value)) {
    return { kind: "text", provider: value.name };
  }
  return { kind: "text", text: value === undefined || value === null ? "" : String(value) };
}

function imageSource(source: string | ImageSource): ImageSource {
  return typeof source === "string" ? { kind: "asset", name: source } : source;
}

function childrenFrom(children: WidgetChildren | undefined): WidgetNode[] {
  if (children === undefined || children === null || typeof children === "boolean") return [];
  if (Array.isArray(children)) return children.flatMap((child) => childrenFrom(child));
  if (typeof children === "string" || typeof children === "number") return [textNode(children)];
  return [children];
}

function firstChild(children: WidgetChildren | undefined): WidgetChild {
  return Array.isArray(children) ? children[0] : children;
}

function isProps(value: unknown): value is WidgetComponentProps & Record<string, unknown> {
  return isObject(value) && !Array.isArray(value) && !hasProp(value, "kind");
}

function hasProp(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isProviderBinding(value: unknown): value is ProviderBinding {
  return isObject(value) && value.kind === "provider" && typeof value.name === "string";
}

function isWidgetNode(value: unknown): value is WidgetNode {
  return isObject(value) && typeof value.kind === "string" && value.kind !== "provider";
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function nodeWithOptionalStyle(node: WidgetNode, style?: WidgetStyle, key?: string | number): WidgetNode {
  const styled = style === undefined ? node : { ...node, style };
  return key === undefined ? styled : { ...styled, key };
}

function normalizeTask(task: WidgetTaskItem): WidgetTaskItem {
  return { id: task.id, text: task.text, completed: task.completed === true };
}

function normalizeListItem(item: WidgetListItem): WidgetListItem {
  return { id: item.id, title: item.title, subtitle: item.subtitle, completed: item.completed === true };
}
