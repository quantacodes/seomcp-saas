/**
 * Admin API endpoints.
 * Protected by ADMIN_SECRET environment variable.
 * Used for monitoring, analytics, and user management.
 */

import { Hono } from "hono";
import { sqlite } from "../db/index";
import { config } from "../config";
import { binaryPool } from "../mcp/binary";
import { sessionManager } from "../mcp/session";

export const adminRoutes = new Hono();

/**
 * Admin auth middleware.
 * Requires X-Admin-Secret header matching ADMIN_SECRET env var.
 */
adminRoutes.use("/api/admin/*", async (c, next) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return c.json({ error: "Admin API not configured" }, 503);
  }

  const provided = c.req.header("X-Admin-Secret");
  if (!provided || provided !== adminSecret) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});

/**
 * GET /api/admin/stats
 * Overview dashboard: user counts, usage, revenue signals.
 */
adminRoutes.get("/api/admin/stats", (c) => {
  const now = Math.floor(Date.now() / 1000);
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
  const dayStart = now - 86400;
  const weekStart = now - 604800;

  // User stats
  const userStats = sqlite.query<{
    total: number;
    free: number;
    pro: number;
    agency: number;
    enterprise: number;
  }, []>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN plan = 'free' THEN 1 ELSE 0 END) as free,
      SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END) as pro,
      SUM(CASE WHEN plan = 'agency' THEN 1 ELSE 0 END) as agency,
      SUM(CASE WHEN plan = 'enterprise' THEN 1 ELSE 0 END) as enterprise
    FROM users
  `).get()!;

  // Signups this month
  const signupsMonth = sqlite.query<{ count: number }, [number]>(
    `SELECT COUNT(*) as count FROM users WHERE created_at >= ?`
  ).get(monthStart)!;

  // Usage stats (this month)
  const usageMonth = sqlite.query<{
    total_calls: number;
    success: number;
    errors: number;
    rate_limited: number;
  }, [number]>(`
    SELECT 
      COUNT(*) as total_calls,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
      SUM(CASE WHEN status = 'rate_limited' THEN 1 ELSE 0 END) as rate_limited
    FROM usage_logs WHERE created_at >= ?
  `).get(monthStart)!;

  // Usage last 24h
  const usage24h = sqlite.query<{ total_calls: number }, [number]>(
    `SELECT COUNT(*) as total_calls FROM usage_logs WHERE created_at >= ?`
  ).get(dayStart)!;

  // Active users (used API in last 7 days)
  const activeWeek = sqlite.query<{ count: number }, [number]>(
    `SELECT COUNT(DISTINCT user_id) as count FROM usage_logs WHERE created_at >= ?`
  ).get(weekStart)!;

  // Google OAuth connections
  const googleConnected = sqlite.query<{ count: number }, []>(
    `SELECT COUNT(*) as count FROM google_tokens`
  ).get()!;

  // Active subscriptions
  const activeSubs = sqlite.query<{ count: number }, []>(
    `SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'`
  ).get()!;

  // Top tools (this month)
  const topTools = sqlite.query<{ tool_name: string; count: number }, [number]>(`
    SELECT tool_name, COUNT(*) as count 
    FROM usage_logs 
    WHERE created_at >= ? AND status = 'success'
    GROUP BY tool_name 
    ORDER BY count DESC 
    LIMIT 10
  `).all(monthStart);

  // Runtime stats
  const runtime = {
    activeBinaries: binaryPool.size,
    activeSessions: sessionManager.size,
    uptime: process.uptime(),
    memoryMb: Math.round(process.memoryUsage.rss() / 1024 / 1024),
  };

  return c.json({
    users: {
      total: userStats.total,
      byPlan: {
        free: userStats.free,
        pro: userStats.pro,
        agency: userStats.agency,
        enterprise: userStats.enterprise,
      },
      signupsThisMonth: signupsMonth.count,
      activeThisWeek: activeWeek.count,
      googleConnected: googleConnected.count,
    },
    usage: {
      thisMonth: {
        total: usageMonth.total_calls,
        success: usageMonth.success,
        errors: usageMonth.errors,
        rateLimited: usageMonth.rate_limited,
      },
      last24h: usage24h.total_calls,
    },
    billing: {
      activeSubscriptions: activeSubs.count,
      mrr: activeSubs.count * 29, // rough estimate (assumes all Pro)
    },
    topTools,
    runtime,
  });
});

/**
 * GET /api/admin/users
 * List users with usage summary.
 */
