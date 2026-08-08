import type {
  ImageSourceContract,
  WidgetActionName,
  WidgetAnchorCorner,
  WidgetCapability,
  WidgetConnectorName,
  WidgetActionContract,
  WidgetAnimationContract,
  WidgetBorderContract,
  WidgetCornerRadiiContract,
  WidgetFontContract,
  WidgetGradientStopContract,
  WidgetImageOptionsContract,
  WidgetInteractionAppearanceContract,
  WidgetInteractionStyleContract,
  WidgetJSONValueContract,
  WidgetLengthContract,
  WidgetListItemContract,
  WidgetManifestContract,
  WidgetNodeContract,
  WidgetNodeKind,
  WidgetProviderName,
  WidgetShadowContract,
  WidgetSizeContract,
  WidgetSpacingContract,
  WidgetStateReferenceContract,
  WidgetStyleContract,
  WidgetTaskItemContract,
  WidgetTextureSourceContract,
  WidgetThemeName,
  WidgetTransformContract
} from "./widget-contract.generated.ts";

export type {
  WidgetActionName,
  WidgetAnchorCorner,
  WidgetCapability,
  WidgetConnectorName,
  WidgetNodeKind,
  WidgetProviderName,
  WidgetThemeName
} from "./widget-contract.generated.ts";

export {
  RENDER_WIDGET_CONTRACT_VERSION,
  WIDGET_ACTION_NAMES,
  WIDGET_ANCHOR_CORNERS,
  WIDGET_CAPABILITIES,
  WIDGET_CONNECTOR_NAMES,
  WIDGET_CONNECTOR_SCOPES,
  WIDGET_ACTION_CONNECTORS,
  WIDGET_NODE_KINDS,
  WIDGET_PROVIDER_CONNECTORS,
  WIDGET_PROVIDER_NAMES,
  WIDGET_THEME_NAMES
} from "./widget-contract.generated.ts";

export { describeSdkCatalog, listSdkCatalog, SDK_PACKAGE, SDK_VERSION } from "./catalog.ts";
export type { SdkCatalogItem, SdkCatalogKind } from "./catalog.ts";
export { RENDER_WORKER_PROTOCOL_VERSION } from "./worker-protocol.ts";
export type { WorkerDiagnostic, WorkerMessage, WorkerMessageKind } from "./worker-protocol.ts";
export { Fragment, jsx, jsxs } from "./jsx-runtime.ts";
export { SDK_ICON_NAMES, canonicalIconName } from "./icon-catalog.ts";
export type { SdkIconName } from "./icon-catalog.ts";
export type { WidgetComponent, WidgetElementType } from "./jsx-runtime.ts";

export type WidgetLength = WidgetLengthContract;
export type WidgetSpacing = WidgetSpacingContract;
export type WidgetAlignment =
  | "leading"
  | "center"
  | "trailing"
  | "top"
  | "bottom"
  | "fill"
  | "space-between";
export type WidgetFontWeight = "regular" | "medium" | "semibold" | "bold";
export type WidgetDensity = "compact" | "comfortable";
export type WidgetMaterial = "solid" | "thin" | "thick";
export type WidgetSemanticRole = "surface" | "panel" | "control" | "status" | "media";
export type WidgetStyleToken =
  | "surface"
  | "surface.elevated"
  | "surface.panel"
  | "surface.control"
  | "surface.status"
  | "text.primary"
  | "text.secondary"
  | "text.tertiary"
  | "border.subtle"
  | "accent"
  | "accent.muted"
  | "danger"
  | "success"
  | "mono";

export type WidgetSize = WidgetSizeContract;

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
  connector: WidgetConnectorName;
  scopes: string[];
}

export interface WidgetAccountBinding {
  kind: "account";
  connector: WidgetConnectorName;
}

export interface ProviderValue {
  name: string;
  state: ProviderState;
  value?: WidgetJsonValue;
  message?: string;
}

