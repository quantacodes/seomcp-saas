import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";

// Set test DB BEFORE any module loads
const testDbPath = "./data/test-password-reset.db";
process.env.DATABASE_PATH = testDbPath;
process.env.JWT_SECRET = "test-jwt-password-reset-12345";
process.env.TOKEN_ENCRYPTION_KEY = "abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01";

mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);
if (existsSync(testDbPath + "-wal")) try { unlinkSync(testDbPath + "-wal"); } catch {}
if (existsSync(testDbPath + "-shm")) try { unlinkSync(testDbPath + "-shm"); } catch {}

const { Hono } = await import("hono");
const { runMigrations } = await import("../src/db/migrate");
const { authRoutes } = await import("../src/routes/auth");
const { passwordResetRoutes } = await import("../src/routes/password-reset");
const { healthRoutes } = await import("../src/routes/health");
const {
  generateResetToken,
  verifyResetToken,
  hashResetToken,
  buildResetUrl,
} = await import("../src/auth/password-reset");
const { db, schema } = await import("../src/db/index");
const { eq } = await import("drizzle-orm");
const { ulid } = await import("../src/utils/ulid");

runMigrations();

const app = new Hono();
app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", passwordResetRoutes);

// Helper to create a user directly in DB (bypasses signup rate limits)
async function createTestUser(email: string, password: string = "testpassword123") {
  const userId = ulid();
  const now = new Date();
  const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt" });
  
  db.insert(schema.users)
    .values({
      id: userId,
      email: email.toLowerCase().trim(),
      passwordHash,
      plan: "free",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  
  return { user: { id: userId, email } };
}

// ── Token Generation & Verification ──

describe("Password Reset Token", () => {
  const userId = "01TEST000000000000000000AA";
  const email = "test@example.com";

  it("generates a token with correct format", () => {
    const { token, expiresAt } = generateResetToken(userId, email);
    expect(token).toContain(".");
    const [ts, hmac] = token.split(".");
    expect(parseInt(ts)).toBeGreaterThan(0);
    expect(hmac.length).toBe(64); // SHA-256 hex
    expect(expiresAt).toBeGreaterThan(Date.now());
    // 1 hour expiry (not 24h like verification)
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(60 * 60 * 1000 + 100);
  });

  it("generates different tokens for different users", () => {
    const t1 = generateResetToken(userId, email);
    const t2 = generateResetToken("01TEST000000000000000000BB", "other@example.com");
    expect(t1.token).not.toBe(t2.token);
  });

  it("verifies valid token", () => {
    const { token } = generateResetToken(userId, email);
    const result = verifyResetToken(token, userId, email);
    expect(result.valid).toBe(true);
    expect(result.expired).toBe(false);
  });

  it("rejects tampered HMAC", () => {
    const { token } = generateResetToken(userId, email);
    const [ts] = token.split(".");
    const tampered = `${ts}.${"a".repeat(64)}`;
    const result = verifyResetToken(tampered, userId, email);
    expect(result.valid).toBe(false);
  });

  it("rejects wrong user ID", () => {
    const { token } = generateResetToken(userId, email);
    const result = verifyResetToken(token, "WRONG_USER_ID", email);
    expect(result.valid).toBe(false);
  });

  it("rejects wrong email", () => {
    const { token } = generateResetToken(userId, email);
    const result = verifyResetToken(token, userId, "wrong@example.com");
    expect(result.valid).toBe(false);
  });

  it("rejects garbage token", () => {
    const result = verifyResetToken("garbage", userId, email);
    expect(result.valid).toBe(false);
  });

  it("rejects empty token", () => {
    const result = verifyResetToken("", userId, email);
    expect(result.valid).toBe(false);
  });

  it("hashes token deterministically", () => {
    const { token } = generateResetToken(userId, email);
    const h1 = hashResetToken(token);
    const h2 = hashResetToken(token);
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64); // SHA-256 hex
  });

  it("different tokens produce different hashes", () => {
    const t1 = generateResetToken(userId, email);
    const t2 = generateResetToken("01TEST000000000000000000CC", "diff@example.com");
    expect(hashResetToken(t1.token)).not.toBe(hashResetToken(t2.token));
  });

  it("builds correct reset URL", () => {
    const url = buildResetUrl("USER123", "TOKEN456");
    expect(url).toContain("/reset-password?uid=USER123&token=TOKEN456");
  });

  it("uses different HMAC domain from verification tokens", () => {
    // Reset and verification tokens for same user should be different
    const { generateVerificationToken } = require("../src/auth/verification");
    const resetToken = generateResetToken(userId, email);
    const verifyTokenResult = generateVerificationToken(userId, email);
    // Same timestamp would yield different HMACs due to domain separation
    expect(resetToken.token.split(".")[1]).not.toBe(verifyTokenResult.token.split(".")[1]);
  });
});

// ── Forgot Password API ──

describe("POST /api/auth/forgot-password", () => {
  it("returns success for existing user", async () => {
    await createTestUser("forgot@test.com");

    const res = await app.request("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "forgot@test.com" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("If an account");
  });

  it("returns same success for non-existing user (prevents enumeration)", async () => {
    const res = await app.request("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@test.com" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("If an account");
  });

  it("stores hashed token in DB", async () => {
    await createTestUser("hash-check@test.com");

    await app.request("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "hash-check@test.com" }),
    });

    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "hash-check@test.com"))
      .all()[0];

    expect(user.resetToken).toBeTruthy();
    expect(user.resetToken!.length).toBe(64); // SHA-256 hex
    expect(user.resetSentAt).toBeTruthy();
  });

  it("rejects invalid email", async () => {
    const res = await app.request("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad" }),
    });

    expect(res.status).toBe(400);
  });

  it("rejects missing email", async () => {
    const res = await app.request("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

// ── Reset Password Form Page ──

describe("GET /reset-password", () => {
  it("shows form for valid token", async () => {
    await createTestUser("form-valid@test.com");

    // Get user and generate token
    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "form-valid@test.com"))
      .all()[0];

    const { token } = generateResetToken(user.id, user.email);
    db.update(schema.users)
      .set({ resetToken: hashResetToken(token), resetSentAt: new Date() })
      .where(eq(schema.users.id, user.id))
      .run();

    const res = await app.request(`/reset-password?uid=${user.id}&token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("New Password");
    expect(html).toContain("Reset Password");
    expect(html).toContain("Confirm Password");
  });

  it("shows error for missing params", async () => {
    const res = await app.request("/reset-password");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Invalid reset link");
  });

  it("shows error for invalid token", async () => {
    await createTestUser("form-invalid@test.com");
    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "form-invalid@test.com"))
      .all()[0];

    // Set a reset token but provide wrong one
    db.update(schema.users)
      .set({ resetToken: hashResetToken("sometoken"), resetSentAt: new Date() })
      .where(eq(schema.users.id, user.id))
      .run();

    const res = await app.request(`/reset-password?uid=${user.id}&token=garbage`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Invalid");
  });

  it("shows error for non-existent user", async () => {
    const res = await app.request("/reset-password?uid=FAKE_USER&token=fake.token");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Invalid");
  });

  it("shows error for superseded token (newer request exists)", async () => {
    await createTestUser("superseded@test.com");

    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "superseded@test.com"))
      .all()[0];

    // Generate first token and store it
    const { token: firstToken } = generateResetToken(user.id, user.email);
    const firstHash = hashResetToken(firstToken);
    db.update(schema.users)
      .set({ resetToken: firstHash, resetSentAt: new Date() })
      .where(eq(schema.users.id, user.id))
      .run();

    // Wait a bit to ensure different timestamp
    await new Promise(r => setTimeout(r, 5));

    // Generate second token (supersedes first) and store it
    const { token: secondToken } = generateResetToken(user.id, user.email);
    const secondHash = hashResetToken(secondToken);

    // Ensure the tokens are actually different
    expect(firstHash).not.toBe(secondHash);

    db.update(schema.users)
      .set({ resetToken: secondHash, resetSentAt: new Date() })
      .where(eq(schema.users.id, user.id))
      .run();

    // First token should be rejected on GET (form page) — superseded
    const res = await app.request(`/reset-password?uid=${user.id}&token=${encodeURIComponent(firstToken)}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("superseded");

    // Second token should show the form
    const res2 = await app.request(`/reset-password?uid=${user.id}&token=${encodeURIComponent(secondToken)}`);
    expect(res2.status).toBe(200);
    const html2 = await res2.text();
    expect(html2).toContain("New Password");
  });
});

// ── Reset Password API ──

describe("POST /api/auth/reset-password", () => {
  it("resets password with valid token", async () => {
    await createTestUser("reset-me@test.com", "oldpassword123");

    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "reset-me@test.com"))
      .all()[0];

    const { token } = generateResetToken(user.id, user.email);
    db.update(schema.users)
      .set({ resetToken: hashResetToken(token), resetSentAt: new Date() })
      .where(eq(schema.users.id, user.id))
      .run();

    const res = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user.id,
        token,
        password: "newpassword456",
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toContain("successfully");

    // Verify token is cleared (single-use)
    const updated = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .all()[0];
    expect(updated.resetToken).toBeNull();
    expect(updated.resetSentAt).toBeNull();

    // Verify new password works
    const valid = await Bun.password.verify("newpassword456", updated.passwordHash);
    expect(valid).toBe(true);

    // Verify old password doesn't work
    const oldValid = await Bun.password.verify("oldpassword123", updated.passwordHash);
    expect(oldValid).toBe(false);
  });

  it("rejects wrong token", async () => {
    await createTestUser("wrong-token@test.com");

    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "wrong-token@test.com"))
      .all()[0];

    const { token } = generateResetToken(user.id, user.email);
    db.update(schema.users)
      .set({ resetToken: hashResetToken(token), resetSentAt: new Date() })
      .where(eq(schema.users.id, user.id))
      .run();

    const res = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user.id,
        token: "wrong.token",
        password: "newpassword456",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("rejects short password", async () => {
    const res = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: "any",
        token: "any.token",
        password: "short",
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("8 characters");
  });

  it("rejects missing fields", async () => {
    const res = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: "test" }),
    });

    expect(res.status).toBe(400);
  });

  it("rejects non-JSON content type", async () => {
    const res = await app.request("/api/auth/reset-password", {
      method: "POST",
      body: "uid=test&token=test&password=testtest",
    });

    expect(res.status).toBe(415);
  });

  it("rejects already-used token (single-use)", async () => {
    await createTestUser("single-use@test.com", "originalpass123");

    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "single-use@test.com"))
      .all()[0];

    const { token } = generateResetToken(user.id, user.email);
    db.update(schema.users)
      .set({ resetToken: hashResetToken(token), resetSentAt: new Date() })
      .where(eq(schema.users.id, user.id))
      .run();

    // First reset — should work
    const res1 = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: user.id, token, password: "newpass12345" }),
    });
    expect(res1.status).toBe(200);

    // Second attempt with same token — should fail
    const res2 = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: user.id, token, password: "anotherpass123" }),
    });
    expect(res2.status).toBe(400);
  });

  it("rejects non-existent user", async () => {
    const res = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: "NONEXISTENT_USER_ID",
        token: "any.token",
        password: "newpassword123",
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ── Forgot Password Form Page ──

describe("GET /forgot-password", () => {
  it("returns the forgot password form", async () => {
    const res = await app.request("/forgot-password");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Reset your password");
    expect(html).toContain("Send Reset Link");
    expect(html).toContain("email");
  });
});

// ── Login page has forgot link ──

describe("Login page forgot password link", () => {
  it("login page has forgot password link", async () => {
    // Check the raw HTML file
    const { readFileSync } = require("fs");
    const html = readFileSync("src/dashboard/login.html", "utf-8");
    expect(html).toContain("/forgot-password");
    expect(html).toContain("Forgot password");
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
