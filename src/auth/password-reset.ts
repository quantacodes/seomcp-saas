import { createHmac, createHash, timingSafeEqual } from "crypto";
import { config } from "../config";

/**
 * Domain-separated HMAC key for password reset.
 * Different domain from email verification to prevent cross-use.
 */
function getResetKey(): Buffer {
  return createHmac("sha256", config.jwtSecret)
    .update("password-reset-v1")
    .digest();
}

/**
 * Hash a reset token for storage (same pattern as API key / verification hashing).
 * Prevents token theft from DB compromise.
 */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a password reset token.
 * Token = timestamp.HMAC-SHA256(userId:email:timestamp, resetKey)
 * Returns { token, expiresAt }
 * Expiry: 1 hour (shorter than verification — security sensitive).
 */
export function generateResetToken(
  userId: string,
  email: string,
): { token: string; expiresAt: number } {
  const timestamp = Date.now();
  const payload = `${userId}:${email}:${timestamp}`;
  const hmac = createHmac("sha256", getResetKey())
    .update(payload)
    .digest("hex");
  const token = `${timestamp}.${hmac}`;
  const expiresAt = timestamp + 60 * 60 * 1000; // 1 hour
  return { token, expiresAt };
}

/**
 * Verify a password reset token.
 * Returns { valid, expired } — valid means HMAC matches, expired means past 1h.
 */
export function verifyResetToken(
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
  const expectedHmac = createHmac("sha256", getResetKey())
    .update(payload)
    .digest("hex");

  // Timing-safe comparison
  const a = Buffer.from(receivedHmac, "hex");
  const b = Buffer.from(expectedHmac, "hex");
  if (a.length !== b.length) return { valid: false, expired: false };
  const valid = timingSafeEqual(a, b);

  // Check expiry (1 hour)
  const expired = Date.now() - timestamp > 60 * 60 * 1000;

  return { valid, expired };
}

/**
 * Build the password reset URL.
 */
export function buildResetUrl(userId: string, token: string): string {
  const base = config.baseUrl;
  return `${base}/reset-password?uid=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
}

/**
 * Send password reset email via Resend API.
 * Falls back to console logging if RESEND_API_KEY is not set.
 */
export async function sendResetEmail(
  email: string,
  resetUrl: string,
): Promise<boolean> {
  if (!config.resendApiKey) {
    console.log(`📧 Password reset for ${email}: ${resetUrl}`);
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
        subject: "Reset your password — SEO MCP",
        html: resetEmailHtml(resetUrl),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Failed to send reset email: ${res.status} ${err}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Reset email send error:", err);
    return false;
  }
}

function resetEmailHtml(url: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px 20px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155;">
    <h1 style="color:#38bdf8;font-size:24px;margin:0 0 8px;">🔍 SEO MCP</h1>
    <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 24px;">Reset your password</h2>
    <p style="color:#94a3b8;line-height:1.6;margin:0 0 24px;">
      Someone requested a password reset for your account. Click below to set a new password.
    </p>
    <a href="${url}" style="display:inline-block;background:#38bdf8;color:#0f172a;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:16px;">
      Reset Password
    </a>
    <p style="color:#64748b;font-size:13px;margin:24px 0 0;">
      This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;
}
