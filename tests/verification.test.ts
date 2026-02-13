import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";

// Set test DB BEFORE any module loads
const testDbPath = "./data/test-verification.db";
process.env.DATABASE_PATH = testDbPath;
process.env.JWT_SECRET = "test-jwt-verification-12345";
process.env.TOKEN_ENCRYPTION_KEY = "abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01";

mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);
if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}

const { Hono } = await import("hono");
const { runMigrations } = await import("../src/db/migrate");
const { authRoutes } = await import("../src/routes/auth");
const { verifyRoutes } = await import("../src/routes/verify");
const { healthRoutes } = await import("../src/routes/health");
const {
  generateVerificationToken,
  verifyToken,
  buildVerificationUrl,
} = await import("../src/auth/verification");

runMigrations();

const app = new Hono();
app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", verifyRoutes);

// ── Token Generation & Verification ──

describe("Verification Token", () => {
  const userId = "01TEST000000000000000000AA";
  const email = "test@example.com";

  it("generates a token with correct format", () => {
    const { token, expiresAt } = generateVerificationToken(userId, email);
    expect(token).toMatch(/^\d+\.[a-f0-9]{64}$/); // timestamp.hmac
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 100);
  });

  it("generates unique tokens for different timestamps", async () => {
    const t1 = generateVerificationToken(userId, email);
    await new Promise((r) => setTimeout(r, 5));
    const t2 = generateVerificationToken(userId, email);
    expect(t1.token).not.toBe(t2.token);
  });

  it("verifies a valid token", () => {
    const { token } = generateVerificationToken(userId, email);
    const result = verifyToken(token, userId, email);
    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
  });

  it("rejects a token with wrong userId", () => {
    const { token } = generateVerificationToken(userId, email);
    const result = verifyToken(token, "WRONG_USER_ID_0000000000", email);
    expect(result.valid).toBe(false);
  });

  it("rejects a token with wrong email", () => {
    const { token } = generateVerificationToken(userId, email);
    const result = verifyToken(token, userId, "wrong@example.com");
    expect(result.valid).toBe(false);
  });

  it("rejects a tampered token", () => {
    const { token } = generateVerificationToken(userId, email);
    // Flip a character in the HMAC
    const parts = token.split(".");
    const tampered = parts[0] + "." + "0".repeat(64);
    const result = verifyToken(tampered, userId, email);
    expect(result.valid).toBe(false);
  });

  it("rejects garbage tokens", () => {
    expect(verifyToken("", userId, email).valid).toBe(false);
    expect(verifyToken("not.a.token", userId, email).valid).toBe(false);
    expect(verifyToken("abc.def", userId, email).valid).toBe(false);
    expect(verifyToken("123", userId, email).valid).toBe(false);
  });

  it("builds correct verification URL", () => {
    const url = buildVerificationUrl("USER123", "TOKEN456");
    expect(url).toBe("http://localhost:3456/verify?uid=USER123&token=TOKEN456");
  });
});

// ── Signup with Verification ──

describe("Signup Verification Flow", () => {
  let userId: string;

  it("signup returns emailVerified: false", async () => {
    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "verify-test@example.com", password: "password123" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.emailVerified).toBe(false);
    userId = data.user.id;
  });

  it("login returns emailVerified: false for unverified user", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "verify-test@example.com", password: "password123" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.emailVerified).toBe(false);
  });
});

// ── Verification Endpoint ──

describe("GET /verify", () => {
  let userId: string;
  let verificationToken: string;

  beforeAll(async () => {
    // Intercept console.log to capture the raw verification token from email fallback
    const originalLog = console.log;
    let capturedUrl = "";
    console.log = (...args: unknown[]) => {
      const msg = args.join(" ");
      if (msg.includes("Verification email")) {
        const match = msg.match(/token=([^\s&]+)/);
        if (match) capturedUrl = decodeURIComponent(match[1]);
      }
      originalLog(...args);
    };

    const res = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "magic-link@example.com", password: "password123" }),
    });
    const data = await res.json();
    userId = data.user.id;

    // Restore console.log
    console.log = originalLog;

    // The raw token was captured from the console log (email fallback)
    verificationToken = capturedUrl;
  });

  it("rejects missing parameters", async () => {
    const res = await app.request("/verify");
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Invalid verification link");
  });

  it("rejects non-existent user", async () => {
    const res = await app.request("/verify?uid=NONEXISTENT&token=fake");
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("Account not found");
  });

  it("rejects wrong token", async () => {
    const res = await app.request(`/verify?uid=${userId}&token=wrong.token`);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Invalid");
  });

  it("verifies email with valid token", async () => {
    const res = await app.request(`/verify?uid=${userId}&token=${encodeURIComponent(verificationToken)}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Email Verified");
    expect(html).toContain("50 tool calls");
  });

  it("returns already-verified for repeat verification", async () => {
    const res = await app.request(`/verify?uid=${userId}&token=${encodeURIComponent(verificationToken)}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("already verified");
  });

  it("login returns emailVerified: true after verification", async () => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "magic-link@example.com", password: "password123" }),
    });
    const data = await res.json();
    expect(data.user.emailVerified).toBe(true);
  });
});

