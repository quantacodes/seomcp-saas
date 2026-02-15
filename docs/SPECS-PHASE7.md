# Phase 7: User Webhooks + Scheduled Audits

## 7A: User Webhook Routes + Dashboard UI

### Overview
Wire the existing `src/webhooks/user-webhooks.ts` into dashboard routes. Users can:
- Set/update their webhook URL from the dashboard
- Test the webhook (sends a test event)
- See webhook delivery status (last delivery, last error)

### New Dashboard API Endpoints
- `GET /dashboard/api/webhook` — Get current webhook config
- `POST /dashboard/api/webhook` — Set/update webhook URL
- `DELETE /dashboard/api/webhook` — Remove webhook URL
- `POST /dashboard/api/webhook/test` — Send a test webhook event

### Database Change
Add to users table (already done via ALTER TABLE):
- `webhook_url TEXT DEFAULT NULL`

Add webhook_deliveries table for delivery tracking:
```sql
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  event TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  success INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_user ON webhook_deliveries(user_id, created_at DESC);
```

### Webhook Events
- `audit.completed` — When generate_report/site_audit/crawl_page finishes
- `usage.alert` — When usage hits 80% or 100%
- `test` — Manual test event

### Integration Points
1. After audit capture in `audit/history.ts` → call `notifyAuditComplete()`
2. After rate limit check → call `notifyUsageAlert()` if threshold hit
3. Log all deliveries to webhook_deliveries table

### Dashboard UI
New "Webhooks" section in settings:
- URL input with HTTPS validation
- Save / Remove buttons
- "Send Test" button
- Last 10 deliveries table (event, status, time)

---

## 7B: Scheduled Audits

### Overview
Users can schedule recurring SEO audits. The system runs them automatically and stores results in audit_history. Combined with webhooks, users get automated SEO monitoring.

### Database Schema
```sql
CREATE TABLE IF NOT EXISTS scheduled_audits (
  id TEXT PRIMARY KEY, -- ULID
  user_id TEXT NOT NULL REFERENCES users(id),
  api_key_id TEXT NOT NULL REFERENCES api_keys(id),
  site_url TEXT NOT NULL,
  tool_name TEXT NOT NULL DEFAULT 'generate_report',
  schedule TEXT NOT NULL, -- 'daily' | 'weekly' | 'monthly'
  schedule_hour INTEGER NOT NULL DEFAULT 6, -- UTC hour (0-23)
  schedule_day INTEGER, -- Day of week (0-6, Mon=0) for weekly, day of month (1-28) for monthly
  is_active INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  next_run_at INTEGER NOT NULL,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scheduled_audits_user ON scheduled_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_audits_next ON scheduled_audits(is_active, next_run_at);
```

### Plan Limits
- Free: 0 scheduled audits
- Pro: 3 scheduled audits
- Agency: 20 scheduled audits

### Dashboard API Endpoints
- `GET /dashboard/api/schedules` — List user's scheduled audits
- `POST /dashboard/api/schedules` — Create scheduled audit
- `PATCH /dashboard/api/schedules/:id` — Update (pause/resume, change schedule)
- `DELETE /dashboard/api/schedules/:id` — Delete scheduled audit
- `POST /dashboard/api/schedules/:id/run` — Run immediately (manual trigger)

### Scheduler Engine (`src/scheduler/engine.ts`)
A simple polling scheduler that runs every 60 seconds:
1. Query: `SELECT * FROM scheduled_audits WHERE is_active = 1 AND next_run_at <= ?`
2. For each due audit:
   a. Spawn the seo-mcp binary with user's config
   b. Run the tool (generate_report, site_audit, or crawl_page)
   c. Store result in audit_history
   d. Send webhook notification if configured
   e. Update last_run_at, next_run_at, run_count
   f. Respect rate limits (deduct from user's monthly quota)
3. Calculate next_run_at based on schedule type

### Next Run Calculation
```typescript
function calculateNextRun(schedule: string, hour: number, day?: number): number {
  const now = new Date();
  let next = new Date();
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(hour);
  
  switch (schedule) {
    case 'daily':
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
      break;
    case 'weekly':
      // day = 0-6 (Mon-Sun)
      while (next.getUTCDay() !== ((day ?? 0) + 1) % 7 || next <= now) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      break;
    case 'monthly':
      next.setUTCDate(day ?? 1);
      if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }
  return next.getTime();
}
```

### Dashboard UI
New "Scheduled Audits" section:
- List of schedules with site, frequency, next run, last run, status
- Create new: site URL, tool, frequency (daily/weekly/monthly), time, day
- Pause/Resume toggle
- Delete button
- "Run Now" button
- Plan limit indicator (e.g., "2/3 schedules used")

### Concurrency Control
- Max 3 concurrent scheduled audit runs (global)
- If a run takes >5 minutes, timeout and mark as failed
- If binary pool is full, queue and retry on next tick

### Error Handling
- If audit fails, still update next_run_at (don't retry endlessly)
- Store error in audit_history with status field
- Notify via webhook on failure too

---

## Implementation Order
1. Webhook routes + dashboard UI (builds on existing code)
2. Webhook delivery tracking (migration + logging)
3. Wire webhooks into audit capture + rate limiter
4. Scheduled audits schema + migration
5. Scheduler engine
6. Scheduled audits routes + dashboard UI
7. Tests for both features
