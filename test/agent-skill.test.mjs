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
    "render init",
    "render check",
    "render run",
    "render status",
    "render rollback"
  ]) {
    assert.match(skill, new RegExp(command.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }

  assert.match(skill, /widget\.tsx/);
  assert.match(skill, /last-known-good/i);
  assert.match(skill, /unrelated/i);
});

test("Render agent skill keeps capabilities and unsupported integrations explicit", () => {
  const skill = readFileSync(skillPath, "utf8");

  assert.match(skill, /capabilit/i);
  assert.match(skill, /permission/i);
  assert.match(skill, /@render\/sdk/);
  assert.match(skill, /do not invent|must not invent|unsupported/i);
});
