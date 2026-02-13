import { sqlite } from "./index";

// Manual migration — simpler than drizzle-kit for MVP
const migrations = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Default',
    is_active INTEGER NOT NULL DEFAULT 1,
    last_used_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_id TEXT NOT NULL REFERENCES api_keys(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    tool_name TEXT NOT NULL,
    request_id TEXT,
    status TEXT NOT NULL,
    duration_ms INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    api_key_id TEXT NOT NULL REFERENCES api_keys(id),
    window_start INTEGER NOT NULL,
    call_count INTEGER NOT NULL DEFAULT 0
  )`,
  // Google OAuth tokens (Phase 1.5)
  `CREATE TABLE IF NOT EXISTS google_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    access_token_enc TEXT NOT NULL,
    refresh_token_enc TEXT NOT NULL,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    expires_at INTEGER NOT NULL,
    scopes TEXT NOT NULL,
    google_email TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  // Dashboard sessions (Phase 3)
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`,
  // Subscriptions (Phase 4 — Billing)
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    ls_subscription_id TEXT NOT NULL UNIQUE,
    ls_customer_id TEXT,
    ls_order_id TEXT,
    ls_variant_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_end INTEGER,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    update_payment_url TEXT,
    customer_portal_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_ls_id ON subscriptions(ls_subscription_id)`,
  // Webhook events audit log (Phase 4)
  `CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    ls_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    processed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_events_ls_id ON webhook_events(ls_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_idempotent ON webhook_events(event_name, ls_id)`,
  // Audit history (Phase 6)
  `CREATE TABLE IF NOT EXISTS audit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    api_key_id TEXT NOT NULL REFERENCES api_keys(id),
    tool_name TEXT NOT NULL,
    site_url TEXT NOT NULL,
    health_score INTEGER,
    summary TEXT,
    full_result TEXT NOT NULL,
    duration_ms INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_history_user ON audit_history(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_history_site ON audit_history(user_id, site_url, created_at DESC)`,
  // Webhook delivery log (Phase 7)
  `CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    event TEXT NOT NULL,
    url TEXT NOT NULL,
    status_code INTEGER,
    success INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    duration_ms INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_user ON webhook_deliveries(user_id, created_at DESC)`,
  // Scheduled audits (Phase 7)
  `CREATE TABLE IF NOT EXISTS scheduled_audits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    api_key_id TEXT NOT NULL REFERENCES api_keys(id),
    site_url TEXT NOT NULL,
    tool_name TEXT NOT NULL DEFAULT 'generate_report',
    schedule TEXT NOT NULL,
    schedule_hour INTEGER NOT NULL DEFAULT 6,
    schedule_day INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_run_at INTEGER,
    next_run_at INTEGER NOT NULL,
    last_error TEXT,
    run_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scheduled_audits_user ON scheduled_audits(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_scheduled_audits_next ON scheduled_audits(is_active, next_run_at)`,
  // Teams (Phase 9)
  `CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id),
    max_members INTEGER NOT NULL DEFAULT 5,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id)`,
  `CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES teams(id),
    user_id TEXT REFERENCES users(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    invite_token TEXT,
    invite_expires_at INTEGER,
    joined_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id)`,
  `CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_unique ON team_members(team_id, email)`,
  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_logs_key ON usage_logs(api_key_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id, created_at)`,
  // rate_limits PK is user_id, no extra index needed
];

// ALTER TABLE migrations that may fail if already applied (SQLite lacks IF NOT EXISTS for columns)
const alterMigrations = [
  `ALTER TABLE api_keys ADD COLUMN scopes TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN webhook_url TEXT DEFAULT NULL`,
  `ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN verification_token TEXT`,
  `ALTER TABLE users ADD COLUMN verification_sent_at INTEGER`,
];

export function runMigrations() {
  for (const sql of migrations) {
    sqlite.exec(sql);
  }
  // Apply ALTER TABLE migrations (ignore "duplicate column" errors)
  for (const sql of alterMigrations) {
    try {
      sqlite.exec(sql);
    } catch (e: any) {
      if (!e.message?.includes("duplicate column")) throw e;
    }
  }
  console.log(`✅ Migrations complete (${migrations.length + alterMigrations.length} statements)`);
}

// Run if called directly
if (import.meta.main) {
  runMigrations();
}
