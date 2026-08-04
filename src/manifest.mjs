import { validateAccountRequirements } from "./integrations.mjs";
import path from "node:path";
import { existsSync, realpathSync, statSync } from "node:fs";
import {
  WIDGET_ANCHOR_CORNERS,
  WIDGET_CAPABILITIES,
  WIDGET_THEME_NAMES
} from "../packages/sdk/src/widget-contract.generated.ts";

const ROOT_FIELDS = new Set([
  "schemaVersion",
  "name",
  "sdkVersion",
  "size",
  "resizable",
  "windowShape",
  "anchor",
  "adjustable",
  "capabilities",
  "subscribe",
  "accounts",
  "assets",
  "fonts",
  "theme"
]);
const CAPABILITIES = new Set(WIDGET_CAPABILITIES);
const CORNERS = new Set(WIDGET_ANCHOR_CORNERS);
const THEMES = new Set(WIDGET_THEME_NAMES);

export function extractManifest(source) {
  return readManifest(source).manifest;
}

export function updateManifest(source, update) {
  const { manifest, objectStart, objectEnd } = readManifest(source);
  const nextManifest = update(manifest);
  return [
    source.slice(0, objectStart),
    JSON.stringify(nextManifest, null, 2),
    source.slice(objectEnd + 1)
  ].join("");
}

