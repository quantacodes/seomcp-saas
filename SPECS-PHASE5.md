# SEO MCP SaaS — Phase 5 Specs: Launch Prep

**Phase:** 5 — Launch Preparation
**Author:** Coral 🧠🔎
**Date:** 2026-02-13

---

## Overview

Prepare seomcp.dev for production deployment and launch. This includes:
1. API documentation page
2. Deploy configuration (Dockerfile + systemd)
3. Production checklist
4. Final polish (favicon, meta tags, error pages)

---

## 1. Documentation Page

Serve at `/docs` — single-page HTML similar to landing/dashboard.

### Sections:
- **Quick Start** — 3-step setup (sign up, get key, add MCP config)
- **Authentication** — API key format, Bearer token usage
- **MCP Connection** — Config snippets for Claude Desktop, Cursor, Windsurf, generic
- **Available Tools** — All 35 tools with name + description (group by category)
- **Google OAuth** — How to connect GSC/GA4
- **Rate Limits** — Per-plan limits, what happens when exceeded
- **Error Handling** — Error response format, common error codes
- **Billing** — Plan comparison, upgrade/downgrade flow

### Implementation:
- Static HTML served from Hono (like landing page)
- File: `src/docs/index.html`
- Route: `/docs` in `src/routes/docs.ts`

---

## 2. Production Deploy Config

### Dockerfile
```dockerfile
FROM oven/bun:1.3 AS base
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --production
COPY . .

# Copy seo-mcp binary
COPY seo-mcp-server /app/seo-mcp-server
RUN chmod +x /app/seo-mcp-server

ENV NODE_ENV=production
ENV SEO_MCP_BINARY=/app/seo-mcp-server
EXPOSE 3456
CMD ["bun", "run", "src/index.ts"]
```

### docker-compose.yml
- Service: seo-mcp-saas
- Volumes: ./data:/app/data (SQLite persistence)
- Environment: from .env file
- Restart: unless-stopped

### .env.example
All required env vars with descriptions.

---

## 3. Production Environment Variables

```bash
# Required
NODE_ENV=production
PORT=3456
JWT_SECRET=                          # 32+ random bytes, hex
TOKEN_ENCRYPTION_KEY=                # 64 hex chars (32 bytes AES-256)
SEO_MCP_BINARY=/app/seo-mcp-server

# Google OAuth (for user GSC/GA4)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://seomcp.dev/api/auth/google/callback

# Lemon Squeezy
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_PRO_VARIANT_ID=
LEMONSQUEEZY_AGENCY_VARIANT_ID=

# App
BASE_URL=https://seomcp.dev
DATABASE_PATH=/app/data/seo-mcp-saas.db
```

---

## 4. Final Polish

### Favicon
- Use the 🔍 emoji as SVG favicon (already in place)

### Meta tags (landing page)
- og:title, og:description, og:image
- twitter:card, twitter:title, twitter:description

### Error pages
- Custom 404 page (already exists)
- 500 error handling (catch-all)

### Security headers
- Add Hono middleware for production headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy` (if using CDN Tailwind, allow it)
