import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { generateApiKey } from "../auth/keys";
import { ulid } from "../utils/ulid";
import { checkIpRateLimit, getClientIp } from "../middleware/rate-limit-ip";
import {
  generateVerificationToken,
  buildVerificationUrl,
  sendVerificationEmail,
} from "../auth/verification";

export const authRoutes = new Hono();

/**
 * POST /api/auth/signup
 * Create account + get API key in one step.
 * Sends verification email — unverified users get reduced rate limits.
 */
authRoutes.post("/api/auth/signup", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}));

  if (!body.email || !body.password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  // Validate email format (basic)
  if (!body.email.includes("@") || body.email.length < 5) {
    return c.json({ error: "Invalid email format" }, 400);
  }

  if (body.password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  // IP rate limit AFTER validation — don't burn quota on malformed requests
  const ip = getClientIp(c);
  const { allowed, retryAfterMs } = checkIpRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    c.header("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    return c.json({ error: "Too many signups. Try again later." }, 429);
  }

  // Check if email already exists
  const existing = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, body.email.toLowerCase()))
    .limit(1)
    .all()[0];

  if (existing) {
    return c.json({ error: "Email already registered" }, 409);
  }

  // Hash password
  const passwordHash = await Bun.password.hash(body.password, { algorithm: "bcrypt" });

  // Create user
  const userId = ulid();
  const now = new Date();

  // Generate verification token
  const { token: verificationToken } = generateVerificationToken(userId, body.email.toLowerCase());

  db.insert(schema.users)
    .values({
      id: userId,
      email: body.email.toLowerCase(),
      passwordHash,
      plan: "free",
      emailVerified: false,
      verificationToken,
      verificationSentAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Generate API key
  const { raw, hash, prefix } = generateApiKey();
  const keyId = ulid();

  db.insert(schema.apiKeys)
    .values({
      id: keyId,
      userId,
      keyHash: hash,
      keyPrefix: prefix,
      name: "Default",
      isActive: true,
      createdAt: now,
    })
    .run();

  // Send verification email (async, don't block signup)
  const verificationUrl = buildVerificationUrl(userId, verificationToken);
  sendVerificationEmail(body.email.toLowerCase(), verificationUrl).catch((err) => {
    console.error("Failed to send verification email:", err);
  });

  return c.json(
    {
      user: {
        id: userId,
        email: body.email.toLowerCase(),
        plan: "free",
        emailVerified: false,
      },
      apiKey: raw, // Only shown once!
      apiKeyPrefix: prefix,
      message: "Save your API key — it won't be shown again. Check your email to verify your account and unlock full limits.",
    },
    201,
  );
});

/**
 * POST /api/auth/login
 * Returns user info (no JWT for MVP — use API keys for everything).
 */
authRoutes.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}));

  if (!body.email || !body.password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  // IP rate limit AFTER validation — don't burn quota on malformed requests
  const ip = getClientIp(c);
  const { allowed, retryAfterMs } = checkIpRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!allowed) {
    c.header("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    return c.json({ error: "Too many login attempts. Try again later." }, 429);
  }

  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, body.email.toLowerCase()))
    .limit(1)
    .all()[0];

  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await Bun.password.verify(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan,
      emailVerified: user.emailVerified,
    },
  });
});
