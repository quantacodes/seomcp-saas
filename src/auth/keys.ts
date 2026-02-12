import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "sk_live_";

/**
 * Generate a new API key.
 * Returns { raw, hash, prefix } — raw is shown once, hash is stored.
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const randomPart = randomBytes(24).toString("hex"); // 48 hex chars
  const raw = `${KEY_PREFIX}${randomPart}`;
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, 16); // "sk_live_REDACTED"
  return { raw, hash, prefix };
}

/**
 * Hash an API key for storage/lookup.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Validate API key format.
 */
export function isValidKeyFormat(key: string): boolean {
  return key.startsWith(KEY_PREFIX) && key.length === 56; // 8 prefix + 48 hex
}