export function validateManifest(manifest, options = {}) {
  const issues = [];
  if (!isRecord(manifest)) {
    return [{ path: "manifest", message: "must be an object" }];
  }

  if (manifest.schemaVersion !== 1) {
    issues.push({ path: "schemaVersion", message: "must equal 1" });
  }
  requireString(manifest, "name", issues);
  requireString(manifest, "sdkVersion", issues);

  if (!isRecord(manifest.size)) {
    issues.push({ path: "size", message: "must be an object" });
  } else {
    requirePositiveNumber(manifest.size, "width", "size.width", issues);
    requirePositiveNumber(manifest.size, "height", "size.height", issues);
  }

  if (manifest.resizable !== undefined && typeof manifest.resizable !== "boolean") {
    issues.push({ path: "resizable", message: "must be a boolean" });
  }

  if (manifest.windowShape !== undefined && !["rectangle", "circle"].includes(manifest.windowShape)) {
    issues.push({ path: "windowShape", message: "must be \"rectangle\" or \"circle\"" });
  }
  if (
    manifest.windowShape === "circle" &&
    isRecord(manifest.size) &&
    typeof manifest.size.width === "number" &&
    typeof manifest.size.height === "number" &&
    manifest.size.width !== manifest.size.height
  ) {
    issues.push({ path: "size", message: "circle widgets require equal width and height" });
  }

  if (!isRecord(manifest.anchor)) {
    issues.push({ path: "anchor", message: "must be an object" });
  } else {
    if (!CORNERS.has(manifest.anchor.corner)) {
      issues.push({ path: "anchor.corner", message: "must be a supported corner" });
    }
    if (!isRecord(manifest.anchor.offset)) {
      issues.push({ path: "anchor.offset", message: "must be an object" });
    } else {
      requireFiniteNumber(manifest.anchor.offset, "x", "anchor.offset.x", issues);
      requireFiniteNumber(manifest.anchor.offset, "y", "anchor.offset.y", issues);
    }
  }

  if (manifest.adjustable !== undefined) {
    validateAdjustable(manifest.adjustable, issues);
  }

  if (!Array.isArray(manifest.capabilities)) {
    issues.push({ path: "capabilities", message: "must be an array" });
  } else {
    manifest.capabilities.forEach((capability, index) => {
      if (!CAPABILITIES.has(capability)) {
        issues.push({
          path: `capabilities[${index}]`,
          message: "must be an allowed capability"
        });
      }
    });
  }

  if (!Array.isArray(manifest.subscribe) || manifest.subscribe.some((item) => typeof item !== "string")) {
    issues.push({ path: "subscribe", message: "must be an array of strings" });
  }

  if (manifest.assets !== undefined) {
    if (!Array.isArray(manifest.assets)) {
      issues.push({ path: "assets", message: "must be an array of relative asset paths" });
    } else {
      const workspaceRoot = options.workspace ? path.resolve(options.workspace) : null;
      const assetRoot = workspaceRoot ? path.join(workspaceRoot, "assets") : null;
      const realWorkspaceRoot = workspaceRoot && existsSync(workspaceRoot) ? realpathSync(workspaceRoot) : null;
      const realAssetRoot = assetRoot && existsSync(assetRoot) ? realpathSync(assetRoot) : null;
      const seen = new Set();
      if (realWorkspaceRoot && realAssetRoot && !isInside(realAssetRoot, realWorkspaceRoot)) {
        issues.push({ path: "assets", message: "workspace assets directory must remain inside the workspace" });
      }
      manifest.assets.forEach((asset, index) => {
        const issuePath = `assets[${index}]`;
        if (typeof asset !== "string" || asset.trim() === "") {
          issues.push({ path: issuePath, message: "must be a non-empty relative asset path" });
          return;
        }
        const normalized = asset.replaceAll("\\", "/");
        const resolved = assetRoot ? path.resolve(assetRoot, normalized) : null;
        if (path.isAbsolute(normalized) || normalized.split("/").includes("..") || (assetRoot && !resolved.startsWith(`${assetRoot}${path.sep}`))) {
          issues.push({ path: issuePath, message: "must stay inside the workspace assets directory" });
          return;
        }
        if (seen.has(normalized)) {
          issues.push({ path: issuePath, message: "must not contain duplicate asset paths" });
          return;
        }
        seen.add(normalized);
        if (assetRoot && !existsSync(resolved)) {
          issues.push({ path: issuePath, message: `asset file does not exist at assets/${normalized}` });
        } else if (assetRoot && !statSync(resolved).isFile()) {
          issues.push({ path: issuePath, message: `asset path must point to a file: assets/${normalized}` });
        } else if (realAssetRoot && !isInside(realpathSync(resolved), realAssetRoot)) {
          issues.push({ path: issuePath, message: "asset symlinks must remain inside the workspace assets directory" });
        }
      });
    }
  }

  if (manifest.fonts !== undefined) {
    if (!Array.isArray(manifest.fonts)) {
      issues.push({ path: "fonts", message: "must be an array of local font declarations" });
    } else {
      const declaredAssets = new Set(Array.isArray(manifest.assets) ? manifest.assets.map((item) => typeof item === "string" ? item.replaceAll("\\", "/") : item) : []);
      const seenFonts = new Set();
      manifest.fonts.forEach((font, index) => {
        const issuePath = `fonts[${index}]`;
        if (!isRecord(font)) {
          issues.push({ path: issuePath, message: "must be an object with an asset path and optional family" });
          return;
        }
        for (const field of Object.keys(font)) {
          if (!new Set(["asset", "family"]).has(field)) issues.push({ path: `${issuePath}.${field}`, message: "unknown font declaration field" });
        }
        if (typeof font.asset !== "string" || font.asset.trim() === "") {
          issues.push({ path: `${issuePath}.asset`, message: "must name a declared .ttf or .otf asset" });
          return;
        }
        const asset = font.asset.replaceAll("\\", "/");
        if (!/\.(?:ttf|otf)$/i.test(asset)) issues.push({ path: `${issuePath}.asset`, message: "font assets must use a .ttf or .otf extension" });
        if (!declaredAssets.has(asset)) issues.push({ path: `${issuePath}.asset`, message: `font asset must also be listed in manifest.assets: ${asset}` });
        if (seenFonts.has(asset)) issues.push({ path: `${issuePath}.asset`, message: "font asset must not be declared more than once" });
        seenFonts.add(asset);
        if (font.family !== undefined && (typeof font.family !== "string" || font.family.trim() === "")) {
          issues.push({ path: `${issuePath}.family`, message: "family must be a non-empty string when provided" });
        }
      });
    }
  }

  if (manifest.accounts !== undefined) {
    issues.push(...validateAccountRequirements(manifest.accounts));
  }

  if (manifest.theme !== undefined) {
    validateTheme(manifest.theme, issues);
  }

  for (const field of Object.keys(manifest)) {
    if (!ROOT_FIELDS.has(field)) {
      issues.push({ path: field, message: "unknown manifest field" });
    }
  }
  return issues;
}

function findObjectEnd(source, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return index;
  }
  throw new Error("widget manifest has an unterminated object");
}

