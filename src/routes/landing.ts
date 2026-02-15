import { Hono } from "hono";

const landingRoutes = new Hono();

// Landing page is now served by React SPA (Cloudflare Pages/Netlify)
// Backend only handles API requests
// This route just redirects to the main site

landingRoutes.get("/", (c) => {
  return c.redirect("https://seomcp.dev", 302);
});

export { landingRoutes };
