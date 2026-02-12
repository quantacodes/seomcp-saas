import type { JsonRpcRequest, JsonRpcResponse, AuthContext } from "../types";
import { binaryPool, type BinaryInstance } from "./binary";
import { sessionManager } from "./session";
import { checkAndIncrementRateLimit } from "../ratelimit/middleware";
import { logUsage } from "../usage/tracker";
import { config, VERSION } from "../config";
import { existsSync } from "fs";
import {
  getUserConfigPath as getPerUserConfigPath,
  writeUserConfig,
  hasUserConfig,
} from "../config/user-config";
import { sqlite } from "../db/index";
import { decryptToken } from "../crypto/tokens";

// Methods that don't count against rate limits
const EXEMPT_METHODS = new Set([
  "initialize",
  "notifications/initialized",
  "ping",
  "tools/list",
]);

// Methods that are tool calls (for usage tracking)
const TOOL_CALL_METHOD = "tools/call";

/**
 * Get or create the config path for a user's binary instance.
 * If user has Google tokens connected, generates config with those tokens.
 * Otherwise generates a basic config (crawl/schema tools still work).
 */
function getUserConfigPath(userId: string): string {
  // Validate userId format to prevent path traversal
  if (!/^[A-Z0-9]{26,32}$/.test(userId)) {
    throw new Error("Invalid user ID format");
  }

  // Check if user has Google tokens
  const tokenRow = sqlite.prepare(
    "SELECT access_token_enc, refresh_token_enc, expires_at FROM google_tokens WHERE user_id = ?"
  ).get(userId) as { access_token_enc: string; refresh_token_enc: string; expires_at: number } | undefined;

  if (tokenRow) {
    // Decrypt tokens and generate config with Google OAuth
    try {
      const accessToken = decryptToken(tokenRow.access_token_enc);
      const refreshToken = decryptToken(tokenRow.refresh_token_enc);
      writeUserConfig(userId, {
        accessToken,
        refreshToken,
        expiresAt: tokenRow.expires_at,
      });
    } catch (err) {
      console.error(`Failed to decrypt tokens for user ${userId}:`, err);
      // Fall through to basic config
      writeUserConfig(userId);
    }
  } else if (!hasUserConfig(userId)) {
    // No Google connection — write basic config
    writeUserConfig(userId);
  }

  return getPerUserConfigPath(userId);
}

/**
 * Handle an MCP initialization request.
 * Creates a new session and binary instance.
 */
export async function handleInitialize(
  auth: AuthContext,
  request: JsonRpcRequest,
): Promise<{ response: JsonRpcResponse; sessionId: string }> {
  const configPath = getUserConfigPath(auth.userId);
  const binary = binaryPool.getInstance(auth.userId, configPath);

  // Initialize the binary
  await binary.ensureReady();

  // Create session
  const sessionId = sessionManager.create(auth, binary);

  // Return our own initialization response (not the binary's)
  const response: JsonRpcResponse = {
    jsonrpc: "2.0",
    id: request.id ?? null,
    result: {
      protocolVersion: "2025-03-26",
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: {
        name: "seo-mcp-saas",
        version: VERSION,
      },
    },
  };

  return { response, sessionId };
}

/**
 * Handle a JSON-RPC request (non-initialize).
 * Routes to the binary via the session's binary instance.
 */
export async function handleRequest(
  auth: AuthContext,
  sessionId: string,
  request: JsonRpcRequest,
): Promise<JsonRpcResponse> {
  const session = sessionManager.get(sessionId);
  if (!session || session.auth.userId !== auth.userId) {
    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: {
        code: -32000,
        message: "Session expired or not found. Send a new initialize request.",
      },
    };
  }

  // Atomic rate limit check + increment (only for tool calls)
  const isToolCall = request.method === TOOL_CALL_METHOD;
  if (isToolCall) {
    const rateCheck = checkAndIncrementRateLimit(auth);
    if (!rateCheck.allowed) {
      const toolName = extractToolName(request);
      logUsage(auth, toolName || request.method, "rate_limited", 0);

      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        error: {
          code: -32000,
          message: `Rate limit exceeded. ${rateCheck.used}/${rateCheck.limit} calls used this month. Upgrade at https://seomcp.dev/pricing`,
          data: {
            used: rateCheck.used,
            limit: rateCheck.limit,
            plan: auth.plan,
          },
        },
      };
    }
  }

  const startTime = Date.now();

  try {
    // Forward to binary
    const response = await session.binary.send({
      ...request,
      id: request.id ?? 1,
    });

    const durationMs = Date.now() - startTime;

    // Track usage for tool calls (rate limit already incremented atomically above)
    if (isToolCall) {
      const toolName = extractToolName(request);
      logUsage(auth, toolName || "unknown", response.error ? "error" : "success", durationMs);
    }

    return response;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const toolName = extractToolName(request);

    if (isToolCall) {
      logUsage(auth, toolName || "unknown", "error", durationMs);
    }

    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Internal error",
      },
    };
  }
}

/**
 * Handle a batch of JSON-RPC messages.
 */
export async function handleBatch(
  auth: AuthContext,
  sessionId: string,
  messages: JsonRpcRequest[],
): Promise<JsonRpcResponse[]> {
  const responses = await Promise.all(
    messages.map((msg) => handleRequest(auth, sessionId, msg)),
  );
  return responses;
}

/**
 * Extract tool name from a tools/call request.
 */
function extractToolName(request: JsonRpcRequest): string | null {
  if (request.method === TOOL_CALL_METHOD && request.params) {
    return (request.params as { name?: string }).name || null;
  }
  return null;
}
