import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { timingSafeEqual } from "crypto";
import { db, schema } from "../db/index";
import { checkIpRateLimit, getClientIp } from "../middleware/rate-limit-ip";
import {
  generateResetToken,
  hashResetToken,
  verifyResetToken,
  buildResetUrl,
  sendResetEmail,
} from "../auth/password-reset";
import { config } from "../config";

export const passwordResetRoutes = new Hono();

/**
 * POST /api/auth/forgot-password
 * Sends a password reset email.
 * Always returns 200 to prevent email enumeration.
 */
passwordResetRoutes.post("/api/auth/forgot-password", async (c) => {
  const body = await c.req.json<{ email?: string }>().catch(() => ({}));

  if (!body.email || !body.email.includes("@") || body.email.length < 5) {
    return c.json({ error: "Valid email is required" }, 400);
  }

  const email = body.email.toLowerCase().trim();

  // IP rate limit AFTER validation (3 per hour — tighter than signup)
  const ip = getClientIp(c);
  const { allowed, retryAfterMs } = checkIpRateLimit(`forgot:${ip}`, 3, 60 * 60 * 1000);
  if (!allowed) {
    c.header("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    return c.json({ error: "Too many reset requests. Try again later." }, 429);
  }

  // Always return success — prevents email enumeration
  const genericResponse = {
    message: "If an account with that email exists, a reset link has been sent.",
  };

  // Find user
  const user = db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)
    .all()[0];

  if (!user) {
    return c.json(genericResponse);
  }

  // Generate reset token
  const { token } = generateResetToken(user.id, user.email);

  // Store hashed token + timestamp
  db.update(schema.users)
    .set({
      resetToken: hashResetToken(token),
      resetSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id))
    .run();

  // Send email (async, don't block response)
  const resetUrl = buildResetUrl(user.id, token);
  sendResetEmail(user.email, resetUrl).catch((err) => {
    console.error("Failed to send reset email:", err);
  });

  return c.json(genericResponse);
});

/**
 * GET /reset-password — Password reset form page
 * Validates token before showing form (don't show form for expired/invalid links).
 */
passwordResetRoutes.get("/reset-password", (c) => {
  const uid = c.req.query("uid") || "";
  const token = c.req.query("token") || "";

  if (!uid || !token) {
    return c.html(resetResultHtml("Invalid reset link", "The link is missing required parameters.", false));
  }

  // Find user
  const user = db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      resetToken: schema.users.resetToken,
    })
    .from(schema.users)
    .where(eq(schema.users.id, uid))
    .limit(1)
    .all()[0];

  if (!user || !user.resetToken) {
    return c.html(resetResultHtml("Invalid reset link", "This link is invalid or has already been used.", false));
  }

  // Verify token HMAC + expiry
  const { valid, expired } = verifyResetToken(token, user.id, user.email);

  if (!valid) {
    return c.html(resetResultHtml("Invalid reset link", "This link is invalid.", false));
  }

  if (expired) {
    return c.html(resetResultHtml("Link expired", "This reset link has expired. Please request a new one.", false));
  }

  // Also verify stored hash matches (reject superseded tokens)
  const tokenHash = hashResetToken(token);
  if (tokenHash !== user.resetToken) {
    return c.html(resetResultHtml("Invalid reset link", "This link has been superseded by a newer reset request.", false));
  }

  // Show reset form
  return c.html(resetFormHtml(uid, token));
});

/**
 * POST /api/auth/reset-password
 * Resets the password with a valid token.
 */
