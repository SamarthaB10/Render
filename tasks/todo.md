# Render implementation TODO

## Phase 1 - Toolchain and native host proof

- [ ] Prove SwiftPM/AppKit host build with the installed command-line toolchain.
- [ ] Add the serializable widget-tree protocol.
- [ ] Add focused tests for protocol validation and encoding.

## Phase 2 - SDK and CLI contracts

- [ ] Add `@render/sdk` package and initial primitives.
- [ ] Add manifest and capability validation.
- [ ] Add workspace-scoped `render init`, `render check`, and `render status`.

## Phase 3 - First widget path

- [ ] Render the initial primitive tree natively.
- [ ] Add CPU/RAM providers and one-second host updates.
- [ ] Add watch reload, snapshots, persistence, and rollback.

## Phase 4 - Future isolation preparation

- [ ] Add versioned supervisor/worker protocol boundaries.
- [ ] Measure runtime and snapshot performance before setting tripwires.
