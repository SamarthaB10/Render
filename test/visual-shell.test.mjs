import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(repositoryRoot, "examples", "visual-shell", "widget.tsx");
const noticePath = path.join(repositoryRoot, "examples", "visual-shell", "NOTICE.md");

test("visual shell fixture stays within the implemented catalog surface", () => {
  const fixture = readFileSync(fixturePath, "utf8");
  const notice = readFileSync(noticePath, "utf8");

  for (const api of [
    "Animate",
    "Gradient",
    "Texture",
    "SegmentedProgress",
    "Spectrum",
    "Image",
    "Icon"
  ]) {
    assert.match(fixture, new RegExp(`\\b${api}\\b`));
  }

  assert.match(fixture, /Texture\(\{[^}]*name[^}]*grain/s);
  assert.match(fixture, /Texture\(\{[^}]*name[^}]*grid/s);
  assert.match(fixture, /album-art-placeholder/);
  assert.match(fixture, /Icon\("play"\)/);
  assert.match(fixture, /SegmentedProgress\(\{[^}]*segments/s);
  assert.match(fixture, /Spectrum\(\{[^}]*values["']?\s*:\s*spectrumValues/s);
  assert.match(fixture, /Animate\(Text\([^)]*\),\s*\{[^}]*property["']?\s*:\s*"opacity"/s);
  assert.match(fixture, /capabilities": \[\]/);
  assert.doesNotMatch(fixture, /spotify|https?:|fetch\(|window\.|document\./i);

  assert.match(notice, /placeholder/i);
  assert.match(notice, /source.*license|license.*source/is);
  assert.match(notice, /Lucide|Feather/);
  assert.match(notice, /attribution/i);
});
