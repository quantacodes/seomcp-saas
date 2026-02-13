/**
 * @seomcp/proxy — MCP JSON-RPC stdio handler
 *
 * Implements the Model Context Protocol over stdin/stdout.
 * Handles: initialize, notifications/initialized, tools/list, tools/call
 *
 * Framing: newline-delimited JSON (one JSON object per line).
 */

import { createInterface } from "node:readline";
import { VERSION } from "./version.js";
import { readCredentials, validateApiKey } from "./credentials.js";
import { callTool } from "./client.js";
import { getManifest, type ToolManifest } from "./manifest.js";
import { isForceUpdate } from "./version.js";
import * as errors from "./errors.js";

/** Write a JSON-RPC response to stdout */
function send(msg: object): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

/** JSON-RPC success response */
function rpcResult(id: string | number | null, result: unknown): object {
  return { jsonrpc: "2.0", id, result };
}

/** Handle `initialize` — return server info and capabilities */
function handleInitialize(id: string | number | null): void {
  send(
    rpcResult(id, {
      protocolVersion: "2025-03-26",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "seomcp-proxy",
        version: VERSION,
      },
    }),
  );
}

/** Handle `tools/list` — serve cached manifest */
function handleToolsList(id: string | number | null): void {
  const manifest = getManifest();
  send(rpcResult(id, { tools: manifest.tools }));
}

/**
 * Handle `tools/call` — forward to cloud API with credentials.
 * Re-reads credentials from disk on every call (supports key rotation).
 */
async function handleToolsCall(
  id: string | number | null,
  params: { name?: string; arguments?: Record<string, unknown> },
): Promise<void> {
  // Block if force update is active
  if (isForceUpdate()) {
    send(errors.versionOutdated(id, VERSION));
    return;
  }

  const toolName = params?.name;
  if (!toolName || typeof toolName !== "string") {
    send(errors.invalidRequest(id, "Missing tool name in params"));
    return;
  }

  // Validate tool exists in manifest
  const manifest = getManifest();
  const toolExists = manifest.tools.some((t) => t.name === toolName);
  if (!toolExists) {
    send(errors.methodNotFound(id, toolName));
    return;
  }

  // Validate API key
  const apiKey = process.env.SEOMCP_API_KEY;
  if (!apiKey) {
    send(errors.apiKeyMissing(id));
    return;
  }
  const keyError = validateApiKey(apiKey);
  if (keyError) {
    send(errors.apiKeyInvalid(id));
    return;
  }

  // Read credentials from disk (fresh every call)
  const credPath = process.env.GOOGLE_SERVICE_ACCOUNT;
  const credResult = readCredentials(credPath);

  if (!credResult.ok) {
    if (credResult.code === "missing") {
      send(errors.missingCredentials(id));
    } else {
      send(errors.invalidCredentials(id, credResult.field ?? "unknown"));
    }
    return;
  }

  // Forward to cloud
  const args = params.arguments ?? {};
  const gscProperty = process.env.GSC_PROPERTY;
  const ga4Property = process.env.GA4_PROPERTY;

  const result = await callTool(
    apiKey!,
    toolName,
    args,
    credResult.credentials,
    gscProperty,
    ga4Property,
  );

  if (!result.ok) {
    if (result.kind === "timeout") {
      send(errors.requestTimeout(id, parseInt(process.env.SEOMCP_TIMEOUT ?? "30000", 10)));
    } else {
      send(errors.cloudUnreachable(id));
    }
    return;
  }

  // Map HTTP status to errors
  const { status, body, headers } = result;

  if (status === 200) {
    // Cloud returns MCP-compatible tool result
    // Expected shape: { content: [...] } or { result: ... }
    const toolResult = body as Record<string, unknown>;
    if (toolResult.content) {
      send(rpcResult(id, toolResult));
    } else {
      // Wrap in MCP content format
      send(
        rpcResult(id, {
          content: [
            {
              type: "text",
              text: typeof body === "string" ? body : JSON.stringify(body, null, 2),
            },
          ],
        }),
      );
    }
    return;
  }

  if (status === 401) {
    send(errors.apiKeyInvalid(id));
    return;
  }

  if (status === 403) {
    const email = credResult.credentials.client_email ?? "your service account";
    send(
      errors.permissionDenied(
        id,
        gscProperty ?? "the resource",
        email,
      ),
    );
    return;
  }

  if (status === 429) {
    const remaining = headers["x-ratelimit-remaining"];
    send(errors.rateLimited(id, remaining ? parseInt(remaining, 10) : undefined));
    return;
  }

  if (status >= 500) {
    send(errors.serverError(id));
    return;
  }

  // Google API errors (passed through from cloud)
  if (status === 400 || status === 422) {
    const msg =
      (body as Record<string, unknown>)?.message ??
      (body as Record<string, unknown>)?.error ??
      "Unknown error";
    send(errors.googleApiError(id, String(msg)));
    return;
  }

  // Fallback
  send(
    errors.rpcError(id, -32000, `Unexpected response: HTTP ${status}`, body),
  );
}

