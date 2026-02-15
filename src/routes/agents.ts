import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index";
import { config } from "../config";
import { ulid } from "../utils/ulid";
import { generateApiKey } from "../auth/keys";
import { encryptToken, decryptToken } from "../crypto/tokens";
import { getClerkSession, type ClerkSessionData } from "../auth/clerk";
import { getCookie } from "hono/cookie";
import { validateSession, SESSION_COOKIE_NAME, type SessionData } from "../auth/session";

export const agentRoutes = new Hono();

// ── Rate limiting: simple in-memory per-user limiter for Agent SaaS calls ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20; // max 20 Agent SaaS calls per minute per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ── Sanitize upstream API errors (never leak internal details) ──
function sanitizeUpstreamError(errorData: any, fallback: string): string {
  // Only pass through safe, known error messages
  const safeErrors = [
    "Customer not found",
    "Provisioning failed",
    "Deprovisioning failed",
    "Deployment failed",
    "Invalid request",
    "Plan not found",
    "Server not found",
  ];
  const msg = errorData?.error || "";
  if (typeof msg === "string" && safeErrors.some((s) => msg.includes(s))) {
    return msg;
  }
  return fallback;
}

// ── Session middleware (hybrid: Clerk Bearer token OR cookie session) ──
async function getSessionHybrid(c: any): Promise<SessionData | ClerkSessionData | null> {
  // Try Clerk first (Bearer token from dashboard SPA)
  try {
    const clerkSession = await getClerkSession(c);
    if (clerkSession) return clerkSession;
  } catch (e) {
    // Clerk not configured or token invalid — fall through to cookie
  }

  // Fallback: cookie-based session (legacy)
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionId) return null;
  return validateSession(sessionId);
}

// ── CSRF protection: require JSON content-type on mutating endpoints ──
function requireJson(c: any): Response | null {
  const ct = c.req.header("Content-Type") || "";
  if (!ct.includes("application/json")) {
    return c.json({ error: "Content-Type must be application/json" }, 415);
  }
  return null;
}

