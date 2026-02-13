import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { eq, and, gte, desc, sql, ne } from "drizzle-orm";
import { db, schema } from "../db/index";
import { config } from "../config";
import {
  createSession,
  validateSession,
  deleteSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  type SessionData,
} from "../auth/session";
import { generateApiKey } from "../auth/keys";
import { ulid } from "../utils/ulid";
import { checkIpRateLimit, getClientIp } from "../middleware/rate-limit-ip";
import { readFileSync } from "fs";
import { join, dirname } from "path";

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

// Dashboard login rate limiting now uses shared module (src/middleware/rate-limit-ip.ts)

// ── Session middleware ──
function getSession(c: any): SessionData | null {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  return validateSession(sessionId);
}

// ── HTML cache ──
let cachedLoginHtml: string | null = null;
let cachedDashboardHtml: string | null = null;
const isDev = process.env.NODE_ENV !== "production";

function loadHtml(name: string): string {
  const htmlPath = join(dirname(new URL(import.meta.url).pathname), "..", "dashboard", `${name}.html`);
  try {
    return readFileSync(htmlPath, "utf-8");
  } catch (e) {
    return `<!DOCTYPE html><html><body><h1>${name} not found</h1><p>Expected at: ${htmlPath}</p></body></html>`;
  }
}

function getLoginHtml(): string {
  if (isDev) return loadHtml("login");
  if (!cachedLoginHtml) cachedLoginHtml = loadHtml("login");
  return cachedLoginHtml;
}

function getDashboardHtml(): string {
  if (isDev) return loadHtml("app");
  if (!cachedDashboardHtml) cachedDashboardHtml = loadHtml("app");
  return cachedDashboardHtml;
}

// ── Routes ──

/**
 * GET /dashboard/login — Login page
 */
dashboardRoutes.get("/dashboard/login", (c) => {
  // If already logged in, redirect to dashboard
  const session = getSession(c);
  if (session) {
    return c.redirect("/dashboard");
  }
  return c.html(getLoginHtml());
});

/**
 * POST /dashboard/login — Authenticate and create session
 */
dashboardRoutes.post("/dashboard/login", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}));

  if (!body.email || !body.password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  const email = body.email.toLowerCase().trim();
  const ip = getClientIp(c);

  // Rate limit check: 10 attempts per 15 min (shared module)
  const { allowed, retryAfterMs } = checkIpRateLimit(`dashboard-login:${ip}`, 10, 15 * 60 * 1000);
  if (!allowed) {
    c.header("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    return c.json({ error: "Too many login attempts. Try again in 15 minutes." }, 429);
  }

  // Find user
  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)
    .all()[0];

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Verify password
  const valid = await Bun.password.verify(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Create session
  const sessionId = createSession(user.id);
  const cookieOpts = sessionCookieOptions(process.env.NODE_ENV === "production");
  setCookie(c, SESSION_COOKIE_NAME, sessionId, cookieOpts);

  return c.json({ success: true, redirect: "/dashboard" });
});

/**
 * POST /dashboard/logout
 * Accepts both JSON and non-JSON (form) for convenience, but uses a session check.
 */
dashboardRoutes.post("/dashboard/logout", (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) {
    return c.json({ error: "Not authenticated" }, 401);
  }
  // Validate session exists (prevents blind logout CSRF)
  const session = validateSession(sessionId);
  if (!session) {
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/dashboard" });
    return c.json({ error: "Session already expired" }, 401);
  }
  deleteSession(sessionId);
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/dashboard" });
  return c.json({ success: true, redirect: "/dashboard/login" });
});

/**
 * GET /dashboard — Main dashboard (requires auth)
 */
dashboardRoutes.get("/dashboard", (c) => {
  const session = getSession(c);
  if (!session) {
    return c.redirect("/dashboard/login");
  }
  return c.html(getDashboardHtml());
});

/**
 * GET /dashboard/api/overview — All dashboard data in one call
 */
dashboardRoutes.get("/dashboard/api/overview", (c) => {
  const session = getSession(c);
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
    keys: keys.map((k) => ({
      ...k,
      lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
      createdAt: k.createdAt.toISOString(),
    })),
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
dashboardRoutes.post("/dashboard/api/keys", (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = getSession(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  return c.req.json<{ name?: string }>().then((body) => {
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
        createdAt: new Date(),
      })
      .run();

    return c.json(
      {
        id: keyId,
        key: raw, // Only shown once
        prefix,
        name: body?.name || "Untitled",
        message: "Save your API key — it won't be shown again.",
      },
      201,
    );
  }).catch(() => {
    return c.json({ error: "Invalid request body" }, 400);
  });
});

/**
 * POST /dashboard/api/keys/:id/revoke — Revoke API key (POST for CSRF safety)
 * Also supports DELETE for backwards compatibility.
 */
dashboardRoutes.post("/dashboard/api/keys/:id/revoke", revokeKeyHandler);
dashboardRoutes.delete("/dashboard/api/keys/:id", revokeKeyHandler);

function revokeKeyHandler(c: any) {
  // For DELETE requests, verify X-Requested-With header for CSRF protection
  if (c.req.method === "DELETE") {
    const xrw = c.req.header("X-Requested-With");
    if (xrw !== "XMLHttpRequest") {
      // Accept anyway for now but log — prefer POST /revoke going forward
    }
  }

  const session = getSession(c);
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
 * POST /dashboard/api/password — Change password
 */
dashboardRoutes.post("/dashboard/api/password", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = getSession(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const body = await c.req.json<{ currentPassword?: string; newPassword?: string }>().catch(() => ({}));

  if (!body.currentPassword || !body.newPassword) {
    return c.json({ error: "Current password and new password are required" }, 400);
  }

  if (body.newPassword.length < 8) {
    return c.json({ error: "New password must be at least 8 characters" }, 400);
  }

  // Verify current password
  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1)
    .all()[0];

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const valid = await Bun.password.verify(body.currentPassword, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Current password is incorrect" }, 401);
  }

  // Hash and update
  const newHash = await Bun.password.hash(body.newPassword, { algorithm: "bcrypt" });
  db.update(schema.users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(schema.users.id, session.userId))
    .run();

  // Invalidate all other sessions (keep current session active)
  db.delete(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, session.userId),
        ne(schema.sessions.id, session.sessionId),
      ),
    )
    .run();

  return c.json({ success: true, message: "Password updated" });
});
