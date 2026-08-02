# Render ImplementationDoc

## Status

Implementation roadmap for the first Render prototype. The product and architecture decisions in this document were confirmed before implementation began.

The decision map is recorded in the closed [Render: first local macOS widget foundation](https://github.com/SamarthaB10/Render/issues/1) issue and its linked tickets.

## Destination

Build a local macOS experience where a user asks Codex to create one CPU/RAM widget, the widget appears directly on the desktop, and the user can remix it conversationally without manually editing code.

The first proof is:

1. Ask Codex for a CPU/RAM monitor.
2. The agent creates or updates a dedicated widget workspace.
3. The native macOS runtime renders the widget at the top-left of the primary display.
4. CPU and RAM values update once per second.
5. The widget persists and relaunches after macOS login.
6. Ask Codex to make it blue; the widget updates in place.
7. Ask Codex to move it to the top-right; the widget moves using a logical anchor.
8. Introduce a failing remix; the last-known-good widget remains running.

## Product contract

### User experience

- Codex or another coding agent is the primary interface.
- The user does not need to operate a separate builder UI.
- Generated code runs automatically after the agent updates the workspace.
- The first prototype supports one active widget.
- Remixing updates that widget in place rather than creating a second widget.
- The user can drag the generated first-prototype widget, and its screen placement persists.
- The widget is a true desktop-layer surface, not a browser or ordinary floating app window.

### First prototype scope

- Native macOS rendering.
- One CPU/RAM widget.
- Local CPU/RAM providers only.
- TypeScript/TSX authoring.
- A canonical `@render/sdk`.
- A deterministic local `render` CLI.
- A Render agent skill that turns natural-language requests into source edits and CLI operations.
- A dedicated local widget workspace.
- Persistent active-widget registration and relaunch.
- Immutable Render snapshots and last-known-good rollback.
- Capability declarations and permission prompts for future resource access.

### Explicitly deferred

- MCP and XPC. The first prototype uses the local CLI and agent skill. MCP may later wrap the stable CLI contract if broader agent interoperability requires it.
- Multiple simultaneous widgets.
- Separate widget worker processes in the first prototype.
- Sharing, publishing, galleries, and marketplace workflows.
- iPhone and iPad support.
- Third-party APIs and network integrations in the first CPU/RAM proof.
- Editing unrelated user projects.
- Developer ID notarization, installer, updater, and App Store distribution.

## Non-negotiable project principles

See [AGENTS.md](AGENTS.md) for the complete guidance. The implementation must preserve these principles:

- Performance is part of the product. Memory and CPU usage are not polish work.
- Every numeric limit needs a measurement receipt before it becomes an enforced tripwire.
- Capacity should be generous until real usage is measured.
- APIs and errors must be useful to both a human and an agent.
- A budget failure must name the budget, the limit, and the observed ask.
- Prefer the obvious solution and refuse work the product does not need yet.
- Keep architecture boundaries simple and explicit.

## Architecture

```mermaid
flowchart TD
    U[User request in Codex] --> A[Render agent skill]
    A --> S[Dedicated widget workspace]
    A --> C[render check]
    C -->|valid| R[render run or render run --watch]
    R --> H[Native Render host]
    H --> J[Embedded JavaScript engine]
    J --> T[Serializable widget tree and actions]
    T --> N[SwiftUI content renderer]
    H --> W[AppKit desktop-layer window]
    W --> D[macOS desktop]
    H --> P[Host-owned providers and timers]
    P --> J
```

### Agent boundary

The first agent boundary is a local CLI plus an agent skill:

- The agent skill interprets the user's natural-language request.
- The agent edits `widget.tsx` and related workspace files.
- `render check` validates the candidate without mutating the running widget.
- `render run` ensures the native host is running and returns when the widget is live.
- `render run --watch` observes source changes and hot-reloads successful candidates.
- `render status`, `render move`, and `render rollback` expose deterministic lifecycle operations.
- Human-readable output is the default.
- `--json` is the stable machine-readable contract for agents.
- MCP is not part of this first boundary.

### Native host boundary

The native macOS host owns:

- Native windows and desktop-layer behavior.
- SwiftUI rendering of declarative content.
- AppKit window configuration, placement, Spaces behavior, click-through, and interaction mode.
- Host-owned providers and timer scheduling.
- Capability enforcement and permission prompts.
- Active widget registration and relaunch.
- Candidate validation, promotion, rollback, and diagnostics.

Generated widget code does not own native windows and does not access arbitrary native APIs.

### TypeScript execution boundary

- TypeScript is the authoring format.
- The runtime transpiles TypeScript locally to JavaScript.
- An embedded JavaScript engine executes the generated JavaScript.
- The exact embedded engine and transpilation implementation remain implementation choices, subject to native macOS constraints and measured performance.
- Widget code returns a serializable, platform-neutral declarative tree.
- Events emit serializable action messages rather than arbitrary serialized closures.

### Future supervisor and worker boundary

The first prototype may run one widget in-process, but it must preserve the boundary required for later isolation:

- A native supervisor owns lifecycle, windows, providers, permissions, identity, placement, rollback, restart policy, and compatibility.
- Each widget worker executes TypeScript and emits serialized trees and actions.
- Workers never own native macOS windows or unrestricted native resources.
- Workers are disposable and independently restartable from the last-known-good snapshot.
- Supervisor-worker communication uses a versioned protocol with compatibility negotiation.
- CPU, memory, wakeups, and frame cadence are measured before becoming per-widget tripwires.

## Workspace and source contract

The widget workspace is the durable source of truth. The first implementation should keep the layout obvious:

```text
<widget-workspace>/
  widget.tsx             # canonical authored entrypoint
  .render/
    metadata/            # workspace and SDK metadata
    snapshots/           # immutable candidate and known-good snapshots
    logs/                # runtime and validation diagnostics
    runtime/             # local runtime state that belongs to this workspace
```

The exact metadata filenames may be chosen during implementation, but durable widget state must not be hidden in a global directory. App Support may contain only global runtime metadata such as the active-workspace pointer, process state, and connection state.

### Manifest shape

The manifest lives in the TypeScript entrypoint through a wrapper similar to:

```tsx
import { widget, Column, Text, useProvider, useTimer } from "@render/sdk";

export default widget(
  {
    schemaVersion: 1,
    name: "System Monitor",
    sdkVersion: "...",
    size: { width: 320, height: 180 },
    anchor: { corner: "top-left", offset: { x: 24, y: 24 } },
    capabilities: [],
    subscribe: ["system.cpu", "system.memory"],
  },
  () => {
    // Return the declarative widget tree here.
  },
);
```

The exact public API is finalized by the SDK implementation, but these rules are fixed:

- `schemaVersion` is required.
- `sdkVersion` is locked and checked for compatibility.
- `name` is human-facing identity.
- `size` is required.
- `anchor` defaults to the top-left of the primary display.
- The runtime, not the agent, generates the stable `widgetId`.
- Capabilities are explicit and fine-grained, such as `network`, `filesystem.read`, and `filesystem.write`.
- Provider subscriptions are explicit.
- Unknown or malformed fields fail `render check` with source locations.

## Render SDK

`@render/sdk` is the canonical source of truth for primitives, providers, styles, actions, and capability types.

### Initial primitive slice

The first native renderer implements:

- `Column`
- `Row`
- `Stack`
- `Text`
- `Shape`
- `Gauge`

This is the first slice of a larger Render SDK. Agents compose from the SDK; they do not invent ad-hoc primitives or bypass the native renderer.

### Style and layout rules

- Use typed style props for colors, spacing, radius, opacity, and other native properties.
- Use `Column`, `Row`, and `Stack` with explicit spacing, alignment, and sizing.
- Do not expose DOM, HTML, browser APIs, CSS layout, or a webview.
- Defer arbitrary absolute positioning until a real widget requires it.

### Providers and timers

- Widgets access host data through hooks such as `useProvider("system.cpu")`.
- The host collects and fans out only subscribed providers.
- An unavailable provider returns an explicit unavailable state, never fake or silently stale data.
- Time-based updates use host-scheduled hooks such as `useTimer`, not arbitrary `setInterval` calls.
- The CPU/RAM prototype refreshes once per second.

### Actions

Events emit declarative actions, for example an action to open a URL or request a supported host operation. The host is the enforcement point for capability checks.

### SDK catalog and discovery

- Generate a machine-readable catalog from `@render/sdk`.
- Generate agent-facing documentation from the same catalog.
- Provide `render sdk list`.
- Provide `render sdk describe <name>`.
- Lock each widget to an SDK/catalog version using semantic versioning.
- A primitive becomes available only when its SDK type, generated catalog entry, and native renderer implementation ship together.
- `render check` rejects unsupported or incomplete primitives.

## CLI and agent workflow

### Commands

The first CLI uses explicit workspace-scoped subcommands:

| Command | Purpose |
| --- | --- |
| `render init` | Create or initialize a dedicated widget workspace. |
| `render check` | Purely validate source, manifest, SDK imports, capabilities, and provider subscriptions. |
| `render run` | Ensure the native host is running in the background and return when the widget is live. |
| `render run --watch` | Keep the CLI attached and hot-reload successful source changes. |
| `render status` | Report widget, host, snapshot, provider, permission, and failure state. |
| `render move` | Update logical anchor and offset without using raw screen coordinates. |
| `render rollback` | Select and relaunch a known-good snapshot. |
| `render sdk list` | List primitives, providers, styles, actions, and capabilities. |
| `render sdk describe <name>` | Show the exact current SDK contract for one catalog item. |

Natural-language remixing is an agent-skill workflow, not an embedded CLI model:

1. The user asks Codex to change the widget.
2. The agent edits the workspace source.
3. The agent runs `render check`.
4. The agent triggers or observes the host reload.
5. The host promotes only a candidate that compiles, renders, and runs.

### Structured output

Human-readable output is the default. Every command that agents need to automate supports `--json` with stable fields including:

- `requestId`
- `widgetId`
- operation name
- workspace identity
- current running state
- active and last-known-good versions
- requested and granted capabilities
- provider availability
- actionable diagnostics

Do not invent numeric timeouts, node caps, byte caps, or resource budgets before measuring real workloads. When a limit is introduced, its diagnostic must name the limit and observed ask.

## Persistence, promotion, and rollback

The runtime uses Render-owned immutable snapshots independent of Git history.

1. A source edit creates a staged candidate snapshot.
2. `render check` validates the candidate without changing the running widget.
3. The native host compiles, renders, and runs the candidate.
4. A successful candidate is atomically promoted to last-known-good.
5. A failed candidate remains available as diagnostics.
6. The prior last-known-good widget continues running.
7. `render rollback` can select and relaunch a previous successful snapshot.

The first prototype retains every successful snapshot. Pruning is deferred until disk usage is measured and a tripwire can be sized from a receipt.

`render run` registers the workspace as the active widget. Render stores that active-workspace pointer in app-support metadata and relaunches the active widget at macOS login.

## Native macOS desktop behavior

- Use a native non-activating window between wallpaper and normal application windows.
- Use true per-pixel alpha with no opaque backing rectangle.
- Render rounded corners, shadows, glass, and other effects from the widget tree.
- The first prototype runs the generated widget in draggable interaction mode so users can place it.
- Keep click-through as an explicit passive mode when interaction configuration is added.
- Use logical anchors and offsets instead of raw screen coordinates.
- Default to the top-left of the primary display.
- Support conversational movement to another logical anchor, including top-right.
- Show the widget across every macOS Space.
- Request macOS permissions only when a widget needs a specific capability.
- The CPU/RAM widget requires no elevated permission.
- Do not request blanket Accessibility, Screen Recording, or unrelated system access.

The first prototype may be ad-hoc signed for local development. Developer ID signing, notarization, installers, updaters, and App Store distribution are later work.

## Implementation roadmap

### Phase 0 - Repository and build foundation

- Keep implementation work on a feature branch from `main`.
- Preserve [AGENTS.md](AGENTS.md) as active project guidance.
- Establish the native macOS app/host target.
- Establish the TypeScript package and embedded-runtime build path.
- Establish the local `render` CLI package.
- Add the smallest test harness for native host, CLI, and SDK layers.
- Keep commits atomic and use Conventional Commit messages.

### Phase 1 - Native desktop shell

- Create the native AppKit window host with SwiftUI content hosting.
- Verify per-pixel transparency, non-activation, click-through, all-Space visibility, and primary-display placement.
- Implement logical anchor movement.
- Add the minimal ad-hoc signing required to run locally.
- Capture visual and behavioral verification on the target Mac.

### Phase 2 - SDK and declarative tree

- Implement the `@render/sdk` package and the initial six primitives.
- Define serializable tree and action types.
- Implement typed style props and Column/Row/Stack layout.
- Generate the SDK catalog and agent documentation.
- Add `render sdk list` and `render sdk describe`.
- Reject DOM, browser, and unknown SDK imports in `render check`.

### Phase 3 - Embedded TypeScript runtime

- Transpile the widget entrypoint locally.
- Execute it inside the embedded JavaScript engine.
- Convert the returned tree into native SwiftUI/AppKit rendering operations.
- Enforce the manifest schema and SDK version.
- Return actionable errors with source locations.

### Phase 4 - CPU/RAM providers

- Implement host-owned `system.cpu` and `system.memory` providers.
- Implement explicit unavailable states.
- Implement host-scheduled one-second updates for the first widget.
- Deliver only subscribed providers.
- Measure CPU, memory, wakeups, and frame behavior before adding performance tripwires.

### Phase 5 - CLI, workspace, and lifecycle

- Implement `render init` and the dedicated workspace layout.
- Implement pure `render check`.
- Implement background `render run` and `render run --watch`.
- Implement active-workspace registration and relaunch.
- Implement immutable snapshots, promotion, status, and rollback.
- Implement structured `--json` output.

### Phase 6 - Agent workflow and remixing

- Add the Render agent skill with SDK catalog guidance.
- Teach the skill to edit `widget.tsx` rather than inventing primitives.
- Verify create, remix-in-place, move, check, hot reload, and rollback through Codex.
- Verify that the skill does not modify unrelated projects.

### Phase 7 - First-prototype verification

- Run the complete CPU/RAM acceptance flow from a clean workspace.
- Verify persistence across process restart and macOS login.
- Verify failed candidates leave last-known-good running.
- Verify click-through and all-Space behavior.
- Verify primary-display placement and logical movement.
- Verify no elevated permission prompt for CPU/RAM.
- Verify agent-readable errors and JSON output.
- Record performance receipts before setting tripwires.

### Phase 8 - Future crash isolation

- Introduce the native supervisor without changing the widget tree or CLI contract.
- Move TypeScript execution into one worker process per widget.
- Keep native windows, providers, permissions, identity, rollback, and restart in the supervisor.
- Add version negotiation between supervisor and worker.
- Add measured worker resource tripwires and actionable diagnostics.
- Test worker crash, restart, backoff, and last-known-good recovery.

## Acceptance checklist

- [ ] A fresh workspace can be initialized without touching unrelated projects.
- [ ] `widget.tsx` is the obvious source of truth.
- [ ] Codex can create a CPU/RAM widget through the agent skill.
- [ ] The widget renders natively on the macOS desktop layer.
- [ ] The widget starts at the top-left of the primary display.
- [ ] The widget is visible across macOS Spaces.
- [ ] The widget interaction mode is explicit: the first prototype is draggable; passive widgets remain click-through.
- [ ] CPU and RAM values update once per second.
- [ ] No elevated permission prompt is shown for the CPU/RAM widget.
- [ ] `render check` produces actionable diagnostics.
- [ ] `render run --watch` hot-reloads successful edits.
- [ ] “Make it blue” updates the existing widget in place.
- [ ] “Move it to the top-right” updates its logical anchor.
- [ ] The active widget relaunches after macOS login.
- [ ] Failed edits leave the last-known-good widget running.
- [ ] `render rollback` can restore an earlier successful snapshot.
- [ ] `--json` output is sufficient for an agent to act without reading source code.
- [x] Performance receipts exist before any enforced resource limits are added (`perf/receipts/first-prototype.json`).

## Deferred questions discovered during implementation

These are implementation details, not unresolved product direction:

- Exact native macOS target structure and build tooling.
- Exact embedded JavaScript engine and local TypeScript transpilation path.
- Exact SwiftUI/AppKit bridge implementation.
- Native widget render-pass cadence instrumentation beyond display-link cadence.
- Exact workspace metadata filenames.
- Exact SDK catalog generation tool.
- Exact macOS login-item mechanism.
- Measured CPU, memory, wakeup, frame, and snapshot-disk tripwires.

Resolve these with evidence from builds, tests, measurements, and native macOS documentation. Do not silently turn an implementation choice into a product requirement.

## Decision references

- [Native rendering and TypeScript boundary](https://github.com/SamarthaB10/Render/issues/6)
- [CLI invocation contract](https://github.com/SamarthaB10/Render/issues/3)
- [CLI and agent skill contract](https://github.com/SamarthaB10/Render/issues/9)
- [Widget manifest and capabilities](https://github.com/SamarthaB10/Render/issues/10)
- [Widget primitives and providers](https://github.com/SamarthaB10/Render/issues/11)
- [SDK catalog and agent discovery](https://github.com/SamarthaB10/Render/issues/12)
- [Persistence and rollback](https://github.com/SamarthaB10/Render/issues/4)
- [Desktop layer and permissions](https://github.com/SamarthaB10/Render/issues/2)
- [Crash-isolated runtime evolution](https://github.com/SamarthaB10/Render/issues/5)
