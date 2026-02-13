import { Hono } from "hono";
import { config } from "../config";

export const verifyRoutes = new Hono();

/**
 * Email verification is now handled by Clerk.
 * These routes redirect to Clerk's hosted pages.
 */

/**
 * GET /verify — Legacy verification link handler
 * Redirects to dashboard (Clerk handles verification)
 */
verifyRoutes.get("/verify", (c) => {
  // Clerk handles email verification
  // Old verification links should redirect to dashboard
  return c.redirect("/dashboard");
});

/**
 * POST /api/auth/resend-verification
 * No longer needed — Clerk handles verification emails
 */
verifyRoutes.post("/api/auth/resend-verification", (c) => {
  return c.json({
    message: "Email verification is now handled automatically. Please check your inbox or sign in to your dashboard.",
    redirect: `${config.baseUrl}/dashboard`,
  });
});