export interface WidgetInsets {
  horizontal?: number;
  vertical?: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export type WidgetCornerRadii = WidgetCornerRadiiContract;

export type WidgetTextAlignment = "leading" | "center" | "trailing" | "justified";
export type WidgetTextTruncation = "head" | "middle" | "tail" | "clip";

export type WidgetFont = WidgetFontContract;
export type WidgetBorder = WidgetBorderContract;
export type WidgetShadow = WidgetShadowContract;

export type WidgetCursor = "default" | "pointer" | "text" | "crosshair" | "move" | "not-allowed";

export type WidgetInteractionAppearance = WidgetInteractionAppearanceContract;
export type WidgetInteractionStyle = WidgetInteractionStyleContract;
export type WidgetStyle = WidgetStyleContract;

export type WidgetJsonValue = WidgetJSONValueContract;

type WidgetStateValue = string | number | boolean;

export interface WidgetStateBinding<T extends WidgetStateValue = WidgetStateValue> {
  kind: "state";
  key: string;
  initial: T;
}

export type WidgetStateReference = WidgetStateReferenceContract;

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
export type WidgetAction = WidgetActionContract;

export type WidgetImageFit = "contain" | "cover" | "fill";
export type WidgetImageRepeat = "none" | "x" | "y" | "both";
export type WidgetImagePosition = "leading" | "center" | "trailing";

export type WidgetImageOptions = WidgetImageOptionsContract;
export type ImageSource = ImageSourceContract;
export type WidgetGradientStop = WidgetGradientStopContract;
export type WidgetTextureSource = WidgetTextureSourceContract;
export type WidgetTransform = WidgetTransformContract;

export type WidgetAnimationProperty = "opacity" | "rotation" | "scale" | "offsetX" | "offsetY";
export type WidgetAnimationEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export type WidgetAnimation = WidgetAnimationContract;

export type WidgetNode = WidgetNodeContract;

export type WidgetChild = WidgetNode | string | number | null | boolean | undefined;
export type WidgetChildren = WidgetChild | WidgetChild[];

export interface WidgetComponentProps {
  key?: string | number;
  children?: WidgetChildren;
  style?: WidgetStyle;
}

export interface GlassPanelProps extends ContainerProps {}

export interface MediaCardProps extends ContainerProps {}

export type WidgetVisualizerMode = "bars" | "waveform" | "rings";

export interface VisualizerProps extends WidgetComponentProps {
  provider?: ProviderBinding;
  mode?: WidgetVisualizerMode;
  tempo?: number;
}

export interface ArtworkProps extends WidgetComponentProps {
  source: string | ImageSource;
}

export interface TransportControlsProps extends WidgetComponentProps {
  previousAction?: WidgetAction;
  playAction?: WidgetAction;
  pauseAction?: WidgetAction;
  nextAction?: WidgetAction;
}

export interface ContainerProps extends WidgetComponentProps {}

export interface TextProps extends WidgetComponentProps {
  text?: string | ProviderBinding | WidgetStateBinding<string | number | boolean>;
}

export interface TextFieldProps extends WidgetComponentProps {
  text?: string | WidgetStateBinding<string>;
  disabled?: boolean;
}

export interface TextAreaProps extends WidgetComponentProps {
  text?: string | WidgetStateBinding<string>;
  disabled?: boolean;
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
  checked?: boolean | WidgetStateBinding<boolean>;
  disabled?: boolean;
}

export interface TimerProps extends WidgetComponentProps {
  durationSeconds: number;
}

export type WidgetTaskItem = WidgetTaskItemContract;
export type WidgetListItem = WidgetListItemContract;

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
  value: number | ProviderBinding | WidgetStateBinding<number>;
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
  options?: WidgetImageOptions;
  fit?: WidgetImageFit;
  repeat?: WidgetImageRepeat;
  position?: WidgetImagePosition;
  tint?: string;
}

export interface ButtonProps extends WidgetComponentProps {
  label?: string | WidgetNode;
  action?: WidgetAction;
  disabled?: boolean;
}

export interface SliderProps extends WidgetComponentProps {
  value: number | WidgetStateBinding<number>;
  minimum?: number;
  maximum?: number;
  step?: number;
  disabled?: boolean;
}

export interface CountdownProps extends WidgetComponentProps {
  seconds: number | WidgetStateBinding<number>;
  minimum?: number;
  maximum?: number;
  step?: number;
  disabled?: boolean;
}

