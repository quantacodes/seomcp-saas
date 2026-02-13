/**
 * /playground — Interactive demo page.
 * Lets visitors try 3 free tools (crawl_page, validate_schema, core_web_vitals)
 * without signing up. Uses a shared demo pool with per-IP rate limiting.
 */

import { Hono } from "hono";
import { BinaryInstance } from "../mcp/binary";
import { config } from "../config";
import type { JsonRpcResponse } from "../types";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export const playgroundRoutes = new Hono();

// ── Demo rate limiting (per IP) ──
const demoLimits = new Map<string, { count: number; resetAt: number }>();
const DEMO_MAX_CALLS = 5; // 5 calls per hour per IP
const DEMO_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkDemoRate(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = demoLimits.get(ip);

  if (!record || now > record.resetAt) {
    demoLimits.set(ip, { count: 1, resetAt: now + DEMO_WINDOW_MS });
    return { allowed: true, remaining: DEMO_MAX_CALLS - 1 };
  }

  if (record.count >= DEMO_MAX_CALLS) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: DEMO_MAX_CALLS - record.count };
}

// Cleanup expired entries every 30 min
const demoCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of demoLimits) {
    if (now > record.resetAt) demoLimits.delete(key);
  }
}, 30 * 60 * 1000);

// Allow cleanup on shutdown
export function stopDemoCleanup() {
  clearInterval(demoCleanupTimer);
  if (demoBinary) {
    demoBinary.kill();
    demoBinary = null;
  }
}

// Allowed demo tools (free tools that don't need Google OAuth)
const DEMO_TOOLS = new Set(["crawl_page", "validate_schema", "core_web_vitals"]);

/**
 * Check if a hostname is private/internal (SSRF protection).
 * Covers: IPv4 private, IPv6 loopback, link-local, cloud metadata.
 */
function isPrivateHost(host: string): boolean {
  // Exact matches
  const BLOCKED_EXACT = new Set([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",                          // IPv6 loopback
    "::",                           // IPv6 any
    "0:0:0:0:0:0:0:1",             // IPv6 loopback long form
    "0:0:0:0:0:0:0:0",             // IPv6 any long form
    "metadata.google.internal",
  ]);

  if (BLOCKED_EXACT.has(host)) return true;

  // Prefix checks (IPv4 private ranges)
  if (
    host.startsWith("10.") ||           // 10.0.0.0/8
    host.startsWith("192.168.") ||      // 192.168.0.0/16
    host.startsWith("169.254.")         // Link-local / AWS/Azure metadata
  ) {
    return true;
  }

  // 172.16.0.0/12 = 172.16.x – 172.31.x
  if (host.startsWith("172.")) {
    const second = parseInt(host.split(".")[1], 10);
    if (!isNaN(second) && second >= 16 && second <= 31) return true;
  }

  // Suffix checks
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;

  return false;
}

// Shared demo binary instance (no user-specific config)
let demoBinary: BinaryInstance | null = null;

function getDemoConfigPath(): string {
  const dir = "/tmp/seo-mcp-saas/__demo__";
  const configPath = join(dir, "config.toml");
  const credsPath = join(dir, "google-creds.json");

  if (!existsSync(configPath)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(credsPath, "{}", { encoding: "utf-8", mode: 0o600 });
    const toml = `# Demo config for playground\n[credentials]\ngoogle_service_account = "${credsPath}"\n\n[indexnow]\napi_key = "seo-mcp-saas-demo-key"\nkey_location = ""\n`;
    writeFileSync(configPath, toml, "utf-8");
  }

  return configPath;
}

async function getDemoBinary(): Promise<BinaryInstance> {
  if (demoBinary && demoBinary.isAlive) {
    return demoBinary;
  }
  const configPath = getDemoConfigPath();
  demoBinary = new BinaryInstance(configPath, () => {
    demoBinary = null;
  });
  await demoBinary.ensureReady();
  return demoBinary;
}

