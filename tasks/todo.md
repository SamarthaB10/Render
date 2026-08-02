# Render implementation TODO

## Phase 1 - Toolchain and native host proof

- [x] Add SwiftPM/AppKit host source with a transparent desktop window boundary.
- [x] Add the serializable widget-tree protocol.
- [x] Add focused tests for protocol validation and encoding.

## Phase 2 - SDK and CLI contracts

- [x] Add `@render/sdk` package and initial primitives.
- [x] Add manifest and capability validation.
- [x] Add workspace-scoped `render init`, `render check`, and `render status`.

## Phase 3 - First widget path

- [x] Render the initial primitive tree natively.
- [x] Add CPU/RAM providers and one-second host updates.
- [x] Add watch reload, snapshots, persistence, and rollback.

## Phase 4 - Future isolation preparation

- [x] Add versioned supervisor/worker protocol boundaries.
- [x] Measure runtime and snapshot performance before setting tripwires; receipt: `perf/receipts/first-prototype.json`.
