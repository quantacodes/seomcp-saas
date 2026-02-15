# Future Migration Plan — Workers + D1

**Status:** NOT STARTED — For reference only  
**Trigger:** >500 users OR >$10k/mo revenue OR global latency complaints  

---

## When to Migrate

### Current System Limits (Hetzner 2CPU/2GB)

| Resource | Current | Limit | At Limit |
|----------|---------|-------|----------|
| RAM | 2GB | ~40 concurrent binaries | ~200 active users |
| SQLite writes | ~1,000/min | Lock contention | >500 users |
| CPU | 2 cores | 100% sustained | Binary spawn storms |
| Latency | ~150ms US | ~400ms Asia | Global user complaints |

### Migration Triggers

```
                Users
                  │
    100 ──────────┼──────────────────────► Current (comfortable)
                  │
    200 ──────────┼──────────────────────► Monitor closely
                  │                          Add CDN
                  │
    500 ──────────┼──────────────────────► CONSIDER MIGRATION
                  │                          Scale to 4GB first
                  │
    1000 ─────────┼──────────────────────► SHOULD MIGRATE
                  │                          Workers + D1
                  │
    5000 ─────────┼──────────────────────► MUST MIGRATE
                  │                          Or Kubernetes
```

---

## Target Architecture (Future)

```
                           Internet
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌─────────────────┐    ┌─────────────┐
│  Cloudflare   │     │  Bun Server     │    │  Paddle     │
│  Workers      │     │  (Hetzner/Fly)  │    │  Webhooks   │
│  ───────────  │     │  ─────────────  │    │             │
│  • Landing    │     │  • /mcp         │    │             │
│  • Dashboard  │◄────┤  • /v1/tools    │    │             │
│  • Auth API   │ D1  │  • Binary pool  │    │             │
│  • Billing    │     │                 │    │             │
└───────────────┘     └─────────────────┘    └─────────────┘
        │                     │
        └──────────┬──────────┘
                   ▼
            ┌─────────────┐
            │  D1         │
            │  (SQLite)   │
            │  • users    │
            │  • api_keys │
            │  • rate_limits│
            └─────────────┘
```

---

## Migration Phases

### Phase 1: D1 Setup (Week 1)

```typescript
// 1. Create D1 database
wrangler d1 create seomcp-production

// 2. Export SQLite schema
sqlite3 /data/seo-mcp-saas.db .schema > schema.sql

// 3. Adapt schema for D1 (if needed)
// - INTEGER PRIMARY KEY AUTOINCREMENT → INTEGER PRIMARY KEY AUTOINCREMENT (same)
// - Date handling (D1 uses ISO strings)

// 4. Import data
wrangler d1 execute seomcp-production --file=schema.sql

// 5. Migration script to sync live data
```

### Phase 2: Workers Landing + Dashboard (Week 2)

```typescript
// Workers project structure
workers/
├── src/
│   ├── index.ts           // Hono router
│   ├── routes/
│   │   ├── landing.ts     // Static pages
│   │   ├── dashboard.ts   // Dashboard API
│   │   ├── auth.ts        // Auth endpoints
│   │   └── billing.ts     // Paddle webhooks
│   ├── middleware/
│   │   ├── auth.ts        // API key validation
│   │   └── ratelimit.ts   // Rate limiting
│   └── db/
│       └── d1.ts          // D1 queries
├── wrangler.toml
└── migrations/
```

**Routes to migrate:**
- `GET /` — Landing page
- `GET /docs` — Documentation
- `GET /pricing` — Pricing page
- `GET /dashboard/*` — Dashboard UI + API
- `POST /api/auth/*` — Auth
- `POST /webhooks/paddle` — Billing

### Phase 3: Bun MCP Refactor (Week 3)

```typescript
// Bun server now uses D1 instead of SQLite

// Before:
import { sqlite } from './db';
const user = sqlite.query('SELECT * FROM users WHERE id = ?').get(id);

// After:
import { d1Query } from './db-d1';
const user = await d1Query('SELECT * FROM users WHERE id = ?', [id]);

// D1 HTTP client for Bun
async function d1Query(sql: string, params: any[]) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/.../query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CF_TOKEN}` },
    body: JSON.stringify({ sql, params })
  });
  return res.json();
}
```

### Phase 4: Testing + Cutover (Week 4)

```
Pre-migration:
  seomcp.dev ───────► Hetzner (everything)

