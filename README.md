# Render

Render is a local macOS desktop-widget platform. Users ask an agent for a widget, and the agent authors a native declarative widget as a TypeScript/TSX module, validates it, and launches it directly on the desktop.

The north-star request is:

> I need a mini 4x4 widget that plays my Spotify music.

The current reference implementation is a native CPU/RAM widget. It proves the agent-to-desktop workflow, not the full Spotify integration yet.

## What works today

- Native macOS desktop-layer rendering through SwiftUI/AppKit.
- One active widget per workspace.
- `widget.tsx` as the readable source of truth.
- A canonical `@render/sdk` with native layout, content, image, control, task-list, timer, list, progress, provider, action, and typed-style contracts.
- Automatic TSX compilation to a serializable declarative tree; no DOM, HTML, CSS, browser runtime, or webview.
- Agent-readable SDK discovery through `render sdk list --json` and `render sdk describe <name> --json`.
- Workspace-scoped validation, running, watch mode, logical movement, snapshots, rollback, and last-known-good recovery.
- An experimental fleet lifecycle seam can run, inspect, reconcile, and stop multiple isolated widget workspaces with repeated `--workspace` flags; each workspace keeps its own snapshots and runtime metadata.
- Host-owned CPU, memory, and local-time providers.
- Native dragging and persisted placement for the first prototype.
- Host-owned adjustable sizing with native resize handles, persisted size and lock state, responsive modes, and a settings-panel mode selector.
- Host-owned countdown timers and editable task lists with start/pause/reset, duration editing, completion, add/remove, direct editing, reorder, clear-completed, and persisted state.
- Native `ScrollView` and persistent multiline `TextEditor` primitives; stateful nodes can use stable keys so user edits survive remixes and reordering.
- Native `DateTime` display and persistent `DateTimePicker` controls for date, time, or combined date-time values.
- Generic host-owned account requirements with secure macOS Keychain storage.
- A Spotify connector for current playback, track metadata, play/pause, previous/next, and volume control.
- A macOS Reminders connector with permission-gated account state, incomplete-count and next-reminder providers, and explicit create/update/complete/delete actions.
- A generic native `List` primitive for static rows or structured provider-backed rows such as `reminders.items`.
- A native `YouTubePlayer` primitive backed by an isolated WebKit surface, with explicit network capability, validated video IDs, and an optional persisted link-input toggle.
- Render-owned Spotify permission prompt and a liquid-glass widget settings panel with metadata and a confirmed stop control.

MCP is not required for this prototype. The agent boundary is the deterministic local CLI plus the checked-in widget-authoring skill. MCP can wrap that stable contract later if broader interoperability requires it.

## Requirements

- macOS 13 or newer.
- Git.
- Node.js 20 or newer and npm.
- Swift 5.8 or newer with the macOS Command Line Tools.

Full Xcode is not required for the current Swift Package Manager build. If the command-line tools are missing, install them with:

```bash
xcode-select --install
```

Verify the toolchain before continuing:

```bash
swift --version
node --version
npm --version
```

## Download and build on a Mac

Clone the repository, install the TypeScript toolchain, and build the native host:

```bash
git clone https://github.com/SamarthaB10/Render.git
cd Render
npm install
swift build
npm run package:host
```

`swift build` produces the development executable at `.build/debug/RenderHost`. `npm run package:host` additionally creates and ad-hoc signs `.build/debug/RenderHost.app`, embedding the macOS usage metadata needed for permission-gated providers such as Reminders. Set `RENDER_SIGNING_IDENTITY` when using a local signing identity. The repository's Node CLI is `bin/render.mjs`; while working from the checkout, invoke it with `node bin/render.mjs`.

## Create and run your first widget

Create an isolated workspace outside the repository. The scaffold writes a canonical `widget.tsx` and the `.render/` runtime state:

```bash
mkdir -p "$HOME/RenderWidgets"
node bin/render.mjs scaffold --workspace "$HOME/RenderWidgets/system-monitor"
node bin/render.mjs check --workspace "$HOME/RenderWidgets/system-monitor" --json
node bin/render.mjs run --workspace "$HOME/RenderWidgets/system-monitor" --json
```

`run` automatically prefers `.build/debug/RenderHost.app/Contents/MacOS/RenderHost` and falls back to the raw SwiftPM executable. To select a specific host binary, set `RENDER_HOST_PATH`:

