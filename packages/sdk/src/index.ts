export type WidgetNodeKind =
  | "column"
  | "row"
  | "stack"
  | "box"
  | "spacer"
  | "divider"
  | "text"
  | "shape"
  | "icon"
  | "image"
  | "button"
  | "gauge"
  | "progress"
  | "grid";

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
  | "spotify.set-volume";
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
}

export type WidgetChild = WidgetNode | string | number | null | boolean | undefined;
export type WidgetChildren = WidgetChild | WidgetChild[];

export interface WidgetComponentProps {
  children?: WidgetChildren;
  style?: WidgetStyle;
}

export interface ContainerProps extends WidgetComponentProps {}

export interface TextProps extends WidgetComponentProps {
  text?: string | ProviderBinding;
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
  size: { width: number; height: number };
  anchor: {
    corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    offset: { x: number; y: number };
  };
  capabilities: WidgetCapability[];
  subscribe: string[];
  accounts?: WidgetAccountRequirement[];
}

export interface WidgetDefinition {
  manifest: WidgetManifest;
  render: () => WidgetNode;
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

export function widget(manifest: WidgetManifest, render: () => WidgetNode): WidgetDefinition {
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

function containerNode(kind: "column" | "row" | "stack", input: WidgetNode[] | ContainerProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    return nodeWithOptionalStyle({ kind, children: childrenFrom(input.children) }, input.style);
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

function nodeWithOptionalStyle(node: WidgetNode, style?: WidgetStyle): WidgetNode {
  return style === undefined ? node : { ...node, style };
}
