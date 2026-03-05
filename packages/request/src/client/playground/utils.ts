import type { Variable } from "../../server/types";
import { RouteInfo, VersioningInfo } from "../types";
import type { KeyValue } from "./types";

export const resolveVariables = (variables: Variable[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const v of variables) {
    if (!v.key) continue;
    if (v.type === 'text') {
      out[v.key] = v.value;
    } else {
      try {
        // Using Function constructor has security implications.
        // This is intended for local development use only since node-lens is a local first tool.
        const fn = new Function(`return (${v.value})`)();
        out[v.key] = String(fn?.());
      } catch (err) {
        out[v.key] = `Error: ${err}`;
      }
    }
  }
  return out;
}

export const applyVariables = (str: string, variables: Variable[]): string => {
  if (!str) return str;
  const vars = resolveVariables(variables);
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export const applyVariablesToKeyValue = (rows: KeyValue[], variables: Variable[]): KeyValue[] => {
  return rows.map(r => ({
    key: applyVariables(r.key, variables),
    value: applyVariables(r.value, variables),
  }));
}

export const keyValueToRecord = (rows: KeyValue[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const { key, value } of rows) {
    if (!key) continue;
    const existingKey = Object.keys(out).find(k => k.toLowerCase() === key.toLowerCase());
    if (existingKey) delete out[existingKey];
    out[key] = value ?? '';
  }
  return out;
}

/**
 * Build full URL (and headers if needed) from route info and versioning metadata
 */
export const buildRouteUrl = (origin: string, route: RouteInfo, versioning?: VersioningInfo | null) => {
  let path = route.path.startsWith('/') ? route.path : `/${route.path}`
  const headers: Record<string, string> = {}

  let version: string | string[] | undefined = route.versions ?? versioning?.versioning?.defaultVersion
  if (version === '*') version = undefined

  if (versioning?.versioning?.enabled && version) {
    switch (versioning.versioning.type) {
      case 'URI': {
        const prefix = versioning.versioning.uriPrefix ?? 'v'
        const v = Array.isArray(version) ? version[0] : version
        path = `/${prefix}${v}${path}`
        break
      }
      case 'HEADER': {
        const v = Array.isArray(version) ? version[0] : version
        const headerName = versioning.versioning.headerName ?? 'X-API-Version'
        headers[headerName] = String(v)
        break
      }
      case 'MEDIA_TYPE': {
        const v = Array.isArray(version) ? version[0] : version
        const key = versioning.versioning.mediaTypeKey ?? 'v'
        headers['Accept'] = `application/json; ${key}=${v}`
        break
      }
    }
  }

  if (versioning?.globalPrefix) {
    const prefix = versioning.globalPrefix.startsWith('/')
      ? versioning.globalPrefix
      : `/${versioning.globalPrefix}`
    path = `${prefix}${path}`
  }

  path = path.replace(/\/{2,}/g, '/')
  const url = `${origin.replace(/\/$/, '')}${path}`

  return Object.keys(headers).length > 0 ? { url, headers } : { url }
}

/**
 * Constructs a final URL by resolving variables, appending query parameters,
 * and combining it with a base URL.
 *
 * @param baseUrl - The base URL to which the resolved URL will be appended.
 * @param url - The URL string that may contain variables to be resolved.
 * @param queryRows - An array of key-value pairs representing query parameters.
 *                     Each key and value may also contain variables to be resolved.
 * @param variables - An array of variables used to resolve placeholders in the URL,
 *                    query keys, and query values.
 * @returns The fully constructed URL as a string. If an error occurs during URL
 *          construction, the function returns the resolved `url` string.
 */
export const buildFinalUrl = (baseUrl: string, url: string, queryRows: KeyValue[], variables: Variable[]): string => {
  try {
    const resolvedUrl = applyVariables(url, variables);
    const fullUrl = new URL(resolvedUrl, baseUrl);
    const params = new URLSearchParams(fullUrl.search);

    for (const { key, value } of queryRows) {
      if (!key) continue;
      params.set(
        applyVariables(key, variables),
        applyVariables(value ?? '', variables)
      );
    }
    fullUrl.search = params.toString();
    return fullUrl.toString();
  } catch {
    return applyVariables(url, variables);
  }
}
