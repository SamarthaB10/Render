import { readFileSync } from "node:fs";

const contractURL = new URL("../contracts/render-widget-contract.v1.json", import.meta.url);
export const widgetContract = Object.freeze(JSON.parse(readFileSync(contractURL, "utf8")));

export function validateContractDefinition(definitionName, value, path = "root") {
  const schema = widgetContract.$defs?.[definitionName];
  if (!schema) throw new Error(`unknown Render Widget contract definition '${definitionName}'`);
  return validateSchema(schema, value, path, definitionName);
}

function validateSchema(schema, value, path, definitionName) {
  if (schema.$ref) {
    const referencedName = schema.$ref.match(/^#\/\$defs\/(.+)$/)?.[1];
    if (!referencedName || !widgetContract.$defs[referencedName]) {
      throw new Error(`unsupported Render Widget contract reference '${schema.$ref}'`);
    }
    return validateSchema(widgetContract.$defs[referencedName], value, path, referencedName);
  }

  if (schema.oneOf || schema.anyOf) {
    const alternatives = schema.oneOf ?? schema.anyOf;
    const results = alternatives.map((alternative) => validateSchema(alternative, value, path, definitionName));
    const matches = results.filter((issues) => issues.length === 0).length;
    const valid = schema.oneOf ? matches === 1 : matches >= 1;
    if (valid) return [];
    if (matches === 0) {
      const discriminator = value !== null && typeof value === "object" ? value.kind : undefined;
      const discriminatedResults = alternatives
        .map((alternative, index) => ({ alternative, issues: results[index] }))
        .filter(({ alternative }) => alternative.properties?.kind?.const === discriminator)
        .map(({ issues }) => issues);
      if (discriminatedResults.length > 0) {
        return discriminatedResults.reduce((best, issues) => issues.length < best.length ? issues : best);
      }
      const allowedKinds = [...new Set(alternatives.map((alternative) => alternative.properties?.kind?.const).filter(Boolean))];
      if (discriminator !== undefined && allowedKinds.length > 0) {
        return [{ path: `${path}.kind`, message: `must be one of ${allowedKinds.map(JSON.stringify).join(", ")}` }];
      }
      return results.reduce((best, issues) => issues.length < best.length ? issues : best);
    }
    return [{ path, message: "must match exactly one declared shape" }];
  }

  const issues = [];
  if (Object.hasOwn(schema, "const") && !equalJSON(value, schema.const)) {
    issues.push({ path, message: `must equal ${JSON.stringify(schema.const)}` });
  }
  if (schema.enum && !schema.enum.some((item) => equalJSON(value, item))) {
    issues.push({ path, message: `must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}` });
  }
  if (schema.type && !matchesType(value, schema.type)) {
    issues.push({ path, message: `must be ${describeType(schema.type)}` });
    return issues;
  }

  if (schema.type === "object") validateObject(schema, value, path, definitionName, issues);
  if (schema.type === "array") validateArray(schema, value, path, definitionName, issues);
  if (schema.type === "string") validateString(schema, value, path, issues);
  if (schema.type === "number" || schema.type === "integer") validateNumber(schema, value, path, issues);
  return issues;
}

function validateObject(schema, value, path, definitionName, issues) {
  for (const field of schema.required ?? []) {
    if (!Object.hasOwn(value, field)) issues.push({ path: `${path}.${field}`, message: "field is required" });
  }
  for (const [field, fieldValue] of Object.entries(value)) {
    const fieldSchema = schema.properties?.[field];
    if (fieldSchema) {
      issues.push(...validateSchema(fieldSchema, fieldValue, `${path}.${field}`, definitionName));
    } else if (schema.additionalProperties === false) {
      issues.push({ path: `${path}.${field}`, message: `field is not declared by the ${definitionName} contract` });
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      issues.push(...validateSchema(schema.additionalProperties, fieldValue, `${path}.${field}`, definitionName));
    }
  }
}

function validateArray(schema, value, path, definitionName, issues) {
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    issues.push({ path, message: `must contain at least ${schema.minItems} items` });
  }
  if (schema.items) {
    value.forEach((item, index) => {
      issues.push(...validateSchema(schema.items, item, `${path}[${index}]`, definitionName));
    });
  }
}

function validateString(schema, value, path, issues) {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    issues.push({ path, message: `must contain at least ${schema.minLength} characters` });
  }
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
    issues.push({ path, message: `must match ${schema.pattern}` });
  }
  if (schema.format === "date-time" && !isRFC3339DateTime(value)) {
    issues.push({ path, message: "must be an RFC 3339 date-time" });
  }
}

function isRFC3339DateTime(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 60 || offsetHour > 23 || offsetMinute > 59) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function validateNumber(schema, value, path, issues) {
  if (schema.minimum !== undefined && value < schema.minimum) issues.push({ path, message: `must be at least ${schema.minimum}` });
  if (schema.maximum !== undefined && value > schema.maximum) issues.push({ path, message: `must be at most ${schema.maximum}` });
  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) issues.push({ path, message: `must be greater than ${schema.exclusiveMinimum}` });
  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) issues.push({ path, message: `must be less than ${schema.exclusiveMaximum}` });
}

function matchesType(value, type) {
  switch (type) {
  case "object": return value !== null && typeof value === "object" && !Array.isArray(value);
  case "array": return Array.isArray(value);
  case "integer": return Number.isInteger(value);
  case "number": return typeof value === "number" && Number.isFinite(value);
  case "null": return value === null;
  default: return typeof value === type;
  }
}

function describeType(type) {
  if (type === "object") return "an object";
  if (type === "array") return "an array";
  if (type === "integer") return "an integer";
  return `a ${type}`;
}

function equalJSON(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
