import { Animate, Text, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "Performance animated Widget",
  "sdkVersion": "0.1.0",
  "size": { "width": 240, "height": 80 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": []
}, () => Animate(Text("Animated Widget"), {
  property: "opacity",
  from: 0.5,
  to: 1,
  duration: 1000,
  easing: "ease-in-out",
  repeat: "forever"
}));
