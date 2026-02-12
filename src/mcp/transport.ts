import type { JsonRpcRequest, JsonRpcResponse, AuthContext } from "../types";
import { binaryPool, type BinaryInstance } from "./binary";
import { sessionManager } from "./session";
import { checkAndIncrementRateLimit } from "../ratelimit/middleware";
import { logUsage } from "../usage/tracker";
import { config, VERSION } from "../config";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

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
 * Get or create the config directory for a user's binary instance.
 * For MVP: uses a shared config. In Phase 1.5, per-user Google OAuth.
 */
function getUserConfigPath(userId: string): string {
  // Validate userId format to prevent path traversal
  if (!/^[A-Z0-9]{26,32}$/.test(userId)) {
    throw new Error("Invalid user ID format");
  }
  const userDir = join("/tmp", "seo-mcp-saas", userId);
  const configPath = join(userDir, "config.toml");

  if (!existsSync(configPath)) {
    mkdirSync(userDir, { recursive: true });

    // MVP: minimal config with dummy credentials path
    // The binary needs [credentials] to start, but tools that don't need Google (crawl, schema, etc.) still work
    // Real Google integration comes in Phase 1.5
    const dummyCredsPath = join(userDir, "google-creds.json");
    if (!existsSync(dummyCredsPath)) {
      // Empty JSON — binary starts but Google API calls will fail gracefully
      writeFileSync(dummyCredsPath, '{}');
    }

    const configContent = `# Auto-generated config for user ${userId}
[credentials]
google_service_account = "${dummyCredsPath}"

[indexnow]
api_key = ""
key_location = ""
`;
    writeFileSync(configPath, configContent);
  }

  return configPath;
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
