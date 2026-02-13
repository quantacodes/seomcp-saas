import { Hono } from "hono";
import {
  getUserWebhookUrl,
  setUserWebhookUrl,
  validateWebhookUrl,
  getWebhookDeliveries,
  sendTestWebhook,
} from "../webhooks/user-webhooks";
import {
  validateSession,
  SESSION_COOKIE_NAME,
} from "../auth/session";
import { getClerkSession, type ClerkSessionData } from "../auth/clerk";
import { getCookie } from "hono/cookie";

export const webhookSettingsRoutes = new Hono();

function requireJson(c: any): Response | null {
  const ct = c.req.header("Content-Type") || "";
  if (!ct.includes("application/json")) {
    return c.json({ error: "Content-Type must be application/json" }, 415);
  }
  return null;
}

async function getSessionHybrid(c: any) {
  try {
    const clerkSession = await getClerkSession(c);
    if (clerkSession) return clerkSession;
  } catch (e) {}
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  return validateSession(sessionId);
}

/**
 * GET /dashboard/api/webhook — Get webhook config + recent deliveries
 */
webhookSettingsRoutes.get("/dashboard/api/webhook", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const url = getUserWebhookUrl(session.userId);
  const deliveries = getWebhookDeliveries(session.userId, 10);

  return c.json({
    webhook: {
      url,
      enabled: !!url,
    },
    deliveries: deliveries.map((d: any) => ({
      id: d.id,
      event: d.event,
      statusCode: d.status_code,
      success: !!d.success,
      error: d.error,
      durationMs: d.duration_ms,
      createdAt: d.created_at,
    })),
  });
});

/**
 * POST /dashboard/api/webhook — Set/update webhook URL
 */
webhookSettingsRoutes.post("/dashboard/api/webhook", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = await getSessionHybrid(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const body = await c.req.json<{ url?: string }>().catch(() => ({}));

  if (!body.url) {
    return c.json({ error: "Webhook URL is required" }, 400);
  }

  const validation = validateWebhookUrl(body.url);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  setUserWebhookUrl(session.userId, body.url);

  return c.json({
    success: true,
    message: "Webhook URL saved",
    url: body.url,
  });
});

/**
 * DELETE /dashboard/api/webhook — Remove webhook URL
 * Also accepts POST /dashboard/api/webhook/remove for CSRF safety
 */
webhookSettingsRoutes.post("/dashboard/api/webhook/remove", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = await getSessionHybrid(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  setUserWebhookUrl(session.userId, null);
  return c.json({ success: true, message: "Webhook URL removed" });
});

/**
 * POST /dashboard/api/webhook/test — Send test webhook
 */
webhookSettingsRoutes.post("/dashboard/api/webhook/test", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = await getSessionHybrid(c);
  if (!session) return c.json({ error: "Not authenticated" }, 401);

  const url = getUserWebhookUrl(session.userId);
  if (!url) {
    return c.json({ error: "No webhook URL configured. Set one first." }, 400);
  }

  sendTestWebhook(session.userId);
  return c.json({ success: true, message: "Test webhook sent" });
});
