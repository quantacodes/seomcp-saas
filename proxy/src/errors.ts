/**
 * @seomcp/proxy — Error taxonomy
 *
 * Structured JSON-RPC error codes and factory functions.
 * Every error the proxy can return is defined here.
 */

// ─── JSON-RPC standard errors ────────────────────────────────────────────────
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;

// ─── Custom proxy errors ─────────────────────────────────────────────────────
export const MISSING_CREDENTIALS = -32001;
export const INVALID_CREDENTIALS = -32002;
export const API_KEY_MISSING = -32003;
export const API_KEY_INVALID = -32004;
export const RATE_LIMITED = -32005;
export const CLOUD_UNREACHABLE = -32006;
export const REQUEST_TIMEOUT = -32007;
export const GOOGLE_API_ERROR = -32008;
export const SERVER_ERROR = -32009;
export const VERSION_OUTDATED = -32010;
export const PERMISSION_DENIED = -32011;

/** Shape of a JSON-RPC error object */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** Create a JSON-RPC error response envelope */
export function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): object {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

// ─── Error factory helpers ───────────────────────────────────────────────────

export function invalidRequest(id: string | number | null, detail?: string) {
  return rpcError(id, INVALID_REQUEST, detail ?? "Invalid JSON-RPC request");
}

export function methodNotFound(id: string | number | null, method: string) {
  const truncated = method.length > 100 ? method.slice(0, 100) + "..." : method;
  return rpcError(id, METHOD_NOT_FOUND, `Unknown method: ${truncated}`);
}

export function missingCredentials(id: string | number | null) {
  return rpcError(
    id,
    MISSING_CREDENTIALS,
    "GOOGLE_SERVICE_ACCOUNT not set or file not found",
  );
}

export function invalidCredentials(
  id: string | number | null,
  field: string,
) {
  return rpcError(
    id,
    INVALID_CREDENTIALS,
    `Service account JSON is malformed: missing ${field}`,
  );
}

export function apiKeyMissing(id: string | number | null) {
  return rpcError(
    id,
    API_KEY_MISSING,
    "SEOMCP_API_KEY not set",
  );
}

export function apiKeyInvalid(id: string | number | null) {
  return rpcError(
    id,
    API_KEY_INVALID,
    "Invalid API key. Check your key at seomcp.dev/dashboard",
  );
}

export function rateLimited(id: string | number | null, remaining?: number) {
  const msg =
    remaining !== undefined
      ? `Rate limit exceeded. ${remaining} calls remaining. Upgrade at seomcp.dev/pricing`
      : "Rate limit exceeded. Upgrade at seomcp.dev/pricing";
  return rpcError(id, RATE_LIMITED, msg);
}

export function cloudUnreachable(id: string | number | null) {
  return rpcError(
    id,
    CLOUD_UNREACHABLE,
    "Cannot reach api.seomcp.dev. Check your internet connection",
  );
}

export function requestTimeout(id: string | number | null, timeout: number) {
  return rpcError(
    id,
    REQUEST_TIMEOUT,
    `Request timed out after ${timeout}ms`,
  );
}

export function googleApiError(id: string | number | null, message: string) {
  return rpcError(id, GOOGLE_API_ERROR, `Google API error: ${message}`);
}

export function serverError(id: string | number | null) {
  return rpcError(
    id,
    SERVER_ERROR,
    "seomcp.dev server error. Try again later",
  );
}

export function versionOutdated(
  id: string | number | null,
  current: string,
) {
  return rpcError(
    id,
    VERSION_OUTDATED,
    `Proxy version ${current} is outdated. Run: npm i -g @seomcp/proxy`,
  );
}

export function permissionDenied(
  id: string | number | null,
  property: string,
  clientEmail: string,
) {
  return rpcError(
    id,
    PERMISSION_DENIED,
    `Service account lacks access to ${property}. Share ${clientEmail} in Google Search Console`,
  );
}
