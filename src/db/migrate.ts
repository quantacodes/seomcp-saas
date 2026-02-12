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
  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_logs_key ON usage_logs(api_key_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id, created_at)`,
  // rate_limits PK is user_id, no extra index needed
];

export function runMigrations() {
  for (const sql of migrations) {
    sqlite.exec(sql);
  }
  console.log(`✅ Migrations complete (${migrations.length} statements)`);
}

// Run if called directly
if (import.meta.main) {
  runMigrations();
}
