# seomcp.dev

**37 SEO tools for any AI agent. One MCP endpoint. Your real Google data.**

Give Claude, Cursor, Windsurf, or any MCP-compatible AI agent full SEO capabilities — Google Search Console, GA4 Analytics, site audits, schema validation, IndexNow submissions, and more.

## Quick Start

```bash
# Backend (Bun)
bun install
bun run dev

# Frontend (React)
cd frontend
npm install
npm run dev
```

## Architecture

```
┌─────────────────┐      ┌──────────────────┐
│  React SPA      │      │  Bun Backend     │
│  (Cloudflare)   │◄────►│  (Hetzner)       │
│  Clerk Auth     │      │  SQLite + MCP    │
└─────────────────┘      └──────────────────┘
```

## Documentation

See [`docs/`](docs/) directory for full documentation:

| Document | Description |
|----------|-------------|
| [`docs/ARCHITECTURE_DECISION.md`](docs/ARCHITECTURE_DECISION.md) | Why we chose this stack |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Deployment guide |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Running in production |
| [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) | Code organization |
| [`docs/SPECS.md`](docs/SPECS.md) | Technical specifications |

## Environment Variables

### Frontend (.env)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_API_URL=https://api.seomcp.dev
```

### Backend (.env)
```env
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
DATABASE_PATH=./data/seo-mcp-saas.db
```

## License

Proprietary. © QuantaCodes Solutions.
