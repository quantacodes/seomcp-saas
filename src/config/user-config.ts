/**
 * Generates per-user config.toml for the seo-mcp binary.
 * 
 * Each user gets their own config at /tmp/seo-mcp-saas/<userId>/config.toml
 * containing their Google OAuth tokens for GSC/GA4 access.
 */

import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { config } from "../config";

// Re-export writeFileSync since we use it in the toml builder inline

const BASE_DIR = "/tmp/seo-mcp-saas";

/**
 * Get the config directory for a user.
 */
export function getUserConfigDir(userId: string): string {
  return join(BASE_DIR, userId);
}

/**
 * Get the config.toml path for a user.
 */
export function getUserConfigPath(userId: string): string {
  return join(getUserConfigDir(userId), "config.toml");
}

interface UserGoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

/**
 * Write a config.toml for a user with their Google tokens.
 * This is what the seo-mcp binary reads for API authentication.
 */
export function writeUserConfig(userId: string, tokens?: UserGoogleTokens): string {
  const dir = getUserConfigDir(userId);
  mkdirSync(dir, { recursive: true });

  const configPath = getUserConfigPath(userId);

  // Build TOML content
  let toml = `# Auto-generated config for seo-mcp-saas user: ${userId}\n`;
  toml += `# Do not edit manually — managed by the SaaS gateway\n\n`;

  // Write credentials section
  // The binary needs [credentials].google_service_account
  // For OAuth users, we create a JSON with their tokens that the binary can use
  const credsDir = dir;
  const credsPath = join(credsDir, "google-creds.json");

  if (tokens) {
    // User has connected Google — write OAuth token as a credential file
    // The seo-mcp binary uses this for Google API authentication
    const credsJson = JSON.stringify({
      type: "authorized_user",
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: tokens.refreshToken,
    });
    writeFileSync(credsPath, credsJson, "utf-8");
  } else {
    // No Google connection — write empty creds (binary starts but Google APIs fail gracefully)
    writeFileSync(credsPath, "{}", "utf-8");
  }

  toml += `[credentials]\n`;
  toml += `google_service_account = "${escapeToml(credsPath)}"\n\n`;

  // Global IndexNow key (shared across all users)
  toml += `[indexnow]\n`;
  toml += `api_key = "seo-mcp-saas-global-key"\n`;
  toml += `key_location = ""\n`;

  writeFileSync(configPath, toml, "utf-8");
  return configPath;
}

/**
 * Delete a user's config directory.
 */
export function deleteUserConfig(userId: string): void {
  const dir = getUserConfigDir(userId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Check if a user has a config file.
 */
export function hasUserConfig(userId: string): boolean {
  return existsSync(getUserConfigPath(userId));
}

/**
 * Escape a string for TOML basic string (double-quoted).
 */
function escapeToml(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}
