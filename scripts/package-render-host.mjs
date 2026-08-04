#!/usr/bin/env node

import { chmodSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configuration = process.argv.includes("--release") ? "release" : "debug";
const signingIdentity = process.env.RENDER_SIGNING_IDENTITY ?? "-";

export function packageRenderHost({ root = repoRoot, configuration: requested = configuration, sign = true } = {}) {
  const buildResult = spawnSync("swift", ["build", "--configuration", requested], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (buildResult.status !== 0) {
    return { ok: false, diagnostics: [{ code: "native-build-failed", path: "Package.swift", message: "swift build failed" }] };
  }

  const binary = path.join(root, ".build", requested, "RenderHost");
  const app = path.join(root, ".build", requested, "RenderHost.app");
  const contents = path.join(app, "Contents");
  const macOS = path.join(contents, "MacOS");
  mkdirSync(macOS, { recursive: true });
  const executable = path.join(macOS, "RenderHost");
  copyFileSync(binary, executable);
  chmodSync(executable, 0o755);
  copyFileSync(path.join(root, "Sources", "RenderHost", "Info.plist"), path.join(contents, "Info.plist"));
  writeFileSync(path.join(contents, "PkgInfo"), "APPL????\n", "utf8");

  if (sign) {
    const signResult = spawnSync("codesign", ["--force", "--deep", "--sign", signingIdentity, app], {
      cwd: root,
      encoding: "utf8"
    });
    if (signResult.status !== 0) {
      return { ok: false, app, diagnostics: [{ code: "code-sign-failed", path: app, message: signResult.stderr.trim() || "codesign failed" }] };
    }
  }

  const info = readFileSync(path.join(contents, "Info.plist"), "utf8");
  return {
    ok: info.includes("NSRemindersFullAccessUsageDescription"),
    operation: "package-host",
    configuration: requested,
    app,
    executable,
    signingIdentity,
    diagnostics: info.includes("NSRemindersFullAccessUsageDescription") ? [] : [{
      code: "missing-reminders-usage-description",
      path: "Contents/Info.plist",
      message: "Info.plist must declare NSRemindersFullAccessUsageDescription"
    }]
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = packageRenderHost();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
