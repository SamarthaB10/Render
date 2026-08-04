import {
  RENDER_WORKER_PROTOCOL_VERSION,
  type WorkerDiagnosticContract,
  type WorkerMessageContract,
  type WorkerMessageKind
} from "./widget-contract.generated.ts";

export { RENDER_WORKER_PROTOCOL_VERSION };
export type { WorkerMessageKind };

export type WorkerDiagnostic = WorkerDiagnosticContract;
export type WorkerMessage = WorkerMessageContract;
