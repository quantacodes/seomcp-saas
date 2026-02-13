import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import {
  validateSession,
  SESSION_COOKIE_NAME,
} from "../auth/session";
import { config } from "../config";
import { ulid } from "../utils/ulid";
import {
  getUserSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  countUserSchedules,
  validateSchedule,
  calculateNextRun,
  runScheduleNow,
} from "../scheduler/engine";
import { db, schema } from "../db/index";
import { eq, and } from "drizzle-orm";

export const scheduleRoutes = new Hono();

const ALLOWED_TOOLS = new Set(["generate_report", "site_audit", "crawl_page"]);

function requireJson(c: any): Response | null {
  const ct = c.req.header("Content-Type") || "";
  if (!ct.includes("application/json")) {
    return c.json({ error: "Content-Type must be application/json" }, 415);
  }
  return null;
}

function getSession(c: any) {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  return validateSession(sessionId);
}

const SCHEDULE_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function describeSchedule(schedule: string, hour: number, day: number | null): string {
  const hourStr = `${String(hour).padStart(2, "0")}:00 UTC`;
  switch (schedule) {
    case "daily": return `Daily at ${hourStr}`;
    case "weekly": return `Every ${DAY_NAMES[day ?? 0]} at ${hourStr}`;
    case "monthly": return `Monthly on day ${day ?? 1} at ${hourStr}`;
    default: return schedule;
  }
}

/**
 * GET /dashboard/api/schedules — List user's scheduled audits
 */
