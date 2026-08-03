import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function preferencesPath(workspace) {
  return path.join(path.resolve(workspace), ".render/runtime/preferences.json");
}

export function readPreferences(workspace) {
  const filePath = preferencesPath(workspace);
  if (!existsSync(filePath)) return { width: null, height: null, mode: "auto", locked: false };
  try {
    const value = JSON.parse(readFileSync(filePath, "utf8"));
    return {
      width: finitePositiveOrNull(value.width),
      height: finitePositiveOrNull(value.height),
      mode: typeof value.mode === "string" && value.mode.length > 0 ? value.mode : "auto",
      locked: value.locked === true
    };
  } catch {
    return { width: null, height: null, mode: "auto", locked: false };
  }
}

export function writePreferences(workspace, next) {
  const preferences = {
    width: finitePositiveOrNull(next.width),
    height: finitePositiveOrNull(next.height),
    mode: typeof next.mode === "string" && next.mode.length > 0 ? next.mode : "auto",
    locked: next.locked === true
  };
  writeFileSync(preferencesPath(workspace), `${JSON.stringify(preferences, null, 2)}\n`, "utf8");
  return preferences;
}

function finitePositiveOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