Migration:
  1. Deploy Workers to workers.seomcp.dev
  2. Test all endpoints
  3. DNS cutover:
     seomcp.dev ────┬──► Workers (landing/dashboard)
                    └──► api.seomcp.dev (Bun MCP)

Post-migration:
  seomcp.dev ───────► Workers
  api.seomcp.dev ───► Bun (MCP only)
```

---

## Database Queries Comparison

### Auth Middleware

**SQLite (Current):**
```typescript
const keyRecord = db
  .select()
  .from(schema.apiKeys)
  .where(eq(schema.apiKeys.keyHash, keyHash))
  .limit(1)
  .then(rows => rows[0]);
```

**D1 (Future):**
```typescript
const { results } = await env.DB.prepare(`
  SELECT ak.*, u.plan, u.email 
  FROM api_keys ak 
  JOIN users u ON ak.user_id = u.id 
  WHERE ak.key_hash = ?
`).bind(keyHash).all();
const keyRecord = results[0];
```

### Rate Limiting

**SQLite (Current):**
```typescript
return sqlite.transaction(() => {
  const row = sqlite
    .query('SELECT call_count FROM rate_limits WHERE user_id = ?')
    .get(userId);
  
  if (!row || row.window_start < windowStart) {
    sqlite.run('INSERT OR REPLACE...');
    return { allowed: true, used: 1 };
  }
  
  if (row.call_count >= limit) {
    return { allowed: false };
  }
  
  sqlite.run('UPDATE rate_limits SET call_count = ? WHERE user_id = ?');
  return { allowed: true, used: row.call_count + 1 };
})();
```

**D1 (Future):**
```typescript
// D1 supports transactions via batch
const [selectResult, updateResult] = await env.DB.batch([
  env.DB.prepare('SELECT call_count FROM rate_limits WHERE user_id = ?').bind(userId),
  env.DB.prepare('UPDATE rate_limits SET call_count = call_count + 1 WHERE user_id = ?').bind(userId)
]);
```

---

## Cost Comparison

### Current (Hetzner Only)

| Item | Cost |
|------|------|
| CX21 (2CPU/2GB) | ~$6/mo |
| Backups (manual) | Free |
| **Total** | **~$6/mo** |

### Future (Workers + D1 + Bun)

| Item | Cost |
|------|------|
| Hetzner (MCP only, smaller) | ~$6/mo |
| Workers (1M requests/day) | ~$5/mo |
| D1 (reads/writes) | ~$5-10/mo |
| **Total** | **~$16-21/mo** |

**Breakeven:** Worth it when latency matters more than $15/mo

---

## Risk Mitigation

### Risk: D1 Latency for MCP

**Mitigation:** Keep rate limiting in Bun, use D1 only for auth
```
User → Bun → Check SQLite cache (rate limit)
           → If cache miss → Query D1 (auth)
```

### Risk: D1 Write Limits

**D1 limits:**
- 100,000 writes/day (free)
- 1M writes/day (paid)

**At 500 users, 10 calls/day = 5,000 writes** ✓ Fine

### Risk: Migration Downtime

**Mitigation:**
1. Blue-green deployment
2. DNS cutover with low TTL
3. Rollback plan ready
4. Migrate during low-traffic hours

---

## Success Metrics

After migration, we should see:

| Metric | Before | Target |
|--------|--------|--------|
| Landing page load (US) | 150ms | 50ms |
| Landing page load (EU) | 250ms | 50ms |
| Landing page load (Asia) | 400ms | 80ms |
| MCP latency | 150ms | 150ms (no change) |
| Error rate | <1% | <0.5% |
| Uptime | 99.9% | 99.99% |

---

## Decision Checklist

Before starting migration, confirm:

- [ ] >500 active users OR >50 concurrent at peak
- [ ] >$10k/mo revenue (can afford complexity)
- [ ] Global latency complaints (Asia/EU users)
- [ ] 2-3 weeks dev time available
- [ ] Rollback plan tested
- [ ] Monitoring in place

---

**Document Status:** Reference only — do not start until triggers met  
**Last Updated:** 2026-02-15
