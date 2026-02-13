import { Hono } from "hono";
import { binaryPool } from "../mcp/binary";
import { sessionManager } from "../mcp/session";
import { VERSION } from "../config";
import { sqlite } from "../db/index";

export const healthRoutes = new Hono();

// Robots.txt
healthRoutes.get("/robots.txt", (c) => {
  return c.text(
    `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /api/

Sitemap: https://seomcp.dev/sitemap.xml
`,
    200,
    { "Content-Type": "text/plain; charset=utf-8" },
  );
});

// Sitemap
const BUILD_DATE = new Date().toISOString().split("T")[0]; // Set once at startup, not on every request
healthRoutes.get("/sitemap.xml", (c) => {
  const now = BUILD_DATE;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://seomcp.dev/</loc><changefreq>weekly</changefreq><priority>1.0</priority><lastmod>${now}</lastmod></url>
  <url><loc>https://seomcp.dev/tools</loc><changefreq>monthly</changefreq><priority>0.9</priority><lastmod>${now}</lastmod></url>
  <url><loc>https://seomcp.dev/docs</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${now}</lastmod></url>
  <url><loc>https://seomcp.dev/playground</loc><changefreq>monthly</changefreq><priority>0.8</priority><lastmod>${now}</lastmod></url>
</urlset>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
});

healthRoutes.get("/health", (c) => {
  // Quick DB check
  let dbOk = false;
  try {
    sqlite.prepare("SELECT 1").get();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? "ok" : "degraded";
  const statusCode = dbOk ? 200 : 503;

  const mem = process.memoryUsage();

  return c.json({
    status,
    version: VERSION,
    uptime: Math.round(process.uptime()),
    activeSessions: sessionManager.size,
    activeBinaries: binaryPool.size,
    db: dbOk ? "ok" : "error",
    memoryMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
  }, statusCode);
});
