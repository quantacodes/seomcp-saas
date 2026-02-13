import { Hono } from "hono";
import { readFileSync } from "fs";
import { join, dirname } from "path";

export const docsRoutes = new Hono();

let cachedDocsHtml: string | null = null;
const isDev = process.env.NODE_ENV !== "production";

function getDocsHtml(): string {
  if (isDev || !cachedDocsHtml) {
    const htmlPath = join(dirname(new URL(import.meta.url).pathname), "..", "docs", "index.html");
    try {
      cachedDocsHtml = readFileSync(htmlPath, "utf-8");
    } catch (e) {
      cachedDocsHtml = `<!DOCTYPE html><html><body><h1>Docs not found</h1></body></html>`;
    }
  }
  return cachedDocsHtml!;
}

docsRoutes.get("/docs", (c) => {
  return c.html(getDocsHtml());
});

// Serve setup script: curl -fsSL https://seomcp.dev/setup | bash
let cachedSetupScript: string | null = null;

docsRoutes.get("/setup", (c) => {
  if (isDev || !cachedSetupScript) {
    const scriptPath = join(dirname(new URL(import.meta.url).pathname), "..", "..", "scripts", "setup-mcp.sh");
    try {
      cachedSetupScript = readFileSync(scriptPath, "utf-8");
    } catch {
      return c.text("# Setup script not found. Visit https://seomcp.dev/docs for manual setup.", 404);
    }
  }
  return new Response(cachedSetupScript!, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
});
