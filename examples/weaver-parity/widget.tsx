import {
  Button,
  Column,
  Gradient,
  Icon,
  Image,
  Row,
  SegmentedProgress,
  Slider,
  Stack,
  Text,
  Texture,
  useProvider,
  useWidgetState,
  widget
} from "@render/sdk";

const buttonInteraction = {
  cursor: "pointer",
  hover: {
    backgroundColor: "#242424",
    borderColor: "#262626"
  },
  pressed: {
    backgroundColor: "#111111",
    color: "#b6b6b6",
    opacity: 0.82,
    scale: 0.97,
    shadow: {
      kind: "inset",
      color: "#000000",
      radius: 4,
      y: 2,
      opacity: 0.45
    }
  }
};

const pixelText = {
  family: "GeistPixel-Square",
  size: 13,
  tracking: 0.7,
  tabularNumbers: true
};

export default widget({
  "schemaVersion": 1,
  "name": "Weaver-class UI Conformance",
  "sdkVersion": "0.1.0",
  "size": { "width": 340, "height": 380 },
  "anchor": { "corner": "top-right", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": ["system.time"],
  "assets": ["cover.svg", "GeistPixel-Square.ttf"],
  "fonts": [{ "asset": "GeistPixel-Square.ttf", "family": "GeistPixel-Square" }]
}, () => {
  const level = useWidgetState("level", 38);

  return Stack([
    Column([
      Stack([
        Image("cover.svg", { fit: "cover" }, { width: 312, height: 188 }),
        Texture({ kind: "builtin", name: "grid" }, { width: 312, height: 188, opacity: 0.1 }),
        Texture({ kind: "builtin", name: "grain" }, { width: 312, height: 188, opacity: 0.16 }),
        Column([
          Gradient([], [
            { color: "#00000000", position: 0 },
            { color: "#000000d9", position: 1 }
          ], { width: 312, height: 72 }),
          Row([
            Text("02:47", { width: 58, font: pixelText }),
            Text("RENDER PARITY", {
              width: 154,
              flexGrow: 1,
              font: { ...pixelText, alignment: "center", lineLimit: 1, truncation: "tail" }
            }),
            Text(useProvider("system.time"), { width: 72, font: { ...pixelText, alignment: "trailing" } })
          ], { width: 312, padding: { horizontal: 10, vertical: 6 }, gap: 4 })
        ], { width: 312, height: 188, justifyContent: "bottom" })
      ], {
        width: 312,
        height: 188,
        radius: { topLeft: 36, topRight: 36, bottomLeft: 4, bottomRight: 4 },
        border: { color: "#000000", width: 1 },
        overflow: "hidden"
      }),

      SegmentedProgress(42, 24, 100, { width: 312, color: "#ffffff" }),

      Row([
        Button({
          label: Icon("skip-back", {
            width: 28,
            height: 28,
            color: "#d0d0d0",
            interaction: { pressed: { color: "#b6b6b6" } }
          }),
          action: { type: "invoke", name: "widget.refresh" },
          style: {
            width: 100,
            flexGrow: 1,
            height: 92,
            alignItems: "center",
            justifyContent: "center",
            radius: { topLeft: 8, topRight: 8, bottomRight: 8, bottomLeft: 34 },
            backgroundColor: "#1a1a1a",
            border: { color: "#0a0a0a", width: 1 },
            shadows: [{ kind: "inset", color: "#ffffff", radius: 2, y: 1, opacity: 0.05 }],
            interaction: buttonInteraction
          }
        }),
        Button({
          label: Icon("play", {
            width: 30,
            height: 30,
            color: "#d0d0d0",
            interaction: { pressed: { color: "#b6b6b6" } }
          }),
          action: { type: "invoke", name: "widget.refresh" },
          style: {
            width: 100,
            flexGrow: 1,
            height: 92,
            alignItems: "center",
            justifyContent: "center",
            radius: 8,
            backgroundColor: "#1a1a1a",
            border: { color: "#0a0a0a", width: 1 },
            shadows: [{ kind: "inset", color: "#ffffff", radius: 2, y: 1, opacity: 0.05 }],
            interaction: buttonInteraction
          }
        }),
        Button({
          label: Icon("skip-forward", {
            width: 28,
            height: 28,
            color: "#d0d0d0",
            interaction: { pressed: { color: "#b6b6b6" } }
          }),
          action: { type: "invoke", name: "widget.refresh" },
          style: {
            width: 100,
            flexGrow: 1,
            height: 92,
            alignItems: "center",
            justifyContent: "center",
            radius: { topLeft: 8, topRight: 8, bottomRight: 34, bottomLeft: 8 },
            backgroundColor: "#1a1a1a",
            border: { color: "#0a0a0a", width: 1 },
            shadows: [{ kind: "inset", color: "#ffffff", radius: 2, y: 1, opacity: 0.05 }],
            interaction: buttonInteraction
          }
        })
      ], { width: 312, gap: 6 }),

      Row([
        Text("LEVEL", { width: 54, color: "#a3a3a3", font: pixelText }),
        Slider({
          value: level,
          minimum: 0,
          maximum: 100,
          step: 1,
          style: {
            width: 214,
            flexGrow: 1,
            height: 14,
            color: "#d0d0d0",
            interaction: {
              cursor: "pointer",
              hover: { opacity: 0.92 },
              pressed: { color: "#a5b4fc", scale: 0.99 }
            }
          }
        }),
        Text(level, { width: 28, color: "#ffffff", font: { ...pixelText, alignment: "trailing" } })
      ], { width: 312, alignItems: "center", gap: 8 })
    ], {
      width: 340,
      height: 380,
      padding: 14,
      gap: 10,
      radius: 51,
      color: "#ffffff",
      backgroundColor: "#1a1a1a",
      border: { color: "#000000", width: 1 },
      shadows: [
        { kind: "inset", color: "#ffffff", radius: 2, y: 1, opacity: 0.1 },
        { kind: "outset", color: "#000000", radius: 18, y: 10, opacity: 0.45 }
      ],
      overflow: "hidden"
    }),
    Texture({ kind: "builtin", name: "grain" }, {
      width: 340,
      height: 380,
      color: "#ffffff",
      opacity: 0.05,
      radius: 51,
      overflow: "hidden"
    })
  ], { width: 340, height: 380, radius: 51, overflow: "hidden" });
});
