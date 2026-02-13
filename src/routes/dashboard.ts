import { Hono } from "hono";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { db, schema } from "../db/index";
import { config } from "../config";
import {
  getClerkSession,
  getUserProfileUrl,
  type ClerkSessionData,
} from "../auth/clerk";
import { generateApiKey } from "../auth/keys";
import { ulid } from "../utils/ulid";
import { validateScopes, describeScopeAccess, parseScopes } from "../auth/scopes";
import { getUserWebhookUrl, setUserWebhookUrl, validateWebhookUrl } from "../webhooks/user-webhooks";
// Note: HTML serving removed - now on Cloudflare Pages

export const dashboardRoutes = new Hono();

// ── CSRF protection: require JSON content-type on mutating endpoints ──
// Browsers won't send application/json cross-origin without CORS preflight,
// which effectively prevents CSRF for JSON-body endpoints.
function requireJson(c: any): Response | null {
  const ct = c.req.header("Content-Type") || "";
  if (!ct.includes("application/json")) {
    return c.json({ error: "Content-Type must be application/json" }, 415);
  }
  return null;
}

// Note: HTML pages are now served from seomcp.dev (Cloudflare Pages)
// This file only serves API routes for the dashboard

// ── Routes ──

// Note: /dashboard, /dashboard/login, /dashboard/signup, /dashboard/logout
// are now served from seomcp.dev (Cloudflare Pages) with Clerk auth
// Legacy redirects for backwards compatibility:

/**
 * GET /dashboard — Redirect to main domain
 */
dashboardRoutes.get("/dashboard", (c) => {
  return c.redirect("https://seomcp.dev/dashboard", 302);
});

/**
 * GET /dashboard/login — Redirect to main domain
 */
dashboardRoutes.get("/dashboard/login", (c) => {
  return c.redirect("https://seomcp.dev/login", 302);
});

/**
 * GET /dashboard/signup — Redirect to main domain
 */
dashboardRoutes.get("/dashboard/signup", (c) => {
  return c.redirect("https://seomcp.dev/signup", 302);
});

/**
 * GET /dashboard/api/overview — All dashboard data in one call
 */