scheduleRoutes.get("/dashboard/api/schedules", (c) => {
  const session = getSession(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const schedules = getUserSchedules(session.userId);
  const planLimits = config.plans[session.plan];
  const maxSchedules = planLimits?.maxSchedules ?? 0;

  return c.json({
    schedules: schedules.map((s: any) => ({
      id: s.id,
      siteUrl: s.site_url,
      toolName: s.tool_name,
      schedule: s.schedule,
      scheduleHour: s.schedule_hour,
      scheduleDay: s.schedule_day,
      isActive: !!s.is_active,
      lastRunAt: s.last_run_at,
      nextRunAt: s.next_run_at,
      lastError: s.last_error,
      runCount: s.run_count,
      description: describeSchedule(s.schedule, s.schedule_hour, s.schedule_day),
      createdAt: s.created_at,
    })),
    limits: {
      used: schedules.length,
      max: maxSchedules === Infinity ? "unlimited" : maxSchedules,
    },
  });
});

/**
 * POST /dashboard/api/schedules — Create a scheduled audit
 */
scheduleRoutes.post("/dashboard/api/schedules", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = getSession(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const body = await c.req.json<{
    siteUrl?: string;
    toolName?: string;
    schedule?: string;
    hour?: number;
    day?: number;
    apiKeyId?: string;
  }>().catch(() => ({}));

  // Validate required fields
  if (!body.siteUrl) return c.json({ error: "siteUrl is required" }, 400);
  if (!body.schedule) return c.json({ error: "schedule is required (daily, weekly, monthly)" }, 400);

  const toolName = body.toolName || "generate_report";
  if (!ALLOWED_TOOLS.has(toolName)) {
    return c.json({ error: `Tool must be one of: ${[...ALLOWED_TOOLS].join(", ")}` }, 400);
  }

  const hour = body.hour ?? 6;
  const day = body.day ?? null;

  // Validate schedule
  const schedValidation = validateSchedule(body.schedule, hour, day);
  if (!schedValidation.valid) {
    return c.json({ error: schedValidation.error }, 400);
  }

  // Check plan limits
  const planLimits = config.plans[session.plan];
  const maxSchedules = planLimits?.maxSchedules ?? 0;
  const currentCount = countUserSchedules(session.userId);

  if (currentCount >= maxSchedules) {
    if (maxSchedules === 0) {
      return c.json({ error: "Scheduled audits are not available on the free plan. Upgrade to Pro." }, 403);
    }
    return c.json({ error: `Maximum ${maxSchedules} scheduled audits for ${session.plan} plan. Upgrade for more.` }, 403);
  }

  // Validate API key belongs to user and is active
  let apiKeyId = body.apiKeyId;
  if (apiKeyId) {
    const key = db
      .select()
      .from(schema.apiKeys)
      .where(and(eq(schema.apiKeys.id, apiKeyId), eq(schema.apiKeys.userId, session.userId), eq(schema.apiKeys.isActive, true)))
      .limit(1)
      .all()[0];
    if (!key) return c.json({ error: "API key not found or inactive" }, 400);
  } else {
    // Use the user's first active key
    const firstKey = db
      .select()
      .from(schema.apiKeys)
      .where(and(eq(schema.apiKeys.userId, session.userId), eq(schema.apiKeys.isActive, true)))
      .limit(1)
      .all()[0];
    if (!firstKey) return c.json({ error: "No active API key found. Create one first." }, 400);
    apiKeyId = firstKey.id;
  }

  // Validate site URL
  try {
    const parsed = new URL(body.siteUrl.startsWith("http") ? body.siteUrl : `https://${body.siteUrl}`);
    body.siteUrl = parsed.hostname; // Normalize to just domain
  } catch {
    return c.json({ error: "Invalid site URL" }, 400);
  }

  const id = ulid();
  createSchedule(id, session.userId, apiKeyId!, body.siteUrl, toolName, body.schedule, hour, day);

  return c.json({
    id,
    siteUrl: body.siteUrl,
    toolName,
    schedule: body.schedule,
    scheduleHour: hour,
    scheduleDay: day,
    nextRunAt: calculateNextRun(body.schedule, hour, day),
    description: describeSchedule(body.schedule, hour, day),
    message: "Scheduled audit created",
  }, 201);
});

/**
 * PATCH /dashboard/api/schedules/:id — Update a scheduled audit
 */
scheduleRoutes.post("/dashboard/api/schedules/:id/update", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = getSession(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const scheduleId = c.req.param("id");
  const existing = getScheduleById(scheduleId, session.userId);
  if (!existing) return c.json({ error: "Schedule not found" }, 404);

  const body = await c.req.json<{
    isActive?: boolean;
    schedule?: string;
    hour?: number;
    day?: number;
  }>().catch(() => ({}));

  const isActive = body.isActive ?? !!existing.is_active;
  const schedule = body.schedule || existing.schedule;
  const hour = body.hour ?? existing.schedule_hour;
  const day = body.day !== undefined ? body.day : existing.schedule_day;

  const schedValidation = validateSchedule(schedule, hour, day);
  if (!schedValidation.valid) {
    return c.json({ error: schedValidation.error }, 400);
  }

  updateSchedule(scheduleId, session.userId, isActive, schedule, hour, day);

  return c.json({
    success: true,
    message: isActive ? "Schedule updated" : "Schedule paused",
    nextRunAt: isActive ? calculateNextRun(schedule, hour, day) : null,
    description: describeSchedule(schedule, hour, day),
  });
});

/**
 * DELETE /dashboard/api/schedules/:id — Delete a scheduled audit
 * Uses POST for CSRF safety
 */
scheduleRoutes.post("/dashboard/api/schedules/:id/delete", (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = getSession(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const scheduleId = c.req.param("id");
  const deleted = deleteSchedule(scheduleId, session.userId);

  if (!deleted) return c.json({ error: "Schedule not found" }, 404);
  return c.json({ success: true, message: "Schedule deleted" });
});

/**
 * POST /dashboard/api/schedules/:id/run — Run a schedule immediately
 */
scheduleRoutes.post("/dashboard/api/schedules/:id/run", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = getSession(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const scheduleId = c.req.param("id");
  const ran = await runScheduleNow(scheduleId, session.userId);

  if (!ran) return c.json({ error: "Schedule not found" }, 404);
  return c.json({ success: true, message: "Audit triggered. Check audit history for results." });
});
