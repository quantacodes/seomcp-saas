/**
 * Google OAuth 2.0 flow for user GSC + GA4 access.
 * 
 * Flow: 
 * 1. Generate consent URL with state parameter
 * 2. User authorizes → Google redirects with code
 * 3. Exchange code for tokens
 * 4. Store encrypted tokens
 * 5. Generate per-user config for seo-mcp binary
 */

import { config } from "../config";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

// Scopes we need: GSC read + GA4 read + user email
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
].join(" ");

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

export interface GoogleUserInfo {
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Generate a state parameter for CSRF protection.
 * Format: base64(userId:timestamp:hmac)
 */
export function generateState(userId: string): string {
  const timestamp = Date.now().toString();
  const payload = `${userId}:${timestamp}`;
  
  // Simple HMAC using the JWT secret
  const { createHmac } = require("crypto");
  const hmac = createHmac("sha256", config.jwtSecret)
    .update(payload)
    .digest("hex")
    .slice(0, 16); // Truncate for URL friendliness

  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

/**
 * Validate and decode a state parameter.
 * Returns userId if valid, null if invalid/expired.
 */
export function validateState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString();
    const [userId, timestamp, hmac] = decoded.split(":");

    if (!userId || !timestamp || !hmac) return null;

    // Verify HMAC
    const { createHmac } = require("crypto");
    const expectedHmac = createHmac("sha256", config.jwtSecret)
      .update(`${userId}:${timestamp}`)
      .digest("hex")
      .slice(0, 16);

    if (hmac !== expectedHmac) return null;

    // Check expiry (10 minutes)
    const age = Date.now() - parseInt(timestamp);
    if (age > 10 * 60 * 1000) return null;

    return userId;
  } catch {
    return null;
  }
}

/**
 * Build the Google OAuth consent URL.
 */
export function getConsentUrl(userId: string): string {
  const state = generateState(userId);

  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",    // Get refresh token
    prompt: "consent",          // Force consent to ensure refresh token
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params}`;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${res.status} — ${err}`);
  }

  return res.json();
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${res.status} — ${err}`);
  }

  return res.json();
}

/**
 * Get user info from Google (email, name).
 */
export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get user info: ${res.status}`);
  }

  return res.json();
}

/**
 * Revoke a token with Google.
 */
export async function revokeToken(token: string): Promise<void> {
  const res = await fetch(`${GOOGLE_REVOKE_URL}?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  // Revocation can fail silently — that's OK
  if (!res.ok) {
    console.warn(`Token revocation returned ${res.status}`);
  }
}