export interface ProgressProps extends WidgetComponentProps {
  value: number | ProviderBinding | WidgetStateBinding<number>;
  maximum?: number;
}

export interface GridProps extends WidgetComponentProps {
  columns: number;
}

export interface GradientProps extends WidgetComponentProps {
  stops: WidgetGradientStop[];
}

export interface TextureProps extends WidgetComponentProps {
  source: WidgetTextureSource;
}

export interface ClipProps extends WidgetComponentProps {}

export interface TransformProps extends WidgetComponentProps {
  transform: WidgetTransform;
}

export interface SegmentedProgressProps extends WidgetComponentProps {
  value: number | ProviderBinding | WidgetStateBinding<number>;
  segments: number;
  maximum?: number;
}

export interface SpectrumProps extends WidgetComponentProps {
  values: number[];
  maximum?: number;
}

export interface AnimateProps {
  node: WidgetNode;
  animation: WidgetAnimation;
}

export type WidgetManifest = WidgetManifestContract;

export interface WidgetThemeConfig {
  default: WidgetThemeName;
  options?: WidgetThemeName[];
}

export interface WidgetFontAsset {
  asset: string;
  family?: string;
}

export interface WidgetDefinition {
  manifest: WidgetManifest;
  render: (context?: WidgetRenderContext) => WidgetNode;
}

export interface ProviderBinding {
  kind: "provider";
  name: WidgetProviderName;
}

export function useWidgetState<T extends WidgetStateValue>(key: string, initial: T): WidgetStateBinding<T> {
  return { kind: "state", key, initial };
}

export function useAccount(connector: WidgetConnectorName): WidgetAccountBinding {
  return { kind: "account", connector };
}

export function widgetAccountRequirement(connector: WidgetConnectorName, scopes: string[]): WidgetAccountRequirement {
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

export function GlassPanel(children: WidgetChildren, style?: WidgetStyle): WidgetNode;
export function GlassPanel(props: GlassPanelProps): WidgetNode;
export function GlassPanel(input: WidgetChildren | GlassPanelProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    return nodeWithOptionalStyle(
      { kind: "glassPanel", children: childrenFrom(input.children) },
      patternStyle({ radius: 18, material: "thin", role: "panel", tokens: ["surface.panel", "border.subtle"] }, input.style),
      input.key
    );
  }
  return nodeWithOptionalStyle(
    { kind: "glassPanel", children: childrenFrom(input as WidgetChildren) },
    patternStyle({ radius: 18, material: "thin", role: "panel", tokens: ["surface.panel", "border.subtle"] }, style)
  );
}

export function MediaCard(children: WidgetChildren, style?: WidgetStyle): WidgetNode;
export function MediaCard(props: MediaCardProps): WidgetNode;
export function MediaCard(input: WidgetChildren | MediaCardProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    return nodeWithOptionalStyle(
      { kind: "mediaCard", children: childrenFrom(input.children) },
      patternStyle({ radius: 16, material: "thin", role: "surface" }, input.style),
      input.key
    );
  }
  return nodeWithOptionalStyle(
    { kind: "mediaCard", children: childrenFrom(input as WidgetChildren) },
    patternStyle({ radius: 16, material: "thin", role: "surface" }, style)
  );
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

export function Text(text: string | ProviderBinding | WidgetStateBinding<string | number | boolean>, style?: WidgetStyle): WidgetNode;
export function Text(props: TextProps): WidgetNode;
export function Text(input: string | ProviderBinding | WidgetStateBinding<string | number | boolean> | TextProps, style?: WidgetStyle): WidgetNode {
  if (isProviderBinding(input)) {
    return nodeWithOptionalStyle(textNode(input), style);
  }
  if (isStateBinding(input)) {
    return nodeWithOptionalStyle(stateTextNode(input), style);
  }
  if (isProps(input)) {
    const props = input as TextProps;
    const value = props.text ?? firstChild(props.children);
    return nodeWithOptionalStyle(textNode(value), props.style);
  }
  return nodeWithOptionalStyle(textNode(input as string), style);
}

