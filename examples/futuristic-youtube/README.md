# Neon YouTube Capsule

This example is a native Render widget with an embedded YouTube player. Change
the `videoId` in `widget.tsx` to any valid 11-character YouTube video ID.

From the repository root:

```bash
node bin/render.mjs init --workspace "$HOME/RenderWidgets/futuristic-youtube"
cp examples/futuristic-youtube/widget.tsx "$HOME/RenderWidgets/futuristic-youtube/widget.tsx"
node bin/render.mjs check --workspace "$HOME/RenderWidgets/futuristic-youtube" --json
node bin/render.mjs run --workspace "$HOME/RenderWidgets/futuristic-youtube" --json
```

The widget declares the `network` capability because the official YouTube
player loads remote media. Render keeps the player inside the native host's
isolated WebKit surface; widget source cannot provide arbitrary HTML or URLs.
