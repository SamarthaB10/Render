export type SdkCatalogKind = "primitive" | "style" | "provider" | "capability";

export interface SdkCatalogItem {
  name: string;
  kind: SdkCatalogKind;
  summary: string;
  inputs?: string[];
  fields?: string[];
  value?: string;
}

const SDK_CATALOG: SdkCatalogItem[] = [
  { name: "Column", kind: "primitive", summary: "Vertical layout container", inputs: ["children", "style"] },
  { name: "Row", kind: "primitive", summary: "Horizontal layout container", inputs: ["children", "style"] },
  { name: "Stack", kind: "primitive", summary: "Layered layout container", inputs: ["children", "style"] },
  { name: "Text", kind: "primitive", summary: "Text label or provider value", inputs: ["text", "style"] },
  { name: "Shape", kind: "primitive", summary: "Rounded blue shape", inputs: ["style"] },
  { name: "Gauge", kind: "primitive", summary: "Progress gauge with a maximum", inputs: ["value", "maximum", "style"] },
  { name: "WidgetStyle", kind: "style", summary: "Size and color properties for a widget node", fields: ["width", "height", "color"] },
  { name: "system.cpu", kind: "provider", summary: "Host CPU utilization percentage, sampled once per second", value: "number | unavailable" },
  { name: "system.memory", kind: "provider", summary: "Host memory utilization percentage, sampled once per second", value: "number | unavailable" },
  { name: "network", kind: "capability", summary: "Permission to access network resources" },
  { name: "filesystem.read", kind: "capability", summary: "Permission to read files" },
  { name: "filesystem.write", kind: "capability", summary: "Permission to write files" }
];

export function listSdkCatalog(): SdkCatalogItem[] {
  return SDK_CATALOG.map(cloneItem);
}

export function describeSdkCatalog(name: string): SdkCatalogItem | null {
  const item = SDK_CATALOG.find((candidate) => candidate.name === name);
  return item === undefined ? null : cloneItem(item);
}

function cloneItem(item: SdkCatalogItem): SdkCatalogItem {
  return JSON.parse(JSON.stringify(item));
}
