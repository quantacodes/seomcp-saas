import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // ULID
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  plan: text("plan").notNull().default("free"), // free | pro | agency | enterprise
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(), // ULID
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  keyHash: text("key_hash").notNull().unique(), // SHA-256 of the full key
  keyPrefix: text("key_prefix").notNull(), // "sk_live_REDACTED" — first 16 chars for display
  name: text("name").notNull().default("Default"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const usageLogs = sqliteTable("usage_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  apiKeyId: text("api_key_id")
    .notNull()
    .references(() => apiKeys.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  toolName: text("tool_name").notNull(),
  requestId: text("request_id"),
  status: text("status").notNull(), // success | error | rate_limited
  durationMs: integer("duration_ms"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const rateLimits = sqliteTable("rate_limits", {
  apiKeyId: text("api_key_id")
    .primaryKey()
    .references(() => apiKeys.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  windowStart: integer("window_start").notNull(), // Unix timestamp (start of month)
  callCount: integer("call_count").notNull().default(0),
});
