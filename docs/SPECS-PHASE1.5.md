# SEO MCP SaaS — Phase 1.5 Specs: Google OAuth

**Phase:** 1.5 — User Google OAuth (GSC + GA4)  
**Author:** Coral 🧠🔎  
**Date:** 2026-02-13  

---

## Overview

Users need to connect their Google accounts to use GSC and GA4 tools. This phase adds:

1. Google OAuth consent flow (users authorize access to their GSC + GA4)
2. Token storage (encrypted in SQLite)
3. Per-user seo-mcp config generation (config.toml with their tokens)
4. Token refresh handling

## Why Phase 1.5 (not Phase 1)

Without this, only crawl/schema/IndexNow tools work. GSC and GA4 tools (16 of 35) need the user's Google credentials. This is critical for the value prop but was deferred to get the core working first.

## Architecture

```
User clicks "Connect Google" → 
  Redirect to Google OAuth consent screen →
    User authorizes GSC + GA4 read access →
      Google redirects back with auth code →
        We exchange code for tokens →
          Store encrypted tokens in DB →
            Generate per-user config.toml for seo-mcp binary →
              Binary uses tokens for GSC/GA4 API calls
```

## Google OAuth Scopes

```
openid
email
https://www.googleapis.com/auth/webmasters.readonly     # GSC read
https://www.googleapis.com/auth/analytics.readonly       # GA4 read
```

## Required Google Cloud Setup

1. Create Google Cloud project
2. Enable APIs: Search Console API, Google Analytics Data API, Google Analytics Admin API
3. Create OAuth 2.0 credentials (Web application)
4. Authorized redirect URI: `https://seomcp.dev/api/auth/google/callback`
5. Store client_id and client_secret in .env

## New API Endpoints

### `GET /api/auth/google`
Start the OAuth flow.

**Query params:**
- None (uses API key auth to identify user)

**Headers:**
- `Authorization: Bearer sk_live_...`

**Response:** Redirect to Google OAuth consent screen with:
- `client_id`
- `redirect_uri`
- `scope`
- `state` (encrypted user_id to prevent CSRF)
- `access_type=offline` (for refresh token)
- `prompt=consent` (force consent screen to get refresh token)

### `GET /api/auth/google/callback`
Handle the OAuth callback.

**Query params (from Google):**
- `code` — authorization code
- `state` — encrypted user_id
- `error` — if user denied

**Flow:**
1. Validate state (decrypt, check user exists)
2. Exchange code for tokens
3. Store access_token + refresh_token (encrypted)
4. Regenerate user's config.toml
5. Redirect to success page or return JSON

### `GET /api/auth/google/status`
Check if Google account is connected.

**Headers:**
- `Authorization: Bearer sk_live_...`

**Response:**
```json
{
  "connected": true,
  "email": "user@gmail.com",
  "scopes": ["webmasters.readonly", "analytics.readonly"],
  "expiresAt": "2026-02-14T00:00:00Z"
}
```

### `DELETE /api/auth/google`
Disconnect Google account (revoke tokens).

**Headers:**
- `Authorization: Bearer sk_live_...`

**Response:** `{ "disconnected": true }`

## Database Changes

### New table: `google_tokens`

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (ULID) | Primary key |
| user_id | TEXT | FK → users.id, UNIQUE |
| access_token_enc | TEXT | AES-256-GCM encrypted |
| refresh_token_enc | TEXT | AES-256-GCM encrypted |
| token_type | TEXT | Usually "Bearer" |
| expires_at | INTEGER | Unix timestamp |
| scopes | TEXT | Space-separated OAuth scopes |
| google_email | TEXT | User's Google email (for display) |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

## Token Encryption

- Use AES-256-GCM for encrypting tokens at rest
- Encryption key from env: `TOKEN_ENCRYPTION_KEY` (32-byte hex string)
- Each token gets a unique IV (stored with ciphertext)
- Format: `iv:ciphertext:tag` (all base64)

## Per-User Config Generation

When a user connects Google, generate `/tmp/seo-mcp-saas/<user_id>/config.toml`:

```toml
[google]
# OAuth user credentials (not service account)
client_id = "from-env"
client_secret = "from-env"
access_token = "decrypted-from-db"
refresh_token = "decrypted-from-db"
token_expiry = "2026-02-14T00:00:00Z"

[indexnow]
key = "global-indexnow-key"
```

The seo-mcp binary reads this config and uses the tokens for API calls.

## Token Refresh Flow

The seo-mcp binary handles token refresh internally (it uses the refresh_token to get new access_tokens). However, we should:

1. Store updated tokens when the binary reports a refresh
2. OR: Have the gateway refresh tokens proactively before they expire

**MVP approach:** Let the binary handle refresh. We just need to provide the refresh_token in the config.

## New File Structure

```
src/
├── auth/
│   ├── middleware.ts    (existing)
│   ├── keys.ts          (existing)
│   └── google.ts        (NEW — OAuth flow, token management)
├── routes/
│   └── google-auth.ts   (NEW — OAuth endpoints)
├── crypto/
│   └── tokens.ts        (NEW — AES-256-GCM encrypt/decrypt)
└── config/
    └── user-config.ts   (NEW — generate per-user config.toml)
```

## Environment Variables (new)

```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://seomcp.dev/api/auth/google/callback
TOKEN_ENCRYPTION_KEY=<64-char-hex-string>
```

## Security Considerations

1. **CSRF protection:** State parameter encrypted with user_id + timestamp
2. **Token encryption:** AES-256-GCM at rest, never exposed in API responses
3. **Scope limiting:** Only request read-only scopes (webmasters.readonly, analytics.readonly)
4. **Token revocation:** DELETE endpoint revokes with Google + deletes locally
5. **Config isolation:** Each user's config.toml is in a separate directory

## Landing Page Changes

After OAuth is implemented, add to the landing page:
- "Connect Google" section in the post-signup flow
- Show which tools require Google connection vs which work without

## Implementation Order

1. Token encryption module (crypto/tokens.ts)
2. Google OAuth utilities (auth/google.ts)  
3. Database migration (add google_tokens table)
4. Per-user config generator (config/user-config.ts)
5. OAuth routes (routes/google-auth.ts)
6. Wire into index.ts
7. Update binary pool to use per-user config
8. Tests
9. Update landing page signup flow

## Out of Scope (Phase 1.5)

- Google workspace email/contacts access
- Service account support (for agencies managing clients)
- Multi-Google-account per user
- Token rotation scheduling
