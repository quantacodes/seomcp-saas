/**
 * @seomcp/proxy — MCP JSON-RPC protocol tests
 *
 * Tests the stdin/stdout MCP protocol by spawning the proxy as a child process
 * and sending JSON-RPC messages through stdin.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { spawn } from "bun";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const TMP_DIR = join(import.meta.dir, ".tmp-mcp-test");
const SRC = join(import.meta.dir, "..", "src", "index.ts");

/** Valid service account for testing */
const VALID_SA = {
  type: "service_account",
  project_id: "my-project",
  private_key_id: "key123",
  private_key: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n",
  client_email: "bot@my-project.iam.gserviceaccount.com",
  client_id: "123456789",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
};

let saPath: string;

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
  saPath = join(TMP_DIR, "sa.json");
  writeFileSync(saPath, JSON.stringify(VALID_SA), "utf-8");
});

/**
 * Send JSON-RPC messages to the proxy and collect responses.
 * Returns parsed JSON responses.
 */
async function mcpSession(
  messages: object[],
  env?: Record<string, string>,
): Promise<any[]> {
  const input = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";

  const proc = spawn({
    cmd: ["bun", "run", SRC],
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      SEOMCP_API_KEY: "sk_live_REDACTED",
      GOOGLE_SERVICE_ACCOUNT: saPath,
      SEOMCP_API_URL: "http://localhost:0", // No real server
      ...env,
    },
    cwd: join(import.meta.dir, ".."),
  });

  // Write all messages then close stdin
  proc.stdin.write(input);
  proc.stdin.end();

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  // Parse responses (one per line)
  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
}

