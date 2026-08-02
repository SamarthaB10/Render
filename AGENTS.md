# Render agent guidance

Samartha and the agent are building Render together.

Render is a desktop widget platform: Rainmeter, but native to macOS and authored in TSX instead of a bespoke markup language. It must match or beat Rainmeter on performance. These are desktop widgets, so memory and CPU usage are part of the product, not a nice-to-have.

This is meant to be a bold project. Simply following existing solutions will not get us where we want to be.

## Glossary

- **You**: the agent reading this document and working on Render directly.
- **We**: the humans contributing to Render.
- **Developers**: our users. We assume they will not read much code; they will prompt their own agents to build things using this framework.
- **Widget**: what Render creates and manages.
- **Landmine**: a decision that costs nothing now and causes major damage later when it becomes load-bearing, such as an unmeasured limit or silent catch.
- **Receipt**: the measurement behind a number. No receipt, no number.
- **Tripwire**: a limit placed past where any good widget goes, so only broken things touch it. Good widgets should never feel it exists.
- **Simple**: how cleanly the logic breaks down. Each step follows from the last, and no step does two jobs.
- **Obvious**: the next reader never asks, “Why is this here?” This is measured by the reader. Obvious is not always simple; sometimes it has more parts.

## Working principles

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

Every budget failure names the budget, the limit, and the ask: at `weaver check`, if knowable there, and loudly at runtime if not. A silent budget is worse than no budget.

### Fight for the obvious solution

Measure twice, cut once. Understand the problem fully before building, because cleverness is what gets written when you have not. The biggest simplicity win is refusing to solve problems we do not have.

Good code is the simplest thing that delivers full functionality and performance—nothing traded away, nothing bolted on. Push back when you see a more obvious way.

## General rule

These principles steer us in the right direction but are not hard-set. Default to following them. If you think one should be ignored, be very clear about why and get approval from us before doing so.

## Domain context

Read [docs/domain-glossary.md](docs/domain-glossary.md) before making product or runtime decisions. It defines Render's shared language for Widgets, Providers, the Renderer, Conjure/Share/Remix, portable Widget files, and system capabilities.
