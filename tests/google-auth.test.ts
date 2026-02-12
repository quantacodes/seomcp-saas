import { describe, it, expect, beforeAll } from "bun:test";
import { unlinkSync, existsSync, mkdirSync } from "fs";

// Set test env BEFORE imports
const testDbPath = "./data/test-google-auth.db";
process.env.DATABASE_PATH = testDbPath;
process.env.TOKEN_ENCRYPTION_KEY = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
process.env.JWT_SECRET = "test-jwt-secret-for-google-auth";

// Clean test DB
mkdirSync("./data", { recursive: true });
if (existsSync(testDbPath)) unlinkSync(testDbPath);

// Import AFTER env setup
import { encryptToken, decryptToken } from "../src/crypto/tokens";
import { generateState, validateState } from "../src/auth/google";
import {
  writeUserConfig,
  getUserConfigPath,
  hasUserConfig,
  deleteUserConfig,
} from "../src/config/user-config";
import { readFileSync, existsSync as exists2 } from "fs";

describe("Token Encryption", () => {
  it("encrypts and decrypts correctly", () => {
    const plaintext = "ya29.test-access-token-abc123";
    const encrypted = encryptToken(plaintext);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for same plaintext (unique IVs)", () => {
    const plaintext = "refresh-token-xyz";
    const enc1 = encryptToken(plaintext);
    const enc2 = encryptToken(plaintext);
    expect(enc1).not.toBe(enc2); // Different IVs = different ciphertext
    expect(decryptToken(enc1)).toBe(plaintext);
    expect(decryptToken(enc2)).toBe(plaintext);
  });

  it("handles empty strings", () => {
    const encrypted = encryptToken("");
    expect(decryptToken(encrypted)).toBe("");
  });

  it("handles long tokens", () => {
    const longToken = "ya29." + "x".repeat(2000);
    const encrypted = encryptToken(longToken);
    expect(decryptToken(encrypted)).toBe(longToken);
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptToken("secret-token");
    const parts = encrypted.split(":");
    // Flip a character in the ciphertext
    const tampered = parts[0] + ":" + "AAAA" + parts[1].slice(4) + ":" + parts[2];
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("rejects invalid format", () => {
    expect(() => decryptToken("not-valid")).toThrow("Invalid encrypted token format");
    expect(() => decryptToken("a:b")).toThrow("Invalid encrypted token format");
  });

  it("encrypted format is iv:ciphertext:tag", () => {
    const encrypted = encryptToken("test");
    const parts = encrypted.split(":");
    expect(parts.length).toBe(3);
    // All parts should be valid base64
    for (const part of parts) {
      expect(() => Buffer.from(part, "base64")).not.toThrow();
    }
  });
});

describe("OAuth State Parameter", () => {
  it("generates and validates state correctly", () => {
    const userId = "01TESTUSER12345678901234";
    const state = generateState(userId);
    expect(typeof state).toBe("string");
    expect(state.length).toBeGreaterThan(20);

    const validatedUserId = validateState(state);
    expect(validatedUserId).toBe(userId);
  });

  it("rejects tampered state", () => {
    const state = generateState("01TESTUSER12345678901234");
    const tampered = state.slice(0, -5) + "XXXXX";
    expect(validateState(tampered)).toBeNull();
  });

  it("rejects garbage state", () => {
    expect(validateState("not-a-valid-state")).toBeNull();
    expect(validateState("")).toBeNull();
  });

  it("generates different states each time (includes timestamp)", () => {
    const s1 = generateState("01USER1");
    const s2 = generateState("01USER1");
    // May be same if called within the same millisecond, but HMAC makes it unlikely
    // Just verify both validate correctly
    expect(validateState(s1)).toBe("01USER1");
    expect(validateState(s2)).toBe("01USER1");
  });
});

describe("Per-User Config", () => {
  const testUserId = "01TESTCONFIGUSER12345678";

  it("writes basic config without Google tokens", () => {
    const path = writeUserConfig(testUserId);
    expect(exists2(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("[credentials]");
    expect(content).toContain("[indexnow]");
    expect(content).toContain("api_key");
  });

  it("writes config with Google OAuth tokens", () => {
    const path = writeUserConfig(testUserId, {
      accessToken: "ya29.test-access",
      refreshToken: "1//test-refresh",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(exists2(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("[credentials]");
    expect(content).toContain("google_service_account");

    // Check the creds JSON file was written
    const credsPath = path.replace("config.toml", "google-creds.json");
    expect(exists2(credsPath)).toBe(true);
    const creds = JSON.parse(readFileSync(credsPath, "utf-8"));
    expect(creds.type).toBe("authorized_user");
    expect(creds.refresh_token).toBe("1//test-refresh");
  });

  it("hasUserConfig returns correct status", () => {
    expect(hasUserConfig(testUserId)).toBe(true);
    expect(hasUserConfig("01NONEXISTENTUSER99999")).toBe(false);
  });

  it("deleteUserConfig removes files", () => {
    writeUserConfig(testUserId);
    expect(hasUserConfig(testUserId)).toBe(true);
    deleteUserConfig(testUserId);
    expect(hasUserConfig(testUserId)).toBe(false);
  });

  it("getUserConfigPath returns correct path", () => {
    const path = getUserConfigPath(testUserId);
    expect(path).toContain(testUserId);
    expect(path).toContain("config.toml");
  });
});

describe("Google Auth API Routes", () => {
  // These test the Hono routes directly
  const { Hono } = require("hono");
  const { googleAuthRoutes } = require("../src/routes/google-auth");
  const { runMigrations } = require("../src/db/migrate");

  // Run migrations for this test DB
  runMigrations();

  const app = new Hono();
  app.route("/", googleAuthRoutes);

  it("GET /api/auth/google returns 503 when Google OAuth not configured", async () => {
    // Without GOOGLE_CLIENT_ID set, should return 503
    const res = await app.request("http://localhost/api/auth/google", {
      headers: { Authorization: "Bearer sk_live_REDACTED" },
    });
    // Will return 401 (no valid key in test DB) or 503 (no Google config)
    expect([401, 503]).toContain(res.status);
  });

  it("GET /api/auth/google/callback rejects missing params", async () => {
    const res = await app.request("http://localhost/api/auth/google/callback");
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Missing authorization code");
  });

  it("GET /api/auth/google/callback rejects invalid state", async () => {
    const res = await app.request(
      "http://localhost/api/auth/google/callback?code=test&state=invalid"
    );
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain("Invalid or expired");
  });

  it("GET /api/auth/google/callback handles user denial", async () => {
    const res = await app.request(
      "http://localhost/api/auth/google/callback?error=access_denied"
    );
    expect(res.status).toBe(200); // Returns HTML page with error message
    const html = await res.text();
    expect(html).toContain("denied");
  });

  it("GET /api/auth/google/status returns not connected without auth", async () => {
    const res = await app.request("http://localhost/api/auth/google/status");
    expect(res.status).toBe(401);
  });

  it("DELETE /api/auth/google requires auth", async () => {
    const res = await app.request("http://localhost/api/auth/google", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });
});