// ── Agent SaaS API client helper ──
async function agentApi(method: string, path: string, body?: any) {
  const url = `${config.agentSaas.apiUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${config.agentSaas.apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  return res;
}

// ── Verify user owns agent helper ──
function verifyAgentOwnership(userId: string, agentId: string) {
  return db
    .select()
    .from(schema.userAgentMappings)
    .where(
      and(
        eq(schema.userAgentMappings.id, agentId),
        eq(schema.userAgentMappings.userId, userId)
      )
    )
    .limit(1)
    .all()[0];
}

// ── Routes ──

/**
 * GET /dashboard/api/agents — List user's agents
 */
agentRoutes.get("/dashboard/api/agents", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  // Get user's agent mappings
  const mappings = db
    .select()
    .from(schema.userAgentMappings)
    .where(eq(schema.userAgentMappings.userId, session.userId))
    .all();

  // For each mapping, optionally fetch status from Agent SaaS API
  const agents = [];
  for (const mapping of mappings) {
    try {
      const statusRes = await agentApi("GET", `/api/customers/${mapping.agentCustomerId}`);
      const agentDetails = statusRes.ok ? await statusRes.json() : null;
      
      agents.push({
        id: mapping.id,
        agentCustomerId: mapping.agentCustomerId,
        siteUrl: mapping.siteUrl,
        plan: mapping.plan,
        status: mapping.status,
        hetznerServerId: mapping.hetznerServerId,
        hasApiKey: !!mapping.agentApiKeyId,
        createdAt: mapping.createdAt.toISOString(),
        updatedAt: mapping.updatedAt.toISOString(),
        agentDetails: agentDetails || null,
      });
    } catch (error) {
      // If Agent SaaS API fails, still return the local mapping
      agents.push({
        id: mapping.id,
        agentCustomerId: mapping.agentCustomerId,
        siteUrl: mapping.siteUrl,
        plan: mapping.plan,
        status: mapping.status,
        hetznerServerId: mapping.hetznerServerId,
        hasApiKey: !!mapping.agentApiKeyId,
        createdAt: mapping.createdAt.toISOString(),
        updatedAt: mapping.updatedAt.toISOString(),
        agentDetails: null,
        error: "Unable to fetch agent status",
      });
    }
  }

  return c.json({ agents });
});

/**
 * POST /dashboard/api/agents/provision — Provision new agent
 */
agentRoutes.post("/dashboard/api/agents/provision", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  let body: {
    telegram_chat_id?: string;
    site_url?: string;
    plan?: string;
    bot_name?: string;
  };
  
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.bot_name && !body.site_url) {
    return c.json({ error: "bot_name or site_url is required" }, 400);
  }

  // Use bot_name as primary identifier, fall back to site_url
  const agentLabel = body.bot_name || body.site_url || "";

  // telegram_chat_id is optional at provision time — dashboard flow provides it at deploy
  const telegramChatId = body.telegram_chat_id || `pending-${session.userId}`;

  // Rate limit
  if (!checkRateLimit(session.userId)) {
    return c.json({ error: "Too many requests. Please wait a moment." }, 429);
  }

  // Idempotency: check if user already has an active agent with this label
  const lookupField = body.site_url || body.bot_name || "";
  const existing = lookupField ? db
    .select()
    .from(schema.userAgentMappings)
    .where(
      and(
        eq(schema.userAgentMappings.userId, session.userId),
        eq(schema.userAgentMappings.siteUrl, lookupField)
      )
    )
    .limit(1)
    .all()[0] : undefined;

  if (existing && existing.status !== "cancelled") {
    return c.json({
      error: "Agent already exists with this name",
      id: existing.id,
      agentCustomerId: existing.agentCustomerId,
      status: existing.status,
    }, 409);
  }

  try {
    // For Hetzner deploy flow: create local records only.
    // The Agent SaaS /api/provision is for multi-tenant (shared gateway) mode.
    // In Hetzner mode, each agent gets its own server via /deploy.
    const agentCustomerId = `hetzner-${ulid().slice(0, 12).toLowerCase()}`;

    // Auto-create a dedicated API key for this agent
    const { raw: agentKeyRaw, hash: agentKeyHash, prefix: agentKeyPrefix } = generateApiKey();
    const agentKeyId = ulid();

    db.insert(schema.apiKeys)
      .values({
        id: agentKeyId,
        userId: session.userId,
        keyHash: agentKeyHash,
        keyPrefix: agentKeyPrefix,
        name: `Agent — ${agentLabel}`,
        isActive: true,
        scopes: null, // Full access — agent needs all tools
        createdAt: new Date(),
      })
      .run();

    // Encrypt the raw key for storage (needed during deploy injection)
    const agentKeyEnc = encryptToken(agentKeyRaw);
    console.log(`[agent] API key created for ${agentLabel}: ${agentKeyPrefix}`);

    // Create local mapping record with API key reference
    const mappingId = ulid();
    db.insert(schema.userAgentMappings)
      .values({
        id: mappingId,
        userId: session.userId,
        agentCustomerId,
        siteUrl: agentLabel,
        plan: body.plan || "starter",
        status: "provisioning",
        agentApiKeyId: agentKeyId,
        agentApiKeyEnc: agentKeyEnc,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    return c.json({
      id: mappingId,
      agentId: mappingId,
      agentCustomerId,
      agentApiKeyPrefix: agentKeyPrefix,
      customer_id: agentCustomerId,
    }, 201);
  } catch (error) {
    console.error("Agent provision error:", error);
    return c.json({ error: "Failed to provision agent" }, 500);
  }
});

/**
 * POST /dashboard/api/agents/:id/deprovision — Teardown agent
 */
agentRoutes.post("/dashboard/api/agents/:id/deprovision", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  // Rate limit
  if (!checkRateLimit(session.userId)) {
    return c.json({ error: "Too many requests. Please wait a moment." }, 429);
  }

  const agentId = c.req.param("id");
  const mapping = verifyAgentOwnership(session.userId, agentId);

  if (!mapping) {
    return c.json({ error: "Agent not found" }, 404);
  }

  try {
    // Call Agent SaaS deprovision endpoint
    const deprovisionRes = await agentApi("POST", "/api/deprovision", {
      customer_id: mapping.agentCustomerId,
    });

    if (!deprovisionRes.ok) {
      const errorData = await deprovisionRes.json().catch(() => ({}));
      return c.json({ error: sanitizeUpstreamError(errorData, "Deprovisioning failed") }, deprovisionRes.status as any);
    }

    // Revoke the agent's API key
    if (mapping.agentApiKeyId) {
      db.update(schema.apiKeys)
        .set({ isActive: false })
        .where(eq(schema.apiKeys.id, mapping.agentApiKeyId))
        .run();
      console.log(`[agent] API key revoked for agent ${agentId}: ${mapping.agentApiKeyId}`);
    }

    // Update local mapping status
    db.update(schema.userAgentMappings)
      .set({ 
        status: "cancelled",
        agentApiKeyEnc: null, // Clear encrypted key
        updatedAt: new Date(),
      })
      .where(eq(schema.userAgentMappings.id, agentId))
      .run();

    return c.json({ success: true, message: "Agent deprovisioned" });
  } catch (error) {
    console.error("Agent deprovision error:", error);
    return c.json({ error: "Failed to deprovision agent" }, 500);
  }
});

/**
 * GET /dashboard/api/agents/:id — Agent detail
 */
agentRoutes.get("/dashboard/api/agents/:id", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const agentId = c.req.param("id");
  const mapping = verifyAgentOwnership(session.userId, agentId);

  if (!mapping) {
    return c.json({ error: "Agent not found" }, 404);
  }

  try {
    // Fetch details from Agent SaaS API
    const detailRes = await agentApi("GET", `/api/customers/${mapping.agentCustomerId}`);
    
    if (!detailRes.ok) {
      const errorData = await detailRes.json().catch(() => ({}));
      return c.json({ error: sanitizeUpstreamError(errorData, "Failed to fetch agent details") }, detailRes.status as any);
    }

    const agentDetails = await detailRes.json();

    // Return merged data
    return c.json({
      id: mapping.id,
      agentCustomerId: mapping.agentCustomerId,
      siteUrl: mapping.siteUrl,
      plan: mapping.plan,
      status: mapping.status,
      hetznerServerId: mapping.hetznerServerId,
      createdAt: mapping.createdAt.toISOString(),
      updatedAt: mapping.updatedAt.toISOString(),
      ...agentDetails,
    });
  } catch (error) {
    console.error("Agent detail error:", error);
    return c.json({ error: "Failed to fetch agent details" }, 500);
  }
});

/**
 * GET /dashboard/api/agents/:id/usage — Agent usage
 */
agentRoutes.get("/dashboard/api/agents/:id/usage", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const agentId = c.req.param("id");
  const mapping = verifyAgentOwnership(session.userId, agentId);

  if (!mapping) {
    return c.json({ error: "Agent not found" }, 404);
  }

  try {
    // Fetch usage from Agent SaaS API
    const usageRes = await agentApi("GET", `/api/customers/${mapping.agentCustomerId}/usage`);
    
    if (!usageRes.ok) {
      const errorData = await usageRes.json().catch(() => ({}));
      return c.json({ error: sanitizeUpstreamError(errorData, "Failed to fetch agent usage") }, usageRes.status as any);
    }

    const usageData = await usageRes.json();
    return c.json(usageData);
  } catch (error) {
    console.error("Agent usage error:", error);
    return c.json({ error: "Failed to fetch agent usage" }, 500);
  }
});

/**
 * POST /dashboard/api/agents/deploy — Deploy to Hetzner
 */
agentRoutes.post("/dashboard/api/agents/deploy", async (c) => {
  const csrfCheck = requireJson(c);
  if (csrfCheck) return csrfCheck;

  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  let body: {
    name?: string;
    telegram_token?: string;
    anthropic_key?: string;
    bot_name?: string;
    site_url?: string;
  };
  
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.name || !body.telegram_token || !body.anthropic_key) {
    return c.json({ error: "name, telegram_token, and anthropic_key are required" }, 400);
  }

  // Rate limit
  if (!checkRateLimit(session.userId)) {
    return c.json({ error: "Too many requests. Please wait a moment." }, 429);
  }

  try {
    // Look up agent's seomcp API key for injection
    let seomcpApiKey: string | undefined;
    if (body.site_url) {
      const mapping = db
        .select({ agentApiKeyEnc: schema.userAgentMappings.agentApiKeyEnc })
        .from(schema.userAgentMappings)
        .where(
          and(
            eq(schema.userAgentMappings.userId, session.userId),
            eq(schema.userAgentMappings.siteUrl, body.site_url)
          )
        )
        .limit(1)
        .all()[0];

      if (mapping?.agentApiKeyEnc) {
        seomcpApiKey = decryptToken(mapping.agentApiKeyEnc);
      }
    }

    // Call Agent SaaS deploy endpoint
    const deployRes = await agentApi("POST", "/api/deploy", {
      ...body,
      platform: config.agentSaas.platform,
      ...(seomcpApiKey ? { seomcp_api_key: seomcpApiKey } : {}),
    });

    if (!deployRes.ok) {
      const errorData = await deployRes.json().catch(() => ({}));
      return c.json({ error: sanitizeUpstreamError(errorData, "Deployment failed") }, deployRes.status as any);
    }

    const deployData = await deployRes.json();

    // Create/update mapping record with hetzner_server_id
    if (deployData.hetzner_server_id) {
      // Try to find existing mapping by site_url or create new one
      let mapping = db
        .select()
        .from(schema.userAgentMappings)
        .where(
          and(
            eq(schema.userAgentMappings.userId, session.userId),
            eq(schema.userAgentMappings.siteUrl, body.site_url || "")
          )
        )
        .limit(1)
        .all()[0];

      if (mapping) {
        // Update existing mapping
        db.update(schema.userAgentMappings)
          .set({
            hetznerServerId: deployData.hetzner_server_id,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(schema.userAgentMappings.id, mapping.id))
          .run();
      } else {
        // Create new mapping
        const mappingId = ulid();
        db.insert(schema.userAgentMappings)
          .values({
            id: mappingId,
            userId: session.userId,
            agentCustomerId: deployData.customer_id || ulid(), // fallback if not provided
            siteUrl: body.site_url || "",
            plan: "starter",
            status: "active",
            hetznerServerId: deployData.hetzner_server_id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .run();
      }
    }

    return c.json(deployData, 201);
  } catch (error) {
    console.error("Agent deploy error:", error);
    return c.json({ error: "Failed to deploy agent" }, 500);
  }
});

/**
 * GET /dashboard/api/agents/deploy/:serverId/verify — Check deploy status
 */
agentRoutes.get("/dashboard/api/agents/deploy/:serverId/verify", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const serverId = c.req.param("serverId");

  try {
    // Proxy to Agent SaaS API
    const verifyRes = await agentApi("GET", `/api/deploy/${serverId}/verify`);
    
    if (!verifyRes.ok) {
      const errorData = await verifyRes.json().catch(() => ({}));
      return c.json({ error: sanitizeUpstreamError(errorData, "Failed to verify deployment") }, verifyRes.status as any);
    }

    const verifyData = await verifyRes.json();
    return c.json(verifyData);
  } catch (error) {
    console.error("Deploy verify error:", error);
    return c.json({ error: "Failed to verify deployment" }, 500);
  }
});

/**
 * DELETE /dashboard/api/agents/deploy/:serverId — Destroy deployment
 */
agentRoutes.delete("/dashboard/api/agents/deploy/:serverId", async (c) => {
  const session = await getSessionHybrid(c);
  if (!session) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const serverId = parseInt(c.req.param("serverId"));

  // Verify user owns this server
  const mapping = db
    .select()
    .from(schema.userAgentMappings)
    .where(
      and(
        eq(schema.userAgentMappings.userId, session.userId),
        eq(schema.userAgentMappings.hetznerServerId, serverId)
      )
    )
    .limit(1)
    .all()[0];

  if (!mapping) {
    return c.json({ error: "Server not found or access denied" }, 404);
  }

  try {
    // Call Agent SaaS destroy endpoint
    const destroyRes = await agentApi("DELETE", `/api/deploy/${serverId}`);

    if (!destroyRes.ok) {
      const errorData = await destroyRes.json().catch(() => ({}));
      return c.json({ error: sanitizeUpstreamError(errorData, "Failed to destroy deployment") }, destroyRes.status as any);
    }

    // Update mapping status
    db.update(schema.userAgentMappings)
      .set({
        status: "cancelled",
        hetznerServerId: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.userAgentMappings.id, mapping.id))
      .run();

    const destroyData = await destroyRes.json();
    return c.json(destroyData);
  } catch (error) {
    console.error("Deploy destroy error:", error);
    return c.json({ error: "Failed to destroy deployment" }, 500);
  }
});