export function TextField(text: string | WidgetStateBinding<string>, style?: WidgetStyle): WidgetNode;
export function TextField(props: TextFieldProps): WidgetNode;
export function TextField(input: string | WidgetStateBinding<string> | TextFieldProps, style?: WidgetStyle): WidgetNode {
  if (isStateBinding(input)) {
    return nodeWithOptionalStyle({ kind: "textField", text: "", state: stateReference(input) }, style);
  }
  if (isProps(input)) {
    const props = input as TextFieldProps;
    if (isStateBinding(props.text)) {
      return nodeWithOptionalStyle({
        kind: "textField",
        text: "",
        state: stateReference(props.text),
        ...(props.disabled === undefined ? {} : { disabled: props.disabled })
      }, props.style);
    }
    return nodeWithOptionalStyle({
      kind: "textField",
      text: String(props.text ?? firstChild(props.children) ?? ""),
      ...(props.disabled === undefined ? {} : { disabled: props.disabled })
    }, props.style);
  }
  return nodeWithOptionalStyle({ kind: "textField", text: input as string }, style);
}

export function TextArea(text: string | WidgetStateBinding<string>, style?: WidgetStyle): WidgetNode;
export function TextArea(props: TextAreaProps): WidgetNode;
export function TextArea(input: string | WidgetStateBinding<string> | TextAreaProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as TextAreaProps;
    if (isStateBinding(props.text)) {
      return nodeWithOptionalStyle({
        kind: "textArea",
        text: "",
        state: stateReference(props.text),
        ...(props.disabled === undefined ? {} : { disabled: props.disabled })
      }, props.style);
    }
    return nodeWithOptionalStyle({
      kind: "textArea",
      text: String(props.text ?? firstChild(props.children) ?? ""),
      ...(props.disabled === undefined ? {} : { disabled: props.disabled })
    }, props.style);
  }
  if (isStateBinding(input)) {
    return nodeWithOptionalStyle({ kind: "textArea", text: "", state: stateReference(input) }, style);
  }
  return nodeWithOptionalStyle({ kind: "textArea", text: input as string }, style);
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

export function Toggle(checked: boolean | WidgetStateBinding<boolean>, style?: WidgetStyle): WidgetNode;
export function Toggle(props: ToggleProps): WidgetNode;
export function Toggle(input: boolean | WidgetStateBinding<boolean> | ToggleProps, style?: WidgetStyle): WidgetNode {
  if (isStateBinding(input)) {
    return nodeWithOptionalStyle({ kind: "toggle", value: 0, state: stateReference(input) }, style);
  }
  if (isProps(input)) {
    const props = input as ToggleProps;
    if (isStateBinding(props.checked)) {
      return nodeWithOptionalStyle({
        kind: "toggle",
        value: 0,
        state: stateReference(props.checked),
        ...(props.disabled === undefined ? {} : { disabled: props.disabled })
      }, props.style);
    }
    return nodeWithOptionalStyle({
      kind: "toggle",
      value: props.checked === true ? 1 : 0,
      ...(props.disabled === undefined ? {} : { disabled: props.disabled })
    }, props.style);
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

export function Visualizer(props?: VisualizerProps): WidgetNode {
  const input = props ?? {};
  return nodeWithOptionalStyle({
    kind: "visualizer",
    ...(input.provider === undefined ? {} : { provider: input.provider.name }),
    visualizerMode: input.mode ?? "bars",
    ...(input.tempo === undefined ? {} : { visualizerTempo: input.tempo })
  }, input.style, input.key);
}

export function Artwork(source: string | ImageSource, style?: WidgetStyle): WidgetNode;
export function Artwork(props: ArtworkProps): WidgetNode;
export function Artwork(input: string | ImageSource | ArtworkProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input) && "source" in input) {
    const props = input as ArtworkProps;
    return Image({
      source: props.source,
      style: patternStyle({ width: 64, height: 64, radius: 12, role: "media" }, props.style),
      key: props.key
    });
  }
  return Image({
    source: input as string | ImageSource,
    style: patternStyle({ width: 64, height: 64, radius: 12, role: "media" }, style)
  });
}

