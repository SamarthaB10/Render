import type {
  WidgetAnchorCorner,
  WidgetAction,
  WidgetConnectorName,
  WidgetCornerRadii,
  WidgetFont,
  WidgetLength,
  WidgetShadow,
  WidgetSpacing,
  WidgetStyle,
  WidgetProviderName
} from "../packages/sdk/src/index.ts";

export const generatedWireTypes: {
  invoke: WidgetAction;
  set: WidgetAction;
} = {
  invoke: { type: "invoke", name: "widget.refresh" },
  set: { type: "set", name: "spotify.set-volume", value: 50 }
};

// @ts-expect-error set operations are limited by the canonical action schema.
export const invalidSetAction: WidgetAction = { type: "set", name: "widget.refresh", value: 1 };

export const contractTypes: {
  anchor: WidgetAnchorCorner;
  connector: WidgetConnectorName;
  provider: WidgetProviderName;
} = {
  anchor: "top-left",
  connector: "spotify",
  provider: "system.cpu"
};

const percent: WidgetLength = { unit: "percent", value: 50 };
const fraction: WidgetLength = { unit: "fraction", value: 1 };
const spacing: WidgetSpacing = { horizontal: 12, vertical: 8, top: 10 };
const radii: WidgetCornerRadii = { topLeft: 16, bottomRight: 16 };
const font: WidgetFont = {
  size: 14,
  leading: 18,
  tracking: 0.2,
  alignment: "center",
  lineLimit: 2,
  tabularNumbers: true,
  truncation: "tail"
};
const shadows: WidgetShadow[] = [
  { kind: "outset", color: "#000000", radius: 8, y: 4, opacity: 0.3 },
  { kind: "inset", color: "#ffffff", radius: 1 },
  { kind: "text", color: "#000000", radius: 2, y: 1 }
];

export const expandedStyle: WidgetStyle = {
  width: percent,
  height: "auto",
  minWidth: 120,
  maxWidth: { unit: "percent", value: 100 },
  minHeight: "fit",
  maxHeight: "fill",
  aspectRatio: 16 / 9,
  padding: spacing,
  margin: { horizontal: -4 },
  alignSelf: "center",
  flexGrow: 1,
  flexShrink: 0,
  flexBasis: fraction,
  flexWrap: "wrap",
  radius: radii,
  shadows,
  font,
  overflow: "clip"
};

export const compatibleStyle: WidgetStyle = {
  width: 120,
  height: "fill",
  padding: 8,
  radius: 12,
  shadow: { radius: 4 }
};