// ── API endpoint: execute demo tool ──
playgroundRoutes.post("/api/playground/run", async (c) => {
  const ip =
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
    c.req.header("X-Real-IP") ||
    "unknown";

  // Parse body first (validation before rate limiting — don't burn quota on bad requests)
  let body: { tool?: string; args?: Record<string, unknown> };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { tool, args } = body;

  if (!tool || typeof tool !== "string") {
    return c.json({ error: "Missing 'tool' field" }, 400);
  }

  if (!DEMO_TOOLS.has(tool)) {
    return c.json(
      {
        error: `Tool '${tool}' is not available in the demo. Available: ${[...DEMO_TOOLS].join(", ")}`,
        hint: "Sign up free to access all 35 tools.",
      },
      403,
    );
  }

  // Validate args
  if (tool === "crawl_page" && (!args?.url || typeof args.url !== "string")) {
    return c.json({ error: "crawl_page requires a 'url' argument" }, 400);
  }
  if (tool === "validate_schema" && !args?.url && !args?.schema) {
    return c.json({ error: "validate_schema requires a 'url' or 'schema' argument" }, 400);
  }
  if (tool === "core_web_vitals" && (!args?.url || typeof args.url !== "string")) {
    return c.json({ error: "core_web_vitals requires a 'url' argument" }, 400);
  }

  // URL validation — block localhost / private IPs
  if (args?.url && typeof args.url === "string") {
    try {
      const parsed = new URL(args.url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return c.json({ error: "URL must use http:// or https://" }, 400);
      }
      const hostname = parsed.hostname.toLowerCase();
      // Strip IPv6 brackets if present
      const bareHost = hostname.startsWith("[") && hostname.endsWith("]")
        ? hostname.slice(1, -1)
        : hostname;

      if (isPrivateHost(bareHost)) {
        return c.json({ error: "Cannot scan private/local URLs" }, 400);
      }
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }
  }

  // Rate limit — checked AFTER validation so invalid requests don't burn quota
  const rateCheck = checkDemoRate(ip);
  if (!rateCheck.allowed) {
    return c.json(
      {
        error: "Demo rate limit reached (5 calls/hour). Sign up for free to get 50 calls/month.",
        signupUrl: "/#pricing",
      },
      429,
    );
  }

  try {
    const binary = await getDemoBinary();
    const startTime = Date.now();

    const response: JsonRpcResponse = await binary.send({
      jsonrpc: "2.0",
      id: `demo-${Date.now()}`,
      method: "tools/call",
      params: { name: tool, arguments: args || {} },
    });

    const durationMs = Date.now() - startTime;

    if (response.error) {
      return c.json(
        {
          success: false,
          error: response.error.message,
          durationMs,
          remaining: rateCheck.remaining,
        },
        500,
      );
    }

    return c.json({
      success: true,
      result: response.result,
      durationMs,
      remaining: rateCheck.remaining,
      tool,
    });
  } catch (err) {
    // Reset demo binary state on crash
    demoBinary = null;
    return c.json(
      {
        success: false,
        error: "Demo engine temporarily unavailable. Try again in a moment.",
        remaining: rateCheck.remaining,
      },
      503,
    );
  }
});

// ── Playground HTML page ──
playgroundRoutes.get("/playground", (c) => {
  return c.html(getPlaygroundHtml());
});

let cachedPlaygroundHtml: string | null = null;
const isDev = process.env.NODE_ENV !== "production";

function getPlaygroundHtml(): string {
  if (!isDev && cachedPlaygroundHtml) return cachedPlaygroundHtml;
  cachedPlaygroundHtml = renderPlaygroundPage();
  return cachedPlaygroundHtml;
}

function renderPlaygroundPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Playground — Try SEO MCP Tools Live | seomcp.dev</title>
  <meta name="description" content="Try SEO MCP tools live in your browser. Crawl pages, validate schema, check Core Web Vitals — no signup required.">
  <meta property="og:title" content="Playground — Try SEO MCP Tools Live">
  <meta property="og:description" content="Test-drive 35 SEO tools for AI agents. No signup required.">
  <meta property="og:url" content="https://seomcp.dev/playground">
  <link rel="canonical" href="https://seomcp.dev/playground">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0a0a0f; --card: #12121a; --border: #1e1e2e;
      --text: #e0e0e0; --muted: #888; --accent: #6366f1;
      --green: #22c55e; --blue: #3b82f6; --orange: #f59e0b;
      --red: #ef4444;
    }
    body { font-family: -apple-system, 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; padding: 2rem; }

    /* Header */
    .back { display: inline-block; color: var(--accent); text-decoration: none; margin-bottom: 1rem; font-size: 0.9rem; }
    .back:hover { text-decoration: underline; }
    header { margin-bottom: 2rem; }
    header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    header h1 span { color: var(--accent); }
    header p { color: var(--muted); }
    .limits { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; padding: 0.4rem 0.8rem; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); border-radius: 8px; font-size: 0.85rem; }
    .limits .dot { width: 8px; height: 8px; background: var(--green); border-radius: 50%; }

    /* Tool selector */
    .tools { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
    .tool-btn { background: var(--card); border: 2px solid var(--border); border-radius: 12px; padding: 1rem; cursor: pointer; transition: all 0.2s; text-align: center; }
    .tool-btn:hover { border-color: var(--accent); transform: translateY(-1px); }
    .tool-btn.active { border-color: var(--accent); background: rgba(99,102,241,0.1); }
    .tool-btn .icon { font-size: 1.5rem; display: block; margin-bottom: 0.4rem; }
    .tool-btn .name { font-weight: 600; font-size: 0.9rem; }
    .tool-btn .desc { font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem; }

    /* Input area */
    .input-area { margin-bottom: 1.5rem; }
    .input-area label { display: block; font-size: 0.85rem; color: var(--muted); margin-bottom: 0.4rem; font-weight: 500; }
    .input-row { display: flex; gap: 0.75rem; }
    .input-row input { flex: 1; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; color: var(--text); font-size: 1rem; font-family: 'SF Mono', 'Fira Code', monospace; outline: none; transition: border-color 0.2s; }
    .input-row input:focus { border-color: var(--accent); }
    .input-row input::placeholder { color: #555; }
    .run-btn { background: var(--accent); color: white; border: none; border-radius: 8px; padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
    .run-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.4); }
    .run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .run-btn.loading { position: relative; color: transparent; }
    .run-btn.loading::after { content: ''; position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; margin: -10px 0 0 -10px; border: 2px solid transparent; border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }

    /* Extra inputs */
    .extra-inputs { margin-top: 0.75rem; }
    .extra-inputs select { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 0.75rem; color: var(--text); font-size: 0.9rem; outline: none; }

    /* Results */
    .result-area { min-height: 200px; }
    .result-placeholder { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 3rem; text-align: center; color: var(--muted); }
    .result-placeholder .big-icon { font-size: 3rem; margin-bottom: 1rem; }
    .result-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .result-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); }
    .result-header .tool-name { font-weight: 600; }
    .result-header .meta { display: flex; gap: 1rem; font-size: 0.8rem; color: var(--muted); }
    .result-header .meta .duration { color: var(--green); }
    .result-header .meta .remaining { color: var(--orange); }
    .result-body { padding: 1.25rem; }
    .result-body pre { background: #0d0d14; border: 1px solid var(--border); border-radius: 8px; padding: 1rem; overflow-x: auto; max-height: 600px; overflow-y: auto; font-size: 0.85rem; line-height: 1.5; }
    .result-body pre code { color: var(--text); font-family: 'SF Mono', 'Fira Code', monospace; }
    .result-error { padding: 1.25rem; }
    .result-error .error-msg { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 1rem; color: var(--red); }

    /* CTA */
    .cta { text-align: center; padding: 2rem; background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.05)); border: 1px solid rgba(99,102,241,0.2); border-radius: 16px; margin-top: 2rem; }
    .cta h3 { font-size: 1.3rem; margin-bottom: 0.5rem; }
    .cta p { color: var(--muted); margin-bottom: 1rem; font-size: 0.95rem; }
    .cta a { display: inline-block; background: var(--accent); color: white; padding: 0.6rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; transition: all 0.2s; }
    .cta a:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }

    /* Footer */
    footer { text-align: center; padding: 2rem 0; color: var(--muted); font-size: 0.85rem; border-top: 1px solid var(--border); margin-top: 2rem; }
    footer a { color: var(--accent); text-decoration: none; }

    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 640px) {
      .tools { grid-template-columns: 1fr; }
      .input-row { flex-direction: column; }
      .container { padding: 1rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back">← Back to seomcp.dev</a>

    <header>
      <h1>🧪 <span>Playground</span></h1>
      <p>Try SEO MCP tools live — no signup required. Enter a URL and see real results.</p>
      <div class="limits">
        <span class="dot"></span>
        <span id="remaining">5 free calls remaining this hour</span>
      </div>
    </header>

    <!-- Tool selector -->
    <div class="tools">
      <button class="tool-btn active" data-tool="crawl_page" onclick="selectTool(this)">
        <span class="icon">🔍</span>
        <span class="name">Crawl Page</span>
        <span class="desc">Deep-analyze any page</span>
      </button>
      <button class="tool-btn" data-tool="validate_schema" onclick="selectTool(this)">
        <span class="icon">🏗️</span>
        <span class="name">Validate Schema</span>
        <span class="desc">Check JSON-LD markup</span>
      </button>
      <button class="tool-btn" data-tool="core_web_vitals" onclick="selectTool(this)">
        <span class="icon">⚡</span>
        <span class="name">Core Web Vitals</span>
        <span class="desc">PageSpeed + LCP/CLS/INP</span>
      </button>
    </div>

    <!-- Input -->
    <div class="input-area">
      <label id="input-label">Enter a URL to crawl</label>
      <div class="input-row">
        <input type="url" id="url-input" placeholder="https://example.com" autocomplete="url" spellcheck="false">
        <button class="run-btn" id="run-btn" onclick="runTool()">Run →</button>
      </div>
      <div class="extra-inputs" id="extra-inputs" style="display: none;">
        <label style="margin-bottom: 0.3rem;">Strategy</label>
        <select id="strategy-select">
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
        </select>
      </div>
    </div>

    <!-- Results -->
    <div class="result-area" id="result-area">
      <div class="result-placeholder">
        <div class="big-icon">🔬</div>
        <p>Results will appear here.<br>Pick a tool and enter a URL to get started.</p>
      </div>
    </div>

    <!-- CTA -->
    <div class="cta">
      <h3>Like what you see?</h3>
      <p>Sign up free for 50 calls/month. Connect Google OAuth to unlock GSC + GA4 tools.</p>
      <a href="/#pricing">Get Started Free →</a>
    </div>

    <footer>
      <a href="/">seomcp.dev</a> · <a href="/tools">All 35 Tools</a> · <a href="/docs">Docs</a>
    </footer>
  </div>

  <script>
    let selectedTool = 'crawl_page';
    let isRunning = false;

    const labels = {
      crawl_page: 'Enter a URL to crawl',
      validate_schema: 'Enter a URL to validate its JSON-LD schema',
      core_web_vitals: 'Enter a URL to check Core Web Vitals',
    };

    const placeholders = {
      crawl_page: 'https://example.com',
      validate_schema: 'https://example.com',
      core_web_vitals: 'https://example.com',
    };

    function selectTool(btn) {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTool = btn.dataset.tool;
      document.getElementById('input-label').textContent = labels[selectedTool];
      document.getElementById('url-input').placeholder = placeholders[selectedTool];

      // Show/hide strategy selector for CWV
      document.getElementById('extra-inputs').style.display =
        selectedTool === 'core_web_vitals' ? 'block' : 'none';
    }

    async function runTool() {
      if (isRunning) return;

      const url = document.getElementById('url-input').value.trim();
      if (!url) {
        document.getElementById('url-input').focus();
        return;
      }

      // Basic URL validation
      try {
        new URL(url);
      } catch {
        showError('Please enter a valid URL (e.g. https://example.com)');
        return;
      }

      const btn = document.getElementById('run-btn');
      btn.classList.add('loading');
      btn.disabled = true;
      isRunning = true;

      // Build args
      const args = { url };
      if (selectedTool === 'core_web_vitals') {
        args.strategy = document.getElementById('strategy-select').value;
      }

      try {
        const res = await fetch('/api/playground/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: selectedTool, args }),
        });

        const data = await res.json();

        if (!res.ok) {
          showError(data.error || 'Something went wrong');
          if (data.remaining !== undefined) updateRemaining(data.remaining);
          return;
        }

        showResult(data);
        updateRemaining(data.remaining);
      } catch (err) {
        showError('Network error. Please try again.');
      } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
        isRunning = false;
      }
    }

    function showResult(data) {
      const area = document.getElementById('result-area');
      const resultContent = data.result?.content?.[0]?.text || JSON.stringify(data.result, null, 2);

      // Try to format as JSON for pretty display
      let formattedContent;
      try {
        const parsed = JSON.parse(resultContent);
        formattedContent = JSON.stringify(parsed, null, 2);
      } catch {
        formattedContent = resultContent;
      }

      area.innerHTML = \`
        <div class="result-card">
          <div class="result-header">
            <span class="tool-name">\${data.tool}</span>
            <div class="meta">
              <span class="duration">⚡ \${data.durationMs}ms</span>
              <span class="remaining">🎟️ \${data.remaining} calls left</span>
            </div>
          </div>
          <div class="result-body">
            <pre><code>\${escapeHtml(formattedContent)}</code></pre>
          </div>
        </div>
      \`;
    }

    function showError(msg) {
      const area = document.getElementById('result-area');
      area.innerHTML = \`
        <div class="result-card">
          <div class="result-error">
            <div class="error-msg">❌ \${escapeHtml(msg)}</div>
          </div>
        </div>
      \`;
    }

    function updateRemaining(n) {
      document.getElementById('remaining').textContent =
        n === 0 ? 'No calls remaining — sign up for more!' : \`\${n} free call\${n === 1 ? '' : 's'} remaining this hour\`;
    }

    function escapeHtml(s) {
      const el = document.createElement('div');
      el.textContent = s;
      return el.innerHTML;
    }

    // Enter key to run
    document.getElementById('url-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runTool();
    });
  </script>
</body>
</html>`;
}