export function TransportControls(props: TransportControlsProps = {}): WidgetNode {
  return Row({
    key: props.key,
    style: patternStyle({ gap: 8, role: "control", density: "compact" }, props.style),
    children: [
      Button({ label: Icon("backward.fill"), action: props.previousAction, style: { role: "control" } }),
      Button({ label: Icon("play.fill"), action: props.playAction, style: { role: "control" } }),
      Button({ label: Icon("pause.fill"), action: props.pauseAction, style: { role: "control" } }),
      Button({ label: Icon("forward.fill"), action: props.nextAction, style: { role: "control" } })
    ]
  });
}

function youtubePlayerStyle(style?: WidgetStyle): WidgetStyle {
  const radius = typeof style?.radius === "number" ? style.radius : 16;
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
export function Image(source: string | ImageSource, options: WidgetImageOptions, style?: WidgetStyle): WidgetNode;
export function Image(props: ImageProps): WidgetNode;
export function Image(
  input: string | ImageSource | ImageProps,
  styleOrOptions?: WidgetStyle | WidgetImageOptions,
  style?: WidgetStyle
): WidgetNode {
  if (typeof input === "object" && "source" in input) {
    const props = input as ImageProps;
    return imageNode(props.source, props.style, imageOptionsFrom(props));
  }
  const options = isImageOptions(styleOrOptions) ? styleOrOptions : undefined;
  return imageNode(input, isImageOptions(styleOrOptions) ? style : styleOrOptions, options);
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
      action: props.action,
      ...(props.disabled === undefined ? {} : { disabled: props.disabled })
    }, props.style);
  }
  return nodeWithOptionalStyle({ kind: "button", children: childrenFrom(input as string), action }, style);
}

export function Slider(value: number | WidgetStateBinding<number>, maximum?: number, style?: WidgetStyle): WidgetNode;
export function Slider(props: SliderProps): WidgetNode;
export function Slider(input: number | WidgetStateBinding<number> | SliderProps, maximum = 100, style?: WidgetStyle): WidgetNode {
  if (isProps(input) && "value" in input) {
    const props = input as SliderProps;
    return sliderNode(props.value, props.minimum ?? 0, props.maximum ?? 100, props.step, props.disabled, props.style);
  }
  return sliderNode(input as number | WidgetStateBinding<number>, 0, maximum, undefined, undefined, style);
}

export function Countdown(seconds: number | WidgetStateBinding<number>, style?: WidgetStyle): WidgetNode;
export function Countdown(props: CountdownProps): WidgetNode;
export function Countdown(input: number | WidgetStateBinding<number> | CountdownProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input) && "seconds" in input) {
    const props = input as CountdownProps;
    return countdownNode(
      props.seconds,
      props.minimum ?? 60,
      props.maximum ?? 7_200,
      props.step ?? 60,
      props.disabled,
      props.style
    );
  }
  return countdownNode(input as number | WidgetStateBinding<number>, 60, 7_200, 60, undefined, style);
}

export function Gauge(value: number | ProviderBinding | WidgetStateBinding<number>, maximum: number, style?: WidgetStyle): WidgetNode;
export function Gauge(props: GaugeProps): WidgetNode;
export function Gauge(input: number | ProviderBinding | WidgetStateBinding<number> | GaugeProps, maximum?: number, style?: WidgetStyle): WidgetNode {
  if (isProviderBinding(input)) {
    return valueNode("gauge", input, maximum as number, style);
  }
  if (isProps(input)) {
    const props = input as GaugeProps;
    return valueNode("gauge", props.value, props.maximum, props.style);
  }
  return valueNode("gauge", input as number, maximum as number, style);
}

export function Progress(value: number | ProviderBinding | WidgetStateBinding<number>, maximum?: number, style?: WidgetStyle): WidgetNode;
export function Progress(props: ProgressProps): WidgetNode;
export function Progress(input: number | ProviderBinding | WidgetStateBinding<number> | ProgressProps, maximum = 100, style?: WidgetStyle): WidgetNode {
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

export function Gradient(children: WidgetChildren, stops: WidgetGradientStop[], style?: WidgetStyle): WidgetNode;
export function Gradient(props: GradientProps): WidgetNode;
export function Gradient(input: WidgetChildren | GradientProps, stops?: WidgetGradientStop[], style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as GradientProps;
    return nodeWithOptionalStyle({ kind: "gradient", children: childrenFrom(props.children), stops: props.stops }, props.style);
  }
  return nodeWithOptionalStyle({ kind: "gradient", children: childrenFrom(input as WidgetChildren), stops: stops as WidgetGradientStop[] }, style);
}