dashboardRoutes.get("/dashboard/api/overview", async (c) => {
  const session = await getClerkSession(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Usage stats
  const usageResult = db
    .select({
      totalCalls: sql<number>`count(*)`,
      successCalls: sql<number>`sum(case when status = 'success' then 1 else 0 end)`,
      errorCalls: sql<number>`sum(case when status = 'error' then 1 else 0 end)`,
      rateLimited: sql<number>`sum(case when status = 'rate_limited' then 1 else 0 end)`,
      avgDuration: sql<number>`avg(duration_ms)`,
    })
    .from(schema.usageLogs)
    .where(
      and(
        eq(schema.usageLogs.userId, session.userId),
        gte(schema.usageLogs.createdAt, monthStart),
      ),
    )
    .all()[0];

  // Top tools
  const topTools = db
    .select({
      tool: schema.usageLogs.toolName,
      count: sql<number>`count(*)`,
    })
    .from(schema.usageLogs)
    .where(
      and(
        eq(schema.usageLogs.userId, session.userId),
        gte(schema.usageLogs.createdAt, monthStart),
      ),
    )
    .groupBy(schema.usageLogs.toolName)
    .orderBy(sql`count(*) DESC`)
    .limit(10)
    .all();

  // Daily usage (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dailyUsage = db
    .select({
      date: sql<string>`date(created_at / 1000, 'unixepoch')`,
      calls: sql<number>`count(*)`,
    })
    .from(schema.usageLogs)
    .where(
      and(
        eq(schema.usageLogs.userId, session.userId),
        gte(schema.usageLogs.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(sql`date(created_at / 1000, 'unixepoch')`)
    .orderBy(sql`date(created_at / 1000, 'unixepoch')`)
    .all();

  // API keys
  const keys = db
    .select({
      id: schema.apiKeys.id,
      prefix: schema.apiKeys.keyPrefix,
      name: schema.apiKeys.name,
      isActive: schema.apiKeys.isActive,
      scopes: schema.apiKeys.scopes,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      createdAt: schema.apiKeys.createdAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.userId, session.userId))
    .all();

  // Google connection
  const googleToken = db
    .select({
      googleEmail: schema.googleTokens.googleEmail,
      scopes: schema.googleTokens.scopes,
      createdAt: schema.googleTokens.createdAt,
    })
    .from(schema.googleTokens)
    .where(eq(schema.googleTokens.userId, session.userId))
    .limit(1)
    .all()[0];

  // Subscription / billing
  const subscription = db
    .select({
      plan: schema.subscriptions.plan,
      status: schema.subscriptions.status,
      currentPeriodEnd: schema.subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: schema.subscriptions.cancelAtPeriodEnd,
      customerPortalUrl: schema.subscriptions.customerPortalUrl,
      updatePaymentUrl: schema.subscriptions.updatePaymentUrl,
    })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, session.userId))
    .limit(1)
    .all()[0];

  // Recent calls (last 20)
  const recentCalls = db
    .select({
      tool: schema.usageLogs.toolName,
      status: schema.usageLogs.status,
      durationMs: schema.usageLogs.durationMs,
      createdAt: schema.usageLogs.createdAt,
    })
    .from(schema.usageLogs)
    .where(eq(schema.usageLogs.userId, session.userId))
    .orderBy(desc(schema.usageLogs.createdAt))
    .limit(20)
    .all();

  const planLimits = config.plans[session.plan];
  const used = usageResult?.totalCalls || 0;
  const limit = planLimits?.callsPerMonth ?? 50;

  return c.json({
    user: {
      id: session.userId,
      email: session.email,
      plan: session.plan,
      emailVerified: session.emailVerified,
      profileUrl: getUserProfileUrl(), // Clerk profile management
    },
    usage: {
      used,
      limit: limit === Infinity ? "unlimited" : limit,
      remaining: limit === Infinity ? "unlimited" : Math.max(0, limit - used),
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      breakdown: {
        success: usageResult?.successCalls || 0,
        error: usageResult?.errorCalls || 0,
        rateLimited: usageResult?.rateLimited || 0,
      },
      avgDurationMs: Math.round(usageResult?.avgDuration || 0),
      topTools,
      dailyUsage,
    },
    keys: keys.map((k) => {
      const parsedScopes = parseScopes(k.scopes);
      return {
        ...k,
        scopes: parsedScopes,
        scopeDescription: describeScopeAccess(parsedScopes),
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        createdAt: k.createdAt.toISOString(),
      };
    }),
    google: googleToken
      ? {
          connected: true,
          email: googleToken.googleEmail,
          scopes: googleToken.scopes,
          connectedAt: googleToken.createdAt.toISOString(),
        }
      : { connected: false },
    recentCalls: recentCalls.map((r) => ({
      tool: r.tool,
      status: r.status,
      durationMs: r.durationMs,
      createdAt: r.createdAt.toISOString(),
    })),
    billing: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          renewsAt: subscription.currentPeriodEnd
            ? new Date(subscription.currentPeriodEnd * 1000).toISOString()
            : null,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          portalUrl: subscription.customerPortalUrl,
          updatePaymentUrl: subscription.updatePaymentUrl,
        }
      : null,
  });
});

/**
 * POST /dashboard/api/keys — Create new API key
 */
dashboardRoutes.post("/dashboard/api/keys", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = await getClerkSession(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const body = await c.req.json<{ name?: string; scopes?: string[] }>().catch(() => ({}));

  // Check plan limits
  const planLimits = config.plans[session.plan];
  const existingCount = db
    .select()
    .from(schema.apiKeys)
    .where(
      and(
        eq(schema.apiKeys.userId, session.userId),
        eq(schema.apiKeys.isActive, true),
      ),
    )
    .all().length;

  if (existingCount >= planLimits.maxKeys) {
    return c.json(
      { error: `Maximum ${planLimits.maxKeys} API keys for ${session.plan} plan. Upgrade for more.` },
      403,
    );
  }

  // Validate scopes
  const scopeResult = validateScopes(body?.scopes);
  if (!scopeResult.valid) {
    return c.json({ error: scopeResult.error }, 400);
  }

  const { raw, hash, prefix } = generateApiKey();
  const keyId = ulid();

  db.insert(schema.apiKeys)
    .values({
      id: keyId,
      userId: session.userId,
      keyHash: hash,
      keyPrefix: prefix,
      name: body?.name || "Untitled",
      isActive: true,
      scopes: scopeResult.scopes ? JSON.stringify(scopeResult.scopes) : null,
      createdAt: new Date(),
    })
    .run();

  return c.json(
    {
      id: keyId,
      key: raw, // Only shown once
      prefix,
      name: body?.name || "Untitled",
      scopes: scopeResult.scopes,
      scopeDescription: describeScopeAccess(scopeResult.scopes),
      message: "Save your API key — it won't be shown again.",
    },
    201,
  );
});

/**
 * POST /dashboard/api/keys/:id/revoke — Revoke API key (POST for CSRF safety)
 * Also supports DELETE for backwards compatibility.
 */
dashboardRoutes.post("/dashboard/api/keys/:id/revoke", revokeKeyHandler);
dashboardRoutes.delete("/dashboard/api/keys/:id", revokeKeyHandler);

async function revokeKeyHandler(c: any) {
  const session = await getClerkSession(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const keyId = c.req.param("id");

  const key = db
    .select()
    .from(schema.apiKeys)
    .where(
      and(
        eq(schema.apiKeys.id, keyId),
        eq(schema.apiKeys.userId, session.userId),
      ),
    )
    .limit(1)
    .all()[0];

  if (!key) {
    return c.json({ error: "API key not found" }, 404);
  }

  db.update(schema.apiKeys)
    .set({ isActive: false })
    .where(eq(schema.apiKeys.id, keyId))
    .run();

  return c.json({ success: true, message: "API key revoked" });
}

/**
 * POST /dashboard/api/keys/:id/rotate — Rotate an API key (revoke old + create new atomically)
 * Returns the new key (only shown once). Old key is immediately revoked.
 */
dashboardRoutes.post("/dashboard/api/keys/:id/rotate", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = await getClerkSession(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const keyId = c.req.param("id");

  // Verify ownership
  const oldKey = db
    .select()
    .from(schema.apiKeys)
    .where(
      and(
        eq(schema.apiKeys.id, keyId),
        eq(schema.apiKeys.userId, session.userId),
        eq(schema.apiKeys.isActive, true),
      ),
    )
    .limit(1)
    .all()[0];

  if (!oldKey) {
    return c.json({ error: "API key not found or already revoked" }, 404);
  }

  // Atomic: revoke old + create new in transaction
  const { sqlite } = await import("../db/index");
  const result = sqlite.transaction(() => {
    // Revoke old key
    db.update(schema.apiKeys)
      .set({ isActive: false })
      .where(eq(schema.apiKeys.id, keyId))
      .run();

    // Create new key with same name and scopes
    const { raw, hash, prefix } = generateApiKey();
    const newKeyId = ulid();

    db.insert(schema.apiKeys)
      .values({
        id: newKeyId,
        userId: session.userId,
        keyHash: hash,
        keyPrefix: prefix,
        name: oldKey.name,
        isActive: true,
        scopes: oldKey.scopes,
        createdAt: new Date(),
      })
      .run();

    return { newKeyId, raw, prefix };
  })();

  return c.json({
    success: true,
    message: "API key rotated. Old key is immediately revoked.",
    key: {
      id: result.newKeyId,
      prefix: result.prefix,
      raw: result.raw,
      name: oldKey.name,
      scopes: oldKey.scopes ? JSON.parse(oldKey.scopes) : null,
    },
  });
});

/**
 * GET /dashboard/api/webhook — Get user's webhook URL
 */
dashboardRoutes.get("/dashboard/api/webhook", async (c) => {
  const session = await getClerkSession(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const url = getUserWebhookUrl(session.userId);
  return c.json({ url: url || null });
});

/**
 * POST /dashboard/api/webhook — Set user's webhook URL
 */
dashboardRoutes.post("/dashboard/api/webhook", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = await getClerkSession(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const body = await c.req.json<{ url?: string }>().catch(() => ({}));

  // Allow clearing the webhook with empty/null URL
  if (!body.url || body.url.trim() === "") {
    setUserWebhookUrl(session.userId, null);
    return c.json({ success: true, url: null });
  }

  // Validate URL
  const validation = validateWebhookUrl(body.url);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  setUserWebhookUrl(session.userId, body.url);
  return c.json({ success: true, url: body.url });
});

/**
 * DELETE /dashboard/api/webhook — Remove user's webhook URL
 */
dashboardRoutes.delete("/dashboard/api/webhook", async (c) => {
  const session = await getClerkSession(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  setUserWebhookUrl(session.userId, null);
  return c.json({ success: true });
});
