import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { validateSession, SESSION_COOKIE_NAME, type SessionData } from "../auth/session";
import { getClerkSession, type ClerkSessionData } from "../auth/clerk";
import { getAuditHistory, getAuditById, getAuditSites, getHealthTrend, getRetentionLimits } from "../audit/history";

export const auditRoutes = new Hono();

async function getSessionHybrid(c: any): Promise<SessionData | ClerkSessionData | null> {
  try {
    const clerkSession = await getClerkSession(c);
    if (clerkSession) return clerkSession;
  } catch (e) {}
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  return validateSession(sessionId);
}

/**
 * GET /dashboard/api/audits/sites — List unique sites with latest scores
 * (registered before /audits/:id to avoid :id matching "sites")
 */
auditRoutes.get("/dashboard/api/audits/sites", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const sites = getAuditSites(session.userId);

  return c.json({
    sites: sites.map((s: any) => ({
      siteUrl: s.site_url,
      latestScore: s.latest_score,
      auditCount: s.audit_count,
      lastAuditAt: new Date(s.last_audit_at).toISOString(),
    })),
  });
});

/**
 * GET /dashboard/api/audits/trend — Get health score trend for a site
 * (registered before /audits/:id to avoid :id matching "trend")
 * Query params: site_url (required), days (default 30)
 */
auditRoutes.get("/dashboard/api/audits/trend", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const siteUrl = c.req.query("site_url");
  if (!siteUrl) return c.json({ error: "site_url is required" }, 400);

  const days = Math.min(parseInt(c.req.query("days") || "30") || 30, 365);
  const trend = getHealthTrend(session.userId, siteUrl, days);

  return c.json({
    siteUrl,
    days,
    dataPoints: trend.map((t: any) => ({
      healthScore: t.health_score,
      date: new Date(t.created_at).toISOString(),
    })),
  });
});

/**
 * GET /dashboard/api/audits — List audit history
 * Query params: site_url, limit (max 100), offset
 */
auditRoutes.get("/dashboard/api/audits", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const siteUrl = c.req.query("site_url") || undefined;
  const limit = Math.min(parseInt(c.req.query("limit") || "20") || 20, 100);
  const offset = parseInt(c.req.query("offset") || "0") || 0;

  const audits = getAuditHistory(session.userId, { siteUrl, limit, offset });
  const retention = getRetentionLimits(session.plan);

  return c.json({
    audits: audits.map((a: any) => ({
      id: a.id,
      toolName: a.tool_name,
      siteUrl: a.site_url,
      healthScore: a.health_score,
      summary: a.summary ? JSON.parse(a.summary) : null,
      durationMs: a.duration_ms,
      createdAt: new Date(a.created_at).toISOString(),
    })),
    retention: {
      maxAudits: retention.maxAudits,
      retentionDays: retention.retentionDays,
      plan: session.plan,
    },
    pagination: { limit, offset },
  });
});

/**
 * GET /dashboard/api/audits/:id — Get full audit result
 */
auditRoutes.get("/dashboard/api/audits/:id", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const auditId = parseInt(c.req.param("id"));
  if (isNaN(auditId)) return c.json({ error: "Invalid audit ID" }, 400);

  const audit = getAuditById(session.userId, auditId);
  if (!audit) return c.json({ error: "Audit not found" }, 404);

  return c.json({
    id: audit.id,
    toolName: audit.tool_name,
    siteUrl: audit.site_url,
    healthScore: audit.health_score,
    summary: audit.summary ? JSON.parse(audit.summary) : null,
    fullResult: JSON.parse(audit.full_result),
    durationMs: audit.duration_ms,
    createdAt: new Date(audit.created_at).toISOString(),
  });
});
