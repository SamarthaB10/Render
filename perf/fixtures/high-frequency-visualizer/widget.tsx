import { Spectrum, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "Performance high-frequency visualizer",
  "sdkVersion": "0.1.0",
  "size": { "width": 320, "height": 120 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": []
}, () => Spectrum([0.2, 0.7, 0.4, 0.9, 0.3, 0.8]));
