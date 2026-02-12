import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";

// Set test DB BEFORE any module loads
const testDbPath = "./data/test-api.db";
process.env.DATABASE_PATH = testDbPath;

mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);
if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}

// Dynamic imports to ensure env is set BEFORE module evaluation
const { Hono } = await import("hono");
const { cors } = await import("hono/cors");
const { runMigrations } = await import("../src/db/migrate");
const { healthRoutes } = await import("../src/routes/health");
const { authRoutes } = await import("../src/routes/auth");
const { keysRoutes } = await import("../src/routes/keys");
const { usageRoutes } = await import("../src/routes/usage");
const { mcpRoutes } = await import("../src/routes/mcp");

runMigrations();

const app = new Hono();
app.use("*", cors());
app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", keysRoutes);
app.route("/", usageRoutes);
app.route("/", mcpRoutes);
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Helper to make requests against app directly
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

describe("Health endpoint", () => {
  it("returns healthy status", async () => {
    const res = await req("/health");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.version).toBe("0.1.0");
  });
});

describe("Auth endpoints", () => {
  it("rejects signup with missing fields", async () => {
    const res = await jsonReq("/api/auth/signup", { email: "test@test.com" });
    expect(res.status).toBe(400);
  });

  it("rejects signup with short password", async () => {
    const res = await jsonReq("/api/auth/signup", { email: "test@test.com", password: "short" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("at least 8");
  });

  it("rejects signup with invalid email", async () => {
    const res = await jsonReq("/api/auth/signup", { email: "bad", password: "testpass123" });
    expect(res.status).toBe(400);
  });

  it("creates account and returns API key", async () => {
    const res = await jsonReq("/api/auth/signup", {
      email: "fresh-test@example.com",
      password: "testpass123",
    });
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.user.email).toBe("fresh-test@example.com");
    expect(data.user.plan).toBe("free");
    expect(data.apiKey).toStartWith("sk_live_");
    expect(data.apiKey).toHaveLength(56);
  });

  it("rejects duplicate email", async () => {
    const res = await jsonReq("/api/auth/signup", {
      email: "fresh-test@example.com",
      password: "anotherpass123",
    });
    expect(res.status).toBe(409);
  });

  it("login works with correct credentials", async () => {
    const res = await jsonReq("/api/auth/login", {
      email: "fresh-test@example.com",
      password: "testpass123",
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user.email).toBe("fresh-test@example.com");
  });

  it("login rejects wrong password", async () => {
    const res = await jsonReq("/api/auth/login", {
      email: "fresh-test@example.com",
      password: "wrongpass",
    });
    expect(res.status).toBe(401);
  });
});

describe("API Key management", () => {
  let apiKey: string;

  beforeAll(async () => {
    const res = await jsonReq("/api/auth/signup", {
      email: "keys-test@example.com",
      password: "testpass123",
    });
    const data = await res.json();
    apiKey = data.apiKey;
  });

  it("lists API keys", async () => {
    const res = await req("/api/keys", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.keys).toHaveLength(1);
    expect(data.keys[0].prefix).toStartWith("sk_live_");
  });

  it("rejects listing without auth", async () => {
    const res = await req("/api/keys");
    expect(res.status).toBe(401);
  });

  it("rejects creating key beyond plan limit", async () => {
    const res = await jsonReq("/api/keys", { name: "Second Key" }, {
      Authorization: `Bearer ${apiKey}`,
    });
    expect(res.status).toBe(403);
  });
});

describe("Usage endpoint", () => {
  let apiKey: string;

  beforeAll(async () => {
    const res = await jsonReq("/api/auth/signup", {
      email: "usage-test@example.com",
      password: "testpass123",
    });
    const data = await res.json();
    apiKey = data.apiKey;
  });

  it("returns usage stats", async () => {
    const res = await req("/api/usage", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.plan).toBe("free");
    expect(data.used).toBe(0);
    expect(data.limit).toBe(50);
    expect(data.remaining).toBe(50);
  });
});

describe("MCP endpoint", () => {
  let apiKey: string;

  beforeAll(async () => {
    const res = await jsonReq("/api/auth/signup", {
      email: "mcp-test@example.com",
      password: "testpass123",
    });
    const data = await res.json();
    apiKey = data.apiKey;
  });

  it("rejects without auth", async () => {
    const res = await jsonReq("/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });
    expect(res.status).toBe(401);
  });

  it("rejects non-init request without session ID", async () => {
    const res = await jsonReq(
      "/mcp",
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toContain("Mcp-Session-Id");
  });

  it("initializes MCP session and returns session ID", async () => {
    const res = await jsonReq(
      "/mcp",
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      },
      { Authorization: `Bearer ${apiKey}`, Accept: "application/json, text/event-stream" },
    );

    expect(res.status).toBe(200);

    const sessionId = res.headers.get("Mcp-Session-Id");
    expect(sessionId).toBeTruthy();
    expect(sessionId!.length).toBe(64);

    const data = await res.json();
    expect(data.result.protocolVersion).toBe("2025-03-26");
    expect(data.result.serverInfo.name).toBe("seo-mcp-saas");
  });

  it("lists tools via MCP", async () => {
    // Initialize first
    const initRes = await jsonReq(
      "/mcp",
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      },
      { Authorization: `Bearer ${apiKey}`, Accept: "application/json, text/event-stream" },
    );

    const sessionId = initRes.headers.get("Mcp-Session-Id")!;

    const res = await jsonReq(
      "/mcp",
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Mcp-Session-Id": sessionId,
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result.tools).toBeDefined();
    expect(data.result.tools.length).toBeGreaterThanOrEqual(35);
  });

  it("calls a tool successfully", async () => {
    // Initialize
    const initRes = await jsonReq(
      "/mcp",
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      },
      { Authorization: `Bearer ${apiKey}`, Accept: "application/json, text/event-stream" },
    );

    const sessionId = initRes.headers.get("Mcp-Session-Id")!;

    // Call version tool
    const res = await jsonReq(
      "/mcp",
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "version" },
      },
      {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Mcp-Session-Id": sessionId,
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBeDefined();
    expect(data.result.content).toBeDefined();
    expect(data.result.content[0].type).toBe("text");

    const versionInfo = JSON.parse(data.result.content[0].text);
    expect(versionInfo.name).toBe("seo-mcp");
    expect(versionInfo.tools).toBe(35);
  });
});

describe("404 handling", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await req("/nonexistent");
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Not found");
  });
});

afterAll(() => {
  try {
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
    if (existsSync(testDbPath + "-wal")) unlinkSync(testDbPath + "-wal");
    if (existsSync(testDbPath + "-shm")) unlinkSync(testDbPath + "-shm");
  } catch {}
});