```bash
RENDER_HOST_PATH="$PWD/.build/debug/RenderHost" \
  node bin/render.mjs run --workspace "$HOME/RenderWidgets/system-monitor" --json
```

Confirm that the native worker is ready:

```bash
node bin/render.mjs status --workspace "$HOME/RenderWidgets/system-monitor" --json
```

For multiple widgets, use the fleet commands. They persist a local registry at
`~/.render/fleet.json` (or the path supplied with `--state-path`) and keep each
workspace's lifecycle state separate:

```bash
node bin/render.mjs fleet run \
  --workspace "$HOME/RenderWidgets/system-monitor" \
  --workspace "$HOME/RenderWidgets/study-timer" \
  --json
node bin/render.mjs fleet status \
  --workspace "$HOME/RenderWidgets/system-monitor" \
  --workspace "$HOME/RenderWidgets/study-timer" \
  --json
node bin/render.mjs fleet stop \
  --workspace "$HOME/RenderWidgets/system-monitor" \
  --workspace "$HOME/RenderWidgets/study-timer" \
  --json
node bin/render.mjs fleet relaunch --json
```

This is the first fleet slice, not the final crash-isolated architecture: the
commands orchestrate the existing per-widget host boundary. The future
host-managed supervisor will preserve this contract while giving every widget
its own worker process and restart policy. `fleet relaunch` consumes the
persisted registry, which is the lifecycle seam a future login item will call.

The status response should report a running widget and, when the native supervisor is active, `worker.status` as `ready`. The widget appears on the desktop at its logical anchor. The first prototype can be dragged by the user, and its placement is persisted by the native host.

For iterative editing, keep the widget live while watching its source:

```bash
node bin/render.mjs run \
  --workspace "$HOME/RenderWidgets/system-monitor" \
  --watch
```

Press `Ctrl-C` to stop watch mode. To stop a detached native host immediately, use the process ID reported by `status --json` and send it `SIGTERM`:

```bash
kill <process-id>
```

## The widget contract: TypeScript modules, not web pages

Every widget is a TypeScript module at `<workspace>/widget.tsx`. It must default-export the result of `widget(manifest, render)`, import its building blocks from `@render/sdk`, and return a serializable native tree.

This is a valid widget module using the automatic TSX runtime:

```tsx
import { Column, Gauge, Text, useProvider, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "System Monitor",
  "sdkVersion": "0.1.0",
  "size": { "width": 320, "height": 180 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": ["system.cpu", "system.memory"]
}, () => (
  <Column style={{ "gap": 8, "padding": 16, "backgroundColor": "#111827", "radius": 12 }}>
    <Text style={{ "font": { "size": 18, "weight": "semibold" } }}>System Monitor</Text>
    <Text>CPU</Text>
    <Gauge value={useProvider("system.cpu")} maximum={100} />
    <Text>Memory</Text>
    <Gauge value={useProvider("system.memory")} maximum={100} />
  </Column>
));
```

### Adjustable widgets and responsive modes

Widgets that should be resizable declare the host-owned adjustable contract in their manifest. The widget receives the active mode and current size as the optional render context; existing widgets that use `() => ...` remain valid.

```tsx
import { Column, Text, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "Responsive Notes",
  "sdkVersion": "0.1.0",
  "size": { "width": 320, "height": 220 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": [],
  "adjustable": {
    "enabled": true,
    "minSize": { "width": 220, "height": 160 },
    "maxSize": { "width": 720, "height": 640 },
    "responsive": {
      "modes": {
        "compact": { "minWidth": 220, "minHeight": 160 },
        "regular": { "minWidth": 320, "minHeight": 220 },
        "expanded": { "minWidth": 520, "minHeight": 360 }
      },
      "default": "regular"
    }
  }
}, ({ mode, size }) => Column([
  Text(mode),
  Text(`${Math.round(size?.width ?? 320)} × ${Math.round(size?.height ?? 220)}`)
]));
```

The native host owns resize handles, placement, lock state, and the settings gear. Runtime preferences are stored in the workspace and are not part of shared widget source. Agents can also operate the same contract explicitly:

```bash
node bin/render.mjs resize --workspace "$WORKSPACE" --width 420 --height 300 --json
node bin/render.mjs mode --workspace "$WORKSPACE" --mode compact --json
node bin/render.mjs mode --workspace "$WORKSPACE" --mode auto --json
node bin/render.mjs reset-size --workspace "$WORKSPACE" --json
```