// ── Resend Verification ──

describe("POST /api/auth/resend-verification", () => {
  it("returns success for valid unverified email", async () => {
    // First create unverified user
    await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "resend-test@example.com", password: "password123" }),
    });

    const res = await app.request("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "resend-test@example.com" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("link has been sent");
  });

  it("returns success for non-existent email (no leak)", async () => {
    const res = await app.request("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@example.com" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("link has been sent");
  });

  it("returns success for already-verified email (no leak)", async () => {
    const res = await app.request("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "magic-link@example.com" }), // already verified above
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("link has been sent");
  });

  it("rejects missing email", async () => {
    const res = await app.request("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

// ── Rate Limit Adjustment ──

describe("Unverified Rate Limit", () => {
  it("unverified free users get 10 call limit", async () => {
    // Create a real user via signup (unverified by default)
    const signupRes = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ratelimit-unverified@example.com", password: "password123" }),
    });
    const signupData = await signupRes.json();

    // Get API key ID from DB
    const { sqlite } = await import("../src/db/index");
    const keyRow = sqlite
      .query("SELECT id FROM api_keys WHERE user_id = ?")
      .get(signupData.user.id) as { id: string };

    const { checkAndIncrementRateLimit } = await import("../src/ratelimit/middleware");
    const auth = {
      userId: signupData.user.id,
      email: "ratelimit-unverified@example.com",
      plan: "free",
      apiKeyId: keyRow.id,
      scopes: null,
      emailVerified: false,
    };

    const result = checkAndIncrementRateLimit(auth);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
  });

  it("verified free users get 50 call limit", async () => {
    // Create and verify a user
    const signupRes = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ratelimit-verified@example.com", password: "password123" }),
    });
    const signupData = await signupRes.json();

    const { sqlite } = await import("../src/db/index");
    // Manually verify
    sqlite.run("UPDATE users SET email_verified = 1 WHERE id = ?", [signupData.user.id]);

    const keyRow = sqlite
      .query("SELECT id FROM api_keys WHERE user_id = ?")
      .get(signupData.user.id) as { id: string };

    const { checkAndIncrementRateLimit } = await import("../src/ratelimit/middleware");
    const auth = {
      userId: signupData.user.id,
      email: "ratelimit-verified@example.com",
      plan: "free",
      apiKeyId: keyRow.id,
      scopes: null,
      emailVerified: true,
    };

    const result = checkAndIncrementRateLimit(auth);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(50);
  });

  it("pro users unaffected by verification", async () => {
    const { sqlite } = await import("../src/db/index");
    const { ulid } = await import("../src/utils/ulid");

    // Create user directly in DB (avoids IP rate limit)
    const userId = ulid();
    const keyId = ulid();
    const now = Math.floor(Date.now() / 1000);
    sqlite.run(
      "INSERT INTO users (id, email, password_hash, plan, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, "ratelimit-pro@example.com", "unused", "pro", 0, now, now],
    );
    sqlite.run(
      "INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [keyId, userId, "fakehash123", "sk_live_REDACTED", "Default", 1, now],
    );

    const { checkAndIncrementRateLimit } = await import("../src/ratelimit/middleware");
    const auth = {
      userId,
      email: "ratelimit-pro@example.com",
      plan: "pro",
      apiKeyId: keyId,
      scopes: null,
      emailVerified: false, // unverified but pro
    };

    const result = checkAndIncrementRateLimit(auth);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(2000);
  });
});

afterAll(async () => {
  try {
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
    if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
    if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}
  } catch {}
});
