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

export const googleTokens = sqliteTable("google_tokens", {
  id: text("id").primaryKey(), // ULID
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  accessTokenEnc: text("access_token_enc").notNull(), // AES-256-GCM encrypted
  refreshTokenEnc: text("refresh_token_enc").notNull(), // AES-256-GCM encrypted
  tokenType: text("token_type").notNull().default("Bearer"),
  expiresAt: integer("expires_at").notNull(), // Unix timestamp
  scopes: text("scopes").notNull(), // Space-separated OAuth scopes
  googleEmail: text("google_email"), // User's Google email (for display)
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // ULID — used as cookie value
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at").notNull(), // Unix timestamp
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(), // ULID
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  lsSubscriptionId: text("ls_subscription_id").notNull().unique(), // Lemon Squeezy subscription ID
  lsCustomerId: text("ls_customer_id"),
  lsOrderId: text("ls_order_id"),
  lsVariantId: text("ls_variant_id").notNull(),
  plan: text("plan").notNull(), // 'pro' | 'agency'
  status: text("status").notNull(), // 'active' | 'cancelled' | 'expired' | 'past_due' | 'paused' | 'on_trial' | 'unpaid'
  currentPeriodEnd: integer("current_period_end"), // Unix timestamp
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
  updatePaymentUrl: text("update_payment_url"),
  customerPortalUrl: text("customer_portal_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const webhookEvents = sqliteTable("webhook_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventName: text("event_name").notNull(),
  lsId: text("ls_id").notNull(), // Lemon Squeezy object ID
  payload: text("payload").notNull(), // Full JSON for audit/replay
  processedAt: integer("processed_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const rateLimits = sqliteTable("rate_limits", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  apiKeyId: text("api_key_id")
    .notNull()
    .references(() => apiKeys.id), // Last key that triggered an increment
  windowStart: integer("window_start").notNull(), // Unix timestamp (start of month)
  callCount: integer("call_count").notNull().default(0),
});
