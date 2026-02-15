# Project Structure

Clean separation of frontend and backend.

```
seo-mcp-saas/
├── frontend/                 # React SPA (deploy to Cloudflare Pages)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx    # Marketing site
│   │   │   └── Dashboard.tsx      # App dashboard
│   │   ├── lib/
│   │   │   └── api.ts             # API client
│   │   ├── App.tsx                # Router
│   │   ├── main.tsx               # ClerkProvider
│   │   └── index.css              # Styles
│   ├── .env                       # VITE_CLERK_PUBLISHABLE_KEY
│   └── package.json
│
├── src/                      # Bun Backend (deploy to Hetzner)
│   ├── routes/
│   │   ├── auth.ts                # /api/auth/*
│   │   ├── mcp.ts                 # /mcp (MCP endpoint)
│   │   ├── proxy.ts               # /v1/tools/*
│   │   ├── dashboard.ts           # /dashboard/api/*
│   │   └── ...
│   ├── auth/
│   │   ├── clerk.ts               # Clerk verification
│   │   ├── keys.ts                # API key management
│   │   └── jwt.ts                 # Token handling
│   ├── db/
│   │   ├── schema.ts              # Drizzle schema
│   │   └── index.ts               # SQLite connection
│   ├── mcp/
│   │   └── binary.ts              # Rust binary pool
│   └── index.ts                   # Main server
│
├── data/                     # SQLite database (prod)
├── tests/                    # Test files
└── docs/                     # Documentation
```

## Frontend (React + Clerk)

**Location:** `frontend/`

**Deploy to:** Cloudflare Pages / Netlify / Vercel

**Key Files:**
- `src/pages/LandingPage.tsx` - Marketing site with Clerk auth
- `src/pages/Dashboard.tsx` - Dashboard for logged-in users
- `src/lib/api.ts` - API client
- `.env` - Clerk publishable key

**Environment:**
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_API_URL=https://api.seomcp.dev
```

## Backend (Bun + Hono)

**Location:** `src/`

**Deploy to:** Hetzner VPS (or Fly.io)

**Key Routes:**
- `/api/auth/*` - Authentication
- `/api/user/me` - Current user
- `/mcp` - MCP protocol endpoint
- `/v1/tools/*` - Proxy API
- `/dashboard/api/*` - Dashboard data

**Environment:**
```env
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
DATABASE_PATH=/data/seo-mcp-saas.db
SEO_MCP_BINARY=/opt/seomcp/seo-mcp-server
```

## Development

```bash
# Terminal 1: Backend
cd seo-mcp-saas
bun run dev

# Terminal 2: Frontend
cd seo-mcp-saas/frontend
npm run dev
```

## Deployment

```bash
# Deploy Frontend
cd frontend
npm run build
# Upload dist/ to Cloudflare Pages

# Deploy Backend
cd ..
# Git push to server, then:
bun install
bun run src/db/migrate.ts
sudo systemctl restart seomcp
```

## Auth Flow

1. User clicks "Sign In" on frontend
2. Clerk modal opens (handled by Clerk React)
3. After login, Clerk token stored in browser
4. Frontend sends token in `Authorization: Bearer <token>` header
5. Backend verifies token with Clerk secret key
6. Backend returns user data

## API Communication

```
Frontend (localhost:5173)          Backend (localhost:3456)
        │                                │
        ├── GET /api/user/me ───────────►│
        │   Authorization: Bearer token  │
        │                                │
        │◄─── User data ─────────────────┤
        │                                │
```
