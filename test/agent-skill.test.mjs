import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillPath = path.join(repositoryRoot, "skills", "render-widget", "SKILL.md");

test("Render agent skill defines the complete widget lifecycle", () => {
  const skill = readFileSync(skillPath, "utf8");

  for (const command of [
    "render sdk list",
    "render sdk describe",
    "render init",
    "render scaffold",
    "render check",
    "render run",
    "render status",
    "render fleet run",
    "render fleet status",
    "render fleet stop",
    "render fleet relaunch",
    "render rollback"
  ]) {
    assert.match(skill, new RegExp(command.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }

  assert.match(skill, /widget\.tsx/);
  assert.match(skill, /last-known-good/i);
  assert.match(skill, /unrelated/i);
});

test("Render agent skill points agents to exact SDK contracts", () => {
  const skill = readFileSync(skillPath, "utf8");

  assert.match(skill, /--json/);
  assert.match(skill, /signature/i);
  assert.match(skill, /canonical `?example/i);
  assert.match(skill, /scaffold/);
});

test("Render agent skill keeps capabilities and unsupported integrations explicit", () => {
  const skill = readFileSync(skillPath, "utf8");

  assert.match(skill, /capabilit/i);
  assert.match(skill, /permission/i);
  assert.match(skill, /@render\/sdk/);
  assert.match(skill, /do not invent|must not invent|unsupported/i);
});
