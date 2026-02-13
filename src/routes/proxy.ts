/**
 * Proxy API routes — Phase 2
 *
 * These endpoints serve the @seomcp/proxy npm package.
 * Unlike the MCP route (long-lived sessions), these are stateless per-request.
 *
 * POST /v1/tools/call     — Execute a tool (auth required, rate limited)
 * GET  /v1/tools/manifest  — Tool list (public, cached)
 * GET  /v1/auth/test       — Validate API key + plan info (auth required)
 */

import { Hono } from "hono";
import { authMiddleware } from "../auth/middleware";
import { checkAndIncrementRateLimit, getRateLimitStatus } from "../ratelimit/middleware";
import { isToolAllowed } from "../auth/scopes";
import { TOOLS, TOOL_COUNT } from "../tools-catalog";
import { VERSION, config } from "../config";
import { spawnForProxyRequest } from "../services/proxy-spawner";
import { ConcurrencyPool } from "../services/concurrency-pool";

// ── Concurrency pool (global, shared across requests) ──
export const proxyPool = new ConcurrencyPool(config.maxProxyConcurrentSpawns);

export const proxyRoutes = new Hono();

// ── Shared: version enforcement header ──
function setVersionHeaders(c: any): void {
  c.header("X-Min-Version", "0.1.0");
}

// ── Rate limit headers (all tool/call responses) ──
function setRateLimitHeaders(
  c: any,
  rl: { limit: number; remaining: number; used: number },
): void {
  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  c.header("X-RateLimit-Limit", String(rl.limit === Infinity ? -1 : rl.limit));
  c.header("X-RateLimit-Remaining", String(rl.remaining === Infinity ? -1 : rl.remaining));
  c.header("X-RateLimit-Reset", resetDate.toISOString());
}

// ── Credential fields required in the service account JSON ──
const SA_REQUIRED_FIELDS = ["type", "project_id", "private_key_id", "private_key", "client_email"];

// ═══════════════════════════════════════════════════════════
//  1. POST /v1/tools/call
// ═══════════════════════════════════════════════════════════

proxyRoutes.post("/v1/tools/call", authMiddleware, async (c) => {
  const auth = c.get("auth");

  // Parse body
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, 400);
  }

  // Validate: tool name
  const toolName = body?.tool;
  if (!toolName || typeof toolName !== "string") {
    return c.json({ error: "Missing or invalid 'tool' field", code: "MISSING_TOOL" }, 400);
  }

  // Validate: tool exists
  const toolExists = TOOLS.some((t) => t.name === toolName);
  if (!toolExists) {
    return c.json(
      { error: `Unknown tool: ${toolName}`, code: "UNKNOWN_TOOL" },
      400,
    );
  }

  // Validate: scope restriction
  if (!isToolAllowed(toolName, auth.scopes)) {
    return c.json(
      { error: `API key scope does not include tool: ${toolName}`, code: "SCOPE_DENIED" },
      403,
    );
  }

  // Validate: credentials
  const creds = body?.credentials;
  if (!creds || typeof creds !== "object") {
    return c.json({ error: "Missing 'credentials' object", code: "MISSING_CREDENTIALS" }, 400);
  }

  const sa = creds.google_service_account;
  if (!sa || typeof sa !== "object") {
    return c.json(
      { error: "Missing 'credentials.google_service_account' object", code: "MISSING_SA" },
      400,
    );
  }

  // Validate SA has required fields
  for (const field of SA_REQUIRED_FIELDS) {
    if (!sa[field]) {
      return c.json(
        { error: `Service account missing required field: ${field}`, code: "INVALID_SA" },
        400,
      );
    }
  }

  // Rate limit (per-user monthly)
  const rl = checkAndIncrementRateLimit(auth);
  setRateLimitHeaders(c, rl);
  setVersionHeaders(c);

  if (!rl.allowed) {
    return c.json(
      {
        error: "Monthly rate limit exceeded",
        code: "RATE_LIMITED",
        limit: rl.limit,
        used: rl.used,
        plan: auth.plan,
      },
      429,
    );
  }

  // Acquire concurrency slot
  let release: (() => void) | null = null;
  try {
    release = await proxyPool.acquire(10_000);
  } catch {
    return c.json(
      { error: "Server is at capacity — please retry in a few seconds", code: "POOL_FULL" },
      503,
    );
  }

  try {
    // Spawn binary
    const result = await spawnForProxyRequest(
      toolName,
      body.arguments ?? {},
      {
        google_service_account: sa,
        gsc_property: creds.gsc_property,
        ga4_property: creds.ga4_property,
      },
      config.proxyTimeoutMs,
    );

    if (result.ok) {
      return c.json({ content: result.content }, 200);
    }

    // Map spawner error to HTTP response
    return c.json(
      { error: result.error, code: result.code },
      result.status as 400 | 401 | 403 | 422 | 500,
    );
  } finally {
    release?.();
  }
});

// ═══════════════════════════════════════════════════════════
//  2. GET /v1/tools/manifest
// ═══════════════════════════════════════════════════════════

proxyRoutes.get("/v1/tools/manifest", (c) => {
  setVersionHeaders(c);
  c.header("Cache-Control", "public, max-age=3600");
  c.header("X-Force-Update", "false");

  // Map tool catalog to MCP tools/list format
  const tools = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: {
      type: "object" as const,
      properties: Object.fromEntries(
        t.params.map((p) => [
          p.name,
          {
            type: p.type.replace("[]", ""),
            description: p.description,
            ...(p.type.includes("[]") ? { type: "array", items: { type: p.type.replace("[]", "") } } : {}),
          },
        ]),
      ),
      required: t.params.filter((p) => p.required).map((p) => p.name),
    },
  }));

  return c.json({ tools, count: TOOL_COUNT });
});

// ═══════════════════════════════════════════════════════════
//  3. GET /v1/auth/test
// ═══════════════════════════════════════════════════════════

proxyRoutes.get("/v1/auth/test", authMiddleware, (c) => {
  const auth = c.get("auth");
  setVersionHeaders(c);

  // Get current usage (pass full auth for unverified-user limit accuracy)
  const rl = getRateLimitStatus(auth);

  // Calculate reset date (first of next month)
  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return c.json({
    valid: true,
    plan: auth.plan,
    usage: {
      calls_this_month: rl.used,
      calls_limit: rl.limit === Infinity ? -1 : rl.limit,
      reset_date: resetDate.toISOString().split("T")[0],
    },
  });
});
