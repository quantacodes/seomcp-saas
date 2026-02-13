import { describe, test, expect, beforeEach } from "bun:test";
import {
  calculateNextRun,
  validateSchedule,
  countUserSchedules,
  getUserSchedules,
  createSchedule,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
} from "../src/scheduler/engine";
import { sqlite } from "../src/db/index";
import { runMigrations } from "../src/db/migrate";
import { ulid } from "../src/utils/ulid";
import { resetIpRateLimits } from "../src/middleware/rate-limit-ip";

// Ensure migrations run
runMigrations();

describe("Schedule validation", () => {
  test("accepts valid daily schedule", () => {
    expect(validateSchedule("daily", 6).valid).toBe(true);
    expect(validateSchedule("daily", 0).valid).toBe(true);
    expect(validateSchedule("daily", 23).valid).toBe(true);
  });

  test("accepts valid weekly schedule", () => {
    expect(validateSchedule("weekly", 6, 0).valid).toBe(true); // Monday
    expect(validateSchedule("weekly", 6, 6).valid).toBe(true); // Sunday
  });

  test("accepts valid monthly schedule", () => {
    expect(validateSchedule("monthly", 6, 1).valid).toBe(true);
    expect(validateSchedule("monthly", 6, 28).valid).toBe(true);
  });

  test("rejects invalid schedule type", () => {
    expect(validateSchedule("hourly", 6).valid).toBe(false);
    expect(validateSchedule("", 6).valid).toBe(false);
  });

  test("rejects invalid hour", () => {
    expect(validateSchedule("daily", -1).valid).toBe(false);
    expect(validateSchedule("daily", 24).valid).toBe(false);
    expect(validateSchedule("daily", 1.5).valid).toBe(false);
  });

  test("rejects invalid day of week", () => {
    expect(validateSchedule("weekly", 6, -1).valid).toBe(false);
    expect(validateSchedule("weekly", 6, 7).valid).toBe(false);
  });

  test("rejects invalid day of month", () => {
    expect(validateSchedule("monthly", 6, 0).valid).toBe(false);
    expect(validateSchedule("monthly", 6, 29).valid).toBe(false);
    expect(validateSchedule("monthly", 6, 31).valid).toBe(false);
  });
});

describe("Next run calculation", () => {
  test("daily: returns future timestamp", () => {
    const next = calculateNextRun("daily", 6);
    expect(next).toBeGreaterThan(Date.now());
  });

  test("daily: returns within 24 hours", () => {
    const next = calculateNextRun("daily", 6);
    expect(next).toBeLessThan(Date.now() + 24 * 60 * 60 * 1000 + 1000);
  });

  test("weekly: returns future timestamp", () => {
    const next = calculateNextRun("weekly", 6, 0);
    expect(next).toBeGreaterThan(Date.now());
  });

  test("weekly: returns within 7 days", () => {
    const next = calculateNextRun("weekly", 6, 0);
    expect(next).toBeLessThan(Date.now() + 7 * 24 * 60 * 60 * 1000 + 1000);
  });

  test("monthly: returns future timestamp", () => {
    const next = calculateNextRun("monthly", 6, 15);
    expect(next).toBeGreaterThan(Date.now());
  });

  test("monthly: returns within ~31 days", () => {
    const next = calculateNextRun("monthly", 6, 15);
    expect(next).toBeLessThan(Date.now() + 32 * 24 * 60 * 60 * 1000);
  });

  test("uses correct UTC hour", () => {
    const next = calculateNextRun("daily", 14);
    const date = new Date(next);
    expect(date.getUTCHours()).toBe(14);
    expect(date.getUTCMinutes()).toBe(0);
    expect(date.getUTCSeconds()).toBe(0);
  });
});

