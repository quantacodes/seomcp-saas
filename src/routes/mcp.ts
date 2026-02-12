import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { authMiddleware } from "../auth/middleware";
import { handleInitialize, handleRequest, handleBatch } from "../mcp/transport";
import { sessionManager } from "../mcp/session";
import { getRateLimitStatus } from "../ratelimit/middleware";
import type { JsonRpcRequest, JsonRpcResponse } from "../types";

export const mcpRoutes = new Hono();

// Auth required for all MCP endpoints
mcpRoutes.use("/mcp", authMiddleware);

/**
 * POST /mcp — Main MCP Streamable HTTP endpoint.
 *
 * Handles JSON-RPC requests:
 * - initialize: Creates session, returns session ID in header
 * - tools/call: Proxies to binary, rate limited
 * - tools/list: Proxies to binary (no rate limit)
 * - notifications: Returns 202
 */
mcpRoutes.post("/mcp", async (c) => {
  const auth = c.get("auth");

  // Validate Accept header
  const accept = c.req.header("Accept") || "";
  if (!accept.includes("application/json") && !accept.includes("text/event-stream") && !accept.includes("*/*")) {
    return c.json(
      { error: "Accept header must include application/json and/or text/event-stream" },
      400,
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error: invalid JSON" },
        id: null,
      },
      400,
    );
  }

  // Handle batch or single message
  const messages = Array.isArray(body) ? body : [body];

  if (messages.length === 0) {
    return c.json(
      { jsonrpc: "2.0", error: { code: -32600, message: "Invalid request: empty batch" }, id: null },
      400,
    );
  }

  // Check if this is an initialization request
  const initRequest = messages.find(
    (m: any) => m.method === "initialize" && m.id !== undefined,
  ) as JsonRpcRequest | undefined;

  if (initRequest) {
    // Handle initialization — creates session
    try {
      const { response, sessionId } = await handleInitialize(auth, initRequest);

      c.header("Mcp-Session-Id", sessionId);
      return c.json(response);
    } catch (error) {
      return c.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Initialization failed",
          },
          id: initRequest.id ?? null,
        },
        500,
      );
    }
  }

  // Non-initialize requests need a session ID
  const sessionId = c.req.header("Mcp-Session-Id");
  if (!sessionId) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32600, message: "Missing Mcp-Session-Id header. Send initialize first." },
        id: null,
      },
      400,
    );
  }

  // Verify session belongs to this user (prevents session hijacking)
  const session = sessionManager.get(sessionId);
  if (!session || session.auth.userId !== auth.userId) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32600, message: "Session not found or expired. Send a new initialize request." },
        id: null,
      },
      404,
    );
  }

  // Check if all messages are notifications/responses (no id = notification)
  const hasRequests = messages.some((m: any) => m.id !== undefined && m.method);
  const isOnlyNotifications = !hasRequests;

  if (isOnlyNotifications) {
    // Handle notifications — just forward to binary, return 202
    for (const msg of messages) {
      session.binary.notify(msg as JsonRpcRequest);
    }
    return new Response(null, { status: 202 });
  }

  // Handle request(s) — check if client wants SSE
  const wantsSSE = accept.includes("text/event-stream");
  const requests = messages.filter((m: any) => m.id !== undefined && m.method) as JsonRpcRequest[];

  if (wantsSSE && requests.length > 0) {
    // Stream responses via SSE
    return streamSSE(c, async (stream) => {
      for (const request of requests) {
        const response = await handleRequest(auth, sessionId, request);
        await stream.writeSSE({
          event: "message",
          data: JSON.stringify(response),
        });
      }
    });
  }

  // JSON response for single request
  if (requests.length === 1) {
    const response = await handleRequest(auth, sessionId, requests[0]);
    // Add rate limit headers for tool calls
    if (requests[0].method === "tools/call") {
      const rl = getRateLimitStatus(auth.userId, auth.plan);
      c.header("X-RateLimit-Limit", String(rl.limit === Infinity ? -1 : rl.limit));
      c.header("X-RateLimit-Remaining", String(rl.remaining === Infinity ? -1 : rl.remaining));
      c.header("X-RateLimit-Used", String(rl.used));
    }
    return c.json(response);
  }

  // Batch JSON response
  const responses = await handleBatch(auth, sessionId, requests);
  // Add rate limit headers for batch
  const rl = getRateLimitStatus(auth.userId, auth.plan);
  c.header("X-RateLimit-Limit", String(rl.limit === Infinity ? -1 : rl.limit));
  c.header("X-RateLimit-Remaining", String(rl.remaining === Infinity ? -1 : rl.remaining));
  c.header("X-RateLimit-Used", String(rl.used));
  return c.json(responses);
});

/**
 * GET /mcp — Server-to-client SSE stream.
 * Phase 1 MVP: return 405 (not implemented yet).
 */
mcpRoutes.get("/mcp", (c) => {
  return new Response("Server-to-client streaming not yet supported", {
    status: 405,
    headers: { Allow: "POST, DELETE" },
  });
});

/**
 * DELETE /mcp — Terminate session.
 * Verifies session belongs to the authenticated user.
 */
mcpRoutes.delete("/mcp", (c) => {
  const auth = c.get("auth");
  const sessionId = c.req.header("Mcp-Session-Id");
  if (!sessionId) {
    return c.json({ error: "Missing Mcp-Session-Id header" }, 400);
  }

  // Verify ownership before destroying
  const session = sessionManager.get(sessionId);
  if (!session || session.auth.userId !== auth.userId) {
    return new Response(null, { status: 404 });
  }

  sessionManager.destroy(sessionId);
  return new Response(null, { status: 200 });
});
