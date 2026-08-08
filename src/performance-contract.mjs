export const PERFORMANCE_RECEIPT_SCHEMA_VERSION = 2;

export const PERFORMANCE_SIGNALS = Object.freeze([
  "fullTreeUpdateMs",
  "cpuPercent",
  "residentMemoryKB",
  "wakeups",
  "latencyMs",
  "nativePresentationMs",
  "recoveryMs"
]);

export const PERFORMANCE_WORKLOADS = Object.freeze([
  workload("static-widget", "Static Widget", "perf/fixtures/static-widget/widget.tsx"),
  workload("interactive-controls", "Interactive controls", "perf/fixtures/interactive-controls/widget.tsx"),
  workload("provider-driven-widget", "Provider-driven Widget", "perf/fixtures/provider-driven-widget/widget.tsx"),
  workload("animated-widget", "Animated Widget", "perf/fixtures/animated-widget/widget.tsx"),
  workload("high-frequency-visualizer", "High-frequency visualizer", "perf/fixtures/high-frequency-visualizer/widget.tsx"),
  workload("multiple-concurrent-widgets", "Multiple concurrent Widgets", "perf/fixtures/multiple-concurrent-widgets/widget.tsx"),
  workload("crash-restart", "Crash/restart", "perf/fixtures/crash-restart/widget.tsx"),
  workload("failed-remix", "Failed remix", "perf/fixtures/failed-remix/widget.tsx")
]);

export function validatePerformanceReceipt(receipt) {
  const diagnostics = [];
  if (!isRecord(receipt)) {
    return invalid([{ path: "receipt", message: "must be an object" }]);
  }

  if (receipt.schemaVersion !== PERFORMANCE_RECEIPT_SCHEMA_VERSION) {
    diagnostics.push({
      path: "schemaVersion",
      message: `must equal ${PERFORMANCE_RECEIPT_SCHEMA_VERSION}`
    });
  }
  if (!isDateTime(receipt.measuredAt)) {
    diagnostics.push({ path: "measuredAt", message: "must be an RFC 3339 date-time" });
  }
  if (!nonEmptyString(receipt.commit)) {
    diagnostics.push({ path: "commit", message: "must be a non-empty string" });
  }

  validateWorkload(receipt.workload, diagnostics);
  validateSettings(receipt.settings, diagnostics);
  validateSignals(receipt.signals, diagnostics);

  return diagnostics.length === 0 ? { ok: true, diagnostics: [] } : invalid(diagnostics);
}

function validateWorkload(value, diagnostics) {
  if (!isRecord(value)) {
    diagnostics.push({ path: "workload", message: "must be an object" });
    return;
  }

  const definition = PERFORMANCE_WORKLOADS.find((workloadItem) => workloadItem.id === value.id);
  if (!definition) {
    diagnostics.push({ path: "workload.id", message: "must name a catalog workload" });
    return;
  }
  if (value.fixture !== definition.fixture) {
    diagnostics.push({
      path: "workload.fixture",
      message: `must equal ${JSON.stringify(definition.fixture)} for workload ${JSON.stringify(definition.id)}`
    });
  }
}

function validateSettings(value, diagnostics) {
  if (!isRecord(value)) {
    diagnostics.push({ path: "settings", message: "must be an object" });
    return;
  }
  for (const field of ["sampleCount", "warmupIntervalMs", "sampleIntervalMs"]) {
    if (!Number.isInteger(value[field]) || value[field] <= 0) {
      diagnostics.push({ path: `settings.${field}`, message: "must be a positive integer" });
    }
  }
}

function validateSignals(value, diagnostics) {
  if (!isRecord(value)) {
    diagnostics.push({ path: "signals", message: "must be an object" });
    return;
  }

  for (const signal of PERFORMANCE_SIGNALS) {
    const measurement = value[signal];
    if (!isRecord(measurement)) {
      diagnostics.push({ path: `signals.${signal}`, message: "must declare an available or unavailable state" });
      continue;
    }
    if (measurement.state === "unavailable") {
      if (!nonEmptyString(measurement.reason)) {
        diagnostics.push({ path: `signals.${signal}.reason`, message: "must explain why the signal is unavailable" });
      }
      continue;
    }
    if (measurement.state !== "available") {
      diagnostics.push({ path: `signals.${signal}.state`, message: "must be \"available\" or \"unavailable\"" });
      continue;
    }
    if (!Array.isArray(measurement.samples) || measurement.samples.length === 0) {
      diagnostics.push({ path: `signals.${signal}.samples`, message: "must contain at least one numeric sample" });
      continue;
    }
    if (measurement.samples.some((sample) => !Number.isFinite(sample))) {
      diagnostics.push({ path: `signals.${signal}.samples`, message: "must contain only finite numbers" });
    }
  }

  for (const signal of Object.keys(value)) {
    if (!PERFORMANCE_SIGNALS.includes(signal)) {
      diagnostics.push({ path: `signals.${signal}`, message: "is not a declared performance signal" });
    }
  }
}

function workload(id, label, fixture) {
  return Object.freeze({ id, label, fixture });
}

function invalid(diagnostics) {
  return { ok: false, diagnostics: diagnostics.map((diagnostic) => ({
    code: "invalid-performance-receipt",
    ...diagnostic
  })) };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isDateTime(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value));
}
