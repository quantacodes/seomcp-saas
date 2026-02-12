import { Hono } from "hono";
import { readFileSync } from "fs";
import { join, dirname } from "path";

const landingRoutes = new Hono();

// Cache the HTML in memory (read once at startup)
let cachedHtml: string | null = null;

function getLandingHtml(): string {
  if (cachedHtml) return cachedHtml;

  // Resolve path relative to this file → ../landing/index.html
  const htmlPath = join(dirname(new URL(import.meta.url).pathname), "..", "landing", "index.html");
  try {
    cachedHtml = readFileSync(htmlPath, "utf-8");
  } catch (e) {
    console.error(`Landing page not found at ${htmlPath}:`, e);
    return `<!DOCTYPE html><html><body><h1>Landing page not found</h1><p>Expected at: ${htmlPath}</p></body></html>`;
  }
  return cachedHtml;
}

// In development, don't cache (reload on every request)
const isDev = process.env.NODE_ENV !== "production";

landingRoutes.get("/", (c) => {
  const html = isDev ? (() => {
    cachedHtml = null; // bust cache in dev
    return getLandingHtml();
  })() : getLandingHtml();

  return c.html(html);
});

// /docs is handled by docsRoutes (registered before landingRoutes in index.ts)

export { landingRoutes };
