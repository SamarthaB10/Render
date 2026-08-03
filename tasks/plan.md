# Implementation Plan: Render first prototype foundation

## Overview

Build the smallest vertical slice that can grow into Render's first local macOS prototype: a native host boundary, a serializable TypeScript widget contract, and a deterministic local CLI. The first slice will not attempt the full CPU/RAM widget, persistence, or crash isolation in one change.

## Current constraints

- The repository contains guidance and `ImplementationDoc.md`, but no source code or package configuration.
- Swift 5.8.1 and the macOS command-line toolchain are available.
- Full Xcode is not installed; use Swift Package Manager and command-line tools unless a native API requires Xcode.
- Node.js 24.15.0 and npm 11.12.1 are available.
- No new dependency is justified before the standard toolchains and native frameworks are tested.

## Architecture decisions carried into implementation

- Native macOS host: Swift/AppKit window ownership with SwiftUI content added only where it earns its complexity.
- Widget authoring: TypeScript/TSX through a canonical `@render/sdk` contract.
- Runtime boundary: serializable declarative tree and action messages; widget code does not own native windows.
- Agent boundary: deterministic workspace-scoped `render` CLI plus agent skill; no MCP in the first prototype.
- Persistence: `widget.tsx` source of truth and `.render/` snapshots/metadata.
- Future isolation: supervisor-owned lifecycle and disposable widget workers.

## Task List

### Phase 1: Toolchain and native host proof

- [x] Task 1: Add the Swift package and native macOS host boundary with a transparent, non-activating window.
- [x] Task 2: Define the host-side serializable widget-tree protocol and focused validation tests.

### Checkpoint: Native boundary

- [x] Swift build succeeds with the available command-line toolchain.
- [ ] Focused host/protocol tests pass.
- [ ] The host boundary does not expose DOM, browser, or arbitrary native widget APIs.

### Phase 2: SDK and CLI contracts

- [x] Task 3: Add the minimal TypeScript SDK package with the first primitives, manifest wrapper, provider hooks, and serializable output types.
- [x] Task 4: Add a deterministic `render check` CLI against an explicit workspace and structured `--json` errors.
- [x] Task 5: Add `render init` and `render status` workspace metadata without hidden global widget state.

### Checkpoint: Agent boundary

- [x] SDK contract tests pass.
- [x] `render check` rejects invalid manifests and unknown imports with source-oriented diagnostics.
- [x] A fresh workspace can be initialized and inspected without touching unrelated paths.

### Phase 3: First widget path

- [x] Task 6: Implement the native tree renderer for the initial primitives and a static widget.
- [x] Task 7: Add host-owned CPU/RAM providers and host-scheduled one-second updates.
- [x] Task 8: Add `render run --watch`, candidate promotion, and last-known-good rollback.

### Checkpoint: First prototype

- [ ] Codex/agent skill can create the CPU/RAM widget through the dedicated workspace.
- [ ] The widget renders on the desktop layer, persists, remixes, moves, and rolls back.
- [ ] Manual verification covers permissions, Spaces, click-through, and relaunch.

### Phase 4: Future isolation preparation

- [x] Task 9: Add versioned supervisor/worker protocol boundaries without moving execution out of process yet.
- [x] Task 10: Measure CPU, memory, wakeups, frame cadence, and snapshot disk use before adding tripwires.

### Phase 5: Agent workflow

- [x] Task 11: Add the canonical SDK catalog and deterministic `render sdk list` / `render sdk describe` discovery commands.
- [x] Task 12: Package the catalog-guided Render agent skill with isolated-workspace, capability, validation, run, remix, and rollback guidance.
- [x] Task 13: Verify the skill through an end-to-end agent workflow for create, remix, move, check, watch, and rollback.
- [x] Task 14: Make SDK discovery agent-complete with exact contracts, canonical examples, and a scaffold command.

### Phase 6: Crash-isolated runtime

- [x] Task 15: Define and validate the version-negotiated supervisor/worker protocol.
- [x] Task 16: Run widget TypeScript in a disposable worker process owned by the native supervisor.
- [x] Task 17: Preserve the active tree across worker failure and restart with bounded backoff.
- [x] Task 18: Add worker diagnostics, session-scoped runtime state, and measured CPU/memory tripwires.
- [x] Task 19: Route native `render run`, watch reload, logical move, and rollback through candidate supervisor handoff.

### Checkpoint: Crash isolation

- [x] Worker protocol tests pass in Node and native protocol validation is covered by the Swift test target.
- [x] The native build succeeds with the available command-line toolchain.
- [x] A native worker crash was observed to enter `restarting`, retain the last-known-good tree, and return to `ready`.
- [x] Candidate supervisor startup is session-scoped and cannot replace the active supervisor until the worker reports ready.
- [x] Worker resource measurements and tripwires are recorded in `perf/receipts/phase8-worker.json`.

### Phase 9: Native JSX and SDK surface

These tasks are shipped as one agent-facing vertical slice. External image
sources and media/account integrations remain explicit deferred capability
gaps rather than hidden fallbacks.

