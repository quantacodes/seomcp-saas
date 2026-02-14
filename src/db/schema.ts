import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // ULID
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull().default(""), // Empty for Clerk users
  clerkUserId: text("clerk_user_id"), // Clerk's user ID (user_xxx) for future mapping
  plan: text("plan").notNull().default("free"), // free | pro | agency | enterprise
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  verificationToken: text("verification_token"),
  verificationSentAt: integer("verification_sent_at", { mode: "timestamp" }),
  resetToken: text("reset_token"), // SHA-256 hash of password reset token
  resetSentAt: integer("reset_sent_at", { mode: "timestamp" }),
  webhookUrl: text("webhook_url"), // Webhook notification URL
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
  scopes: text("scopes"), // JSON array of tool categories, null = all
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

export const googleCredentials = sqliteTable("google_credentials", {
  id: text("id").primaryKey(), // ULID
  userId: text("user_id").notNull()
    .references(() => users.id),
  credentialType: text("credential_type").notNull(), // 'oauth' | 'service_account'
  encryptedData: text("encrypted_data").notNull(), // AES-256-GCM encrypted JSON
  email: text("email"), // Service account email or Google email
  scopes: text("scopes"), // JSON array of scopes
  gscProperties: text("gsc_properties"), // JSON array of verified GSC properties
  status: text("status").notNull().default("active"), // active/expired/revoked/error
  lastValidatedAt: integer("last_validated_at", { mode: "timestamp" }),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
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

export const auditHistory = sqliteTable("audit_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  apiKeyId: text("api_key_id")
    .notNull()
    .references(() => apiKeys.id),
  toolName: text("tool_name").notNull(), // 'generate_report' | 'site_audit' | 'crawl_page'
  siteUrl: text("site_url").notNull(),
  healthScore: integer("health_score"), // 0-100
  summary: text("summary"), // JSON extracted metrics
  fullResult: text("full_result").notNull(), // Full response JSON
  durationMs: integer("duration_ms"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const webhookDeliveries = sqliteTable("webhook_deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  event: text("event").notNull(),
  url: text("url").notNull(),
  statusCode: integer("status_code"),
  success: integer("success", { mode: "boolean" }).notNull().default(false),
  error: text("error"),
  durationMs: integer("duration_ms"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const scheduledAudits = sqliteTable("scheduled_audits", {
  id: text("id").primaryKey(), // ULID
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  apiKeyId: text("api_key_id")
    .notNull()
    .references(() => apiKeys.id),
  siteUrl: text("site_url").notNull(),
  toolName: text("tool_name").notNull().default("generate_report"),
  schedule: text("schedule").notNull(), // 'daily' | 'weekly' | 'monthly'
  scheduleHour: integer("schedule_hour").notNull().default(6), // UTC hour
  scheduleDay: integer("schedule_day"), // Day of week (0-6) or day of month (1-28)
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  nextRunAt: integer("next_run_at").notNull(), // Unix timestamp ms
  lastError: text("last_error"),
  runCount: integer("run_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(), // ULID
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  maxMembers: integer("max_members").notNull().default(5),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(), // ULID
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  userId: text("user_id").references(() => users.id), // NULL if invite pending
  email: text("email").notNull(),
  role: text("role").notNull().default("member"), // 'owner' | 'admin' | 'member'
  inviteToken: text("invite_token"), // HMAC token hash for pending invites
  inviteExpiresAt: integer("invite_expires_at"), // Unix timestamp
  joinedAt: integer("joined_at", { mode: "timestamp" }),
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

export const userAgentMappings = sqliteTable("user_agent_mappings", {
  id: text("id").primaryKey(),           // ulid
  userId: text("user_id").notNull(),     // references users.id
  agentCustomerId: text("agent_customer_id").notNull().unique(),  // ID in Agent SaaS DB
  siteUrl: text("site_url").notNull(),
  plan: text("plan").notNull().default("starter"),
  status: text("status").notNull().default("provisioning"),  // provisioning/active/suspended/cancelled
  hetznerServerId: integer("hetzner_server_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
