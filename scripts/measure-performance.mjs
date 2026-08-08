#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRuntimeTree } from "../src/runtime.mjs";
import {
  PERFORMANCE_RECEIPT_SCHEMA_VERSION,
  PERFORMANCE_WORKLOADS,
  validatePerformanceReceipt
} from "../src/performance-contract.mjs";

export function summarizeSamples(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  return {
    count: sorted.length,
    min: sorted[0],
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length
  };
}

export function buildPerformanceReceipt({
  workload,
  measuredAt,
  commit,
  system,
  settings,
  observations,
  artifacts = {}
}) {
  const receipt = {
    schemaVersion: PERFORMANCE_RECEIPT_SCHEMA_VERSION,
    measuredAt,
    commit,
    system,
    workload: { id: workload.id, fixture: workload.fixture },
    settings,
    signals: {
      fullTreeUpdateMs: {
        state: "unavailable",
        reason: "full-tree update adapter is not instrumented; runtime-tree build samples are recorded separately"
      },
      cpuPercent: availableSignal(observations.cpuPercent, "cpuPercent"),
      residentMemoryKB: availableSignal(observations.residentMemoryKB, "residentMemoryKB"),
      wakeups: normalizeSignal(observations.wakeups, "wakeups"),
      latencyMs: availableSignal(observations.latencyMs, "latencyMs"),
      nativePresentationMs: normalizeSignal(observations.nativePresentationMs, "nativePresentationMs"),
      recoveryMs: normalizeSignal(observations.recoveryMs, "recoveryMs")
    },
    artifacts: {
      ...artifacts,
      runtimeTreeBuildMs: summarizeSamples(observations.runtimeTreeBuildMs ?? [])
    }
  };
  const validation = validatePerformanceReceipt(receipt);
  if (!validation.ok) {
    throw new Error(validation.diagnostics.map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`).join("; "));
  }
  return receipt;
}

function percentile(sorted, rank) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(rank * sorted.length) - 1)];
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const workload = findWorkload(options.workload);
  const sourceWorkspace = path.resolve(options.workspace);
  const sourcePath = path.join(sourceWorkspace, "widget.tsx");
  if (!existsSync(sourcePath)) {
    throw new Error(`workspace must contain widget.tsx: ${sourceWorkspace}`);
  }

  const temporaryWorkspace = mkdtempSync(path.join(os.tmpdir(), "render-performance-"));
  try {
    initTemporaryWorkspace(repoRoot, temporaryWorkspace, sourcePath);
    const receipt = await measure({ repoRoot, workspace: temporaryWorkspace, options, workload });
    const output = JSON.stringify(receipt, null, 2);
    if (options.output) {
      mkdirSync(path.dirname(options.output), { recursive: true });
      writeFileSync(options.output, `${output}\n`, "utf8");
    }
    console.log(output);
  } finally {
    rmSync(temporaryWorkspace, { recursive: true, force: true });
  }
}

function initTemporaryWorkspace(repoRoot, workspace, sourcePath) {
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "bin/render.mjs"), "init", "--workspace", workspace],
    { cwd: repoRoot, encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || "could not initialize performance workspace");
  }
  cpSync(sourcePath, path.join(workspace, "widget.tsx"));
  const sourceAssets = path.join(path.dirname(sourcePath), "assets");
  if (existsSync(sourceAssets)) {
    cpSync(sourceAssets, path.join(workspace, "assets"), { recursive: true, force: true });
  }
}

async function measure({ repoRoot, workspace, options, workload }) {
  const source = readFileSync(path.join(workspace, "widget.tsx"), "utf8");
  const treeBuild = measureTreeBuild(source, options.treeIterations);
  const runStartedAt = performance.now();
  const run = runWorkspace(repoRoot, workspace);
  const runLatencyMs = performance.now() - runStartedAt;
  if (!run.ok) throw new Error(run.stderr || "could not start performance workspace");

  const processSamples = [];
  try {
    await delay(options.intervalMs);
    for (let index = 0; index < options.samples; index += 1) {
      await delay(options.intervalMs);
      const sample = sampleProcess(run.processId);
      if (sample) processSamples.push(sample);
    }
  } finally {
    stopProcess(run.processId);
  }

  const frameCadence = measureFrameCadence(repoRoot);
  const system = readSystemInfo(repoRoot);
  return buildPerformanceReceipt({
    workload,
    measuredAt: new Date().toISOString(),
    commit: gitHead(repoRoot),
    system,
    settings: {
      sampleCount: options.samples,
      warmupIntervalMs: options.intervalMs,
      sampleIntervalMs: options.intervalMs,
      treeIterations: options.treeIterations
    },
    observations: {
      runtimeTreeBuildMs: treeBuild.samples,
      cpuPercent: processSamples.map((sample) => sample.cpuPercent),
      residentMemoryKB: processSamples.map((sample) => sample.residentMemoryKB),
      latencyMs: [runLatencyMs],
      wakeups: {
        state: "unavailable",
        reason: "powermetrics requires superuser privileges on this Mac"
      },
      nativePresentationMs: {
        state: "unavailable",
        reason: frameCadence.state === "available"
          ? "frame cadence is available, but native presentation acknowledgement is not instrumented"
          : frameCadence.message
      },
      recoveryMs: {
        state: "unavailable",
        reason: "recovery measurement adapter is not instrumented"
      }
    },
    artifacts: {
      frameCadence,
      widget: {
      sourceBytes: Buffer.byteLength(source),
      runtimeTreeBytes: fileSize(path.join(workspace, ".render/runtime/tree.json")),
      snapshotDiskBytes: directorySize(path.join(workspace, ".render/snapshots"))
      },
      runtimeTreeBuild: treeBuild
    }
  });
}

function measureTreeBuild(source, iterations) {
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    buildRuntimeTree(source, "widget.tsx");
    samples.push(performance.now() - start);
  }
  return {
    iterations,
    samples,
    durationMs: summarizeSamples(samples)
  };
}

function runWorkspace(repoRoot, workspace) {
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "bin/render.mjs"), "run", "--workspace", workspace, "--json"],
    { cwd: repoRoot, encoding: "utf8" }
  );
  if (result.status !== 0) return { ok: false, stderr: result.stderr };
  return JSON.parse(result.stdout);
}

function sampleProcess(processId) {
  const result = spawnSync("ps", ["-p", String(processId), "-o", "%cpu=,rss="], { encoding: "utf8" });
  if (result.status !== 0) return null;
  const [cpuPercent, residentMemoryKB] = result.stdout.trim().split(/\s+/).map(Number);
  if (!Number.isFinite(cpuPercent) || !Number.isFinite(residentMemoryKB)) return null;
  return { cpuPercent, residentMemoryKB };
}

function stopProcess(processId) {
  try {
    process.kill(processId);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function measureFrameCadence(repoRoot) {
  const hostPath = path.join(repoRoot, ".build/debug/RenderHost");
  const result = spawnSync(hostPath, ["--performance-self-check"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    return {
      state: "unavailable",
      message: result.stderr.trim() || "RenderHost performance self-check failed"
    };
  }
  const payload = JSON.parse(result.stdout);
  return payload.frameCadence;
}

function readSystemInfo(repoRoot) {
  return {
    platform: process.platform,
    arch: process.arch,
    macOS: commandOutput("sw_vers", ["-productVersion"]),
    swift: commandOutput("swift", ["--version"]).split("\n")[0],
    node: process.version,
    hostBinary: path.relative(repoRoot, path.join(repoRoot, ".build/debug/RenderHost"))
  };
}

function gitHead(repoRoot) {
  return commandOutput("git", ["rev-parse", "HEAD"], repoRoot);
}

function commandOutput(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return result.stdout.trim();
}

function fileSize(filePath) {
  return existsSync(filePath) ? statSync(filePath).size : 0;
}

function directorySize(directoryPath) {
  if (!existsSync(directoryPath)) return 0;
  return readdirSync(directoryPath).reduce((total, entry) => {
    const entryPath = path.join(directoryPath, entry);
    const entryStats = statSync(entryPath);
    return total + (entryStats.isDirectory() ? directorySize(entryPath) : entryStats.size);
  }, 0);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseOptions(args) {
  const options = {
    workspace: path.join(os.homedir(), "RenderPreview"),
    workload: "static-widget",
    output: null,
    samples: 5,
    intervalMs: 1_000,
    treeIterations: 100
  };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--workspace" && args[index + 1]) {
      options.workspace = args[++index];
    } else if (args[index] === "--workload" && args[index + 1]) {
      options.workload = args[++index];
    } else if (args[index] === "--output" && args[index + 1]) {
      options.output = path.resolve(args[++index]);
    } else if (args[index] === "--samples" && args[index + 1]) {
      options.samples = positiveInteger(args[++index], "samples");
    } else if (args[index] === "--interval-ms" && args[index + 1]) {
      options.intervalMs = positiveInteger(args[++index], "interval-ms");
    } else if (args[index] === "--tree-iterations" && args[index + 1]) {
      options.treeIterations = positiveInteger(args[++index], "tree-iterations");
    }
  }
  return options;
}

function findWorkload(id) {
  const workload = PERFORMANCE_WORKLOADS.find((candidate) => candidate.id === id);
  if (!workload) {
    throw new Error(`unknown workload '${id}'; choose one of ${PERFORMANCE_WORKLOADS.map((candidate) => candidate.id).join(", ")}`);
  }
  return workload;
}

function availableSignal(samples, name) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return { state: "unavailable", reason: `${name} measurement produced no samples` };
  }
  return { state: "available", samples: [...samples] };
}

function normalizeSignal(signal, name) {
  if (signal?.state === "available") return availableSignal(signal.samples, name);
  if (signal?.state === "unavailable") {
    const reason = signal.reason ?? signal.message;
    return {
      state: "unavailable",
      reason: typeof reason === "string" && reason.trim().length > 0
        ? reason
        : `${name} measurement is unavailable`
    };
  }
  return { state: "unavailable", reason: `${name} measurement is unavailable` };
}

function positiveInteger(rawValue, name) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`performance measurement failed: ${error.message}`);
    process.exitCode = 1;
  });
}
