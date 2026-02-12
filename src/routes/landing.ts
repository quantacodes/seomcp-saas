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
  cachedHtml = readFileSync(htmlPath, "utf-8");
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

// Docs placeholder
landingRoutes.get("/docs", (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation — seomcp.dev</title>
  <style>
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .container {
      text-align: center;
      max-width: 480px;
      padding: 2rem;
    }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    p { color: #94a3b8; line-height: 1.6; }
    a { color: #0ea5e9; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📚 Docs coming soon</h1>
    <p>We're writing comprehensive documentation for seomcp.dev. In the meantime, check out the <a href="/">homepage</a> for setup instructions, or <a href="mailto:hello@seomcp.dev">contact us</a> if you need help.</p>
    <p style="margin-top: 2rem;"><a href="/">← Back to home</a></p>
  </div>
</body>
</html>`);
});

export { landingRoutes };
