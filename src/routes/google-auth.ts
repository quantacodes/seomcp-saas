/**
 * Google OAuth routes for connecting user's GSC + GA4 accounts.
 * 
 * GET  /api/auth/google           — Start OAuth flow (requires API key auth)
 * GET  /api/auth/google/callback  — Handle Google redirect (no auth — state param validates)
 * GET  /api/auth/google/status    — Check connection status (requires API key auth)
 * DELETE /api/auth/google         — Disconnect Google account (requires API key auth)
 */

import { Hono } from "hono";
import { config } from "../config";
import { sqlite } from "../db/index";
import { authMiddleware } from "../auth/middleware";
import {
  getConsentUrl,
  validateState,
  exchangeCode,
  getUserInfo,
  revokeToken,
} from "../auth/google";
import { encryptToken, decryptToken } from "../crypto/tokens";
import { writeUserConfig, deleteUserConfig } from "../config/user-config";
import { ulid } from "../utils/ulid";

const googleAuthRoutes = new Hono();

/**
 * GET /api/auth/google — Start OAuth flow
 * Requires API key auth to identify the user.
 */
googleAuthRoutes.get("/api/auth/google", authMiddleware, (c) => {
  // Check if Google OAuth is configured
  if (!config.googleClientId || !config.googleClientSecret) {
    return c.json({
      error: "Google OAuth not configured",
      message: "The server doesn't have Google OAuth credentials. Contact the administrator.",
    }, 503);
  }

  const userId = c.get("auth").userId;
  const consentUrl = getConsentUrl(userId);

  // Return the URL for the client to redirect to
  // (API clients can't follow redirects automatically)
  return c.json({
    url: consentUrl,
    message: "Open this URL in a browser to connect your Google account",
  });
});

/**
 * GET /api/auth/google/callback — Handle Google OAuth callback
 * No API key auth — state parameter validates the request.
 */