export function Texture(source: WidgetTextureSource, style?: WidgetStyle): WidgetNode;
export function Texture(props: TextureProps): WidgetNode;
export function Texture(input: WidgetTextureSource | TextureProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input) && "source" in input) {
    const props = input as TextureProps;
    return nodeWithOptionalStyle({ kind: "texture", source: props.source }, props.style);
  }
  return nodeWithOptionalStyle({ kind: "texture", source: input as WidgetTextureSource }, style);
}

export function Clip(children: WidgetChildren, style?: WidgetStyle): WidgetNode;
export function Clip(props: ClipProps): WidgetNode;
export function Clip(input: WidgetChildren | ClipProps, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    return nodeWithOptionalStyle({ kind: "clip", children: childrenFrom(input.children) }, input.style);
  }
  return nodeWithOptionalStyle({ kind: "clip", children: childrenFrom(input as WidgetChildren) }, style);
}

export function Transform(children: WidgetChildren, transform: WidgetTransform, style?: WidgetStyle): WidgetNode;
export function Transform(props: TransformProps): WidgetNode;
export function Transform(input: WidgetChildren | TransformProps, transform?: WidgetTransform, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as TransformProps;
    return nodeWithOptionalStyle({ kind: "transform", children: childrenFrom(props.children), transform: props.transform }, props.style);
  }
  return nodeWithOptionalStyle({ kind: "transform", children: childrenFrom(input as WidgetChildren), transform: transform as WidgetTransform }, style);
}

export function SegmentedProgress(value: number | ProviderBinding | WidgetStateBinding<number>, segments: number, maximum?: number, style?: WidgetStyle): WidgetNode;
export function SegmentedProgress(props: SegmentedProgressProps): WidgetNode;
export function SegmentedProgress(
  input: number | ProviderBinding | WidgetStateBinding<number> | SegmentedProgressProps,
  segments?: number,
  maximum = 100,
  style?: WidgetStyle
): WidgetNode {
  if (isProps(input)) {
    const props = input as SegmentedProgressProps;
    return segmentedProgressNode(props.value, props.segments, props.maximum ?? 100, props.style);
  }
  return segmentedProgressNode(input as number | ProviderBinding, segments as number, maximum, style);
}

export function Spectrum(values: number[], maximum?: number, style?: WidgetStyle): WidgetNode;
export function Spectrum(props: SpectrumProps): WidgetNode;
export function Spectrum(input: number[] | SpectrumProps, maximum = 1, style?: WidgetStyle): WidgetNode {
  if (isProps(input)) {
    const props = input as SpectrumProps;
    return nodeWithOptionalStyle({ kind: "spectrum", values: [...props.values], maximum: props.maximum ?? 1 }, props.style);
  }
  return nodeWithOptionalStyle({ kind: "spectrum", values: [...input as number[]], maximum }, style);
}

export function Animate(node: WidgetNode, animation: WidgetAnimation): WidgetNode;
export function Animate(props: AnimateProps): WidgetNode;
export function Animate(input: WidgetNode | AnimateProps, animation?: WidgetAnimation): WidgetNode {
  if (isProps(input) && "node" in input) {
    const props = input as AnimateProps;
    return { ...props.node, animation: props.animation };
  }
  return { ...(input as WidgetNode), animation };
}

