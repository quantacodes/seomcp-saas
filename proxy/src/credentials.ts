/**
 * @seomcp/proxy — Credential reader & validator
 *
 * Reads Google service account JSON from disk on every request.
 * Validates structure. Never caches credentials beyond request scope.
 */

import { readFileSync, existsSync } from "node:fs";

/** Required fields in a Google service account JSON file */
const REQUIRED_FIELDS = [
  "type",
  "project_id",
  "private_key_id",
  "private_key",
  "client_email",
] as const;

/** Minimal shape we validate */
export interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  [key: string]: unknown;
}

export interface CredentialResult {
  ok: true;
  credentials: ServiceAccountCredentials;
}

export interface CredentialError {
  ok: false;
  code: "missing" | "invalid";
  field?: string;
  message: string;
}

/**
 * Read and validate Google service account credentials from disk.
 * Called on every tool request to support key rotation.
 */
export function readCredentials(
  filePath: string | undefined,
): CredentialResult | CredentialError {
  if (!filePath) {
    return {
      ok: false,
      code: "missing",
      message: "GOOGLE_SERVICE_ACCOUNT not set or file not found",
    };
  }

  if (!existsSync(filePath)) {
    return {
      ok: false,
      code: "missing",
      message: `GOOGLE_SERVICE_ACCOUNT file not found: ${filePath}`,
    };
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    return {
      ok: false,
      code: "missing",
      message: `Cannot read GOOGLE_SERVICE_ACCOUNT file: ${filePath}`,
    };
  }

  // Strip UTF-8 BOM if present (some Windows editors / Google Cloud Console exports add it)
  raw = raw.replace(/^\uFEFF/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      code: "invalid",
      message: "Service account JSON is malformed: invalid JSON",
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      code: "invalid",
      message: "Service account JSON is malformed: expected an object",
    };
  }

  const obj = parsed as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (
      !(field in obj) ||
      typeof obj[field] !== "string" ||
      (obj[field] as string).length === 0
    ) {
      return {
        ok: false,
        code: "invalid",
        field,
        message: `Service account JSON is malformed: missing ${field}`,
      };
    }
  }

  return { ok: true, credentials: obj as unknown as ServiceAccountCredentials };
}

/**
 * Validate API key format: sk_live_ + 32 hex chars.
 * Returns null if valid, error message if not.
 */
export function validateApiKey(key: string | undefined): string | null {
  if (!key) return "SEOMCP_API_KEY not set";
  if (!/^sk_live_[a-f0-9]{32,48}$/.test(key)) {
    return "SEOMCP_API_KEY format invalid. Expected: sk_live_ followed by 32-48 hex characters";
  }
  return null;
}
