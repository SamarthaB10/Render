import { Column, Text, useProvider, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "Performance provider-driven Widget",
  "sdkVersion": "0.1.0",
  "size": { "width": 260, "height": 100 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": ["system.cpu"]
}, () => Column([
  Text("Provider-driven Widget"),
  Text(useProvider("system.cpu"))
]));