/**
 * Process a single JSON-RPC message.
 */
async function processMessage(line: string): Promise<void> {
  let msg: Record<string, unknown>;

  try {
    msg = JSON.parse(line);
  } catch {
    send(errors.rpcError(null, errors.PARSE_ERROR, "Parse error: invalid JSON"));
    return;
  }

  // Validate basic JSON-RPC structure
  if (typeof msg !== "object" || msg === null || msg.jsonrpc !== "2.0") {
    send(errors.invalidRequest(msg?.id as string | number | null ?? null));
    return;
  }

  const method = msg.method;
  const id = (msg.id as string | number | null) ?? null;
  const params = (msg.params as Record<string, unknown>) ?? {};

  // Validate method is a string (JSON-RPC spec requirement)
  if (typeof method !== "string") {
    if (id !== null) {
      send(errors.invalidRequest(id, "Missing or invalid method (must be a string)"));
    }
    return;
  }

  // Notifications (no id) — acknowledge silently
  if (method === "notifications/initialized") {
    // No response needed for notifications
    return;
  }

  if (method === "notifications/cancelled") {
    // Client cancelled a request — acknowledge silently
    return;
  }

  switch (method) {
    case "initialize":
      handleInitialize(id);
      break;
    case "tools/list":
      handleToolsList(id);
      break;
    case "tools/call":
      await handleToolsCall(id, params as { name?: string; arguments?: Record<string, unknown> });
      break;
    default:
      // Unknown method
      if (id !== null) {
        send(errors.methodNotFound(id, method));
      }
      // If no id, it's a notification — silently ignore
      break;
  }
}

/**
 * Start the MCP stdio server.
 * Reads newline-delimited JSON from stdin, writes responses to stdout.
 */
export function startStdioServer(): void {
  let inFlight = 0;
  let stdinClosed = false;
  const abortControllers = new Set<AbortController>();

  function maybeExit() {
    if (stdinClosed && inFlight === 0) {
      process.exit(0);
    }
  }

  function gracefulShutdown() {
    // Abort all in-flight requests
    for (const ac of abortControllers) {
      ac.abort();
    }
    abortControllers.clear();
    stdinClosed = true;
    maybeExit();
    // Force exit after 3s if in-flight requests don't finish
    setTimeout(() => process.exit(0), 3000).unref();
  }

  const rl = createInterface({
    input: process.stdin,
    terminal: false,
  });

  rl.on("line", (line: string) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    const ac = new AbortController();
    abortControllers.add(ac);
    inFlight++;
    processMessage(trimmed)
      .catch((err) => {
        process.stderr.write(`Internal error: ${(err as Error).message}\n`);
      })
      .finally(() => {
        abortControllers.delete(ac);
        inFlight--;
        maybeExit();
      });
  });

  rl.on("close", () => {
    // stdin EOF — client disconnected
    gracefulShutdown();
  });

  // Graceful shutdown on signals
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}