googleAuthRoutes.get("/api/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  // Handle user denial
  if (error) {
    return c.html(renderCallbackPage({
      success: false,
      message: `Google authorization was denied: ${error}`,
    }));
  }

  // Validate required params
  if (!code || !state) {
    return c.html(renderCallbackPage({
      success: false,
      message: "Missing authorization code or state parameter.",
    }), 400);
  }

  // Validate state (CSRF protection + user identification)
  const userId = validateState(state);
  if (!userId) {
    return c.html(renderCallbackPage({
      success: false,
      message: "Invalid or expired authorization request. Please try again.",
    }), 400);
  }

  // Verify user exists
  const user = sqlite.prepare("SELECT id, email FROM users WHERE id = ?").get(userId) as any;
  if (!user) {
    return c.html(renderCallbackPage({
      success: false,
      message: "User not found. Please sign up first.",
    }), 404);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code);

    if (!tokens.refresh_token) {
      return c.html(renderCallbackPage({
        success: false,
        message: "No refresh token received. Please revoke access at myaccount.google.com and try again.",
      }), 400);
    }

    // Get user's Google email
    let googleEmail = "";
    try {
      const userInfo = await getUserInfo(tokens.access_token);
      googleEmail = userInfo.email;
    } catch {
      // Non-fatal — we can proceed without the email
    }

    // Encrypt tokens
    const accessTokenEnc = encryptToken(tokens.access_token);
    const refreshTokenEnc = encryptToken(tokens.refresh_token);
    const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;
    const now = new Date();

    // Upsert google_tokens (delete existing + insert new)
    sqlite.exec("BEGIN");
    try {
      sqlite.prepare("DELETE FROM google_tokens WHERE user_id = ?").run(userId);
      sqlite.prepare(
        `INSERT INTO google_tokens (id, user_id, access_token_enc, refresh_token_enc, token_type, expires_at, scopes, google_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        ulid(),
        userId,
        accessTokenEnc,
        refreshTokenEnc,
        tokens.token_type || "Bearer",
        expiresAt,
        tokens.scope || "",
        googleEmail,
        now.getTime(),
        now.getTime(),
      );
      sqlite.exec("COMMIT");
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }

    // Generate per-user config.toml for the seo-mcp binary
    writeUserConfig(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    });

    return c.html(renderCallbackPage({
      success: true,
      message: `Google account connected! (${googleEmail || "unknown email"})`,
      email: googleEmail,
    }));

  } catch (err: any) {
    console.error("Google OAuth callback error:", err);
    return c.html(renderCallbackPage({
      success: false,
      message: "Failed to connect Google account. Please try again.",
    }), 500);
  }
});

/**
 * GET /api/auth/google/status — Check Google connection status
 */
googleAuthRoutes.get("/api/auth/google/status", authMiddleware, (c) => {
  const userId = c.get("auth").userId;

  const row = sqlite.prepare(
    "SELECT google_email, scopes, expires_at, updated_at FROM google_tokens WHERE user_id = ?"
  ).get(userId) as any;

  if (!row) {
    return c.json({
      connected: false,
      message: "No Google account connected. GSC and GA4 tools will not work.",
    });
  }

  const expired = row.expires_at < Math.floor(Date.now() / 1000);

  return c.json({
    connected: true,
    email: row.google_email || null,
    scopes: row.scopes ? row.scopes.split(" ") : [],
    expiresAt: new Date(row.expires_at * 1000).toISOString(),
    expired,
    lastUpdated: new Date(row.updated_at).toISOString(),
    message: expired
      ? "Access token expired — it will be refreshed on next tool call."
      : "Google account connected and active.",
  });
});

/**
 * DELETE /api/auth/google — Disconnect Google account
 */
googleAuthRoutes.delete("/api/auth/google", authMiddleware, async (c) => {
  const userId = c.get("auth").userId;

  // Get existing tokens to revoke with Google
  const row = sqlite.prepare(
    "SELECT refresh_token_enc FROM google_tokens WHERE user_id = ?"
  ).get(userId) as any;

  if (!row) {
    return c.json({ error: "No Google account connected" }, 404);
  }

  // Revoke token with Google (best effort)
  try {
    const refreshToken = decryptToken(row.refresh_token_enc);
    await revokeToken(refreshToken);
  } catch (err: any) {
    console.warn("Token revocation failed (continuing with local cleanup):", err.message);
  }

  // Delete from DB
  sqlite.prepare("DELETE FROM google_tokens WHERE user_id = ?").run(userId);

  // Delete per-user config and regenerate without tokens
  deleteUserConfig(userId);
  writeUserConfig(userId); // Empty config — crawl/schema tools still work

  return c.json({
    disconnected: true,
    message: "Google account disconnected. GSC and GA4 tools will no longer work.",
  });
});

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Render a simple HTML page for the OAuth callback.
 * This is what users see after Google redirects back.
 * All dynamic values are HTML-escaped to prevent XSS.
 */
function renderCallbackPage(opts: { success: boolean; message: string; email?: string }): string {
  const icon = opts.success ? "✅" : "❌";
  const color = opts.success ? "#22c55e" : "#ef4444";
  const title = opts.success ? "Connected!" : "Connection Failed";
  const safeMessage = escapeHtml(opts.message);
  const safeEmail = opts.email ? escapeHtml(opts.email) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — seomcp.dev</title>
  <style>
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      text-align: center;
      max-width: 480px;
      padding: 3rem 2rem;
      background: #1e293b;
      border-radius: 1rem;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: ${color}; }
    p { color: #94a3b8; line-height: 1.6; }
    .email { color: #0ea5e9; font-weight: 600; }
    a { color: #0ea5e9; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .close-hint { margin-top: 2rem; font-size: 0.875rem; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${safeMessage}</p>
    ${safeEmail ? `<p>Connected as: <span class="email">${safeEmail}</span></p>` : ""}
    <p class="close-hint">
      ${opts.success 
        ? "You can close this window. Your AI tools will now have access to Google Search Console and Analytics data."
        : `<a href="/">← Back to seomcp.dev</a>`
      }
    </p>
  </div>
</body>
</html>`;
}

export { googleAuthRoutes };
