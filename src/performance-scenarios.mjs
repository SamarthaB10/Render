import { writeFileSync } from "node:fs";
import path from "node:path";

export const FAILED_REMIX_CANDIDATE_SOURCE = "export default brokenRemixCandidate;\n";

export function measureFailedRemix({
  workspace,
  candidateSource,
  activeVersion,
  runCandidate,
  restoreActive,
  verifyRestored
}) {
  const sourcePath = path.join(path.resolve(workspace), "widget.tsx");
  writeFileSync(sourcePath, candidateSource, "utf8");

  const startedAt = performance.now();
  let candidate;
  try {
    candidate = runCandidate();
  } catch (error) {
    candidate = { error };
  }

  let restored;
  try {
    restored = restoreActive(activeVersion);
  } catch (error) {
    return unavailable(`last-known-good snapshot restore threw: ${error.message}`);
  }
  if (!restored?.ok) {
    return unavailable(restored?.diagnostics?.[0]?.message ?? "last-known-good snapshot could not be restored");
  }
  if (candidate?.error) {
    return unavailable(`candidate run threw before producing a result: ${candidate.error.message}`);
  }
  if (typeof candidate?.ok !== "boolean") {
    return unavailable("candidate run returned an invalid result");
  }
  if (candidate?.ok === true) {
    return unavailable("failed-remix adapter expected the candidate to fail, but it was accepted");
  }
  const candidateDiagnostics = candidate.diagnostics ?? [];
  const unexpectedDiagnostic = candidateDiagnostics.find(
    (diagnostic) => !EXPECTED_CANDIDATE_CODES.has(diagnostic.code)
  );
  if (candidateDiagnostics.length === 0 || unexpectedDiagnostic) {
    return unavailable(
      unexpectedDiagnostic?.message ?? "candidate failed without a validation diagnostic"
    );
  }
  let verification;
  try {
    verification = verifyRestored(restored);
  } catch (error) {
    return unavailable(`last-known-good verification threw: ${error.message}`);
  }
  if (!verification?.ok) {
    return unavailable(verification?.diagnostics?.[0]?.message ?? "last-known-good verification failed");
  }

  return {
    state: "available",
    samples: [performance.now() - startedAt],
    candidateDiagnostics
  };
}

const EXPECTED_CANDIDATE_CODES = new Set([
  "invalid-manifest",
  "invalid-widget-source",
  "invalid-widget-tree",
  "runtime-error",
  "unsupported-import"
]);

function unavailable(reason) {
  return { state: "unavailable", reason };
}
