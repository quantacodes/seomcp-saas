import { createHmac, timingSafeEqual } from "crypto";
import { config } from "../config";

/**
 * Generate a verification token for email verification.
 * Token = HMAC-SHA256(userId:email:timestamp, secret)
 * Returns { token, expiresAt }
 */
export function generateVerificationToken(
  userId: string,
  email: string,
): { token: string; expiresAt: number } {
  const timestamp = Date.now();
  const payload = `${userId}:${email}:${timestamp}`;
  const hmac = createHmac("sha256", config.jwtSecret)
    .update(payload)
    .digest("hex");
  // Token format: timestamp.hmac (allows extraction without DB lookup)
  const token = `${timestamp}.${hmac}`;
  const expiresAt = timestamp + 24 * 60 * 60 * 1000; // 24 hours
  return { token, expiresAt };
}

/**
 * Verify a verification token.
 * Returns { valid, expired } — valid means HMAC matches, expired means past 24h.
 */
export function verifyToken(
  token: string,
  userId: string,
  email: string,
): { valid: boolean; expired: boolean } {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, expired: false };

  const [timestampStr, receivedHmac] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return { valid: false, expired: false };

  // Recompute HMAC
  const payload = `${userId}:${email}:${timestamp}`;
  const expectedHmac = createHmac("sha256", config.jwtSecret)
    .update(payload)
    .digest("hex");

  // Timing-safe comparison
  const a = Buffer.from(receivedHmac, "hex");
  const b = Buffer.from(expectedHmac, "hex");
  if (a.length !== b.length) return { valid: false, expired: false };
  const valid = timingSafeEqual(a, b);

  // Check expiry (24 hours)
  const expired = Date.now() - timestamp > 24 * 60 * 60 * 1000;

  return { valid, expired };
}

/**
 * Build the verification URL.
 */
export function buildVerificationUrl(userId: string, token: string): string {
  const base = config.baseUrl;
  return `${base}/verify?uid=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
}

/**
 * Send verification email via Resend API.
 * Falls back to console logging if RESEND_API_KEY is not set.
 * Returns true if sent successfully (or logged).
 */
export async function sendVerificationEmail(
  email: string,
  verificationUrl: string,
): Promise<boolean> {
  if (!config.resendApiKey) {
    console.log(`📧 Verification email for ${email}: ${verificationUrl}`);
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.resendFromEmail,
        to: email,
        subject: "Verify your email — SEO MCP",
        html: verificationEmailHtml(verificationUrl),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Failed to send verification email: ${res.status} ${err}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Verification email send error:", err);
    return false;
  }
}

/**
 * Send welcome email after verification.
 */
export async function sendWelcomeEmail(email: string): Promise<boolean> {
  if (!config.resendApiKey) {
    console.log(`📧 Welcome email for ${email}`);
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.resendFromEmail,
        to: email,
        subject: "Welcome to SEO MCP 🔍",
        html: welcomeEmailHtml(),
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

function verificationEmailHtml(url: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px 20px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155;">
    <h1 style="color:#38bdf8;font-size:24px;margin:0 0 8px;">🔍 SEO MCP</h1>
    <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 24px;">Verify your email</h2>
    <p style="color:#94a3b8;line-height:1.6;margin:0 0 24px;">
      Click the button below to verify your email and unlock your full free tier (50 tool calls/month).
    </p>
    <a href="${url}" style="display:inline-block;background:#38bdf8;color:#0f172a;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;">
      Verify Email
    </a>
    <p style="color:#64748b;font-size:13px;margin:24px 0 0;">
      This link expires in 24 hours. If you didn't sign up for SEO MCP, ignore this email.
    </p>
  </div>
</body>
</html>`;
}

function welcomeEmailHtml(): string {
  const base = config.baseUrl;
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px 20px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155;">
    <h1 style="color:#38bdf8;font-size:24px;margin:0 0 8px;">🔍 SEO MCP</h1>
    <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 24px;">You're verified! ✅</h2>
    <p style="color:#94a3b8;line-height:1.6;margin:0 0 16px;">
      Your email is verified and you now have access to 50 tool calls per month on the free tier.
    </p>
    <h3 style="color:#f1f5f9;font-size:15px;margin:0 0 12px;">Quick Start</h3>
    <ol style="color:#94a3b8;line-height:1.8;padding-left:20px;margin:0 0 24px;">
      <li>Add the MCP config to your AI tool (<a href="${base}/docs" style="color:#38bdf8;">docs</a>)</li>
      <li>Connect your Google Search Console (<a href="${base}/dashboard" style="color:#38bdf8;">dashboard</a>)</li>
      <li>Try a tool: <code style="background:#0f172a;padding:2px 6px;border-radius:4px;color:#38bdf8;">generate_report site_url=yoursite.com</code></li>
    </ol>
    <a href="${base}/playground" style="display:inline-block;background:#38bdf8;color:#0f172a;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;">
      Try the Playground
    </a>
    <p style="color:#64748b;font-size:13px;margin:24px 0 0;">
      Need help? Reply to this email or check the <a href="${base}/docs" style="color:#38bdf8;">docs</a>.
    </p>
  </div>
</body>
</html>`;
}