`resize` clamps to the declared bounds and `mode` accepts only declared responsive modes. `Auto` chooses the largest mode that fits the current size. Invalid requests produce a repairable JSON diagnostic and do not replace the active widget.

The function-call form generated by `scaffold` is also valid. Both forms produce the same native `WidgetNode` tree. Do not use `<div>`, CSS, `document`, `window`, React DOM, HTML, browser APIs, webviews, or private native APIs. Intrinsic HTML elements are intentionally not part of Render's TypeScript JSX contract.

The manifest is explicit:

- `size` controls the native surface size.
- `anchor` uses `top-left`, `top-right`, `bottom-left`, or `bottom-right` plus offsets. Agents should use logical anchors, never raw screen coordinates.
- `capabilities` declares machine access such as `network`, `filesystem.read`, or `filesystem.write`.
- `subscribe` declares host providers used by the tree.
- `accounts` declares a trusted connector and exact OAuth scopes. RenderHost owns the browser authorization flow, refresh, and tokens.

A capability declaration is not user consent. If a widget needs network, filesystem, account, or other protected access, the agent must explain the need and ask the user before using it. Never put credentials or tokens in `widget.tsx`.

### Configure Spotify for local development

Spotify's desktop-safe Authorization Code with PKCE flow does not need a
client secret. Create or use a Spotify developer app, add the loopback
redirect URI `http://127.0.0.1:8080` to its allowlist, then export its client ID
before launching Render:

```bash
export RENDER_SPOTIFY_CLIENT_ID="your-spotify-client-id"
```

Render listens on loopback port 8080, opens the system browser, validates the
OAuth state and PKCE callback, and stores credentials in the macOS Keychain.
If port 8080 is occupied, set `RENDER_SPOTIFY_REDIRECT_PORT` to another local
port and register the matching `http://127.0.0.1:<port>` URI in Spotify.
The widget never receives an access token. If this variable is absent, Spotify
widgets remain visible but show an explicit unavailable/connect state.

The first connector asks only for playback/account scopes:

```tsx
"accounts": [{
  "connector": "spotify",
  "scopes": [
    "user-read-private",
    "user-read-playback-state",
    "user-read-currently-playing",
    "user-modify-playback-state"
  ]
}]
```

The native host uses Spotify's current playback endpoints and returns explicit
loading, unavailable, permission, and rate-limit states. Spotify OAuth can
succeed while playback remains unavailable: Spotify playback APIs require an
active Premium account, and Spotify may return HTTP 403 when that requirement
is not met. Render never substitutes fake playback data.

## Spotify widget module

This is the shape an agent can generate after discovering the catalog. It is a
TypeScript module, not a web page:

```tsx
import { Button, Column, Progress, Text, useProvider, widget } from "@render/sdk";

export default widget({
  "schemaVersion": 1,
  "name": "Spotify Mini Player",
  "sdkVersion": "0.1.0",
  "size": { "width": 320, "height": 180 },
  "anchor": { "corner": "top-left", "offset": { "x": 24, "y": 24 } },
  "capabilities": [],
  "subscribe": [
    "spotify.account",
    "spotify.track.title",
    "spotify.track.artist",
    "spotify.playback.isPlaying",
    "spotify.playback.progress",
    "spotify.playback.volume"
  ],
  "accounts": [{
    "connector": "spotify",
    "scopes": [
      "user-read-private",
      "user-read-playback-state",
      "user-read-currently-playing",
      "user-modify-playback-state"
    ]
  }]
}, () => Column([
  Text(useProvider("spotify.track.title")),
  Text(useProvider("spotify.track.artist")),
  Text(useProvider("spotify.playback.isPlaying")),
  Progress(useProvider("spotify.playback.progress"), 100),
  Progress(useProvider("spotify.playback.volume"), 100),
  Button("Play", { type: "invoke", name: "spotify.play" }),
  Button("Pause", { type: "invoke", name: "spotify.pause" }),
  Button("Next", { type: "invoke", name: "spotify.next" })
]));
```

## How an agent should build a widget

Agents should follow this exact sequence from the repository checkout. The catalog is authoritative; an agent must not invent a primitive, provider, action, style field, or capability because it sounds reasonable.