describe("Schedule CRUD", () => {
  const testUserId = "SCHEDTEST" + Date.now().toString(36).toUpperCase().padEnd(17, "0");
  const testKeyId = "SCHEDKEY" + Date.now().toString(36).toUpperCase().padEnd(18, "0");

  beforeEach(() => {
    // Clean up any existing schedules for this user
    sqlite.run("DELETE FROM scheduled_audits WHERE user_id = ?", [testUserId]);
    // Create test user + key
    sqlite.run(
      "INSERT OR REPLACE INTO users (id, email, password_hash, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [testUserId, `sched-${Date.now()}@test.com`, "hash", "pro", Date.now(), Date.now()],
    );
    sqlite.run(
      "INSERT OR REPLACE INTO api_keys (id, user_id, key_hash, key_prefix, name, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
      [testKeyId, testUserId, "hash-" + Date.now(), "sk_live_REDACTED", "Test", Date.now()],
    );
  });

  test("count starts at 0", () => {
    expect(countUserSchedules(testUserId)).toBe(0);
  });

  test("creates and retrieves schedule", () => {
    const id = ulid();
    createSchedule(id, testUserId, testKeyId, "example.com", "generate_report", "daily", 6, null);
    
    const schedule = getScheduleById(id, testUserId);
    expect(schedule).not.toBeNull();
    expect(schedule.site_url).toBe("example.com");
    expect(schedule.tool_name).toBe("generate_report");
    expect(schedule.schedule).toBe("daily");
    expect(schedule.schedule_hour).toBe(6);
    expect(schedule.is_active).toBe(1);
    expect(schedule.run_count).toBe(0);
  });

  test("count increments after creation", () => {
    const id = ulid();
    createSchedule(id, testUserId, testKeyId, "example.com", "generate_report", "daily", 6, null);
    expect(countUserSchedules(testUserId)).toBe(1);
  });

  test("lists user schedules", () => {
    createSchedule(ulid(), testUserId, testKeyId, "site1.com", "generate_report", "daily", 6, null);
    createSchedule(ulid(), testUserId, testKeyId, "site2.com", "site_audit", "weekly", 8, 1);
    
    const schedules = getUserSchedules(testUserId);
    expect(schedules.length).toBe(2);
  });

  test("updates schedule", () => {
    const id = ulid();
    createSchedule(id, testUserId, testKeyId, "example.com", "generate_report", "daily", 6, null);
    
    updateSchedule(id, testUserId, true, "weekly", 10, 2);
    
    const updated = getScheduleById(id, testUserId);
    expect(updated.schedule).toBe("weekly");
    expect(updated.schedule_hour).toBe(10);
    expect(updated.schedule_day).toBe(2);
    expect(updated.is_active).toBe(1);
  });

  test("pauses schedule", () => {
    const id = ulid();
    createSchedule(id, testUserId, testKeyId, "example.com", "generate_report", "daily", 6, null);
    
    updateSchedule(id, testUserId, false, "daily", 6, null);
    
    const paused = getScheduleById(id, testUserId);
    expect(paused.is_active).toBe(0);
  });

  test("deletes schedule", () => {
    const id = ulid();
    createSchedule(id, testUserId, testKeyId, "example.com", "generate_report", "daily", 6, null);
    
    const deleted = deleteSchedule(id, testUserId);
    expect(deleted).toBe(true);
    expect(getScheduleById(id, testUserId)).toBeNull();
  });

  test("delete returns false for non-existent", () => {
    expect(deleteSchedule("NONEXISTENT", testUserId)).toBe(false);
  });

  test("schedule isolation: can't access other user's schedule", () => {
    const id = ulid();
    createSchedule(id, testUserId, testKeyId, "example.com", "generate_report", "daily", 6, null);
    
    expect(getScheduleById(id, "OTHERUSER")).toBeNull();
    expect(deleteSchedule(id, "OTHERUSER")).toBe(false);
  });
});

describe("Schedule routes", () => {
  const app = (async () => {
    const { default: server } = await import("../src/index");
    return server;
  })();

  test("GET /dashboard/api/schedules requires auth", async () => {
    const server = await app;
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules"));
    expect(res.status).toBe(401);
  });

  test("POST /dashboard/api/schedules requires auth", async () => {
    const server = await app;
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteUrl: "example.com", schedule: "daily" }),
    }));
    expect(res.status).toBe(401);
  });

  test("POST /dashboard/api/schedules requires JSON content type", async () => {
    const server = await app;
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
      method: "POST",
    }));
    expect(res.status).toBe(415);
  });

  test("POST /dashboard/api/schedules/:id/run requires auth", async () => {
    const server = await app;
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules/test/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(401);
  });

  test("POST /dashboard/api/schedules/:id/delete requires auth", async () => {
    const server = await app;
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules/test/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(401);
  });
});

