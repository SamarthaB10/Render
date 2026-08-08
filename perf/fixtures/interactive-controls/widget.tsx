import { Button, Column, Slider, Text, Toggle, useWidgetState, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "Performance interactive controls",
  "sdkVersion": "0.1.0",
  "size": { "width": 320, "height": 180 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": []
}, () => {
  const level = useWidgetState("level", 50);
  const enabled = useWidgetState("enabled", true);
  return Column([
    Text("Interactive controls"),
    Slider({ value: level, minimum: 0, maximum: 100 }),
    Toggle(enabled),
    Button("Refresh", { type: "invoke", name: "widget.refresh" })
  ]);
});
