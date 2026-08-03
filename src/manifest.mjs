import { validateAccountRequirements } from "./integrations.mjs";

const ROOT_FIELDS = new Set([
  "schemaVersion",
  "name",
  "sdkVersion",
  "size",
  "anchor",
  "adjustable",
  "capabilities",
  "subscribe",
  "accounts"
]);
const CAPABILITIES = new Set(["network", "filesystem.read", "filesystem.write"]);
const CORNERS = new Set(["top-left", "top-right", "bottom-left", "bottom-right"]);

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

export function validateManifest(manifest) {
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

  if (manifest.accounts !== undefined) {
    issues.push(...validateAccountRequirements(manifest.accounts));
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
