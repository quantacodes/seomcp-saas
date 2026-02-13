import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import {
  verifyToken,
  buildVerificationUrl,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../auth/verification";
import { checkIpRateLimit, getClientIp } from "../middleware/rate-limit-ip";
import { config } from "../config";

export const verifyRoutes = new Hono();

/**
 * GET /verify — Email verification magic link handler
 */
verifyRoutes.get("/verify", async (c) => {
  const uid = c.req.query("uid");
  const token = c.req.query("token");

  if (!uid || !token) {
    return c.html(verificationResultHtml(false, "Invalid verification link."), 400);
  }

  // Look up user
  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, uid))
    .limit(1)
    .all()[0];

  if (!user) {
    return c.html(verificationResultHtml(false, "Account not found."), 404);
  }

  // Already verified?
  if (user.emailVerified) {
    return c.html(verificationResultHtml(true, "Your email is already verified!"));
  }

  // Check stored token matches
  if (user.verificationToken !== token) {
    return c.html(verificationResultHtml(false, "Invalid or expired verification link."), 400);
  }

  // Verify HMAC + expiry
  const { valid, expired } = verifyToken(token, user.id, user.email);

  if (!valid) {
    return c.html(verificationResultHtml(false, "Invalid verification link."), 400);
  }

  if (expired) {
    return c.html(
      verificationResultHtml(
        false,
        "This link has expired. <a href=\"/dashboard\" style=\"color:#38bdf8;\">Request a new one</a> from your dashboard.",
      ),
      410,
    );
  }

  // Verify the user
  db.update(schema.users)
    .set({
      emailVerified: true,
      verificationToken: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, uid))
    .run();

  // Send welcome email (async, don't block)
  sendWelcomeEmail(user.email).catch(() => {});

  return c.html(verificationResultHtml(true, "Your email is verified! You now have access to 50 tool calls/month."));
});

/**
 * POST /api/auth/resend-verification
 * Rate limited: 3 per hour per IP
 */
verifyRoutes.post("/api/auth/resend-verification", async (c) => {
  const body = await c.req.json<{ email?: string }>().catch(() => ({}));

  if (!body.email) {
    return c.json({ error: "email is required" }, 400);
  }

  // IP rate limit
  const ip = getClientIp(c);
  const { allowed, retryAfterMs } = checkIpRateLimit(`resend:${ip}`, 3, 60 * 60 * 1000);
  if (!allowed) {
    c.header("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    return c.json({ error: "Too many requests. Try again later." }, 429);
  }

  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, body.email.toLowerCase()))
    .limit(1)
    .all()[0];

  // Always return success (don't leak whether email exists)
  if (!user || user.emailVerified) {
    return c.json({ message: "If the email exists and is unverified, a new link has been sent." });
  }

  // Generate new token
  const { generateVerificationToken } = await import("../auth/verification");
  const { token } = generateVerificationToken(user.id, user.email);
  const url = buildVerificationUrl(user.id, token);

  // Store new token
  db.update(schema.users)
    .set({
      verificationToken: token,
      verificationSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id))
    .run();

  // Send email
  await sendVerificationEmail(user.email, url);

  return c.json({ message: "If the email exists and is unverified, a new link has been sent." });
});

function verificationResultHtml(success: boolean, message: string): string {
  const icon = success ? "✅" : "❌";
  const color = success ? "#22c55e" : "#ef4444";
  const base = config.baseUrl;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? "Email Verified" : "Verification Failed"} — SEO MCP</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #1e293b; border-radius: 16px; padding: 48px; text-align: center; max-width: 440px; border: 1px solid #334155; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { color: ${color}; font-size: 24px; margin: 0 0 12px; }
    p { color: #94a3b8; line-height: 1.6; margin: 0 0 24px; }
    a.btn { display: inline-block; background: #38bdf8; color: #0f172a; font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none; }
    a.btn:hover { background: #7dd3fc; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${success ? "Email Verified!" : "Verification Failed"}</h1>
    <p>${message}</p>
    <a class="btn" href="${base}/dashboard">${success ? "Go to Dashboard" : "Try Again"}</a>
  </div>
</body>
</html>`;
}
