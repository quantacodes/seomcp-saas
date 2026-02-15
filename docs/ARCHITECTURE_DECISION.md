# Architecture Decision Record — SEO MCP SaaS

**Date:** 2026-02-15  
**Status:** ACCEPTED  
**Decision:** Stay on Hetzner VPS (Bun + SQLite), do NOT migrate to Cloudflare Workers  

---

## Context

We evaluated migrating the SEO MCP SaaS from our current Hetzner VPS to Cloudflare Workers + D1 for better global performance and "serverless" benefits.

After analysis, we decided **NOT to migrate** at this time.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Hetzner Cloud VPS (CX21 or similar)                        │
│  Location: Germany (or US East)                             │
│  Specs: 2 vCPU, 2GB RAM, SSD                                │
│  Cost: ~$6/month                                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Bun HTTP Server (port 3456)                        │    │
│  │  ───────────────────────────                        │    │
│  │  • Landing pages (/, /docs, /pricing)               │    │
│  │  • Dashboard API (/dashboard/api/*)                 │    │
│  │  • Auth (/api/auth/*)                               │    │
│  │  • MCP endpoint (/mcp) — spawns Rust binary         │    │
│  │  • Proxy API (/v1/tools/call)                       │    │
│  │  • Billing webhooks (/webhooks/*)                   │    │
│  │                                                     │    │
│  │  SQLite Database (/data/seo-mcp-saas.db)            │    │
│  │  ───────────────────────────────────────            │    │
│  │  • users, api_keys, rate_limits                     │    │
│  │  • usage_logs, sessions, subscriptions              │    │
│  │  • WAL mode enabled for performance                 │    │
│  │                                                     │    │
│  │  seo-mcp-server (Rust binary)                       │    │
│  │  ────────────────────────────                       │    │
│  │  • Spawned per-user via stdio                       │    │
│  │  • 35 SEO tools (GSC, GA4, PageSpeed, etc.)         │    │
│  │  • Auto-killed after 5 min idle                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                     https://seomcp.dev
```

---

## Why We're Staying on Hetzner

### 1. Current Capacity is Sufficient

| Metric | Current | Limit | Headroom |
|--------|---------|-------|----------|
| **RAM** | 2GB | 2GB | ~1.5GB for binaries |
| **Concurrent binaries** | ~10-15 | ~30-40 | 2-3x growth |
| **Users supported** | 100-200 comfortably | 500+ with tuning | Comfortable |
| **Monthly cost** | ~$6 | N/A | Cheapest option |

**Bun + SQLite on SSD can handle:**
- 10,000+ requests/minute (reads)
- 1,000+ requests/minute (writes)
- 100-200 concurrent users easily

### 2. Migration Cost > Benefit (For Now)

| Factor | Migration Impact |
|--------|------------------|
| **Development time** | 2-3 weeks full-time |
| **Risk** | High (rewriting DB layer, auth, rate limiting) |
| **Immediate benefit** | Low (current system works fine) |
| **New complexity** | Two systems (Workers + Bun) vs one |
| **Monthly cost** | $6 → $20-30 (Workers + D1 + Bun) |

### 3. Migration Makes Sense When...

- **> 500 active users** (SQLite write contention)
- **>$10k/month revenue** (can afford complexity)
- **Global latency complaints** (US/EU/Asia users)
- **Need multi-region** (current single VPS is bottleneck)
- **Hiring dev team** (someone to maintain it)

**Estimated timeline:** 6-12 months from now

---

## How Key Systems Work

### 1. API Key Authentication

```typescript
// Every MCP/proxy request:
Authorization: Bearer sk_live_REDACTED

1. Parse "Bearer <token>"
2. SHA-256 hash the token
3. SQLite lookup: SELECT * FROM api_keys WHERE key_hash = ?
4. Check is_active flag
5. Lookup user plan
6. Update last_used_at
7. Continue to rate limiting
```

**Performance:** ~1-2ms (SQLite in-memory cache)

### 2. Rate Limiting

```typescript
// Per-user monthly limits
Free:     100 calls/month  (10 if unverified)
Pro:      2,000 calls/month
Agency:   10,000 calls/month
Enterprise: Unlimited

// Algorithm:
1. Get window_start (1st of month)
2. SQLite transaction:
   - SELECT call_count FROM rate_limits WHERE user_id = ?
   - IF new window: INSERT/RESET
   - IF under limit: UPDATE call_count = call_count + 1
   - IF over limit: REJECT
3. Return allowed/used/remaining
```

**Performance:** ~1-2ms (SQLite transaction)

### 3. Binary Pool (MCP)

```typescript
// BinaryPool manages Rust process lifecycle

User 1 requests ──┐
                  ├─► BinaryPool.getInstance(userId)
User 2 requests ──┤       │
                  │       ├─ Check Map<string, BinaryInstance>
User 1 requests ──┘       ├─ If exists & alive → reuse
                          ├─ If dead/missing → spawn new
                          │
                          ▼
                    BinaryInstance
                    ───────────────
                    • Spawn: bun spawn()
                    • stdin/stdout: JSON-RPC
                    • Idle timeout: 5 minutes
                    • Auto-kill on idle
```

**Memory per binary:** ~30-50MB  
**Spawn time:** ~300-500ms (first request)  
**Reuse time:** ~10ms (subsequent requests)

### 4. Database Schema (SQLite)

```sql
-- Core tables
users              -- Auth, plan, email
api_keys           -- Hashed keys, scopes, activity
rate_limits        -- Monthly usage counters
usage_logs         -- Audit trail
sessions           -- Dashboard cookies
subscriptions      -- Billing state
google_credentials -- Encrypted OAuth tokens

-- WAL mode enabled (write-ahead logging)
-- Foreign keys enforced
-- Auto-vacuum enabled
```

---

## Monitoring & Maintenance

### 1. Systemd Service (Auto-restart)

```ini
# /etc/systemd/system/seomcp.service
[Unit]
Description=SEO MCP SaaS
After=network.target

[Service]
Type=simple
User=seomcp
WorkingDirectory=/opt/seomcp
ExecStart=/usr/bin/bun run src/index.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Commands:**
```bash
sudo systemctl start seomcp
sudo systemctl enable seomcp
sudo systemctl status seomcp
sudo journalctl -u seomcp -f
```

### 2. Log Monitoring

```bash
# Watch live logs
pm2 logs seomcp

# Or with journald
journalctl -u seomcp -f --since "1 hour ago"

# Look for errors
grep -i "error\|fail\|crash" /var/log/seomcp.log
```

**Key metrics to watch:**
- Binary spawn failures
- SQLite lock timeouts
- Memory usage
- Request latency (>5s is bad)

### 3. Automated Backups

```bash
#!/bin/bash
# /opt/seomcp/scripts/backup.sh

DATE=$(date +%Y%m%d-%H%M)
DB_PATH="/data/seo-mcp-saas.db"
BACKUP_DIR="/backup"

# SQLite backup (online, no downtime)
sqlite3 "$DB_PATH" ".backup $BACKUP_DIR/seo-mcp-$DATE.db"

# Compress
gzip "$BACKUP_DIR/seo-mcp-$DATE.db"

# Upload to R2/S3
rclone copy "$BACKUP_DIR/seo-mcp-$DATE.db.gz" r2:seomcp-backups/

# Keep only last 7 days locally
find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete
```

**Cron:**
```bash
# Daily at 2 AM
0 2 * * * /opt/seomcp/scripts/backup.sh >> /var/log/backup.log 2>&1
```

### 4. Health Checks

```bash
# Server health
curl https://seomcp.dev/health

# MCP health (with key)
curl -X POST https://seomcp.dev/mcp \
  -H "Authorization: Bearer $TEST_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",...}'

# Disk space
df -h /data

# Memory
free -h

# Processes
ps aux | grep seo-mcp-server | wc -l  # Count active binaries
```

---

## Scaling Checklist

### Phase 1: Optimize Current (100-200 users)

- [ ] Enable SQLite `PRAGMA synchronous = NORMAL`
- [ ] Add `PRAGMA cache_size = 10000` (more memory cache)
- [ ] Tune binary idle timeout (lower = less RAM, higher = faster)
- [ ] Add Cloudflare CDN for static assets
- [ ] Enable gzip compression in Bun

### Phase 2: Vertical Scale (200-500 users)

- [ ] Upgrade to CX31 (4GB RAM) — $9/mo
- [ ] Add swap file (4GB) — emergency only
- [ ] Separate read replicas? (probably not needed)
- [ ] Add monitoring dashboard (Grafana + Prometheus)

### Phase 3: Horizontal Scale (500+ users) — MIGRATION TIME

- [ ] Evaluate: Workers + D1 OR Kubernetes OR More VPS
- [ ] Plan migration strategy
- [ ] Budget: $100-500/mo for infrastructure

---

## Security Checklist

- [ ] UFW firewall: only 22, 80, 443 open
- [ ] Fail2ban for SSH
- [ ] Auto-updates: `unattended-upgrades`
- [ ] Non-root user for app
- [ ] SQLite permissions: 600 (owner only)
- [ ] API keys: hashed (SHA-256), never logged
- [ ] OAuth tokens: encrypted (AES-256-GCM)
- [ ] HTTPS only (Let's Encrypt)

---

## Decision Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-02-15 | Stay on Hetzner | Current capacity sufficient, migration cost too high |
| 2026-02-15 | Switch to Paddle | Better than Lemon Squeezy, easier than architecture migration |
| Future | Re-evaluate Workers | When >500 users or >$10k/mo |

---

## Related Documents

- `DEPLOY.md` — Deployment instructions
- `README.md` — General documentation
- `SECURITY.md` — Security practices
- `PLAN.md` — Product roadmap

---

**Next Review:** When we hit 200 active users or $5k MRR