describe("Schedule E2E (with auth)", () => {
  const app = (async () => {
    const { default: server } = await import("../src/index");
    return server;
  })();

  async function createAuthenticatedUser() {
    // Reset rate limits to avoid hitting signup limit in tests
    resetIpRateLimits();
    const server = await app;
    const email = `sched-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
    
    // Signup
    const signupRes = await server.fetch(new Request("http://localhost:3456/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "testpass123" }),
    }));
    const signupData = await signupRes.json() as any;
    
    // Login to dashboard
    const loginRes = await server.fetch(new Request("http://localhost:3456/dashboard/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "testpass123" }),
    }));
    
    const cookie = loginRes.headers.get("Set-Cookie") || "";
    return { cookie, apiKey: signupData.apiKey };
  }

  test("free plan cannot create schedules", async () => {
    const server = await app;
    const { cookie } = await createAuthenticatedUser();
    
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({ siteUrl: "example.com", schedule: "daily", hour: 6 }),
    }));
    
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toContain("free plan");
  });

  test("lists empty schedules", async () => {
    const server = await app;
    const { cookie } = await createAuthenticatedUser();
    
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
      headers: { "Cookie": cookie },
    }));
    
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.schedules).toEqual([]);
    expect(body.limits.used).toBe(0);
  });

  test("validates schedule params", async () => {
    const server = await app;
    const { cookie } = await createAuthenticatedUser();
    
    // Upgrade user to pro
    const overview = await server.fetch(new Request("http://localhost:3456/dashboard/api/overview", {
      headers: { "Cookie": cookie },
    }));
    const overviewData = await overview.json() as any;
    sqlite.run("UPDATE users SET plan = 'pro' WHERE id = ?", [overviewData.user.id]);
    
    // Missing siteUrl
    let res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({ schedule: "daily" }),
    }));
    expect(res.status).toBe(400);
    
    // Invalid schedule type
    res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({ siteUrl: "example.com", schedule: "hourly" }),
    }));
    expect(res.status).toBe(400);
    
    // Invalid hour
    res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({ siteUrl: "example.com", schedule: "daily", hour: 25 }),
    }));
    expect(res.status).toBe(400);
  });

  test("pro user creates, updates, and deletes schedule", async () => {
    const server = await app;
    const { cookie } = await createAuthenticatedUser();
    
    // Upgrade user to pro
    const overview = await server.fetch(new Request("http://localhost:3456/dashboard/api/overview", {
      headers: { "Cookie": cookie },
    }));
    const overviewData = await overview.json() as any;
    sqlite.run("UPDATE users SET plan = 'pro' WHERE id = ?", [overviewData.user.id]);
    
    // Create
    const createRes = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({ siteUrl: "https://example.com", schedule: "daily", hour: 8 }),
    }));
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as any;
    expect(created.id).toBeTruthy();
    expect(created.siteUrl).toBe("example.com"); // Normalized to domain
    expect(created.schedule).toBe("daily");
    expect(created.nextRunAt).toBeGreaterThan(Date.now());
    
    // List
    const listRes = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
      headers: { "Cookie": cookie },
    }));
    const listData = await listRes.json() as any;
    expect(listData.schedules.length).toBe(1);
    expect(listData.limits.used).toBe(1);
    expect(listData.limits.max).toBe(3);
    
    // Update (pause)
    const updateRes = await server.fetch(new Request(`http://localhost:3456/dashboard/api/schedules/${created.id}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({ isActive: false }),
    }));
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json() as any;
    expect(updated.message).toContain("paused");
    
    // Delete
    const deleteRes = await server.fetch(new Request(`http://localhost:3456/dashboard/api/schedules/${created.id}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({}),
    }));
    expect(deleteRes.status).toBe(200);
    
    // Verify deleted
    const listRes2 = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
      headers: { "Cookie": cookie },
    }));
    const listData2 = await listRes2.json() as any;
    expect(listData2.schedules.length).toBe(0);
  });

  test("enforces pro plan limit (3 schedules)", async () => {
    const server = await app;
    const { cookie } = await createAuthenticatedUser();
    
    // Upgrade to pro
    const overview = await server.fetch(new Request("http://localhost:3456/dashboard/api/overview", {
      headers: { "Cookie": cookie },
    }));
    const overviewData = await overview.json() as any;
    sqlite.run("UPDATE users SET plan = 'pro' WHERE id = ?", [overviewData.user.id]);
    
    // Create 3 schedules
    for (let i = 0; i < 3; i++) {
      const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": cookie },
        body: JSON.stringify({ siteUrl: `site${i}.com`, schedule: "daily", hour: 6 }),
      }));
      expect(res.status).toBe(201);
    }
    
    // 4th should fail
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({ siteUrl: "site4.com", schedule: "daily", hour: 6 }),
    }));
    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toContain("Maximum 3");
  });

  test("rejects invalid tool name", async () => {
    const server = await app;
    const { cookie } = await createAuthenticatedUser();
    
    const overview = await server.fetch(new Request("http://localhost:3456/dashboard/api/overview", {
      headers: { "Cookie": cookie },
    }));
    const overviewData = await overview.json() as any;
    sqlite.run("UPDATE users SET plan = 'pro' WHERE id = ?", [overviewData.user.id]);
    
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookie },
      body: JSON.stringify({ siteUrl: "example.com", schedule: "daily", toolName: "evil_tool" }),
    }));
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toContain("Tool must be one of");
  });
});
