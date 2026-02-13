import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";

// Set test DB BEFORE any module loads
const testDbPath = "./data/test-proxy.db";
process.env.DATABASE_PATH = testDbPath;
process.env.NODE_ENV = "test";

mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);
if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}

// Dynamic imports
const { Hono } = await import("hono");
const { cors } = await import("hono/cors");
const { runMigrations } = await import("../src/db/migrate");
const { healthRoutes } = await import("../src/routes/health");
const { authRoutes } = await import("../src/routes/auth");
const { proxyRoutes } = await import("../src/routes/proxy");
const { resetIpRateLimits } = await import("../src/middleware/rate-limit-ip");

runMigrations();
resetIpRateLimits();

const app = new Hono();
app.use("*", cors());
app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", proxyRoutes);
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Helpers
async function req(path: string, options: RequestInit = {}) {
  return app.fetch(new Request(`http://localhost${path}`, options));
}

async function jsonReq(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

// Create a test user + API key
let apiKey: string;

beforeAll(async () => {
  const res = await jsonReq("/api/auth/signup", {
    email: "proxy-test@example.com",
    password: "testpass123",
  });
  const data = await res.json() as any;
  apiKey = data.apiKey;
});

// ─── Fake SA credentials for testing ───
const fakeSA = {
  type: "service_account",
  project_id: "test-project",
  private_key_id: "key123",
  private_key: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n",
  client_email: "test@test-project.iam.gserviceaccount.com",
};

// ═══════════════════════════════════════════════════════════
//  GET /v1/tools/manifest
// ═══════════════════════════════════════════════════════════

describe("GET /v1/tools/manifest", () => {
  test("returns tools list without auth", async () => {
    const res = await req("/v1/tools/manifest");
    expect(res.status).toBe(200);

    const data = await res.json() as any;
    expect(data.tools).toBeDefined();
    expect(Array.isArray(data.tools)).toBe(true);
    expect(data.tools.length).toBeGreaterThanOrEqual(25);
    expect(data.count).toBeGreaterThanOrEqual(25);
  });

  test("includes correct tool shape", async () => {
    const res = await req("/v1/tools/manifest");
    const data = await res.json() as any;

    const tool = data.tools.find((t: any) => t.name === "gsc_performance");
    expect(tool).toBeDefined();
    expect(tool.description).toBeTruthy();
    expect(tool.inputSchema).toBeDefined();
    expect(tool.inputSchema.type).toBe("object");
    expect(tool.inputSchema.properties.site_url).toBeDefined();
    expect(tool.inputSchema.required).toContain("site_url");
  });

  test("has caching headers", async () => {
    const res = await req("/v1/tools/manifest");
    expect(res.headers.get("cache-control")).toContain("max-age=3600");
    expect(res.headers.get("x-min-version")).toBe("0.1.0");
    expect(res.headers.get("x-force-update")).toBe("false");
  });
});

// ═══════════════════════════════════════════════════════════
//  GET /v1/auth/test
// ═══════════════════════════════════════════════════════════

describe("GET /v1/auth/test", () => {
  test("returns plan info with valid key", async () => {
    const res = await req("/v1/auth/test", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);

    const data = await res.json() as any;
    expect(data.valid).toBe(true);
    expect(data.plan).toBe("free");
    expect(data.usage).toBeDefined();
    expect(typeof data.usage.calls_this_month).toBe("number");
    expect(typeof data.usage.calls_limit).toBe("number");
    expect(data.usage.reset_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("has version header", async () => {
    const res = await req("/v1/auth/test", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.headers.get("x-min-version")).toBe("0.1.0");
  });

  test("returns 401 without auth", async () => {
    const res = await req("/v1/auth/test");
    expect(res.status).toBe(401);
  });

  test("returns 401 with invalid key", async () => {
    const res = await req("/v1/auth/test", {
      headers: { Authorization: "Bearer sk_live_REDACTED" },
    });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════
//  POST /v1/tools/call — validation tests
//  (These don't actually spawn the binary — they fail at validation)
// ═══════════════════════════════════════════════════════════

describe("POST /v1/tools/call — validation", () => {
  test("returns 401 without auth", async () => {
    const res = await jsonReq("/v1/tools/call", {
      tool: "version",
      arguments: {},
      credentials: { google_service_account: fakeSA },
    });
    expect(res.status).toBe(401);
  });

  test("returns 400 for missing tool", async () => {
    const res = await jsonReq(
      "/v1/tools/call",
      { arguments: {}, credentials: { google_service_account: fakeSA } },
      { Authorization: `Bearer ${apiKey}` },
    );
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.code).toBe("MISSING_TOOL");
  });

  test("returns 400 for unknown tool", async () => {
    const res = await jsonReq(
      "/v1/tools/call",
      {
        tool: "nonexistent_tool",
        arguments: {},
        credentials: { google_service_account: fakeSA },
      },
      { Authorization: `Bearer ${apiKey}` },
    );
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.code).toBe("UNKNOWN_TOOL");
  });

  test("returns 400 for missing credentials", async () => {
    const res = await jsonReq(
      "/v1/tools/call",
      { tool: "gsc_performance", arguments: {} },
      { Authorization: `Bearer ${apiKey}` },
    );
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.code).toBe("MISSING_CREDENTIALS");
  });

  test("returns 400 for missing SA", async () => {
    const res = await jsonReq(
      "/v1/tools/call",
      {
        tool: "gsc_performance",
        arguments: {},
        credentials: {},
      },
      { Authorization: `Bearer ${apiKey}` },
    );
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.code).toBe("MISSING_SA");
  });

  test("returns 400 for SA missing required fields", async () => {
    const res = await jsonReq(
      "/v1/tools/call",
      {
        tool: "gsc_performance",
        arguments: {},
        credentials: {
          google_service_account: { type: "service_account" }, // missing other fields
        },
      },
      { Authorization: `Bearer ${apiKey}` },
    );
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.code).toBe("INVALID_SA");
  });

  test("returns 400 for invalid JSON body", async () => {
    const res = await app.fetch(
      new Request("http://localhost/v1/tools/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.code).toBe("INVALID_JSON");
  });

  test("rate limit headers are present on valid requests", async () => {
    // This will fail at binary spawn (which is fine), but we check headers
    const res = await jsonReq(
      "/v1/tools/call",
      {
        tool: "version",
        arguments: {},
        credentials: { google_service_account: fakeSA },
      },
      { Authorization: `Bearer ${apiKey}` },
    );
    // Will be 500 (binary not available) or 200, but should have rate limit headers
    expect(res.headers.get("x-ratelimit-limit")).toBeTruthy();
    expect(res.headers.get("x-ratelimit-remaining")).toBeTruthy();
    expect(res.headers.get("x-ratelimit-reset")).toBeTruthy();
    expect(res.headers.get("x-min-version")).toBe("0.1.0");
  });
});

// ═══════════════════════════════════════════════════════════
//  Health endpoint — proxy spawn count
// ═══════════════════════════════════════════════════════════

describe("Health endpoint — proxy stats", () => {
  test("includes proxySpawns in health response", async () => {
    const res = await req("/health");
    expect(res.status).toBe(200);

    const data = await res.json() as any;
    expect(data.proxySpawns).toBeDefined();
    expect(typeof data.proxySpawns.active).toBe("number");
    expect(typeof data.proxySpawns.max).toBe("number");
    expect(data.proxySpawns.active).toBe(0);
    expect(data.proxySpawns.max).toBe(15);
  });
});

// Cleanup
afterAll(() => {
  try {
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
    if (existsSync(testDbPath + "-wal")) unlinkSync(testDbPath + "-wal");
    if (existsSync(testDbPath + "-shm")) unlinkSync(testDbPath + "-shm");
  } catch {}
});
