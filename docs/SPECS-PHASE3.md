# SEO MCP SaaS — Phase 3 Specs: Dashboard

**Phase:** 3 — Dashboard UI  
**Author:** Coral 🧠🔎  
**Date:** 2026-02-13  

---

## Overview

Build a dashboard served from the same Hono server (no separate frontend build step).  
Users access it at `/dashboard` after logging in. Uses Tailwind CDN + vanilla JS (same approach as landing page).

The dashboard provides:
1. **API Key Management** — Create, view, revoke API keys
2. **Usage Stats** — Calls this month, breakdown by tool, trend sparkline
3. **Connected Sites** — Google OAuth status, connected GSC/GA4 properties
4. **Audit History** — Recent tool calls with results
5. **Account Settings** — Plan info, email, password change
6. **Quick Start** — MCP config snippet for copy-paste

---

## Architecture

```
/dashboard              → Login gate → Dashboard SPA (single HTML file)
/dashboard/login        → Login page
/dashboard/api/*        → Proxied to existing /api/* routes with session cookie

No build step. Single HTML file with inline Tailwind + vanilla JS.
Session: httpOnly cookie (session token → user lookup) for dashboard.
API keys still used for MCP endpoint.
```

---

## File Structure (new files only)

```
src/
├── routes/
│   └── dashboard.ts        # Dashboard routes (HTML pages + session auth)
├── auth/
│   └── session.ts          # Cookie session management (for dashboard only)
├── dashboard/
│   ├── layout.html          # Base HTML template (nav, sidebar)
│   ├── login.html           # Login page
│   └── app.html             # Main dashboard SPA
└── db/
    └── schema.ts            # Add sessions table
```

---

## Session Auth (Dashboard Only)

MCP endpoint continues to use API key auth. Dashboard uses cookie sessions.

### `sessions` table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (ULID) | Primary key / session token |
| user_id | TEXT | FK → users.id |
| expires_at | INTEGER | Unix timestamp (7 days from creation) |
| created_at | INTEGER | Unix timestamp |

### Flow
1. User POSTs to `/dashboard/login` with email + password
2. Server validates credentials, creates session row
3. Returns `Set-Cookie: session=<session_id>; HttpOnly; Secure; SameSite=Lax; Path=/dashboard; Max-Age=604800`
4. All `/dashboard/*` routes check this cookie
5. Logout deletes the session row and clears the cookie

---

## Routes

### `GET /dashboard/login`
Login page HTML (simple form, same dark theme as landing).

### `POST /dashboard/login`
```json
{ "email": "...", "password": "..." }
```
- Creates session → sets cookie → redirects to `/dashboard`
- On error: returns login page with error message

### `POST /dashboard/logout`
Deletes session, clears cookie, redirects to `/dashboard/login`.

### `GET /dashboard`
Main dashboard page. Requires valid session cookie.
If no session → redirect to `/dashboard/login`.

### `GET /dashboard/api/overview`
Returns dashboard data in one call (reduces JS complexity):
```json
{
  "user": { "id": "...", "email": "...", "plan": "free" },
  "usage": {
    "used": 23,
    "limit": 50,
    "remaining": 27,
    "period": "2026-02",
    "breakdown": { "success": 20, "error": 2, "rateLimited": 1 },
    "topTools": [
      { "tool": "generate_report", "count": 8 },
      { "tool": "gsc_performance", "count": 5 }
    ],
    "dailyUsage": [
      { "date": "2026-02-01", "calls": 3 },
      { "date": "2026-02-02", "calls": 5 }
    ]
  },
  "keys": [
    { "id": "...", "prefix": "sk_live_REDACTED...", "name": "Default", "isActive": true, "lastUsedAt": "...", "createdAt": "..." }
  ],
  "google": {
    "connected": true,
    "email": "user@gmail.com",
    "scopes": "webmasters.readonly analytics.readonly",
    "connectedAt": "2026-02-10"
  },
  "recentCalls": [
    { "tool": "generate_report", "status": "success", "durationMs": 4200, "createdAt": "2026-02-13T04:30:00Z" }
  ]
}
```

### `POST /dashboard/api/keys`
Create new API key (proxies to existing logic but uses session auth).

### `DELETE /dashboard/api/keys/:id`
Revoke API key (proxies to existing logic but uses session auth).

### `POST /dashboard/api/password`
Change password:
```json
{ "currentPassword": "...", "newPassword": "..." }
```

---

## Dashboard UI Design

### Layout
- **Top nav:** Logo (link to `/`), plan badge, user email, logout button
- **Content area:** Single page with sections (no sidebar for MVP — keep it simple)

### Sections (in order, top to bottom)

#### 1. Quick Start Banner
- Only shown if user has 0 tool calls (new user)
- Shows MCP config snippet with their first API key pre-filled
- "Copy config" button
- Dismissible (stored in localStorage)

#### 2. Usage Overview
- Large stat: `23 / 50 calls used` with progress bar
- Plan name and period
- "Upgrade" button if on free tier
- Small breakdown: success / error / rate limited
- Bar chart showing daily calls (last 30 days) — pure CSS bars, no chart library

#### 3. API Keys
- Table: Key prefix | Name | Status | Last Used | Created | Actions
- "Create New Key" button → modal → shows key once → "Copy" button
- "Revoke" button with confirmation
- Key count vs plan limit shown

#### 4. Connected Google Account
- If connected: show email, scopes, "Disconnect" button
- If not connected: "Connect Google Account" button → starts OAuth flow
- Explains why Google connection is needed (GSC + GA4 tools)

#### 5. Recent Activity
- Table: Time | Tool | Status | Duration
- Last 20 calls
- Status badges: green (success), red (error), yellow (rate limited)
- Tool name links to nothing for now (future: tool detail page)

#### 6. Account
- Email (read-only for now)
- Plan info + upgrade CTA
- Change password form (current + new)

---

## Styling

Same design system as landing page:
- Dark theme (`#0f172a` base)
- Tailwind CDN
- Inter font
- Brand blue (`#0ea5e9`)
- Cards with `bg-surface-800 border border-white/5 rounded-xl`
- No external chart libraries — pure CSS for the usage bar chart

---

## Security

1. Session cookies are `HttpOnly`, `Secure` (in prod), `SameSite=Lax`
2. Sessions expire in 7 days
3. CSRF: all mutations use POST with JSON body (SameSite=Lax protects against basic CSRF)
4. Session cookie only valid for `/dashboard/*` path
5. Password change requires current password verification
6. Rate limit on login: max 5 attempts per email per 15 minutes (in-memory counter)

---

## Implementation Order

1. Session auth module (`src/auth/session.ts`)
2. Database migration (add sessions table)
3. Dashboard routes (`src/routes/dashboard.ts`)
4. Login page HTML
5. Dashboard HTML (all sections)
6. Dashboard JS (fetch overview API, key management, password change)
7. Wire up Google connect/disconnect buttons to existing OAuth routes
8. Tests

---

## What NOT to build (defer)

- Sidebar navigation (single page is enough for MVP)
- Audit report viewer (just show recent calls)
- Team/multi-user management
- Email/notification settings
- Dark/light mode toggle
- Data export
- Billing management (Phase 4)