```bash
# 1. Discover the SDK contract
node bin/render.mjs sdk list --json
node bin/render.mjs sdk describe Column --json
node bin/render.mjs sdk describe system.cpu --json

# 2. Create an isolated workspace
node bin/render.mjs scaffold --workspace "$WORKSPACE"

# 3. Write or remix the TypeScript module
#    Edit: "$WORKSPACE/widget.tsx"

# 4. Validate before changing the running widget
node bin/render.mjs check --workspace "$WORKSPACE" --json

# 5. Launch and wait for the native ready state
node bin/render.mjs run --workspace "$WORKSPACE" --json
node bin/render.mjs status --workspace "$WORKSPACE" --json

# 6. Keep edits live and update the existing widget in place
node bin/render.mjs run --workspace "$WORKSPACE" --watch

# 7. Move using the logical placement contract
node bin/render.mjs move --workspace "$WORKSPACE" \
  --corner top-right --offset-x 24 --offset-y 24 --json

# 8. Resize or select a declared responsive mode without editing source
node bin/render.mjs resize --workspace "$WORKSPACE" --width 420 --height 300 --json
node bin/render.mjs mode --workspace "$WORKSPACE" --mode regular --json

# 9. Restore a prior successful snapshot after a failed remix
node bin/render.mjs rollback --workspace "$WORKSPACE" \
  --version <snapshot-version>
```

The agent should preserve the last-known-good widget when a candidate fails. `check` diagnostics are the source of truth: each failure identifies the path and the repair needed. `status --json` exposes lifecycle, worker, restart, resource, and diagnostic state.

The complete agent procedure is checked in at [`skills/render-widget/SKILL.md`](skills/render-widget/SKILL.md). A fresh agent should read that file before authoring a widget.

## SDK discovery

The SDK catalog is generated from the checked-in SDK contract and is available to both humans and agents:

```bash
node bin/render.mjs sdk list --json
node bin/render.mjs sdk describe Text --json
node bin/render.mjs sdk describe Button --json
node bin/render.mjs sdk describe system.memory --json
```

The catalog currently exposes these implemented families:

- Layout: `Column`, `Row`, `Stack`, `Box`, `GlassPanel`, `MediaCard`, `Spacer`, `Divider`, `ScrollView`, `Grid`.
- Collections: `List` for static rows or structured provider-backed rows; `TaskList` remains the editable task-specific primitive.
- Media: `YouTubePlayer` for official embedded playback inside a native widget surface; `Artwork` for clipped media; `Visualizer` for honest clock-driven playback response; use a valid 11-character YouTube video ID.
- Content and visuals: `Text`, editable native `TextField`, native `Toggle`, `Shape`, `Icon`, native asset `Image`.
- Controls and progress: `Button`, `TransportControls`, `Gauge`, `Progress`.
- Data and lifecycle: `useProvider`, typed provider states, `widget.refresh`, `widget.reload`, and the worker protocol types.
- Styles: typed color, sizing, spacing, alignment, radius, border, shadow, font, opacity, semantic tokens, materials, roles, density, and selectable themes (`dark-glass`, `light`, `monochrome`, `retro`). `radius` clips child content as well as rounding the surface, so embedded media fits cleanly inside curved cards; `border` controls the stroke color, width, and optional corner radius.

### Native visual language

The default Render surface is a restrained dark-glass system: rounded native cards, semantic hierarchy, quiet borders, and purposeful motion. Agents should start with `GlassPanel`, `MediaCard`, `Artwork`, `TransportControls`, and `Visualizer`, then use documented `WidgetStyle` fields for the requested visual direction. Explicit user styling wins over defaults, but arbitrary DOM/CSS and private native views are never widget primitives. Every widget also receives host-managed settings, resize, lock, and recovery chrome with keyboard-accessible focus behavior.

For a theme-aware widget, declare the available variants in the manifest:

```tsx
theme: {
  default: "dark-glass",
  options: ["dark-glass", "light", "monochrome", "retro"]
}
```

The host stores the selected theme, size, mode, lock state, and placement locally. Sharing or remixing a widget carries its declared defaults and responsive rules, not another user's desktop preferences. `Visualizer` is intentionally honest: it can respond to playback metadata and the host clock, but it does not invent audio data or change Spotify playback tempo.

For a retro treatment, agents can layer `Box`, `Stack`, `Shape`, `Text`, and `Divider`, then use `radius`, `border`, `shadow`, monospace fonts, and explicit colors to build curved panels, inset frames, pill controls, and neon or CRT-like accents. The catalog intentionally does not expose arbitrary CSS or HTML.

