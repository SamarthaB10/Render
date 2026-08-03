# Render agent guidance

Samartha and the agent are building Render together.

Render is a desktop widget platform: Rainmeter, but native to macOS and authored in TSX instead of a bespoke markup language. It must match or beat Rainmeter on performance. These are desktop widgets, so memory and CPU usage are part of the product, not a nice-to-have.

Render is agent-first. Developers will usually prompt their agents to create, remix, and repair Widgets rather than hand-write code. A fresh agent should be able to take a request such as “make me a mini 4×4 Spotify widget” from prompt to a running desktop surface using the SDK and the documented lifecycle.

This is meant to be a bold project. Simply following existing solutions will not get us where we want to be.

## Glossary

- **You**: the agent reading this document and working on Render directly.
- **We**: the humans contributing to Render.
- **Developers**: our users. We assume they will not read much code; they will prompt their own agents to build things using this framework.
- **Widget**: the self-contained desktop surface Render creates and manages. Read [docs/domain-glossary.md](docs/domain-glossary.md) for the full domain definition.
- **SDK**: Render's supported catalog of primitives, providers, styles, and runtime contracts. Widget authors use this boundary; they do not invent a parallel one.
- **Conjure**: creating a Widget by prompting an agent.
- **Share**: sending a Widget as readable source and declared capabilities, not as a compiled artifact or workspace pointer.
- **Remix**: patching an existing Widget's source to personalize it.
- **Last-known-good**: the most recent validated Widget version that remains active when a candidate fails.
- **Landmine**: a decision that costs nothing now and causes major damage later when it becomes load-bearing, such as an unmeasured limit or silent catch.
- **Receipt**: the measurement behind a number. No receipt, no number.
- **Tripwire**: a limit placed past where any good widget goes, so only broken things touch it. Good widgets should never feel it exists.
- **Simple**: how cleanly the logic breaks down. Each step follows from the last, and no step does two jobs.
- **Obvious**: the next reader never asks, “Why is this here?” This is measured by the reader. Obvious is not always simple; sometimes it has more parts.

## Working principles

### The SDK is the Widget boundary

Widget source must use the Render SDK catalog for primitives, providers, styles, and runtime contracts. Do not create bespoke JSX primitives, hidden native views, embedded web pages, or private provider implementations inside a Widget.

If the SDK cannot express a required Widget, report the missing capability clearly. A platform change may add a new primitive, but it must extend the catalog, validation, runtime contract, documentation, and tests together. Do not silently bypass the boundary to make one Widget work.

### Conjure is an observable lifecycle

For Widget work, follow this sequence unless the task explicitly targets a different layer:

1. Discover the SDK catalog and relevant provider/capability contracts.
2. Create an isolated Widget workspace.
3. Author the Widget using catalog primitives.
4. Run `check --json` and fix every actionable diagnostic.
5. Run the native Widget and verify its visible behavior.
6. Use Remix, logical move, watch, and rollback through the Render lifecycle rather than editing runtime state by hand.

The canonical acceptance test is an agent creating a small real Widget, running it on the desktop, moving it, observing a valid edit, and restoring the last-known-good version after a failed edit.

### Last-known-good is a runtime invariant

Candidate Widget changes must be validated before promotion. A failed candidate must not replace the active version, corrupt placement or workspace state, or leave a blank surface without an actionable diagnostic. Keep the last-known-good Widget running whenever recovery is possible, and use the rollback path before attempting another fix.

### Platform work and Widget work are different

The SDK-only rule applies to Widget authors. Agents changing Render itself may add primitives or providers, but only through the public catalog and its complete validation, runtime, documentation, and test surface. Do not solve a platform gap by putting platform code in an individual Widget.

### Boil the ocean

When planning, do not be afraid to suggest seemingly insane solutions. We effectively have to rethink and rebuild what it means to make a desktop widget platform. The bar is an amazing developer experience without giving up performance: TSX familiarity for developers and agents who know the web, with efficiency that beats the native incumbents.

### Every number needs a receipt

A limit without a measurement is a landmine. Before writing any number—a `max_nodes`, a byte cap, or a timeout—measure the real thing first, then size it as a tripwire. Capacity is free until touched: reserve big, commit lazily, and never zero an arena eagerly. Be generous. If a good widget hits a budget, the budget is wrong. Remeasure and update the receipt.

### DX is for humans and agents

Every surface we ship has two readers: a human debugging at 2 a.m. and an agent with nothing but the error text. Design for both. APIs should be guessable by anyone who knows TSX; errors and check output should carry enough information for an agent to act without reading our code.

An agent can fix `max_nodes=128, asked for 129`. It cannot fix a blank window. The test for done is:

- Given only the message, could a fresh agent fix the widget?
- Given only the log, would a human know where to look?

If either answer is no, the work is not done.

### A limit developers can hit is a limit they must see

Every budget failure names the budget, the limit, and the ask: at `render check`, if knowable there, and loudly at runtime if not. A silent budget is worse than no budget.

### Fight for the obvious solution

Measure twice, cut once. Understand the problem fully before building, because cleverness is what gets written when you have not. The biggest simplicity win is refusing to solve problems we do not have.

Good code is the simplest thing that delivers full functionality and performance—nothing traded away, nothing bolted on. Push back when you see a more obvious way.

## General rule

These principles are strong defaults, not decoration. If a necessary platform change conflicts with one, state the conflict, explain the tradeoff, and get explicit approval before deviating. The SDK boundary for normal Widget work and the last-known-good invariant are not optional shortcuts.

#
