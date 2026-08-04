import {
  Animate,
  Box,
  Column,
  Gradient,
  Icon,
  Image,
  Row,
  SegmentedProgress,
  Spectrum,
  Text,
  Texture,
  widget
} from "@render/sdk";

// Native visual SDK reference fixture. It intentionally uses static artwork
// values and does not claim service-specific providers or playback support.
const spectrumValues = [0.22, 0.48, 0.36, 0.74, 0.58, 0.88, 0.44, 0.3];

export default widget({
  "schemaVersion": 1,
  "name": "Visual Shell Fixture",
  "sdkVersion": "0.1.0",
  "size": { "width": 360, "height": 220 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": [],
  "assets": ["album-art-placeholder.svg"]
}, () => Box([
  Texture({ "kind": "builtin", "name": "grain" }),
  Texture({ "kind": "builtin", "name": "grid" }),
  Gradient([], [
      { "color": "#17122d", "position": 0 },
      { "color": "#44245f", "position": 1 }
  ]),
  Column([
    Row([
      Image({ "kind": "asset", "name": "album-art-placeholder.svg" }),
      Column([
        Text("Visual shell"),
        Text("Static artwork fixture"),
        Row([
          Icon("play"),
          Icon("skip-forward")
        ])
      ])
    ]),
    SegmentedProgress({ "value": 42, "maximum": 100, "segments": 12 }),
    Spectrum({ "values": spectrumValues, "maximum": 1 }),
    Animate(Text("Native visual contract"), {
      "property": "opacity",
      "from": 0.82,
      "to": 1,
      "duration": 1200,
      "easing": "ease-in-out",
      "repeat": "forever"
    })
  ], {
    "padding": 18,
    "gap": 12,
    "radius": 20,
    "color": "#ffffff"
  })
]));
