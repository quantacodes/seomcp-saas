import { describe, test, expect, beforeAll } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";

// Set test DB BEFORE any module loads
const testDbPath = "./data/test-admin.db";
process.env.DATABASE_PATH = testDbPath;
process.env.ADMIN_SECRET = "test-admin-secret-12345";

mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);
if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}

// Dynamic imports to ensure env is set BEFORE module evaluation
const { Hono } = await import("hono");
const { cors } = await import("hono/cors");
const { runMigrations } = await import("../src/db/migrate");
const { authRoutes } = await import("../src/routes/auth");
const { adminRoutes } = await import("../src/routes/admin");

runMigrations();

const app = new Hono();
app.use("*", cors());
app.route("/", authRoutes);
app.route("/", adminRoutes);
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Helpers
async function req(path: string, options: RequestInit = {}) {
  return app.fetch(new Request(`http://localhost${path}`, options));
}

async function adminGet(path: string) {
  return req(path, {
    headers: { "X-Admin-Secret": "test-admin-secret-12345" },
  });
}

async function adminPost(path: string, body: object) {
  return req(path, {
    method: "POST",
    headers: {
      "X-Admin-Secret": "test-admin-secret-12345",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const ADMIN_SECRET = "test-admin-secret-12345";

describe("Admin API", () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const email = `admin-test-${Date.now()}@test.dev`;
    const res = await req("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "testpassword123" }),
    });
    const data = (await res.json()) as any;
    testUserId = data.user?.id;
  });

  describe("Authentication", () => {
    test("rejects requests without admin secret", async () => {
      const res = await req("/api/admin/stats");
      expect(res.status).toBe(401);
    });

    test("rejects requests with wrong admin secret", async () => {
      const res = await req("/api/admin/stats", {
        headers: { "X-Admin-Secret": "wrong-secret" },
      });
      expect(res.status).toBe(401);
    });

    test("accepts requests with correct admin secret", async () => {
      const res = await adminGet("/api/admin/stats");
      expect(res.status).toBe(200);
    });

    test("returns 503 when ADMIN_SECRET not configured", async () => {
      const saved = process.env.ADMIN_SECRET;
      delete process.env.ADMIN_SECRET;
      const res = await req("/api/admin/stats", {
        headers: { "X-Admin-Secret": "anything" },
      });
      process.env.ADMIN_SECRET = saved;
      expect(res.status).toBe(503);
    });
  });

  describe("GET /api/admin/stats", () => {
    test("returns user stats", async () => {
      const res = await adminGet("/api/admin/stats");
      const data = (await res.json()) as any;

      expect(data.users).toBeDefined();
      expect(data.users.total).toBeGreaterThanOrEqual(1);
      expect(data.users.byPlan).toBeDefined();
      expect(typeof data.users.signupsThisMonth).toBe("number");
      expect(typeof data.users.googleConnected).toBe("number");
    });

    test("returns usage stats", async () => {
      const res = await adminGet("/api/admin/stats");
      const data = (await res.json()) as any;

      expect(data.usage).toBeDefined();
      expect(data.usage.thisMonth).toBeDefined();
      expect(typeof data.usage.thisMonth.total).toBe("number");
      expect(typeof data.usage.last24h).toBe("number");
    });

    test("returns billing and runtime stats", async () => {
      const res = await adminGet("/api/admin/stats");
      const data = (await res.json()) as any;

      expect(data.billing).toBeDefined();
      expect(typeof data.billing.activeSubscriptions).toBe("number");
      expect(data.runtime).toBeDefined();
      expect(typeof data.runtime.uptime).toBe("number");
      expect(typeof data.runtime.memoryMb).toBe("number");
    });

    test("returns top tools array", async () => {
      const res = await adminGet("/api/admin/stats");
      const data = (await res.json()) as any;

      expect(Array.isArray(data.topTools)).toBe(true);
    });
  });

  describe("GET /api/admin/users", () => {
    test("returns paginated user list", async () => {
      const res = await adminGet("/api/admin/users");
      const data = (await res.json()) as any;

      expect(Array.isArray(data.users)).toBe(true);
      expect(data.users.length).toBeGreaterThanOrEqual(1);
      expect(data.pagination).toBeDefined();
      expect(typeof data.pagination.total).toBe("number");
    });

    test("respects limit parameter", async () => {
      const res = await adminGet("/api/admin/users?limit=1");
      const data = (await res.json()) as any;

      expect(data.users.length).toBeLessThanOrEqual(1);
      expect(data.pagination.limit).toBe(1);
    });

    test("filters by plan", async () => {
      const res = await adminGet("/api/admin/users?plan=free");
      const data = (await res.json()) as any;

      expect(Array.isArray(data.users)).toBe(true);
      for (const user of data.users) {
        expect(user.plan).toBe("free");
      }
    });
  });

  describe("GET /api/admin/users/:id", () => {
    test("returns detailed user info", async () => {
      const res = await adminGet(`/api/admin/users/${testUserId}`);
      const data = (await res.json()) as any;

      expect(data.user).toBeDefined();
      expect(data.user.id).toBe(testUserId);
      expect(Array.isArray(data.apiKeys)).toBe(true);
      expect(Array.isArray(data.recentUsage)).toBe(true);
      expect(typeof data.monthlyUsage).toBe("number");
    });

    test("returns 404 for unknown user", async () => {
      const res = await adminGet("/api/admin/users/01AAAAAAAAAAAAAAAAAAAAAAAAA");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/admin/users/:id/plan", () => {
    test("changes user plan", async () => {
      const res = await adminPost(`/api/admin/users/${testUserId}/plan`, { plan: "pro" });
      const data = (await res.json()) as any;

      expect(data.success).toBe(true);
      expect(data.plan).toBe("pro");

      // Verify
      const detail = await adminGet(`/api/admin/users/${testUserId}`);
      const detailData = (await detail.json()) as any;
      expect(detailData.user.plan).toBe("pro");

      // Reset
      await adminPost(`/api/admin/users/${testUserId}/plan`, { plan: "free" });
    });

    test("rejects invalid plan", async () => {
      const res = await adminPost(`/api/admin/users/${testUserId}/plan`, { plan: "mega" });
      expect(res.status).toBe(400);
    });

    test("returns 404 for unknown user", async () => {
      const res = await adminPost("/api/admin/users/01AAAAAAAAAAAAAAAAAAAAAAAAA/plan", { plan: "pro" });
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/admin/usage/hourly", () => {
    test("returns hourly breakdown", async () => {
      const res = await adminGet("/api/admin/usage/hourly");
      const data = (await res.json()) as any;

      expect(Array.isArray(data.hourly)).toBe(true);
      expect(typeof data.periodStart).toBe("number");
    });
  });

  describe("GET /api/admin/errors", () => {
    test("returns error list", async () => {
      const res = await adminGet("/api/admin/errors");
      const data = (await res.json()) as any;

      expect(Array.isArray(data.errors)).toBe(true);
    });
  });
});
