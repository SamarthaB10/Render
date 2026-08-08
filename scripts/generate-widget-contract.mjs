import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(root, "contracts/render-widget-contract.v1.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const metadata = contract["x-render"];
const widgetTreeSwift = readFileSync(path.join(root, "Sources/RenderHostCore/WidgetTree.swift"), "utf8");
const workerProtocolSwift = readFileSync(path.join(root, "Sources/RenderHostCore/WorkerProtocol.swift"), "utf8");
const renderHostMainSwift = readFileSync(path.join(root, "Sources/RenderHost/RenderHostMain.swift"), "utf8");

if (contract.contractVersion !== 1) throw new Error("render widget contract must declare contractVersion 1");
if (!metadata || !Array.isArray(metadata.nodeKinds) || !Array.isArray(metadata.providers) || !Array.isArray(metadata.actions)) {
  throw new Error("render widget contract must declare x-render nodeKinds, providers, and actions");
}
if (!metadata.connectorScopes || typeof metadata.connectorScopes !== "object") {
  throw new Error("render widget contract must declare x-render connectorScopes");
}
if (!metadata.workerProtocol || !Number.isInteger(metadata.workerProtocol.version) || !Array.isArray(metadata.workerProtocol.messageKinds)) {
  throw new Error("render widget contract must declare x-render workerProtocol version and messageKinds");
}

const nodeKinds = contract.$defs.WidgetNode.properties.kind.enum;
const providerNames = contract.$defs.WidgetNode.properties.provider.enum;
const metadataNames = (items) => items.map((item) => item.name);
const actionNames = metadataNames(metadata.actions);
const workerVariants = contract.$defs.WorkerMessage.oneOf;
const workerMessageKinds = [...new Set(workerVariants.map((variant) => variant.properties.kind.const))];
const workerMessageFields = [...new Set(workerVariants.flatMap((variant) => Object.keys(variant.properties)))];
const workerMessageShapes = {};
for (const variant of workerVariants) {
  (workerMessageShapes[variant.properties.kind.const] ??= []).push(variant);
}
const providerConnectors = Object.fromEntries(metadata.providers.filter((item) => item.connector).map((item) => [item.name, item.connector]));
const actionConnectors = Object.fromEntries(metadata.actions.filter((item) => item.connector).map((item) => [item.name, item.connector]));
const contractCatalog = [
  ...metadata.nodeKinds.map((item) => ({
    name: item.sdkName ?? `${item.name[0].toUpperCase()}${item.name.slice(1)}`,
    wireName: item.name,
    kind: "primitive",
    summary: item.summary
  })),
  ...metadata.providers.map((item) => ({ name: item.name, kind: "provider", summary: item.summary })),
  ...metadata.actions.map((item) => ({ name: item.name, kind: "action", actionKind: item.kind, summary: item.summary })),
  ...metadata.connectors.map((name) => ({ name, kind: "connector", summary: `${name} host-owned connector` })),
  ...metadata.capabilities.map((name) => ({ name, kind: "capability", summary: `Declared ${name} capability` }))
];

assertSame("node kinds", nodeKinds, metadataNames(metadata.nodeKinds));
assertSame("providers", providerNames, metadataNames(metadata.providers));
assertSameSet("actions", contract.$defs.WidgetAction.oneOf[0].properties.name.enum.concat(contract.$defs.WidgetAction.oneOf[1].properties.name.const), actionNames);
assertSameSet("connectors", metadata.connectors, Object.keys(metadata.connectorScopes));
assertSame("manifest capabilities", contract.$defs.WidgetManifest.properties.capabilities.items.enum, metadata.capabilities);
assertSame("manifest anchor corners", contract.$defs.WidgetManifest.properties.anchor.properties.corner.enum, metadata.anchorCorners);
assertSame("manifest themes", contract.$defs.WidgetManifest.properties.theme.properties.default.enum, metadata.themes);
assertSame("manifest providers", contract.$defs.WidgetManifest.properties.subscribe.items.enum, providerNames);
assertSame("manifest connectors", contract.$defs.WidgetManifest.properties.accounts.items.properties.connector.enum, metadata.connectors);
assertSameSet("worker message kinds", workerMessageKinds, metadata.workerProtocol.messageKinds);
if (workerVariants.some((variant) => variant.properties.protocolVersion.const !== metadata.workerProtocol.version)) {
  throw new Error("contract metadata drift for worker protocol version");
}
assertSwiftCodingFields("WidgetTree", Object.keys(contract.$defs.WidgetNode.properties), contract.$defs.WidgetNode.required, widgetTreeSwift, true);
assertSwiftStoredFields("WorkerMessage", workerMessageFields, workerProtocolSwift);
assertSwiftCodingFields("RuntimeManifest", Object.keys(contract.$defs.WidgetManifest.properties), contract.$defs.WidgetManifest.required, renderHostMainSwift, false);

const generatedContractTypes = Object.entries(contract.$defs)
  .map(([name, schema]) => `export type ${name}Contract = ${schemaTypeScript(schema)};`)
  .join("\n\n");

const generatedTypeScript = `// Generated by scripts/generate-widget-contract.mjs. Do not edit.\n\nexport const RENDER_WIDGET_CONTRACT_VERSION = ${contract.contractVersion} as const;\nexport const RENDER_WORKER_PROTOCOL_VERSION = ${metadata.workerProtocol.version} as const;\nexport const WIDGET_WORKER_MESSAGE_KINDS = ${json(metadata.workerProtocol.messageKinds)} as const;\nexport type WorkerMessageKind = typeof WIDGET_WORKER_MESSAGE_KINDS[number];\nexport const WIDGET_NODE_KINDS = ${json(nodeKinds)} as const;\nexport type WidgetNodeKind = typeof WIDGET_NODE_KINDS[number];\nexport const WIDGET_CAPABILITIES = ${json(metadata.capabilities)} as const;\nexport type WidgetCapability = typeof WIDGET_CAPABILITIES[number];\nexport const WIDGET_ANCHOR_CORNERS = ${json(metadata.anchorCorners)} as const;\nexport type WidgetAnchorCorner = typeof WIDGET_ANCHOR_CORNERS[number];\nexport const WIDGET_THEME_NAMES = ${json(metadata.themes)} as const;\nexport type WidgetThemeName = typeof WIDGET_THEME_NAMES[number];\nexport const WIDGET_PROVIDER_NAMES = ${json(providerNames)} as const;\nexport type WidgetProviderName = typeof WIDGET_PROVIDER_NAMES[number];\nexport const WIDGET_ACTION_NAMES = ${json(actionNames)} as const;\nexport type WidgetActionName = typeof WIDGET_ACTION_NAMES[number];\nexport const WIDGET_CONNECTOR_NAMES = ${json(metadata.connectors)} as const;\nexport type WidgetConnectorName = typeof WIDGET_CONNECTOR_NAMES[number];\nexport const WIDGET_CONNECTOR_SCOPES = ${json(metadata.connectorScopes)} as const;\nexport const WIDGET_PROVIDER_CONNECTORS = ${json(providerConnectors)} as const;\nexport const WIDGET_ACTION_CONNECTORS = ${json(actionConnectors)} as const;\nexport const WIDGET_CONTRACT_CATALOG = ${json(contractCatalog)} as const;\n\n${generatedContractTypes}\n`;

const generatedSwift = `// Generated by scripts/generate-widget-contract.mjs. Do not edit.\n\nimport Foundation\n\npublic struct WorkerMessageShape: Sendable {\n    public let requiredFields: Set<String>\n    public let allowedFields: Set<String>\n\n    public init(requiredFields: Set<String>, allowedFields: Set<String>) {\n        self.requiredFields = requiredFields\n        self.allowedFields = allowedFields\n    }\n}\n\npublic enum RenderWidgetContract {\n    public static let version = ${contract.contractVersion}\n    public static let workerProtocolVersion = ${metadata.workerProtocol.version}\n    public static let widgetNodeFields: Set<String> = ${swiftSet(Object.keys(contract.$defs.WidgetNode.properties))}\n    public static let workerMessageFields: Set<String> = ${swiftSet(workerMessageFields)}\n    public static let workerMessageShapes: [String: [WorkerMessageShape]] = ${swiftWorkerMessageShapes(workerMessageShapes)}\n    public static let workerMessageKinds: Set<String> = ${swiftSet(metadata.workerProtocol.messageKinds)}\n    public static let nodeKinds: Set<String> = ${swiftSet(nodeKinds)}\n    public static let capabilities: Set<String> = ${swiftSet(metadata.capabilities)}\n    public static let anchorCorners: Set<String> = ${swiftSet(metadata.anchorCorners)}\n    public static let themes: Set<String> = ${swiftSet(metadata.themes)}\n    public static let providers: Set<String> = ${swiftSet(providerNames)}\n    public static let actions: Set<String> = ${swiftSet(actionNames)}\n    public static let connectors: Set<String> = ${swiftSet(metadata.connectors)}\n    public static let connectorScopes: [String: Set<String>] = ${swiftDictionary(metadata.connectorScopes)}\n    public static let providerConnectors: [String: String] = ${swiftStringDictionary(providerConnectors)}\n    public static let actionConnectors: [String: String] = ${swiftStringDictionary(actionConnectors)}\n}\n\npublic enum WidgetNodeKind: String, Codable, CaseIterable, Sendable {\n${nodeKinds.map((kind) => `    case ${kind}`).join("\n")}\n}\n\npublic enum WorkerMessageKind: String, Codable, CaseIterable, Sendable {\n${metadata.workerProtocol.messageKinds.map((kind) => `    case ${kind}`).join("\n")}\n}\n`;

const markdownCode = (value) => "`" + value + "`";
const generatedMarkdown = [
  "<!-- Generated by scripts/generate-widget-contract.mjs. Do not edit. -->",
  "",
  `# Render Widget Contract v${contract.contractVersion}`,
  "",
  "This is the agent-facing reference generated from [the canonical JSON Schema](../contracts/render-widget-contract.v1.json). Use the schema as the source of truth; this page is a readable index.",
  "",
  "## Widget artifact",
  "",
  `A Widget contains a validated ${markdownCode("manifest")} and a retained ${markdownCode("tree")}. A Widget must use the SDK catalog for every primitive, provider, style, action, and capability.`,
  "",
  "## Primitives",
  "",
  "| Kind | Summary |",
  "| --- | --- |",
  ...metadata.nodeKinds.map((item) => `| ${markdownCode(item.name)} | ${item.summary} |`),
  "",
  "## Capabilities",
  "",
  ...metadata.capabilities.map((item) => `- ${markdownCode(item)}`),
  "",
  "Capabilities are explicit in the manifest and require user permission when the host needs them.",
  "",
  "## Connector scopes",
  "",
  ...Object.entries(metadata.connectorScopes).map(([connector, scopes]) => `- ${markdownCode(connector)}: ${scopes.map(markdownCode).join(", ")}`),
  "",
  "Widgets declare connector scopes in the manifest. The host owns credentials and asks the user for permission; Widget source never receives tokens.",
  "",
  "## Providers",
  "",
  "| Provider | Connector | Summary |",
  "| --- | --- | --- |",
  ...metadata.providers.map((item) => `| ${markdownCode(item.name)} | ${item.connector ? markdownCode(item.connector) : "—"} | ${item.summary} |`),
  "",
  "## Actions",
  "",
  "| Action | Kind | Connector | Summary |",
  "| --- | --- | --- | --- |",
  ...metadata.actions.map((item) => `| ${markdownCode(item.name)} | ${markdownCode(item.kind)} | ${item.connector ? markdownCode(item.connector) : "—"} | ${item.summary} |`),
  "",
  "## Worker protocol",
  "",
  `Protocol version: ${markdownCode(String(metadata.workerProtocol.version))}`,
  "",
  `Message kinds: ${metadata.workerProtocol.messageKinds.map(markdownCode).join(", ")}`,
  "",
  "## Contract evolution",
  "",
  "Changes within contract version 1 must be additive. Breaking changes require a new contract version and an explicit compatibility check. Generated outputs are checked into the repository and CI must reject drift.",
  ""
].join("\n");

const outputs = new Map([
  ["packages/sdk/src/widget-contract.generated.ts", generatedTypeScript],
  ["Sources/RenderHostCore/WidgetContractGenerated.swift", generatedSwift],
  ["docs/sdk-contract.md", generatedMarkdown]
]);
const check = process.argv.includes("--check");
for (const [relativePath, content] of outputs) {
  const outputPath = path.join(root, relativePath);
  if (check) {
    const current = readFileSync(outputPath, "utf8");
    if (current !== content) throw new Error(`${relativePath} is stale; run npm run contract:generate`);
  } else {
    writeFileSync(outputPath, content);
  }
}

function json(value) {
  return JSON.stringify(value, null, 2).replaceAll("\n", "\n");
}

function schemaTypeScript(schema) {
  if (schema.$ref) return `${schema.$ref.split("/").at(-1)}Contract`;
  if (Object.hasOwn(schema, "const")) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (schema.oneOf || schema.anyOf) {
    return (schema.oneOf ?? schema.anyOf).map((item) => schemaTypeScript(item)).join(" | ");
  }
  if (schema.type === "array") return `${parenthesizeType(schemaTypeScript(schema.items ?? {}))}[]`;
  if (schema.type === "object") {
    const properties = Object.entries(schema.properties ?? {});
    if (properties.length === 0) {
      return schema.additionalProperties && typeof schema.additionalProperties === "object"
        ? `{ [key: string]: ${schemaTypeScript(schema.additionalProperties)} }`
        : "Record<string, unknown>";
    }
    const required = new Set(schema.required ?? []);
    const fields = properties.map(([name, fieldSchema]) => {
      const propertyName = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
      return `  ${propertyName}${required.has(name) ? "" : "?"}: ${schemaTypeScript(fieldSchema)};`;
    });
    return `{\n${fields.join("\n")}\n}`;
  }
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (schema.type === "string" || schema.type === "boolean" || schema.type === "null") return schema.type;
  return "unknown";
}

function parenthesizeType(type) {
  return type.includes(" | ") ? `(${type})` : type;
}

function swiftSet(values) {
  return `[${values.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(", ")}]`;
}

function swiftDictionary(values) {
  return `[${Object.entries(values).map(([key, scopes]) => `"${key}": ${swiftSet(scopes)}`).join(", ")}]`;
}

function swiftStringDictionary(values) {
  return `[${Object.entries(values).map(([key, value]) => `"${key}": "${value}"`).join(", ")}]`;
}

function swiftWorkerMessageShapes(shapes) {
  return `[${Object.entries(shapes).map(([kind, variants]) => {
    const values = variants.map((variant) => `.init(requiredFields: ${swiftSet(variant.required)}, allowedFields: ${swiftSet(Object.keys(variant.properties))})`);
    return `"${kind}": [${values.join(", ")}]`;
  }).join(", ")}]`;
}

function assertSame(label, expected, actual) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(`contract metadata drift for ${label}`);
  }
}