describe("MCP protocol", () => {
  test("initialize returns server info", async () => {
    const responses = await mcpSession([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    ]);

    expect(responses.length).toBeGreaterThanOrEqual(1);
    const res = responses[0];
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe(1);
    expect(res.result).toBeDefined();
    expect(res.result.serverInfo.name).toBe("seomcp-proxy");
    expect(res.result.serverInfo.version).toBeDefined();
    expect(res.result.capabilities).toBeDefined();
    expect(res.result.capabilities.tools).toBeDefined();
    expect(res.result.protocolVersion).toBe("2024-11-05");
  });

  test("tools/list returns cached manifest", async () => {
    const responses = await mcpSession([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    ]);

    // Find the tools/list response
    const toolsRes = responses.find((r) => r.id === 2);
    expect(toolsRes).toBeDefined();
    expect(toolsRes.result).toBeDefined();
    expect(toolsRes.result.tools).toBeDefined();
    expect(Array.isArray(toolsRes.result.tools)).toBe(true);
    expect(toolsRes.result.tools.length).toBeGreaterThan(0);

    // Check tool shape
    const firstTool = toolsRes.result.tools[0];
    expect(firstTool.name).toBeDefined();
    expect(firstTool.description).toBeDefined();
    expect(firstTool.inputSchema).toBeDefined();
  });

  test("tools/list returns all 37 tools from bundled manifest", async () => {
    const responses = await mcpSession([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    ]);

    const toolsRes = responses.find((r) => r.id === 2);
    expect(toolsRes.result.tools.length).toBe(37);

    // Verify some key tools exist
    const toolNames = toolsRes.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain("gsc_performance");
    expect(toolNames).toContain("ga4_report");
    expect(toolNames).toContain("site_audit");
    expect(toolNames).toContain("generate_report");
    expect(toolNames).toContain("version");
    expect(toolNames).toContain("core_web_vitals");
    expect(toolNames).toContain("validate_schema");
    expect(toolNames).toContain("indexnow_submit_url");
  });

  test("invalid JSON returns parse error", async () => {
    const proc = spawn({
      cmd: ["bun", "run", SRC],
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        SEOMCP_API_KEY: "sk_live_REDACTED",
        GOOGLE_SERVICE_ACCOUNT: saPath,
        SEOMCP_API_URL: "http://localhost:0",
      },
      cwd: join(import.meta.dir, ".."),
    });

    proc.stdin.write("not valid json\n");
    proc.stdin.end();

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    const lines = output.split("\n").filter((l) => l.trim());
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const res = JSON.parse(lines[0]);
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(-32700); // PARSE_ERROR per JSON-RPC spec
  });

  test("unknown method returns method not found", async () => {
    const responses = await mcpSession([
      { jsonrpc: "2.0", id: 1, method: "unknown/method", params: {} },
    ]);

    const res = responses[0];
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(-32601);
    expect(res.error.message).toContain("unknown/method");
  });

  test("notifications/initialized is silently acknowledged", async () => {
    const responses = await mcpSession([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    ]);

    // Should get initialize and tools/list responses, but NOT a response for the notification
    const ids = responses.map((r) => r.id).filter((id) => id !== undefined);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    // No response without an id (except notification replies aren't sent)
    expect(responses.every((r) => r.id !== undefined)).toBe(true);
  });

  test("tools/call with missing API key returns -32003", async () => {
    const responses = await mcpSession(
      [
        { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "version", arguments: {} },
        },
      ],
      { SEOMCP_API_KEY: "" },
    );

    const callRes = responses.find((r) => r.id === 2);
    expect(callRes).toBeDefined();
    expect(callRes.error).toBeDefined();
    expect(callRes.error.code).toBe(-32003);
  });

  test("tools/call with unknown tool returns -32601", async () => {
    const responses = await mcpSession([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "nonexistent_tool", arguments: {} },
      },
    ]);

    const callRes = responses.find((r) => r.id === 2);
    expect(callRes).toBeDefined();
    expect(callRes.error).toBeDefined();
    expect(callRes.error.code).toBe(-32601);
  });

  test("tools/call without tool name returns error", async () => {
    const responses = await mcpSession([
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {},
      },
    ]);

    const res = responses[0];
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(-32600);
  });

  test("tools/call with missing credentials returns -32001", async () => {
    const responses = await mcpSession(
      [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "version", arguments: {} },
        },
      ],
      { GOOGLE_SERVICE_ACCOUNT: "" },
    );

    const res = responses[0];
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(-32001);
  });

  test("tools/call forwards to cloud (network error expected)", async () => {
    // With a fake API URL pointing to a port that refuses connections,
    // we expect a cloud unreachable or timeout error
    const responses = await mcpSession(
      [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "version", arguments: {} },
        },
      ],
      { SEOMCP_API_URL: "http://127.0.0.1:19999", SEOMCP_TIMEOUT: "2000" },
    );

    expect(responses.length).toBeGreaterThanOrEqual(1);
    const res = responses[0];
    expect(res).toBeDefined();
    expect(res.error).toBeDefined();
    // Should be cloud unreachable (-32006) or timeout (-32007)
    expect([-32006, -32007].includes(res.error.code)).toBe(true);
  });

  test("missing jsonrpc field returns invalid request", async () => {
    const proc = spawn({
      cmd: ["bun", "run", SRC],
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        SEOMCP_API_KEY: "sk_live_REDACTED",
        GOOGLE_SERVICE_ACCOUNT: saPath,
        SEOMCP_API_URL: "http://localhost:0",
      },
      cwd: join(import.meta.dir, ".."),
    });

    proc.stdin.write(JSON.stringify({ id: 1, method: "initialize" }) + "\n");
    proc.stdin.end();

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    const lines = output.split("\n").filter((l) => l.trim());
    const res = JSON.parse(lines[0]);
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(-32600);
  });
});

describe("MCP full session", () => {
  test("initialize → notifications/initialized → tools/list lifecycle", async () => {
    const responses = await mcpSession([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    ]);

    expect(responses.length).toBe(2); // initialize + tools/list (notification has no response)

    const initRes = responses.find((r) => r.id === 1);
    expect(initRes.result.serverInfo.name).toBe("seomcp-proxy");

    const toolsRes = responses.find((r) => r.id === 2);
    expect(toolsRes.result.tools.length).toBeGreaterThan(0);
  });
});
