/**
 * OpenAPI 3.1 spec endpoint.
 * Auto-discoverable at /openapi.json
 */

import { Hono } from "hono";
import { VERSION } from "../config";

export const openapiRoutes = new Hono();

const spec = {
  openapi: "3.1.0",
  info: {
    title: "SEO MCP API",
    description: "35 production SEO tools for AI agents. MCP-compliant HTTP server with API key auth, rate limiting, and Google OAuth for GSC/GA4 access.",
    version: VERSION,
    contact: { url: "https://seomcp.dev" },
    license: { name: "Proprietary" },
  },
  servers: [
    { url: "https://seomcp.dev", description: "Production" },
    { url: "http://localhost:3456", description: "Local development" },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        tags: ["System"],
        responses: {
          200: { description: "Healthy", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, version: { type: "string" } } } } } },
          503: { description: "Degraded" },
        },
      },
    },
    "/mcp": {
      post: {
        summary: "MCP Streamable HTTP endpoint",
        description: "Send JSON-RPC requests (initialize, tools/list, tools/call). Returns session ID in Mcp-Session-Id header on initialize.",
        tags: ["MCP"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["jsonrpc", "method"],
                properties: {
                  jsonrpc: { type: "string", enum: ["2.0"] },
                  id: { type: ["string", "number"] },
                  method: { type: "string", enum: ["initialize", "tools/list", "tools/call", "notifications/initialized", "ping"] },
                  params: { type: "object" },
                },
              },
              examples: {
                initialize: {
                  summary: "Initialize MCP session",
                  value: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "my-agent", version: "1.0" } } },
                },
                toolsList: {
                  summary: "List available tools",
                  value: { jsonrpc: "2.0", id: 2, method: "tools/list" },
                },
                toolCall: {
                  summary: "Call a tool",
                  value: { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "site_audit", arguments: { url: "https://example.com" } } },
                },
              },
            },
          },
        },
        parameters: [
          { name: "Mcp-Session-Id", in: "header", description: "Session ID (required for all requests after initialize)", schema: { type: "string" } },
          { name: "Accept", in: "header", description: "application/json or text/event-stream", schema: { type: "string", default: "application/json" } },
        ],
        responses: {
          200: {
            description: "JSON-RPC response",
            headers: {
              "Mcp-Session-Id": { description: "Session ID (returned on initialize)", schema: { type: "string" } },
              "X-RateLimit-Limit": { description: "Monthly call limit", schema: { type: "integer" } },
              "X-RateLimit-Remaining": { description: "Calls remaining", schema: { type: "integer" } },
              "X-RateLimit-Used": { description: "Calls used this month", schema: { type: "integer" } },
            },
          },
          400: { description: "Bad request (invalid JSON-RPC, missing session)" },
          401: { description: "Unauthorized (missing or invalid API key)" },
        },
      },
      delete: {
        summary: "Terminate MCP session",
        tags: ["MCP"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "Mcp-Session-Id", in: "header", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Session terminated" },
          400: { description: "Missing session ID" },
          404: { description: "Session not found" },
        },
      },
    },
    "/api/auth/signup": {
      post: {
        summary: "Create account",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 } } },
            },
          },
        },
        responses: {
          201: { description: "Account created with API key" },
          400: { description: "Validation error" },
          409: { description: "Email already registered" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Login",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" } } },
            },
          },
        },
        responses: {
          200: { description: "Login successful" },
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/api/keys": {
      get: {
        summary: "List API keys",
        tags: ["Keys"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "List of API keys" } },
      },
      post: {
        summary: "Create API key",
        tags: ["Keys"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" } } } } },
        },
        responses: {
          201: { description: "Key created (raw key shown once)" },
          403: { description: "Plan limit reached" },
        },
      },
    },
    "/api/usage": {
      get: {
        summary: "Usage statistics",
        tags: ["Usage"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Usage stats for current billing period" } },
      },
    },
    "/.well-known/mcp": {
      get: {
        summary: "MCP discovery",
        tags: ["System"],
        responses: { 200: { description: "MCP server metadata for auto-discovery" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API key (sk_live_...) from seomcp.dev. Sign up free at https://seomcp.dev",
      },
    },
  },
  tags: [
    { name: "MCP", description: "MCP Streamable HTTP transport" },
    { name: "Auth", description: "Authentication & accounts" },
    { name: "Keys", description: "API key management" },
    { name: "Usage", description: "Usage tracking & rate limits" },
    { name: "System", description: "Health, discovery, metadata" },
  ],
};

openapiRoutes.get("/openapi.json", (c) => {
  return c.json(spec);
});
