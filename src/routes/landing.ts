import { Hono } from "hono";

const landingRoutes = new Hono();

// API domain should NOT serve the landing page.
// Landing page lives on seomcp.dev (Cloudflare Pages).
// Root of api.seomcp.dev redirects to the main site.
landingRoutes.get("/", (c) => {
  return c.redirect("https://seomcp.dev", 302);
});

export { landingRoutes };
