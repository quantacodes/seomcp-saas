import { describe, test, expect, beforeEach } from "bun:test";
import {
  validateWebhookUrl,
  getUserWebhookUrl,
  setUserWebhookUrl,
  getWebhookDeliveries,
} from "../src/webhooks/user-webhooks";
import { sqlite } from "../src/db/index";
import { runMigrations } from "../src/db/migrate";

// Ensure migrations run
runMigrations();

describe("Webhook URL validation", () => {
  test("accepts valid HTTPS URL", () => {
    const result = validateWebhookUrl("https://example.com/webhook");
    expect(result.valid).toBe(true);
  });

  test("accepts valid HTTP URL", () => {
    const result = validateWebhookUrl("http://example.com/webhook");
    expect(result.valid).toBe(true);
  });

  test("rejects non-HTTP protocol", () => {
    const result = validateWebhookUrl("ftp://example.com/webhook");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("HTTPS or HTTP");
  });

  test("rejects localhost", () => {
    expect(validateWebhookUrl("http://localhost/webhook").valid).toBe(false);
    expect(validateWebhookUrl("http://127.0.0.1/webhook").valid).toBe(false);
  });

  test("rejects private IPs - 10.x", () => {
    expect(validateWebhookUrl("http://10.0.0.1/webhook").valid).toBe(false);
  });

  test("rejects private IPs - 192.168.x", () => {
    expect(validateWebhookUrl("http://192.168.1.1/webhook").valid).toBe(false);
  });

  test("rejects private IPs - 172.16-31.x", () => {
    expect(validateWebhookUrl("http://172.16.0.1/webhook").valid).toBe(false);
    expect(validateWebhookUrl("http://172.31.255.255/webhook").valid).toBe(false);
    // 172.32 is public
  });

  test("rejects link-local 169.254.x", () => {
    expect(validateWebhookUrl("http://169.254.1.1/webhook").valid).toBe(false);
  });

  test("rejects IPv6 loopback", () => {
    expect(validateWebhookUrl("http://[::1]/webhook").valid).toBe(false);
  });

  test("rejects cloud metadata endpoints", () => {
    expect(validateWebhookUrl("http://metadata.google.internal/webhook").valid).toBe(false);
    expect(validateWebhookUrl("http://something.internal/webhook").valid).toBe(false);
  });

  test("rejects invalid URL", () => {
    expect(validateWebhookUrl("not-a-url").valid).toBe(false);
    expect(validateWebhookUrl("").valid).toBe(false);
  });
});

describe("Webhook get/set", () => {
  const testUserId = "WHTEST" + Date.now().toString(36).toUpperCase().padEnd(20, "0");

  beforeEach(() => {
    // Create test user
    sqlite.run(
      "INSERT OR REPLACE INTO users (id, email, password_hash, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [testUserId, `wh-${Date.now()}@test.com`, "hash", "pro", Date.now(), Date.now()],
    );
  });

  test("returns null when no webhook set", () => {
    expect(getUserWebhookUrl(testUserId)).toBeNull();
  });

  test("sets and gets webhook URL", () => {
    setUserWebhookUrl(testUserId, "https://example.com/hook");
    expect(getUserWebhookUrl(testUserId)).toBe("https://example.com/hook");
  });

  test("clears webhook URL with null", () => {
    setUserWebhookUrl(testUserId, "https://example.com/hook");
    setUserWebhookUrl(testUserId, null);
    expect(getUserWebhookUrl(testUserId)).toBeNull();
  });

  test("returns empty deliveries for new user", () => {
    const deliveries = getWebhookDeliveries(testUserId);
    expect(deliveries).toEqual([]);
  });
});

describe("Webhook dashboard routes", () => {
  // Test via HTTP
  const app = (async () => {
    const { default: server } = await import("../src/index");
    return server;
  })();

  test("GET /dashboard/api/webhook requires auth", async () => {
    const server = await app;
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/webhook"));
    expect(res.status).toBe(401);
  });

  test("POST /dashboard/api/webhook requires auth", async () => {
    const server = await app;
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/hook" }),
    }));
    expect(res.status).toBe(401);
  });

  test("POST /dashboard/api/webhook requires JSON", async () => {
    const server = await app;
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/webhook", {
      method: "POST",
    }));
    expect(res.status).toBe(415);
  });

  test("POST /dashboard/api/webhook/test requires auth", async () => {
    const server = await app;
    const res = await server.fetch(new Request("http://localhost:3456/dashboard/api/webhook/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(401);
  });
});
