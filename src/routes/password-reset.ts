import { Hono } from "hono";
import { config } from "../config";
import { getSignInUrl } from "../auth/clerk";

export const passwordResetRoutes = new Hono();

/**
 * Password reset is now handled by Clerk.
 * These routes redirect to Clerk's hosted pages.
 */

/**
 * POST /api/auth/forgot-password
 * Redirects to Clerk's password reset flow
 */
passwordResetRoutes.post("/api/auth/forgot-password", (c) => {
  return c.json({
    message: "Password reset is now handled through our sign-in page. Click 'Forgot password?' there.",
    redirect: getSignInUrl(`${config.baseUrl}/dashboard`),
  });
});

/**
 * GET /reset-password — Legacy password reset page
 * Redirects to Clerk sign-in (which has forgot password)
 */
passwordResetRoutes.get("/reset-password", (c) => {
  return c.redirect(getSignInUrl(`${config.baseUrl}/dashboard`));
});

/**
 * GET /forgot-password — Forgot password page
 * Redirects to Clerk sign-in (which has forgot password)
 */
passwordResetRoutes.get("/forgot-password", (c) => {
  return c.redirect(getSignInUrl(`${config.baseUrl}/dashboard`));
});