adminRoutes.get("/api/admin/users", (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);
  const offset = parseInt(c.req.query("offset") || "0");
  const plan = c.req.query("plan");

  let query = `
    SELECT 
      u.id, u.email, u.plan, u.created_at,
      (SELECT COUNT(*) FROM api_keys WHERE user_id = u.id AND is_active = 1) as active_keys,
      (SELECT COUNT(*) FROM usage_logs WHERE user_id = u.id) as total_calls,
      (SELECT MAX(created_at) FROM usage_logs WHERE user_id = u.id) as last_active,
      (SELECT COUNT(*) FROM google_tokens WHERE user_id = u.id) as google_connected,
      (SELECT status FROM subscriptions WHERE user_id = u.id) as sub_status
    FROM users u
  `;

  const params: any[] = [];
  if (plan) {
    query += ` WHERE u.plan = ?`;
    params.push(plan);
  }

  query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const users = sqlite.query(query).all(...params);

  const total = sqlite.query<{ count: number }, []>(
    plan
      ? `SELECT COUNT(*) as count FROM users WHERE plan = '${plan}'`
      : `SELECT COUNT(*) as count FROM users`
  ).get()!;

  return c.json({
    users,
    pagination: { limit, offset, total: total.count },
  });
});

/**
 * GET /api/admin/users/:id
 * Detailed user view.
 */
adminRoutes.get("/api/admin/users/:id", (c) => {
  const userId = c.req.param("id");

  const user = sqlite.query(`SELECT * FROM users WHERE id = ?`).get(userId);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const keys = sqlite.query(
    `SELECT id, key_prefix, name, is_active, last_used_at, created_at FROM api_keys WHERE user_id = ?`
  ).all(userId);

  const recentUsage = sqlite.query(`
    SELECT tool_name, status, duration_ms, created_at 
    FROM usage_logs 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 20
  `).all(userId);

  const googleToken = sqlite.query(
    `SELECT google_email, scopes, created_at, updated_at FROM google_tokens WHERE user_id = ?`
  ).get(userId);

  const subscription = sqlite.query(
    `SELECT * FROM subscriptions WHERE user_id = ?`
  ).get(userId);

  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
  const monthUsage = sqlite.query<{ count: number }, [string, number]>(
    `SELECT COUNT(*) as count FROM usage_logs WHERE user_id = ? AND created_at >= ?`
  ).get(userId, monthStart)!;

  return c.json({
    user,
    apiKeys: keys,
    recentUsage,
    googleConnection: googleToken,
    subscription,
    monthlyUsage: monthUsage.count,
  });
});

/**
 * POST /api/admin/users/:id/plan
 * Manually set a user's plan (for support/testing).
 */
adminRoutes.post("/api/admin/users/:id/plan", async (c) => {
  const userId = c.req.param("id");
  const body = await c.req.json<{ plan?: string }>().catch(() => ({}));

  if (!body.plan || !["free", "pro", "agency", "enterprise"].includes(body.plan)) {
    return c.json({ error: "Invalid plan. Must be: free, pro, agency, enterprise" }, 400);
  }

  const result = sqlite.run(
    `UPDATE users SET plan = ?, updated_at = ? WHERE id = ?`,
    [body.plan, Math.floor(Date.now() / 1000), userId]
  );

  if (result.changes === 0) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ success: true, userId, plan: body.plan });
});

/**
 * GET /api/admin/usage/hourly
 * Hourly usage breakdown for the last 24h.
 */
adminRoutes.get("/api/admin/usage/hourly", (c) => {
  const dayStart = Math.floor(Date.now() / 1000) - 86400;

  const hourly = sqlite.query<{ hour: number; count: number }, [number]>(`
    SELECT 
      CAST((created_at - ?) / 3600 AS INTEGER) as hour,
      COUNT(*) as count
    FROM usage_logs 
    WHERE created_at >= ?
    GROUP BY hour
    ORDER BY hour
  `).all(dayStart, dayStart);

  return c.json({ hourly, periodStart: dayStart });
});

/**
 * GET /api/admin/errors
 * Recent errors for debugging.
 */
adminRoutes.get("/api/admin/errors", (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);

  const errors = sqlite.query(`
    SELECT ul.*, u.email, ak.key_prefix
    FROM usage_logs ul
    JOIN users u ON ul.user_id = u.id
    JOIN api_keys ak ON ul.api_key_id = ak.id
    WHERE ul.status IN ('error', 'rate_limited')
    ORDER BY ul.created_at DESC
    LIMIT ?
  `).all(limit);

  return c.json({ errors });
});
