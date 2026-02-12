import { Hono } from "hono";
import { eq, and, gte, sql } from "drizzle-orm";
import { db, schema } from "../db/index";
import { authMiddleware } from "../auth/middleware";
import { config } from "../config";

export const usageRoutes = new Hono();

usageRoutes.use("/api/usage", authMiddleware);

/**
 * GET /api/usage — Get usage stats for current billing period.
 */
usageRoutes.get("/api/usage", async (c) => {
  const auth = c.get("auth");

  // Current month start
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Count calls this month
  const result = db
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
        eq(schema.usageLogs.userId, auth.userId),
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
        eq(schema.usageLogs.userId, auth.userId),
        gte(schema.usageLogs.createdAt, monthStart),
      ),
    )
    .groupBy(schema.usageLogs.toolName)
    .orderBy(sql`count(*) DESC`)
    .limit(10)
    .all();

  const planLimits = config.plans[auth.plan];
  const used = result?.totalCalls || 0;
  const limit = planLimits?.callsPerMonth ?? 0;

  return c.json({
    plan: auth.plan,
    period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    used,
    limit: limit === Infinity ? "unlimited" : limit,
    remaining: limit === Infinity ? "unlimited" : Math.max(0, limit - used),
    breakdown: {
      success: result?.successCalls || 0,
      error: result?.errorCalls || 0,
      rateLimited: result?.rateLimited || 0,
    },
    avgDurationMs: Math.round(result?.avgDuration || 0),
    topTools,
  });
});
