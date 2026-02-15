# Operations Runbook — SEO MCP SaaS

Quick reference for managing the production system.

---

## Server Access

```bash
# SSH into server
ssh root@<your-hetzner-ip>

# Switch to app user
su - seomcp
cd /opt/seomcp
```

---

## Common Commands

### Service Management

```bash
# Check status
sudo systemctl status seomcp

# Restart service
sudo systemctl restart seomcp

# View logs
sudo journalctl -u seomcp -f

# Or if using PM2
pm2 status
pm2 logs seomcp
pm2 restart seomcp
```

### Database

```bash
# SQLite CLI
sqlite3 /data/seo-mcp-saas.db

# Useful queries
SELECT COUNT(*) FROM users;
SELECT plan, COUNT(*) FROM users GROUP BY plan;
SELECT * FROM rate_limits ORDER BY call_count DESC LIMIT 10;

# Backup
sqlite3 /data/seo-mcp-saas.db ".backup /backup/manual-$(date +%Y%m%d).db"
```

### Monitoring

```bash
# System resources
htop                    # Interactive process viewer
free -h                 # Memory usage
df -h                   # Disk space

# Application
ps aux | grep seo-mcp-server | wc -l    # Active binary count
lsof -i :3456           # Check port usage
netstat -tlnp           # Listening ports

# Logs
tail -f /var/log/seomcp.log
grep -i error /var/log/seomcp.log | tail -20
```

---

## Troubleshooting

### Issue: Service won't start

```bash
# Check logs
sudo journalctl -u seomcp --since "1 hour ago"

# Check permissions
ls -la /opt/seomcp/
ls -la /data/

# Check database
sqlite3 /data/seo-mcp-saas.db "PRAGMA integrity_check;"

# Test manually
cd /opt/seomcp && bun run src/index.ts
```

### Issue: High memory usage

```bash
# Check what's using memory
ps aux --sort=-%mem | head -20

# Count binary processes
ps aux | grep seo-mcp-server | wc -l

# Restart to clear binaries
sudo systemctl restart seomcp

# Consider lowering idle timeout in src/config.ts
binaryIdleTimeoutMs: 2 * 60 * 1000,  // 2 min instead of 5
```

### Issue: Slow MCP responses

```bash
# Check if binaries are spawning constantly
grep "spawn\|Binary" /var/log/seomcp.log | tail -20

# Check SQLite locks
grep "locked\|busy" /var/log/seomcp.log | tail -20

# Check rate limit queries (should be <5ms)
grep "rate.*limit" /var/log/seomcp.log | tail -20
```

### Issue: Database locked / busy

```bash
# Check active connections
lsof /data/seo-mcp-saas.db

# Check WAL file size
ls -lh /data/seo-mcp-saas.db-wal

# Force WAL checkpoint (careful: briefly locks)
sqlite3 /data/seo-mcp-saas.db "PRAGMA wal_checkpoint;"

# If WAL is huge, consider:
sqlite3 /data/seo-mcp-saas.db "PRAGMA journal_mode = DELETE;"
sqlite3 /data/seo-mcp-saas.db "PRAGMA journal_mode = WAL;"
```

### Issue: 502 Bad Gateway

```bash
# Check if Bun is listening
netstat -tlnp | grep 3456

# Check if process is running
pgrep -f "bun run src/index.ts"

# Restart
sudo systemctl restart seomcp
```

---

## Maintenance Tasks

### Daily

- [ ] Check `/health` endpoint responds
- [ ] Review error logs (grep ERROR)
- [ ] Check disk space (`df -h`)

### Weekly

- [ ] Review user signups count
- [ ] Check binary spawn rate (should be stable)
- [ ] Review failed requests

### Monthly

- [ ] Database backup test (restore to staging)
- [ ] Update system packages (`apt update && apt upgrade`)
- [ ] Review rate limit table size (cleanup old windows)
- [ ] Check SSL certificate expiry

### Quarterly

- [ ] Security audit (fail2ban logs, SSH attempts)
- [ ] Performance review (p99 latency)
- [ ] Capacity planning (user growth vs resources)
- [ ] Disaster recovery drill

---

## Emergency Procedures

### Database Corruption

```bash
# Stop service
sudo systemctl stop seomcp

# Restore from backup
cp /backup/seo-mcp-20260115-0200.db /data/seo-mcp-saas.db

# Fix permissions
chown seomcp:seomcp /data/seo-mcp-saas.db
chmod 600 /data/seo-mcp-saas.db

# Verify integrity
sqlite3 /data/seo-mcp-saas.db "PRAGMA integrity_check;"

# Start service
sudo systemctl start seomcp
```

### Server Compromise

```bash
# Isolate
ufw default deny incoming
ufw deny 3456

# Preserve logs
tar czf /tmp/evidence-$(date +%s).tar.gz /var/log/

# Contact Hetzner support
# Rotate all secrets (API keys, OAuth, DB)
# Restore from clean backup to new instance
```

### DDoS / High Traffic

```bash
# Enable Cloudflare Under Attack mode (via dashboard)
# Or rate limit at nginx level:

# Add to nginx.conf:
limit_req_zone $binary_remote_addr zone=mcp:10m rate=10r/s;
limit_req zone=mcp burst=20 nodelay;

# Monitor active connections
ss -tan | grep :3456 | wc -l
```

---

## Contact & Escalation

| Issue | Contact |
|-------|---------|
| Server down | Check Hetzner console first |
| Payment/billing | Paddle dashboard |
| Domain/DNS | Cloudflare dashboard |
| Critical bug | GitHub issues |

---

## Useful Scripts

```bash
# Quick health check
#!/bin/bash
HEALTH=$(curl -s https://seomcp.dev/health | jq -r '.status')
if [ "$HEALTH" != "ok" ]; then
  echo "ALERT: Health check failed" | mail -s "SEOMCP Alert" admin@seomcp.dev
fi

# Binary process count alert
#!/bin/bash
COUNT=$(ps aux | grep seo-mcp-server | grep -v grep | wc -l)
if [ "$COUNT" -gt 30 ]; then
  echo "ALERT: $COUNT binaries running" | mail -s "SEOMCP High Memory" admin@seomcp.dev
fi
```

---

**Last Updated:** 2026-02-15  
**Next Review:** 2026-03-15
