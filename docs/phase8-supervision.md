# Phase 8: Native supervision and worker isolation

Phase 8 moves widget execution behind a stable native boundary without changing the agent-facing CLI or declarative widget tree.

## Boundary

```text
render run/check/watch/move/rollback
              |
       RenderHost supervisor
        /       |       \\
   window   providers   WorkerSession
                            |
                       src/worker.mjs
                            |
                       widget.tsx
```

RenderHost owns the desktop window, provider sampling, placement, worker lifecycle, resource sampling, and recovery. The worker reads the workspace source and returns only a serializable tree and manifest. It never owns a native window or receives arbitrary native APIs.

The first prototype has one active widget and one worker process. The fleet
slice adds a detached Node supervisor over multiple isolated host processes;
each host still owns exactly one desktop surface and one worker. The boundary
is intentionally the same shape needed for an eventual XPC-backed supervisor
with one native worker per widget.

## Protocol

The protocol is newline-delimited JSON and is defined in both:

- `packages/sdk/src/worker-protocol.ts` for the TypeScript worker contract.
- `Sources/RenderHostCore/WorkerProtocol.swift` for the native supervisor contract.

The current protocol version is `1`. The worker first sends `hello` with its supported versions. RenderHost sends `helloAck` only when a compatible version is available. The worker then sends `ready`; RenderHost sends `render` with the workspace and source path; the worker returns either `render` with a tree/manifest or `failure` with actionable diagnostics.

Unsupported versions fail closed. A failure includes a machine-readable `code`, the relevant `path`, and a repair-oriented `message`.

## Recovery invariant

The supervisor writes the initial tree before worker execution begins and updates the SwiftUI model only after a candidate render succeeds. If a worker exits after becoming ready:

1. RenderHost writes `restarting` state with a `worker-exited` diagnostic.
2. The existing native tree remains visible.
3. RenderHost retries with bounded exponential backoff, capped at four seconds per retry.
4. A successful retry writes the new tree and returns to `ready`.
5. A failed retry records `worker-restart-failed` and schedules the next retry.
6. The first four consecutive restart failures remain machine-visible as
   `restarting`; the fifth changes the worker state to `quarantined`, emits
   `worker-restart-threshold`, and stops retrying until the widget is run again.

The CLI uses session-specific worker source, state, and tree paths during candidate startup. It promotes a new snapshot and stops the previous supervisor only after the candidate worker reports `ready`. A failed candidate therefore cannot replace the active process or last-known-good snapshot, and an existing worker restart never rereads an unvalidated candidate source.

The fleet supervisor persists its own process state beside the fleet registry,
reconciles each widget's recorded host PID independently, and relaunches only
the workspace whose host disappeared. `render fleet stop` stops the widget
hosts first and then shuts down the fleet supervisor once no registered widget
remains active. The native Settings button records an intentional stop for its
own workspace before terminating, so the fleet supervisor does not mistake a
user action for a crash or relaunch that widget. A supervisor state of
`stopped` or a stale PID is explicit in `fleet status --json`.

## Resource receipt

`WorkerSession` samples the worker once per second using `proc_pid_rusage`. The current tripwires are recorded in [perf/receipts/phase8-worker.json](../perf/receipts/phase8-worker.json):

- CPU: 200% of one logical CPU.
- Resident memory: 131,072 KB.
- `render run` startup observation: 5,000 ms supervisor readiness deadline.
- User-visible worker restart threshold: 5 consecutive failures, defined by
  `RestartPolicy` and required by the crash-loop recovery contract.

These are measured tripwires for runaway or hung behavior, not a target budget for healthy widgets. If a good widget reaches one, remeasure the workload before changing the limit.

## Verification

Run the repository checks:

```bash
npm test
swift build
swift test
```

The Node tests launch `src/worker.mjs` as a separate process and cover successful rendering, actionable failures, and incompatible protocol negotiation. The Swift test target covers native protocol validation; on machines with only Apple Command Line Tools, XCTest may compile but not execute because the XCTest runtime is not installed.

On a built macOS host, the manual crash check is:

1. Start a workspace with `render run --json`.
2. Read `worker.processId` from `render status --json`.
3. Terminate that worker process.
4. Confirm status changes to `restarting` while the widget tree remains visible.
5. Confirm status returns to `ready` with a new worker process ID.
