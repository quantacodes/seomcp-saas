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