- [x] Task 20: Define the JSX runtime contract (`jsx`, `jsxs`, `Fragment`) and a typed native style model that does not expose DOM or CSS.
- [x] Task 21: Add the first layout slice: `Box`, `Spacer`, and `Divider`, including serializable tree types, native rendering, catalog entries, validation, and examples.
- [x] Task 22: Add the first content/control slice: `Icon`, `Image`, `Button`, and `Progress`, including typed state and serializable actions.
- [x] Task 23: Define provider values, loading/unavailable states, typed actions, and the narrow capability declarations required by the Phase 9 slice.
- [x] Task 24: Make each Phase 9 item agent-readable through exact catalog discovery, actionable `render check --json` diagnostics, and unsupported-capability guidance.
- [x] Task 25: Add focused SDK/native/CLI tests and performance receipts for the Phase 9 slice, then verify an agent can build and recover an interactive Widget through the supervised lifecycle.

### Checkpoint: Phase 9 contract

- [x] Every shipped item has SDK types, JSX/runtime support, a catalog entry, native implementation, validation, agent documentation, tests, and performance evidence.
- [x] A fresh agent can discover exact supported imports and signatures without reading Render source code.
- [x] An unsupported request produces a named capability gap; no invented primitive, provider, action, DOM, webview, or fake data path is used.
- [x] The existing last-known-good, capability, provider, supervisor, and receipt invariants remain intact.

### Phase 10: Host-owned authenticated integrations

Phase 10 starts the generic integration boundary with Spotify as the first
trusted connector. The widget author declares an account requirement and the
host owns authorization, secure token storage, refresh, provider polling, and
action dispatch. Widget code never receives raw credentials or gets an
arbitrary network primitive.

The first Spotify slice is deliberately limited to account identity and
playback: current track, playback state, progress, volume, play/pause,
previous, next, and volume changes. Playlist, library, history, search, and
arbitrary third-party OAuth remain separate catalog entries until their host
contracts are designed and tested.

- [x] Task 26: Add a generic account/connector contract to the SDK, manifest validator, catalog, and agent-readable docs.
- [x] Task 27: Add a host-owned auth state machine and secure credential boundary with deterministic tests and no credentials in widget trees or logs.
- [x] Task 28: Add Render-owned authorization prompt and connected/denied/unavailable states to the native widget surface.
- [x] Task 29: Add the trusted Spotify connector using Authorization Code with PKCE, token refresh, allowlisted API calls, playback providers, and explicit playback actions.
- [x] Task 30: Add the liquid-glass hover settings control, confirmed stop flow, process metadata/kill command, and placement-safe interaction handling.
- [x] Task 31: Add a canonical Spotify widget example, update SDK discovery/agent guidance, and verify the complete check → authorize → run → control → remix → rollback workflow.

### Checkpoint: Phase 10 foundation

- [x] SDK and native host agree on one versioned, serializable account contract.
- [x] Missing permission leaves the widget alive with an explicit connect state.
- [x] Raw access/refresh tokens never cross the worker boundary, enter a tree,
  or appear in diagnostics.
- [x] Spotify actions are host-owned, scope-checked, allowlisted, and expose
  loading/success/error/unavailable state.
- [ ] Settings controls are keyboard reachable, confirmation-protected, and do
  not steal drag behavior from the widget surface.
- [x] Official Spotify authorization, scope, playback, and volume behavior is
  recorded in the implementation docs.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Full Xcode is unavailable | Native app packaging or GUI verification may be limited | Keep the first host build SwiftPM-compatible; report any Xcode-only gate explicitly. |
| Native window semantics differ across macOS Spaces/displays | Core desktop behavior may regress | Add focused native behavior checks and manual verification on the target Mac. |
| TSX execution becomes a premature runtime project | Scope expands before rendering is proven | Define the serialized SDK/tree contract first and keep the initial execution path minimal. |
| Resource limits are guessed | Good widgets may be rejected or performance claims become untrustworthy | Measure real workloads before setting limits, per `AGENTS.md`. |
| Catalog and native renderer drift | Agents generate Widgets that validate but cannot render | Ship each SDK item as one contract boundary and gate promotion on catalog, renderer, validation, tests, and receipt evidence. |
| Broad primitive roadmap becomes an unbounded rewrite | Phase 9 loses its vertical proof | Implement only the first slice first; keep advanced families explicitly deferred. |
| Credentials cross the widget boundary | A compromised widget could exfiltrate a user's account | Keep connectors and token storage in RenderHost; expose typed account/provider state and opaque action results only. |
| Provider polling overloads a third-party API | Playback becomes stale or rate-limited | Host-owned cadence, response validation, bounded retries, and explicit unavailable states. |
| Native drag handling swallows controls | Settings and playback buttons appear but cannot be used | Keep interaction hit-testing in the host and add focused manual/native verification. |
| Spotify app configuration is missing | OAuth cannot complete on a fresh machine | Keep client identifiers out of source, document the required Render-managed configuration boundary, and make the unauthenticated path usable. |

## Open implementation questions

- Which embedded JavaScript engine and TypeScript transpilation path fit the available native toolchain; verify before committing to one.
- Whether SwiftUI is needed in the first host slice or AppKit can carry the initial proof more simply.
- Exact workspace metadata filenames and CLI packaging approach.
- Spotify's current Authorization Code with PKCE, scope, playback, and volume
  contracts are the source of truth for the connector implementation; see the
  official links in `ImplementationDoc.md`.

## Verification commands

Use repository-defined commands once the toolchain files exist. Until then, each slice must provide its own focused command and a full build command in the commit notes.
