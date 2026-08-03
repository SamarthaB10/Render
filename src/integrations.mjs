import { WIDGET_CONNECTOR_SCOPES } from "../packages/sdk/src/widget-contract.generated.ts";

const SPOTIFY_SCOPES = new Set(WIDGET_CONNECTOR_SCOPES.spotify);
const REMINDERS_SCOPES = new Set(WIDGET_CONNECTOR_SCOPES.reminders);

export const CONNECTOR_SCOPES = Object.freeze({
  spotify: SPOTIFY_SCOPES,
  reminders: REMINDERS_SCOPES
});

export const SUPPORTED_CONNECTORS = new Set(Object.keys(CONNECTOR_SCOPES));

export function validateAccountRequirements(accounts) {
  const issues = [];
  if (!Array.isArray(accounts)) {
    return [{ path: "accounts", message: "must be an array" }];
  }

  const seen = new Set();
  accounts.forEach((account, index) => {
    const path = `accounts[${index}]`;
    if (!isRecord(account)) {
      issues.push({ path, message: "must be an object" });
      return;
    }
    if (typeof account.connector !== "string" || account.connector.trim() === "") {
      issues.push({ path: `${path}.connector`, message: "must be a non-empty string" });
      return;
    }
    if (seen.has(account.connector)) {
      issues.push({ path: `${path}.connector`, message: `duplicate connector '${account.connector}'` });
    }
    seen.add(account.connector);

    const connectorScopes = CONNECTOR_SCOPES[account.connector];
    if (!connectorScopes) {
      issues.push({
        path: `${path}.connector`,
        message: `unsupported connector '${account.connector}'; use render sdk list to choose a supported connector`
      });
      return;
    }
    if (!Array.isArray(account.scopes) || account.scopes.length === 0 || account.scopes.some((scope) => typeof scope !== "string" || scope.trim() === "")) {
      issues.push({ path: `${path}.scopes`, message: "must be a non-empty array of strings" });
      return;
    }
    const scopes = new Set();
    account.scopes.forEach((scope, scopeIndex) => {
      if (scopes.has(scope)) {
        issues.push({ path: `${path}.scopes[${scopeIndex}]`, message: `duplicate scope '${scope}'` });
      }
      scopes.add(scope);
      if (!connectorScopes.has(scope)) {
        issues.push({
          path: `${path}.scopes[${scopeIndex}]`,
          message: `unsupported scope '${scope}' for connector '${account.connector}'; use render sdk describe ${account.connector}`
        });
      }
    });
  });
  return issues;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
