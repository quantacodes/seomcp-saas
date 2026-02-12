import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";

// Set test env BEFORE imports
const testDbPath = "./data/test-dashboard.db";
process.env.DATABASE_PATH = testDbPath;
process.env.JWT_SECRET = "test-jwt-dashboard";
process.env.TOKEN_ENCRYPTION_KEY = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

// Clean test DB
mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);
if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}

// Import AFTER env setup
import { Hono } from "hono";
import { cors } from "hono/cors";
import { runMigrations } from "../src/db/migrate";
import { authRoutes } from "../src/routes/auth";
import { dashboardRoutes } from "../src/routes/dashboard";
import { createSession, validateSession, deleteSession, cleanExpiredSessions } from "../src/auth/session";
import { db, schema } from "../src/db/index";
import { ulid } from "../src/utils/ulid";

runMigrations();

const app = new Hono();
app.use("*", cors());
app.route("/", authRoutes);
app.route("/", dashboardRoutes);
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Helpers
async function req(path: string, options: RequestInit = {}) {
  return app.fetch(new Request(`http://localhost${path}`, options));
}

async function jsonReq(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.fetch(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

// Create a test user and get session cookie
async function createTestUser(email: string, password: string) {
  await jsonReq("/api/auth/signup", { email, password });
  const loginRes = await jsonReq("/dashboard/login", { email, password });
  const setCookie = loginRes.headers.get("Set-Cookie");
  const sessionMatch = setCookie?.match(/session=([^;]+)/);
  return sessionMatch?.[1] || "";
}

function withCookie(sessionId: string, extra: Record<string, string> = {}): Record<string, string> {
  return { Cookie: `session=${sessionId}`, ...extra };
}

// ── Session Module Tests ──
describe("Session Management", () => {
  let testUserId: string;

  beforeAll(() => {
    // Create a user directly in DB
    testUserId = ulid();
    db.insert(schema.users).values({
      id: testUserId,
      email: "session-test@example.com",
      passwordHash: "fake-hash",
      plan: "free",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).run();
  });

  it("creates a session and validates it", () => {
    const sessionId = createSession(testUserId);
    expect(sessionId).toBeTruthy();
    expect(sessionId.length).toBeGreaterThan(10);

    const data = validateSession(sessionId);
    expect(data).not.toBeNull();
    expect(data!.userId).toBe(testUserId);
    expect(data!.email).toBe("session-test@example.com");
    expect(data!.plan).toBe("free");
  });

  it("returns null for invalid session", () => {
    expect(validateSession("invalid")).toBeNull();
    expect(validateSession("")).toBeNull();
    expect(validateSession("short")).toBeNull();
  });

  it("deletes a session", () => {
    const sessionId = createSession(testUserId);
    expect(validateSession(sessionId)).not.toBeNull();

    deleteSession(sessionId);
    expect(validateSession(sessionId)).toBeNull();
  });

  it("cleans expired sessions", () => {
    // Insert an expired session directly
    const expiredId = ulid();
    db.insert(schema.sessions).values({
      id: expiredId,
      userId: testUserId,
      expiresAt: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
      createdAt: new Date(),
    }).run();

    expect(validateSession(expiredId)).toBeNull(); // already expired

    const cleaned = cleanExpiredSessions();
    expect(cleaned).toBeGreaterThanOrEqual(1);
  });
});

// ── Login Route Tests ──
describe("Dashboard Login", () => {
  beforeAll(async () => {
    await jsonReq("/api/auth/signup", { email: "login-test@example.com", password: "testpass123" });
  });

  it("serves login page HTML", async () => {
    const res = await req("/dashboard/login");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Sign in to your dashboard");
    expect(html).toContain("login-form");
  });

  it("logs in with valid credentials and sets cookie", async () => {
    const res = await jsonReq("/dashboard/login", {
      email: "login-test@example.com",
      password: "testpass123",
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.redirect).toBe("/dashboard");

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/dashboard");
  });

  it("rejects login with wrong password", async () => {
    const res = await jsonReq("/dashboard/login", {
      email: "login-test@example.com",
      password: "wrongpass",
    });
    expect(res.status).toBe(401);
  });

  it("rejects login with non-existent email", async () => {
    const res = await jsonReq("/dashboard/login", {
      email: "nobody@example.com",
      password: "testpass123",
    });
    expect(res.status).toBe(401);
  });

  it("rejects login with missing fields", async () => {
    const res = await jsonReq("/dashboard/login", { email: "test@test.com" });
    expect(res.status).toBe(400);
  });
});

// ── Dashboard Page Tests ──
describe("Dashboard Page", () => {
  it("redirects to login without session", async () => {
    const res = await req("/dashboard", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard/login");
  });

  it("serves dashboard HTML with valid session", async () => {
    const sessionId = await createTestUser("dash-page@example.com", "testpass123");
    const res = await req("/dashboard", {
      headers: withCookie(sessionId),
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Dashboard");
    expect(html).toContain("loadDashboard");
  });

  it("redirects login page to dashboard if already logged in", async () => {
    const sessionId = await createTestUser("dash-redir@example.com", "testpass123");
    const res = await req("/dashboard/login", {
      headers: withCookie(sessionId),
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dashboard");
  });
});

// ── Overview API Tests ──
describe("Dashboard Overview API", () => {
  let sessionId: string;

  beforeAll(async () => {
    sessionId = await createTestUser("overview@example.com", "testpass123");
  });

  it("returns 401 without session", async () => {
    const res = await req("/dashboard/api/overview");
    expect(res.status).toBe(401);
  });

  it("returns overview data with valid session", async () => {
    const res = await req("/dashboard/api/overview", {
      headers: withCookie(sessionId),
    });
    expect(res.status).toBe(200);

    const data = await res.json();

    // User info
    expect(data.user.email).toBe("overview@example.com");
    expect(data.user.plan).toBe("free");

    // Usage
    expect(data.usage.used).toBe(0);
    expect(data.usage.limit).toBe(50);
    expect(data.usage.remaining).toBe(50);
    expect(data.usage.period).toBeTruthy();
    expect(data.usage.breakdown).toBeDefined();
    expect(data.usage.topTools).toBeDefined();
    expect(data.usage.dailyUsage).toBeDefined();

    // Keys
    expect(data.keys).toHaveLength(1);
    expect(data.keys[0].prefix).toStartWith("sk_live_");
    expect(data.keys[0].isActive).toBe(true);

    // Google
    expect(data.google.connected).toBe(false);

    // Recent calls
    expect(data.recentCalls).toHaveLength(0);
  });
});

// ── Key Management via Dashboard ──
describe("Dashboard Key Management", () => {
  let sessionId: string;

  beforeAll(async () => {
    sessionId = await createTestUser("keys-dash@example.com", "testpass123");
  });

  it("rejects key creation without auth", async () => {
    const res = await jsonReq("/dashboard/api/keys", { name: "Test" });
    expect(res.status).toBe(401);
  });

  it("enforces plan limit on free tier (1 key max)", async () => {
    // User already has 1 key from signup
    const res = await jsonReq("/dashboard/api/keys", { name: "Second Key" }, withCookie(sessionId));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Maximum 1");
  });

  it("revokes a key", async () => {
    // Get the existing key
    const overviewRes = await req("/dashboard/api/overview", {
      headers: withCookie(sessionId),
    });
    const overview = await overviewRes.json();
    const keyId = overview.keys[0].id;

    // Revoke it
    const revokeRes = await app.fetch(
      new Request(`http://localhost/dashboard/api/keys/${keyId}`, {
        method: "DELETE",
        headers: withCookie(sessionId),
      }),
    );
    expect(revokeRes.status).toBe(200);
    const revokeData = await revokeRes.json();
    expect(revokeData.success).toBe(true);

    // Now we can create a new key (revoked key doesn't count toward limit)
    const createRes = await jsonReq("/dashboard/api/keys", { name: "Replacement" }, withCookie(sessionId));
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.key).toStartWith("sk_live_");
    expect(createData.name).toBe("Replacement");
  });

  it("rejects revoking non-existent key", async () => {
    const res = await app.fetch(
      new Request("http://localhost/dashboard/api/keys/nonexistent", {
        method: "DELETE",
        headers: withCookie(sessionId),
      }),
    );
    expect(res.status).toBe(404);
  });
});

// ── Password Change ──
describe("Dashboard Password Change", () => {
  let sessionId: string;

  beforeAll(async () => {
    sessionId = await createTestUser("pwchange@example.com", "testpass123");
  });

  it("rejects without auth", async () => {
    const res = await jsonReq("/dashboard/api/password", {
      currentPassword: "testpass123",
      newPassword: "newpass456",
    });
    expect(res.status).toBe(401);
  });

  it("rejects with wrong current password", async () => {
    const res = await jsonReq(
      "/dashboard/api/password",
      { currentPassword: "wrongpass", newPassword: "newpass456" },
      withCookie(sessionId),
    );
    expect(res.status).toBe(401);
  });

  it("rejects short new password", async () => {
    const res = await jsonReq(
      "/dashboard/api/password",
      { currentPassword: "testpass123", newPassword: "short" },
      withCookie(sessionId),
    );
    expect(res.status).toBe(400);
  });

  it("changes password successfully", async () => {
    const res = await jsonReq(
      "/dashboard/api/password",
      { currentPassword: "testpass123", newPassword: "newpass456" },
      withCookie(sessionId),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify new password works for login
    const loginRes = await jsonReq("/dashboard/login", {
      email: "pwchange@example.com",
      password: "newpass456",
    });
    expect(loginRes.status).toBe(200);
  });
});

// ── Logout ──
describe("Dashboard Logout", () => {
  it("logs out and invalidates session", async () => {
    const sessionId = await createTestUser("logout@example.com", "testpass123");

    // Verify session works
    const beforeRes = await req("/dashboard/api/overview", {
      headers: withCookie(sessionId),
    });
    expect(beforeRes.status).toBe(200);

    // Logout
    const logoutRes = await app.fetch(
      new Request("http://localhost/dashboard/logout", {
        method: "POST",
        headers: withCookie(sessionId),
      }),
    );
    expect(logoutRes.status).toBe(200);

    // Session should be invalid now
    const afterRes = await req("/dashboard/api/overview", {
      headers: withCookie(sessionId),
    });
    expect(afterRes.status).toBe(401);
  });
});

afterAll(() => {
  try {
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
    if (existsSync(testDbPath + "-wal")) unlinkSync(testDbPath + "-wal");
    if (existsSync(testDbPath + "-shm")) unlinkSync(testDbPath + "-shm");
  } catch {}
});