function assertSameSet(label, expected, actual) {
  if (JSON.stringify([...expected].sort()) !== JSON.stringify([...actual].sort())) {
    throw new Error(`contract metadata drift for ${label}`);
  }
}

function swiftTypeSource(label, source) {
  const publicStart = source.indexOf(`public struct ${label}`);
  const internalStart = source.indexOf(`struct ${label}`);
  const start = publicStart >= 0 ? publicStart : internalStart;
  if (start < 0) throw new Error(`missing Swift decoder ${label}`);
  const nextType = source.indexOf("\npublic struct ", start + 1);
  const nextInternalType = source.indexOf("\nstruct ", start + 1);
  const ends = [nextType, nextInternalType].filter((value) => value >= 0);
  return source.slice(start, ends.length === 0 ? undefined : Math.min(...ends));
}

function assertSwiftStoredFields(label, fields, source) {
  const typeSource = swiftTypeSource(label, source);
  const missing = fields.filter((field) => !new RegExp(`\\b(?:public\\s+)?let\\s+${field}\\s*:`).test(typeSource));
  if (missing.length > 0) throw new Error(`${label} Swift decoder is missing canonical fields: ${missing.join(", ")}`);
}

function assertSwiftCodingFields(label, fields, requiredFields, source, requireEncoding) {
  const typeSource = swiftTypeSource(label, source);
  const codingKeysStart = typeSource.indexOf("enum CodingKeys");
  if (codingKeysStart < 0) throw new Error(`${label} Swift decoder must declare CodingKeys`);
  const codingKeysBody = bracedBody(typeSource, codingKeysStart);
  const codingKeys = new Map();
  for (const match of codingKeysBody.matchAll(/case\s+([^\n}]+)/g)) {
    for (const declaration of match[1].split(",")) {
      const keyMatch = declaration.trim().match(/^(\w+)(?:\s*=\s*"([^"]+)")?/);
      if (keyMatch) codingKeys.set(keyMatch[2] ?? keyMatch[1], keyMatch[1]);
    }
  }
  const decoderStart = typeSource.indexOf("init(from decoder");
  const decoderEnd = typeSource.indexOf("func encode(to", decoderStart);
  const decoderSource = typeSource.slice(decoderStart, decoderEnd < 0 ? undefined : decoderEnd);
  const encoderSource = decoderEnd < 0 ? "" : typeSource.slice(decoderEnd);
  const missing = fields.filter((field) => {
    const codingKey = codingKeys.get(field);
    if (!codingKey) return true;
    const decodeMatch = decoderSource.match(new RegExp(`decode(IfPresent)?\\([^\\n]*forKey:\\s*\\.${codingKey}\\b`));
    if (!decodeMatch || (requiredFields.includes(field) && decodeMatch[1] === "IfPresent")) return true;
    return requireEncoding && !new RegExp(`forKey:\\s*\\.${codingKey}\\b`).test(encoderSource);
  });
  if (missing.length > 0) throw new Error(`${label} Swift coding is missing canonical fields: ${missing.join(", ")}`);
}

function bracedBody(source, start) {
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(open + 1, index);
  }
  throw new Error("unterminated Swift declaration while checking generated contract coverage");
}