function readManifest(source) {
  const callStart = source.indexOf("widget(");
  if (callStart < 0) {
    throw new Error("widget.tsx must export a default widget({...}, render) call");
  }

  const objectStart = source.indexOf("{", callStart);
  if (objectStart < 0) {
    throw new Error("widget() must start with a manifest object");
  }
  const objectEnd = findObjectEnd(source, objectStart);
  const rawManifest = source.slice(objectStart, objectEnd + 1);

  try {
    return { manifest: JSON.parse(rawManifest), objectStart, objectEnd };
  } catch {
    throw new Error(
      "the widget manifest must be a JSON-compatible object with quoted keys and values"
    );
  }
}

function requireString(object, field, issues) {
  if (typeof object[field] !== "string" || object[field].trim() === "") {
    issues.push({ path: field, message: "must be a non-empty string" });
  }
}

function requirePositiveNumber(object, field, path, issues) {
  requireFiniteNumber(object, field, path, issues);
  if (typeof object[field] === "number" && object[field] <= 0) {
    issues.push({ path, message: "must be greater than zero" });
  }
}

function requireFiniteNumber(object, field, path, issues) {
  if (typeof object[field] !== "number" || !Number.isFinite(object[field])) {
    issues.push({ path, message: "must be a finite number" });
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isInside(candidate, root) {
  const rootPath = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return candidate === root || candidate.startsWith(rootPath);
}

function validateAdjustable(adjustable, issues) {
  if (!isRecord(adjustable)) {
    issues.push({ path: "adjustable", message: "must be an object" });
    return;
  }
  if (adjustable.enabled !== undefined && typeof adjustable.enabled !== "boolean") {
    issues.push({ path: "adjustable.enabled", message: "must be a boolean" });
  }
  const minSize = adjustable.minSize;
  const maxSize = adjustable.maxSize;
  if (minSize !== undefined) validateSizeObject(minSize, "adjustable.minSize", issues);
  if (maxSize !== undefined) validateSizeObject(maxSize, "adjustable.maxSize", issues);
  if (isRecord(minSize) && isRecord(maxSize)) {
    if (maxSize.width < minSize.width) issues.push({ path: "adjustable.maxSize.width", message: "must be at least adjustable.minSize.width" });
    if (maxSize.height < minSize.height) issues.push({ path: "adjustable.maxSize.height", message: "must be at least adjustable.minSize.height" });
  }

  if (adjustable.responsive !== undefined) {
    const responsive = adjustable.responsive;
    if (!isRecord(responsive)) {
      issues.push({ path: "adjustable.responsive", message: "must be an object" });
      return;
    }
    if (!isRecord(responsive.modes) || Object.keys(responsive.modes).length === 0) {
      issues.push({ path: "adjustable.responsive.modes", message: "must be a non-empty object" });
    } else {
      for (const [mode, bounds] of Object.entries(responsive.modes)) {
        validateModeBounds(bounds, `adjustable.responsive.modes.${mode}`, issues);
      }
      if (typeof responsive.default !== "string" || !(responsive.default in responsive.modes)) {
        issues.push({ path: "adjustable.responsive.default", message: "must name one of the declared responsive modes" });
      }
    }
  }
}

function validateSizeObject(value, path, issues) {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  requirePositiveNumber(value, "width", `${path}.width`, issues);
  requirePositiveNumber(value, "height", `${path}.height`, issues);
}

function validateModeBounds(value, path, issues) {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  requirePositiveNumber(value, "minWidth", `${path}.minWidth`, issues);
  requirePositiveNumber(value, "minHeight", `${path}.minHeight`, issues);
}

function validateTheme(theme, issues) {
  if (!isRecord(theme)) {
    issues.push({ path: "theme", message: "must be an object" });
    return;
  }
  if (!THEMES.has(theme.default)) {
    issues.push({ path: "theme.default", message: "must be a supported Render theme" });
  }
  if (theme.options !== undefined) {
    if (!Array.isArray(theme.options)) {
      issues.push({ path: "theme.options", message: "must be an array of supported Render themes" });
    } else {
      theme.options.forEach((option, index) => {
        if (!THEMES.has(option)) {
          issues.push({ path: `theme.options[${index}]`, message: "must be a supported Render theme" });
        }
      });
      if (typeof theme.default === "string" && !theme.options.includes(theme.default)) {
        issues.push({ path: "theme.default", message: "must be included in theme.options" });
      }
    }
  }
  for (const field of Object.keys(theme)) {
    if (!["default", "options"].includes(field)) {
      issues.push({ path: `theme.${field}`, message: "unknown theme field" });
    }
  }
}