passwordResetRoutes.post("/api/auth/reset-password", async (c) => {
  const ct = c.req.header("Content-Type") || "";
  if (!ct.includes("application/json")) {
    return c.json({ error: "Content-Type must be application/json" }, 415);
  }

  const body = await c.req.json<{ uid?: string; token?: string; password?: string }>().catch(() => ({}));

  if (!body.uid || !body.token || !body.password) {
    return c.json({ error: "uid, token, and password are required" }, 400);
  }

  if (body.password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  // IP rate limit (5 attempts per hour)
  const ip = getClientIp(c);
  const { allowed, retryAfterMs } = checkIpRateLimit(`reset:${ip}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    c.header("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    return c.json({ error: "Too many reset attempts. Try again later." }, 429);
  }

  // Find user
  const user = db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      resetToken: schema.users.resetToken,
    })
    .from(schema.users)
    .where(eq(schema.users.id, body.uid))
    .limit(1)
    .all()[0];

  if (!user || !user.resetToken) {
    return c.json({ error: "Invalid or expired reset link" }, 400);
  }

  // Verify stored hash matches
  const tokenHash = hashResetToken(body.token);
  const storedHash = Buffer.from(user.resetToken, "hex");
  const providedHash = Buffer.from(tokenHash, "hex");
  if (storedHash.length !== providedHash.length || !timingSafeEqual(storedHash, providedHash)) {
    return c.json({ error: "Invalid or expired reset link" }, 400);
  }

  // Verify HMAC + expiry
  const { valid, expired } = verifyResetToken(body.token, user.id, user.email);

  if (!valid) {
    return c.json({ error: "Invalid or expired reset link" }, 400);
  }

  if (expired) {
    // Clear token
    db.update(schema.users)
      .set({ resetToken: null, resetSentAt: null, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id))
      .run();
    return c.json({ error: "Reset link has expired. Please request a new one." }, 400);
  }

  // Hash new password
  const newPasswordHash = await Bun.password.hash(body.password, { algorithm: "bcrypt" });

  // Update password + clear reset token (single-use)
  db.update(schema.users)
    .set({
      passwordHash: newPasswordHash,
      resetToken: null,
      resetSentAt: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id))
    .run();

  return c.json({
    message: "Password reset successfully. You can now log in.",
  });
});

// ── HTML Helpers ──

function resetFormHtml(uid: string, token: string): string {
  // HTML-escape values to prevent XSS (same pattern as verification.ts)
  const safeUid = escapeHtml(uid);
  const safeToken = escapeHtml(token);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password — seomcp.dev</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
          colors: {
            brand: { 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' },
            surface: { 900: '#0f172a', 800: '#1e293b', 700: '#334155' },
          }
        }
      }
    }
  </script>
  <style>
    body { background: #0f172a; }
    .gradient-text {
      background: linear-gradient(135deg, #0ea5e9, #38bdf8, #7dd3fc);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
  </style>
</head>
<body class="font-sans antialiased min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <a href="/" class="inline-flex items-center gap-2 text-xl font-bold">
        <span class="text-2xl">🔍</span>
        <span class="gradient-text">seomcp</span><span class="text-slate-400">.dev</span>
      </a>
      <p class="text-slate-500 text-sm mt-2">Set your new password</p>
    </div>

    <div class="bg-surface-800 rounded-2xl border border-white/5 p-8">
      <form id="reset-form" onsubmit="handleReset(event)">
        <input type="hidden" id="uid" value="${safeUid}">
        <input type="hidden" id="token" value="${safeToken}">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
            <input type="password" id="password" required autocomplete="new-password" placeholder="••••••••" minlength="8"
              class="w-full px-4 py-2.5 bg-surface-900 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
            <input type="password" id="confirm-password" required autocomplete="new-password" placeholder="••••••••" minlength="8"
              class="w-full px-4 py-2.5 bg-surface-900 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition text-sm">
          </div>

          <div id="error" class="hidden text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3"></div>
          <div id="success" class="hidden text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg p-3"></div>

          <button type="submit" id="submit-btn"
            class="w-full py-2.5 text-sm font-semibold rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition disabled:opacity-50 disabled:cursor-not-allowed">
            Reset Password
          </button>
        </div>
      </form>
    </div>

    <div class="text-center mt-6">
      <a href="/dashboard/login" class="text-sm text-slate-500 hover:text-slate-400 transition">← Back to login</a>
    </div>
  </div>

  <script>
    async function handleReset(e) {
      e.preventDefault();
      const btn = document.getElementById('submit-btn');
      const errEl = document.getElementById('error');
      const successEl = document.getElementById('success');
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm-password').value;
      const uid = document.getElementById('uid').value;
      const token = document.getElementById('token').value;

      errEl.classList.add('hidden');
      successEl.classList.add('hidden');

      if (password !== confirm) {
        errEl.textContent = 'Passwords do not match.';
        errEl.classList.remove('hidden');
        return;
      }

      if (password.length < 8) {
        errEl.textContent = 'Password must be at least 8 characters.';
        errEl.classList.remove('hidden');
        return;
      }

      btn.textContent = 'Resetting...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, token, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Reset failed');
        }

        successEl.textContent = 'Password reset! Redirecting to login...';
        successEl.classList.remove('hidden');
        document.getElementById('reset-form').style.display = 'none';
        setTimeout(() => { window.location.href = '/dashboard/login'; }, 2000);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
        btn.textContent = 'Reset Password';
        btn.disabled = false;
      }
    }

    document.getElementById('password').focus();
  </script>
</body>
</html>`;
}

function resetResultHtml(title: string, message: string, success: boolean): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const colorClass = success ? "text-green-400" : "text-red-400";
  const bgClass = success ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle} — seomcp.dev</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
          colors: {
            brand: { 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' },
            surface: { 900: '#0f172a', 800: '#1e293b', 700: '#334155' },
          }
        }
      }
    }
  </script>
  <style>body { background: #0f172a; }</style>
</head>
<body class="font-sans antialiased min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm text-center">
    <div class="bg-surface-800 rounded-2xl border border-white/5 p-8">
      <div class="${colorClass} ${bgClass} border rounded-lg p-4 mb-6">
        <h2 class="font-semibold text-lg mb-1">${safeTitle}</h2>
        <p class="text-sm opacity-80">${safeMessage}</p>
      </div>
      <a href="/forgot-password" class="text-brand-400 text-sm hover:underline">Request a new reset link</a>
      <span class="text-slate-600 mx-2">·</span>
      <a href="/dashboard/login" class="text-slate-400 text-sm hover:underline">Back to login</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * GET /forgot-password — Forgot password form page
 */
passwordResetRoutes.get("/forgot-password", (c) => {
  return c.html(forgotPasswordFormHtml());
});

function forgotPasswordFormHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forgot Password — seomcp.dev</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
          colors: {
            brand: { 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' },
            surface: { 900: '#0f172a', 800: '#1e293b', 700: '#334155' },
          }
        }
      }
    }
  </script>
  <style>
    body { background: #0f172a; }
    .gradient-text {
      background: linear-gradient(135deg, #0ea5e9, #38bdf8, #7dd3fc);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
  </style>
</head>
<body class="font-sans antialiased min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <a href="/" class="inline-flex items-center gap-2 text-xl font-bold">
        <span class="text-2xl">🔍</span>
        <span class="gradient-text">seomcp</span><span class="text-slate-400">.dev</span>
      </a>
      <p class="text-slate-500 text-sm mt-2">Reset your password</p>
    </div>

    <div class="bg-surface-800 rounded-2xl border border-white/5 p-8">
      <form id="forgot-form" onsubmit="handleForgot(event)">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input type="email" id="email" required autocomplete="email" placeholder="you@example.com"
              class="w-full px-4 py-2.5 bg-surface-900 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition text-sm">
          </div>

          <div id="error" class="hidden text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3"></div>
          <div id="success" class="hidden text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg p-3"></div>

          <button type="submit" id="submit-btn"
            class="w-full py-2.5 text-sm font-semibold rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition disabled:opacity-50 disabled:cursor-not-allowed">
            Send Reset Link
          </button>
        </div>
      </form>
    </div>

    <div class="text-center mt-6 space-y-2">
      <p class="text-sm text-slate-500">
        Remember your password?
        <a href="/dashboard/login" class="text-brand-400 hover:underline">Sign in →</a>
      </p>
      <p class="text-xs text-slate-600">
        <a href="/" class="hover:text-slate-400 transition">← Back to home</a>
      </p>
    </div>
  </div>

  <script>
    async function handleForgot(e) {
      e.preventDefault();
      const btn = document.getElementById('submit-btn');
      const errEl = document.getElementById('error');
      const successEl = document.getElementById('success');
      const email = document.getElementById('email').value.trim();

      errEl.classList.add('hidden');
      successEl.classList.add('hidden');
      btn.textContent = 'Sending...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Request failed');
        }

        successEl.textContent = 'If an account with that email exists, a reset link has been sent. Check your inbox.';
        successEl.classList.remove('hidden');
        document.getElementById('forgot-form').querySelector('button').style.display = 'none';
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      } finally {
        btn.textContent = 'Send Reset Link';
        btn.disabled = false;
      }
    }

    document.getElementById('email').focus();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