The catalog also marks contract-only and planned items. Current limitations are deliberate:

- `system.cpu`, `system.memory`, and `system.time` are the implemented local providers.
- URL/provider-backed images are rejected until capability-backed providers ship; native asset images are supported.
- Spotify is the first implemented authenticated connector. It currently covers account status, current playback metadata, play/pause, previous/next, and volume; playlists, search, library, history, and artwork retrieval are separate future connector surfaces.
- Spotify requires a local client ID and user consent; without either, the host reports the reason instead of using fake data.
- Reminders requires native macOS full access. The host keeps EventKit objects and reminder identifiers out of widget source; the packaged host must include `NSRemindersFullAccessUsageDescription` for the system permission prompt.
- `YouTubePlayer` requires the manifest `network` capability. Set `allowLinkInput: true` to expose a native toggle and persisted link editor in the widget's hover settings panel for `youtube.com` or `youtu.be` links; source code still cannot provide arbitrary HTML, iframe markup, or URLs.
- One active widget, local development, and a locally packaged host are the current scope; notarization and distribution are future work.
- `TextField` supports direct editing during the current widget session. `Timer` and `TaskList` provide host-owned persisted interaction state; `TaskList` supports direct task editing, completion, adding, and removal. Use `render sdk describe Timer --json`, `render sdk describe TaskList --json`, and `render sdk describe WidgetTaskItem --json` for the exact contracts.
- For Reminders widgets, inspect `reminders`, `reminders.account`, `reminders.items`, `reminders.incompleteCount`, `reminders.next.title`, `reminders.next.dueDate`, and the four `reminders.*` actions before authoring. Use `List(useProvider("reminders.items"))` for native read-only rows, and declare `reminders.read`; add `reminders.write` when the widget edits the user’s lists.

If the catalog cannot express a requested feature, the agent should report the missing contract instead of generating a fake integration or falling back to web technology.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install the local TypeScript compiler and lockfile dependencies |
| `npm run typecheck` | Type-check the SDK and JSX runtime |
| `npm test` | Run the Node test suite |
| `swift build` | Build the native macOS host |
| `swift test` | Run Swift package tests |
| `npm run package:host` | Build an ad-hoc signed `RenderHost.app` with permission metadata |
| `npm run measure:performance` | Run the checked-in performance measurements |
| `node bin/render.mjs sdk list --json` | Discover the agent-readable SDK catalog |
| `node bin/render.mjs check --workspace <path> --json` | Validate a widget without promoting it |
| `node bin/render.mjs run --workspace <path> --json` | Launch or promote a widget |
| `node bin/render.mjs status --workspace <path> --json` | Inspect live state and diagnostics |

Run the full local verification after a checkout or implementation change:

```bash
npm run typecheck
npm test
swift build
swift test
```

## Repository layout

```text
bin/render.mjs                 Workspace-scoped CLI
packages/sdk/src/              TypeScript SDK, JSX runtime, and catalog
skills/render-widget/          Agent authoring procedure
src/                           Workspace, validation, runtime, and worker code
Sources/                       Native SwiftUI/AppKit host and supervisor
Tests/                         Swift tests
test/                          Node tests
perf/receipts/                 Performance evidence and measured limits
ImplementationDoc.md           Product and architecture roadmap
FutureRoadmap.md               Post-prototype platform roadmap
AGENTS.md                      Project rules for humans and agents
```

Read [`ImplementationDoc.md`](ImplementationDoc.md) for the full product direction and phase history. The project is intentionally building toward crash-resistant, separately isolated widgets and a broad provider/action/capability system while keeping the first local path small and inspectable.

The post-prototype platform plan is in [`FutureRoadmap.md`](FutureRoadmap.md). It covers the one-click installer, independent widget processes, seamless relaunch after login and wake, safe agent remixes, and the expansion of the native SDK primitive catalog.

## Contributing

Keep changes focused, preserve the native SDK boundary, and update the agent skill and catalog whenever a public widget contract changes. A new primitive is not complete until its TypeScript type, catalog entry, TSX/runtime behavior, native renderer, validation, tests, agent documentation, and performance evidence agree.

Before committing, run the verification commands above and inspect the staged diff. Use a focused Conventional Commit such as:

```text
docs(readme): document macOS setup and widget authoring
```
