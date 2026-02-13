/**
 * End-to-End Integration Test
 * 
 * Tests the complete user journey:
 * 1. Health check
 * 2. Sign up → get API key
 * 3. Duplicate signup rejected
 * 4. Login
 * 5. MCP initialize → session ID
 * 6. tools/list → all tools
 * 7. tools/call version
 * 8. Usage tracked
 * 9. Dashboard login + create second key
 * 10. Second key works for MCP
 * 11. Revoke first key → rejected
 * 12. Dashboard overview shows stats
 * 13. Signup rate limiting
 * 14. Input validation
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";

// Set test env BEFORE any module loads
const testDbPath = "./data/test-e2e.db";
process.env.DATABASE_PATH = testDbPath;
process.env.JWT_SECRET = "test-jwt-e2e-12345";
process.env.TOKEN_ENCRYPTION_KEY = "abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01";
process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "test-webhook-e2e";
process.env.LEMONSQUEEZY_PRO_VARIANT_ID = "e2e-pro-variant";
process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID = "e2e-agency-variant";

mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);
if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}

const { Hono } = await import("hono");
const { cors } = await import("hono/cors");
const { runMigrations } = await import("../src/db/migrate");
const { authRoutes } = await import("../src/routes/auth");
const { keysRoutes } = await import("../src/routes/keys");
const { usageRoutes } = await import("../src/routes/usage");
const { mcpRoutes } = await import("../src/routes/mcp");
const { dashboardRoutes } = await import("../src/routes/dashboard");
const { healthRoutes } = await import("../src/routes/health");
const { resetIpRateLimits } = await import("../src/middleware/rate-limit-ip");

runMigrations();

const app = new Hono();
app.use("*", cors());
app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", keysRoutes);
app.route("/", usageRoutes);
app.route("/", mcpRoutes);
app.route("/", dashboardRoutes);
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Helpers
function mcpHeaders(apiKey: string, sessionId?: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  if (sessionId) h["Mcp-Session-Id"] = sessionId;
  return h;
}

function jsonHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { "Content-Type": "application/json", ...extra };
}

// State shared across the test journey
let apiKey1 = "";
let apiKey2 = "";
let userId = "";
let mcpSessionId = "";
let dashboardSessionCookie = "";

const TEST_EMAIL = "e2e-test@example.com";
const TEST_PASSWORD = "secure-password-123";

describe("Complete User Journey", () => {

  it("Step 1: Health check passes", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe("ok");
    expect(body.version).toBeTruthy();
  });

  it("Step 2: Sign up creates user and returns API key", async () => {
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(201);
    
    const body = await res.json() as any;
    expect(body.user.email).toBe(TEST_EMAIL);
    expect(body.user.plan).toBe("free");
    expect(body.apiKey).toMatch(/^sk_live_/);
    expect(body.apiKeyPrefix).toMatch(/^sk_live_/);
    expect(body.message).toContain("Save your API key");

    apiKey1 = body.apiKey;
    userId = body.user.id;
  });

  it("Step 3: Duplicate signup is rejected", async () => {
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(409);
  });

  it("Step 4: Login succeeds with correct credentials", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(200);
    
    const body = await res.json() as any;
    expect(body.user.id).toBe(userId);
    expect(body.user.email).toBe(TEST_EMAIL);
  });

  it("Step 5: Login fails with wrong password", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: TEST_EMAIL, password: "wrong-password" }),
    });
    expect(res.status).toBe(401);
  });

  it("Step 6: MCP rejects without auth", async () => {
    const res = await app.request("/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      }),
    });
    expect(res.status).toBe(401);
  });

  it("Step 7: MCP initialize returns session ID", async () => {
    const res = await app.request("/mcp", {
      method: "POST",
      headers: mcpHeaders(apiKey1),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "e2e-test", version: "1.0" },
        },
      }),
    });
    expect(res.status).toBe(200);

    mcpSessionId = res.headers.get("Mcp-Session-Id") || "";
    expect(mcpSessionId).toBeTruthy();

    const body = await res.json() as any;
    expect(body.result).toBeTruthy();
    expect(body.result.protocolVersion).toBe("2025-03-26");
    expect(body.result.serverInfo).toBeTruthy();
  });

  it("Step 8: tools/list returns all SEO tools", async () => {
    const res = await app.request("/mcp", {
      method: "POST",
      headers: mcpHeaders(apiKey1, mcpSessionId),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.result.tools).toBeDefined();
    expect(body.result.tools.length).toBeGreaterThanOrEqual(30);

    // Spot-check some expected tools
    const toolNames = body.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain("version");
    expect(toolNames).toContain("site_audit");
    expect(toolNames).toContain("crawl_page");
    expect(toolNames).toContain("validate_schema");
  });

  it("Step 9: tools/call version works", async () => {
    const res = await app.request("/mcp", {
      method: "POST",
      headers: mcpHeaders(apiKey1, mcpSessionId),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "version", arguments: {} },
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.result).toBeTruthy();
    expect(body.result.content).toBeDefined();
    expect(body.result.content.length).toBeGreaterThan(0);

    // Should contain version info
    const text = body.result.content[0]?.text || "";
    expect(text).toContain("seo-mcp");
  });

  it("Step 10: Usage was tracked after tool call", async () => {
    const res = await app.request("/api/usage", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey1}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.used).toBeGreaterThanOrEqual(1);
    expect(body.limit).toBe(50); // Free plan
    expect(body.plan).toBe("free");
    expect(body.remaining).toBeLessThanOrEqual(49);
  });

  it("Step 11: Dashboard login + verify plan limits on key creation", async () => {
    // Dashboard login — sets session cookie
    const loginRes = await app.request("/dashboard/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    expect(loginRes.status).toBe(200);

    // Extract session cookie
    const setCookie = loginRes.headers.get("Set-Cookie") || "";
    const sessionMatch = setCookie.match(/session=([^;]+)/);
    expect(sessionMatch).toBeTruthy();
    dashboardSessionCookie = sessionMatch![1];

    // Free plan allows only 1 key — creating second should fail with 403
    const keyRes = await app.request("/dashboard/api/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${dashboardSessionCookie}`,
      },
      body: JSON.stringify({ name: "Second Key" }),
    });
    expect(keyRes.status).toBe(403);
    const keyBody = await keyRes.json() as any;
    expect(keyBody.error).toContain("Maximum");
  });

  it("Step 12: Revoke key via dashboard then verify rejected", async () => {
    // Get key list
    const listRes = await app.request("/api/keys", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey1}` },
    });
    expect(listRes.status).toBe(200);

    const listBody = await listRes.json() as any;
    expect(listBody.keys.length).toBe(1);

    const keyToRevoke = listBody.keys[0];
    expect(keyToRevoke.name).toBe("Default");

    // Revoke it via dashboard
    const revokeRes = await app.request(`/dashboard/api/keys/${keyToRevoke.id}/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${dashboardSessionCookie}`,
      },
    });
    expect(revokeRes.status).toBe(200);

    // Verify revoked key is rejected on MCP
    const mcpRes = await app.request("/mcp", {
      method: "POST",
      headers: mcpHeaders(apiKey1),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "revoked-test", version: "1.0" },
        },
      }),
    });
    expect(mcpRes.status).toBe(401);
  });

  it("Step 13: Create new key after revoking old one (within limit)", async () => {
    // Now we have 0 active keys, creating one should work
    const keyRes = await app.request("/dashboard/api/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${dashboardSessionCookie}`,
      },
      body: JSON.stringify({ name: "Replacement Key" }),
    });
    expect(keyRes.status).toBe(201);

    const keyBody = await keyRes.json() as any;
    expect(keyBody.key).toMatch(/^sk_live_/);
    apiKey2 = keyBody.key;

    // New key works for MCP
    const mcpRes = await app.request("/mcp", {
      method: "POST",
      headers: mcpHeaders(apiKey2),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "e2e-replacement-key", version: "1.0" },
        },
      }),
    });
    expect(mcpRes.status).toBe(200);
    expect(mcpRes.headers.get("Mcp-Session-Id")).toBeTruthy();
  });

  it("Step 14: Dashboard overview shows correct data", async () => {
    const res = await app.request("/dashboard/api/overview", {
      method: "GET",
      headers: { Cookie: `session=${dashboardSessionCookie}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json() as any;
    expect(body.usage).toBeDefined();
    expect(body.usage.used).toBeGreaterThanOrEqual(1);
    expect(body.user).toBeDefined();
    expect(body.user.plan).toBe("free");
    expect(body.keys).toBeDefined();
    // 2 keys total (1 revoked Default, 1 active Replacement)
    expect(body.keys.length).toBe(2);
  });
});

describe("Signup Rate Limiting", () => {
  beforeAll(() => {
    resetIpRateLimits();
  });

  it("allows normal signups", async () => {
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "192.168.1.100",
      },
      body: JSON.stringify({ email: "ratelimit1@test.com", password: "password123" }),
    });
    expect(res.status).toBe(201);
  });

  it("blocks after 5 signups from same IP", async () => {
    for (let i = 2; i <= 5; i++) {
      await app.request("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "192.168.1.100",
        },
        body: JSON.stringify({ email: `ratelimit${i}@test.com`, password: "password123" }),
      });
    }

    // 6th should be blocked
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "192.168.1.100",
      },
      body: JSON.stringify({ email: "ratelimit6@test.com", password: "password123" }),
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("allows different IP simultaneously", async () => {
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "10.0.0.1",
      },
      body: JSON.stringify({ email: "different-ip@test.com", password: "password123" }),
    });
    expect(res.status).toBe(201);
  });
});

describe("Input Validation Edge Cases", () => {
  it("rejects empty email", async () => {
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: jsonHeaders({ "X-Forwarded-For": "10.0.0.99" }),
      body: JSON.stringify({ email: "", password: "password123" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects short password", async () => {
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: jsonHeaders({ "X-Forwarded-For": "10.0.0.99" }),
      body: JSON.stringify({ email: "valid@test.com", password: "short" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid email format", async () => {
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: jsonHeaders({ "X-Forwarded-For": "10.0.0.99" }),
      body: JSON.stringify({ email: "not-an-email", password: "password123" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects non-JSON body gracefully", async () => {
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: jsonHeaders({ "X-Forwarded-For": "10.0.0.99" }),
      body: "this is not json",
    });
    expect(res.status).toBe(400);
  });
});
