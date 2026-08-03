import { Box, Column, Divider, Row, Text, YouTubePlayer, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "Neon YouTube Capsule",
  "sdkVersion": "0.1.0",
  "size": { "width": 520, "height": 360 },
  "anchor": { "corner": "top-right", "offset": { "x": 24, "y": 24 } },
  "capabilities": ["network"],
  "subscribe": []
}, () => Box([
  Column([
    Row([
      Text("NEON // MEDIA", {
        color: "#7dd3fc",
        font: { size: 12, weight: "bold", monospace: true }
      }),
      Text("ONLINE", {
        color: "#86efac",
        font: { size: 11, weight: "semibold", monospace: true }
      })
    ], { justifyContent: "space-between" }),
    Divider("horizontal", { color: "#164e63" }),
    YouTubePlayer({
      videoId: "M7lc1UVf-VE",
      allowLinkInput: true,
      controls: true,
      style: { width: 480, height: 270, radius: 16 }
    }),
    Text("YOUTUBE UPLINK // READY", {
      color: "#a5f3fc",
      font: { size: 11, weight: "medium", monospace: true }
    })
  ], { gap: 12 })
], {
  width: 520,
  height: 360,
  padding: 20,
  radius: 22,
  backgroundColor: "#07131c",
  border: { color: "#155e75", width: 1, radius: 22 },
  shadow: { color: "#22d3ee", radius: 18, opacity: 0.25 },
  tokens: ["surface.elevated"]
}));