export function useProvider(name: WidgetProviderName): ProviderBinding {
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

function valueNode(kind: "gauge" | "progress", value: number | ProviderBinding | WidgetStateBinding<number>, maximum: number, style?: WidgetStyle): WidgetNode {
  const node: WidgetNode = typeof value === "number"
    ? { kind, value, maximum }
    : isStateBinding(value)
      ? { kind, value: 0, maximum, state: stateReference(value) }
      : { kind, provider: value.name, maximum };
  return nodeWithOptionalStyle(node, style);
}

function sliderNode(
  value: number | WidgetStateBinding<number>,
  minimum: number,
  maximum: number,
  step: number | undefined,
  disabled: boolean | undefined,
  style: WidgetStyle | undefined
): WidgetNode {
  const node: WidgetNode = isStateBinding(value)
    ? {
        kind: "slider",
        value: value.initial,
        minimum,
        maximum,
        ...(step === undefined ? {} : { step }),
        ...(disabled === undefined ? {} : { disabled }),
        state: stateReference(value)
      }
    : {
        kind: "slider",
        value,
        minimum,
        maximum,
        ...(step === undefined ? {} : { step }),
        ...(disabled === undefined ? {} : { disabled })
      };
  return nodeWithOptionalStyle(node, style);
}

function countdownNode(
  seconds: number | WidgetStateBinding<number>,
  minimum: number,
  maximum: number,
  step: number,
  disabled: boolean | undefined,
  style: WidgetStyle | undefined
): WidgetNode {
  const node: WidgetNode = isStateBinding(seconds)
    ? {
        kind: "countdown",
        value: seconds.initial,
        minimum,
        maximum,
        step,
        ...(disabled === undefined ? {} : { disabled }),
        state: stateReference(seconds)
      }
    : {
        kind: "countdown",
        value: seconds,
        minimum,
        maximum,
        step,
        ...(disabled === undefined ? {} : { disabled })
      };
  return nodeWithOptionalStyle(node, style);
}

function textNode(value: string | ProviderBinding | WidgetStateBinding<string | number | boolean> | WidgetChild | undefined): WidgetNode {
  if (isProviderBinding(value)) {
    return { kind: "text", provider: value.name };
  }
  if (isStateBinding(value)) {
    return stateTextNode(value);
  }
  return { kind: "text", text: value === undefined || value === null ? "" : String(value) };
}

function stateTextNode(value: WidgetStateBinding<string | number | boolean>): WidgetNode {
  return { kind: "text", state: stateReference(value) };
}

function imageSource(source: string | ImageSource): ImageSource {
  return typeof source === "string" ? { kind: "asset", name: source } : source;
}

function imageNode(source: string | ImageSource, style?: WidgetStyle, options?: WidgetImageOptions): WidgetNode {
  const node = nodeWithOptionalStyle({ kind: "image", source: imageSource(source) }, style);
  return options === undefined ? node : { ...node, options };
}

function segmentedProgressNode(value: number | ProviderBinding | WidgetStateBinding<number>, segments: number, maximum: number, style?: WidgetStyle): WidgetNode {
  const node: WidgetNode = typeof value === "number"
    ? { kind: "segmentedProgress", value, segments, maximum }
    : isStateBinding(value)
      ? { kind: "segmentedProgress", value: 0, segments, maximum, state: stateReference(value) }
      : { kind: "segmentedProgress", provider: value.name, segments, maximum };
  return nodeWithOptionalStyle(node, style);
}

function stateReference<T extends WidgetStateValue>(binding: WidgetStateBinding<T>): WidgetStateReference {
  return { key: binding.key, initial: binding.initial };
}

function isStateBinding(value: unknown): value is WidgetStateBinding {
  return isObject(value) && value.kind === "state" && typeof value.key === "string" && "initial" in value;
}

function imageOptionsFrom(props: ImageProps): WidgetImageOptions | undefined {
  const direct: WidgetImageOptions = {};
  for (const key of ["fit", "repeat", "position", "tint"] as const) {
    if (props[key] !== undefined) direct[key] = props[key] as never;
  }
  const options = { ...props.options, ...direct };
  return Object.keys(options).length === 0 ? undefined : options;
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

function isImageOptions(value: unknown): value is WidgetImageOptions {
  return isObject(value) && ["fit", "repeat", "position", "tint"].some((key) => hasProp(value, key));
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

function patternStyle(defaults: WidgetStyle, override?: WidgetStyle): WidgetStyle {
  return { ...defaults, ...override };
}

function normalizeTask(task: WidgetTaskItem): WidgetTaskItem {
  return { id: task.id, text: task.text, completed: task.completed === true };
}

function normalizeListItem(item: WidgetListItem): WidgetListItem {
  return { id: item.id, title: item.title, subtitle: item.subtitle, completed: item.completed === true };
}
