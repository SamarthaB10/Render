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
- [ ] Task 13: Verify the skill through an end-to-end agent workflow for create, remix, move, check, watch, and rollback.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Full Xcode is unavailable | Native app packaging or GUI verification may be limited | Keep the first host build SwiftPM-compatible; report any Xcode-only gate explicitly. |
| Native window semantics differ across macOS Spaces/displays | Core desktop behavior may regress | Add focused native behavior checks and manual verification on the target Mac. |
| TSX execution becomes a premature runtime project | Scope expands before rendering is proven | Define the serialized SDK/tree contract first and keep the initial execution path minimal. |
| Resource limits are guessed | Good widgets may be rejected or performance claims become untrustworthy | Measure real workloads before setting limits, per `AGENTS.md`. |

## Open implementation questions

- Which embedded JavaScript engine and TypeScript transpilation path fit the available native toolchain; verify before committing to one.
- Whether SwiftUI is needed in the first host slice or AppKit can carry the initial proof more simply.
- Exact workspace metadata filenames and CLI packaging approach.

## Verification commands

Use repository-defined commands once the toolchain files exist. Until then, each slice must provide its own focused command and a full build command in the commit notes.
