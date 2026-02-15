import { Link } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Docs() {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('quickstart');

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['quickstart', 'authentication', 'connection', 'tools', 'google-setup', 'limits', 'errors', 'billing'];
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 100) {
            setActiveSection(id);
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const CodeBlock = ({ code, label, id }: { code: string; label: string; id: string }) => (
    <div style={{ 
      background: 'var(--bg-surface)', 
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px',
      overflow: 'hidden',
      marginBottom: '16px'
    }}>
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-raised)'
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}</span>
        <button 
          onClick={() => copyCode(code, id)}
          style={{ color: 'var(--amber)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {copied === id ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre style={{ padding: '16px', fontSize: '13px', overflow: 'auto', fontFamily: 'var(--font-mono)', lineHeight: 1.6, margin: 0 }}>
        <code>{code}</code>
      </pre>
    </div>
  );

  const tocItems = [
    { id: 'quickstart', label: 'Quick Start' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'connection', label: 'Connection Methods' },
    { id: 'tools', label: 'Available Tools' },
    { id: 'google-setup', label: 'Google Service Account' },
    { id: 'limits', label: 'Rate Limits' },
    { id: 'errors', label: 'Error Handling' },
    { id: 'billing', label: 'Billing' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
      {/* Header */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: '64px', display: 'flex', alignItems: 'center',
        background: 'rgba(12, 12, 15, 0.9)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0 24px'
        }}>
          <Link to="/" style={{ fontSize: '18px', fontWeight: 600 }}>
            seomcp<span style={{ color: 'var(--amber)' }}>.dev</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <Link to="/" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Home</Link>
            <Link to="/dashboard" style={{ fontSize: '14px', color: 'var(--amber)' }}>Dashboard →</Link>
          </div>
        </div>
      </nav>

      <div style={{ display: 'flex', paddingTop: '64px' }}>
        {/* Sidebar */}
        <aside style={{
          width: '280px', position: 'fixed', left: 0, top: '64px', bottom: 0,
          borderRight: '1px solid var(--border-subtle)', padding: '32px 24px',
          overflowY: 'auto', background: 'var(--bg-deep)',
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '16px', letterSpacing: '0.05em' }}>
            Documentation
          </p>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {tocItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => { e.preventDefault(); document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }); }}
                style={{
                  fontSize: '14px', color: activeSection === item.id ? 'var(--amber)' : 'var(--text-secondary)',
                  padding: '8px 12px', borderRadius: '6px',
                  borderLeft: activeSection === item.id ? '2px solid var(--amber)' : '2px solid transparent',
                  paddingLeft: activeSection === item.id ? '10px' : '12px',
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main style={{ marginLeft: '280px', flex: 1, maxWidth: '800px', padding: '48px', paddingBottom: '120px' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 800, marginBottom: '48px' }}>Documentation</h1>

          {/* Quick Start */}
          <section id="quickstart" style={{ marginBottom: '64px', scrollMarginTop: '80px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px' }}>🚀 Quick Start</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Two ways to connect — pick what fits your needs.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '14px', fontWeight: 600 }}>Method</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '14px', fontWeight: 600 }}>Tools</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '14px', fontWeight: 600 }}>Best For</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-primary)' }}>Direct (Streamable HTTP)</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>15 tools (crawl, audit, schema, CWV, IndexNow)</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Quick setup, no Google data needed</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-primary)' }}>Proxy (seomcp-proxy)</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>All 39 tools (+ GSC, GA4)</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Full power — your Google creds stay local</td>
                </tr>
              </tbody>
            </table>

            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', marginTop: '32px' }}>Option A: Direct Connection (30 seconds)</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Works for site audits, crawling, schema validation, Core Web Vitals, and IndexNow. No Google account needed.
            </p>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <span style={{ 
                width: '24px', height: '24px', borderRadius: '50%', background: 'var(--amber)', 
                color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0
              }}>1</span>
              <p style={{ color: 'var(--text-secondary)', paddingTop: '2px' }}>
                Sign up at <Link to="/" style={{ color: 'var(--amber)' }}>seomcp.dev</Link> → get your <code style={{ color: 'var(--amber)' }}>sk_live_</code> key
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <span style={{ 
                width: '24px', height: '24px', borderRadius: '50%', background: 'var(--amber)', 
                color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0
              }}>2</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text-secondary)', paddingTop: '2px', marginBottom: '12px' }}>
                  Add to your MCP config:
                </p>
                <CodeBlock 
                  label="Claude Desktop / Cursor / Windsurf"
                  id="direct-config"
                  code={`{
  "mcpServers": {
    "seo": {
      "url": "https://api.seomcp.dev/mcp",
      "headers": {
        "Authorization": "Bearer sk_live_REDACTED_key_here"
      }
    }
  }
}`}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '32px' }}>
              <span style={{ 
                width: '24px', height: '24px', borderRadius: '50%', background: 'var(--amber)', 
                color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0
              }}>3</span>
              <p style={{ color: 'var(--text-secondary)', paddingTop: '2px' }}>
                Ask your agent: <em>"Run a site audit on example.com"</em>
              </p>
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', marginTop: '48px' }}>Option B: Proxy (All 38 Tools + Google Data)</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Unlocks GSC and GA4 tools. Your Google credentials never leave your machine — the proxy reads them locally and forwards requests securely.
            </p>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <span style={{ 
                width: '24px', height: '24px', borderRadius: '50%', background: 'var(--amber)', 
                color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0
              }}>1</span>
              <p style={{ color: 'var(--text-secondary)', paddingTop: '2px' }}>
                Sign up + get API key (same as above)
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <span style={{ 
                width: '24px', height: '24px', borderRadius: '50%', background: 'var(--amber)', 
                color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0
              }}>2</span>
              <p style={{ color: 'var(--text-secondary)', paddingTop: '2px' }}>
                Create a Google service account with GSC + GA4 access
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <span style={{ 
                width: '24px', height: '24px', borderRadius: '50%', background: 'var(--amber)', 
                color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0
              }}>3</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text-secondary)', paddingTop: '2px', marginBottom: '12px' }}>
                  Add to your MCP config:
                </p>
                <CodeBlock 
                  label="Claude Desktop / Cursor / Windsurf"
                  id="proxy-config"
                  code={`{
  "mcpServers": {
    "seo": {
      "command": "npx",
      "args": ["-y", "github:quantacodes/seomcp-proxy"],
      "env": {
        "SEOMCP_API_KEY": "sk_live_REDACTED_key_here",
        "GOOGLE_SERVICE_ACCOUNT": "/path/to/service-account.json",
        "GA4_PROPERTIES": "123456789:example.com,987654321:blog.example.com",
        "GSC_PROPERTIES": "example.com,blog.example.com"
      }
    }
  }
}`}
                />
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '12px' }}>
                  <strong>Required for GSC/GA4 tools:</strong>
                  <br/>• <code>GA4_PROPERTIES</code>: <code>propertyID:domain</code> format (e.g., <code>123456789:example.com</code>)
                  <br/>• <code>GSC_PROPERTIES</code>: Just domain names (e.g., <code>example.com,blog.example.com</code>)
                  <br/><br/>
                  💡 Find GA4 Property ID in GA4 → Admin → Property Settings
                  <br/>💡 Find GSC Property in Search Console → Settings
                  <br/>💡 Having issues? Run the <code>validate_properties</code> tool to diagnose configuration problems
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ 
                width: '24px', height: '24px', borderRadius: '50%', background: 'var(--amber)', 
                color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, flexShrink: 0
              }}>4</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text-secondary)', paddingTop: '2px', marginBottom: '12px' }}>
                  Verify:
                </p>
                <CodeBlock 
                  label="Terminal"
                  id="verify"
                  code={`SEOMCP_API_KEY=sk_live_... GOOGLE_SERVICE_ACCOUNT=./sa.json npx -y github:quantacodes/seomcp-proxy test`}
                />
              </div>
            </div>
          </section>

          {/* Authentication */}
          <section id="authentication" style={{ marginBottom: '64px', scrollMarginTop: '80px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px' }}>🔑 Authentication</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              All MCP requests require an API key passed as a Bearer token.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>API Key Format</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
              API keys follow this format:
            </p>
            <CodeBlock 
              label="Example"
              id="key-format"
              code={`sk_live_REDACTED`}
            />

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', marginTop: '32px' }}>Usage</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Include your key in the Authorization header:
            </p>
            <CodeBlock 
              label="HTTP Header"
              id="auth-usage"
              code={`Authorization: Bearer sk_live_REDACTED_key_here`}
            />

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', marginTop: '32px' }}>Key Management</h3>
            <ul style={{ color: 'var(--text-secondary)', marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Create and revoke keys from your dashboard</li>
              <li>Keys are shown only once at creation — store them securely</li>
              <li>Revoked keys stop working immediately</li>
              <li>Free plan: 1 key, Pro: 5 keys, Agency: 20 keys</li>
            </ul>
          </section>

          {/* Connection Methods */}
          <section id="connection" style={{ marginBottom: '64px', scrollMarginTop: '80px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px' }}>🔌 Connection Methods</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              seomcp.dev speaks the Model Context Protocol (MCP) — the standard for AI tool connections.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Endpoint</h3>
            <CodeBlock 
              label="POST"
              id="endpoint"
              code={`https://api.seomcp.dev/mcp`}
            />

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', marginTop: '32px' }}>Transport</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              We use Streamable HTTP transport (the MCP standard). Your first request must be an initialize call. The server returns a session ID in the <code style={{ color: 'var(--amber)' }}>Mcp-Session-Id</code> header.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Config Snippets</h3>
            
            <CodeBlock 
              label="Claude Desktop / Claude Code — claude_desktop_config.json"
              id="claude-snippet"
              code={`{
  "mcpServers": {
    "seo": {
      "url": "https://api.seomcp.dev/mcp",
      "headers": {
        "Authorization": "Bearer sk_live_..."
      }
    }
  }
}`}
            />

            <CodeBlock 
              label="Cursor / Windsurf — .cursor/mcp.json"
              id="cursor-snippet"
              code={`{
  "mcpServers": {
    "seo": {
      "url": "https://api.seomcp.dev/mcp",
      "headers": {
        "Authorization": "Bearer sk_live_..."
      }
    }
  }
}`}
            />

            <CodeBlock 
              label="Any MCP Client (cURL test)"
              id="curl-test"
              code={`curl -X POST https://api.seomcp.dev/mcp \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'`}
            />
          </section>

          {/* Available Tools */}
          <section id="tools" style={{ marginBottom: '64px', scrollMarginTop: '80px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px' }}>🧰 Available Tools (39)</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              All tools are accessible through the MCP protocol. Your AI agent discovers them automatically via <code style={{ color: 'var(--amber)' }}>tools/list</code>.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Crawl & Audit</h3>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <ul style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><code style={{ color: 'var(--amber)' }}>site_audit</code> — Full site SEO audit with health score</li>
                <li><code style={{ color: 'var(--amber)' }}>crawl_page</code> — Crawl a single page for SEO analysis</li>
                <li><code style={{ color: 'var(--amber)' }}>test_robots_txt</code> — Test URL against robots.txt rules</li>
                <li><code style={{ color: 'var(--amber)' }}>generate_report</code> — One command → comprehensive SEO report</li>
              </ul>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Google Search Console (9 tools)</h3>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <ul style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><code style={{ color: 'var(--amber)' }}>gsc_performance</code> — Search performance data (clicks, impressions, CTR, position)</li>
                <li><code style={{ color: 'var(--amber)' }}>gsc_list_sites</code> — List verified sites</li>
                <li><code style={{ color: 'var(--amber)' }}>discover_property</code> — Auto-discover GSC and GA4 properties</li>
                <li><code style={{ color: 'var(--amber)' }}>gsc_list_sitemaps</code> — List submitted sitemaps</li>
                <li><code style={{ color: 'var(--amber)' }}>gsc_submit_sitemap</code> — Submit a sitemap to Google</li>
                <li><code style={{ color: 'var(--amber)' }}>gsc_delete_sitemap</code> — Delete a submitted sitemap</li>
                <li><code style={{ color: 'var(--amber)' }}>gsc_inspect_url</code> — Inspect URL indexing status</li>
                <li><code style={{ color: 'var(--amber)' }}>gsc_bulk_inspect</code> — Bulk URL inspection</li>
                <li><code style={{ color: 'var(--amber)' }}>gsc_search_appearances</code> — Rich result search appearances</li>
              </ul>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Google Analytics 4 (11 tools)</h3>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <ul style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><code style={{ color: 'var(--amber)' }}>ga4_list_properties</code> — List accessible GA4 properties (discovery tool)</li>
                <li><code style={{ color: 'var(--amber)' }}>ga4_report</code> — Custom GA4 report (5 presets: landing_pages, engagement, conversions, channels, content)</li>
                <li><code style={{ color: 'var(--amber)' }}>ga4_batch_report</code> — Batch run multiple reports (up to 5)</li>
                <li><code style={{ color: 'var(--amber)' }}>ga4_funnel_report</code> — Funnel analysis report</li>
                <li><code style={{ color: 'var(--amber)' }}>ga4_realtime</code> — Real-time active users</li>
                <li><code style={{ color: 'var(--amber)' }}>ga4_overview</code> — Traffic overview dashboard</li>
                <li><code style={{ color: 'var(--amber)' }}>ga4_top_pages</code> — Top performing pages</li>
                <li><code style={{ color: 'var(--amber)' }}>ga4_traffic_sources</code> — Traffic source breakdown</li>
                <li><code style={{ color: 'var(--amber)' }}>ga4_devices</code> — Device category analytics</li>
                <li><code style={{ color: 'var(--amber)' }}>ga4_geography</code> — Geographic traffic data</li>
                <li><code style={{ color: 'var(--amber)' }}>ga4_metadata</code> — Available dimensions and metrics</li>
              </ul>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Schema & Validation (2 tools)</h3>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <ul style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><code style={{ color: 'var(--amber)' }}>validate_schema</code> — Validate structured data / JSON-LD schema</li>
                <li><code style={{ color: 'var(--amber)' }}>analyze_robots_txt</code> — Full robots.txt analysis</li>
              </ul>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Utility & Diagnostics (3 tools)</h3>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <ul style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><code style={{ color: 'var(--amber)' }}>validate_properties</code> — Diagnose GSC/GA4 property configuration issues</li>
                <li><code style={{ color: 'var(--amber)' }}>quota_status</code> — Check API rate limits and usage</li>
                <li><code style={{ color: 'var(--amber)' }}>healthcheck</code> — Server health and connectivity check</li>
              </ul>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Core Web Vitals (1 tool)</h3>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <ul style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><code style={{ color: 'var(--amber)' }}>core_web_vitals</code> — PageSpeed Insights & CWV metrics</li>
              </ul>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>IndexNow (4 tools)</h3>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <ul style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><code style={{ color: 'var(--amber)' }}>indexnow_submit_url</code> — Submit single URL for instant indexing</li>
                <li><code style={{ color: 'var(--amber)' }}>indexnow_batch_submit</code> — Submit multiple URLs at once</li>
                <li><code style={{ color: 'var(--amber)' }}>indexnow_submit_sitemap</code> — Submit all URLs from a sitemap</li>
                <li><code style={{ color: 'var(--amber)' }}>indexnow_submit_file</code> — Submit URLs from a file</li>
              </ul>
            </div>

            <div style={{ 
              background: 'rgba(229, 164, 48, 0.08)', 
              border: '1px solid rgba(229, 164, 48, 0.2)',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                💡 <strong style={{ color: 'var(--amber)' }}>GSC and GA4 tools</strong> require Google service account setup.
              </p>
            </div>
          </section>

          {/* Google Service Account Setup */}
          <section id="google-setup" style={{ marginBottom: '64px', scrollMarginTop: '80px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px' }}>🔑 Google Service Account Setup</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Required for GSC and GA4 tools. Takes about 5 minutes. Your credentials stay on your machine — they're never stored on our servers.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Step 1: Create a Google Cloud project</h3>
            <ul style={{ color: 'var(--text-secondary)', marginLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber)' }}>Google Cloud Console</a></li>
              <li>Create a new project (or select an existing one)</li>
            </ul>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Step 2: Enable APIs</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>Enable these APIs in your project:</p>
            <ul style={{ color: 'var(--text-secondary)', marginLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Google Search Console API</li>
              <li>Google Analytics Data API</li>
              <li>PageSpeed Insights API (optional, for Core Web Vitals)</li>
            </ul>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Step 3: Create service account</h3>
            <ul style={{ color: 'var(--text-secondary)', marginLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Go to IAM → Service Accounts</li>
              <li>Click "Create Service Account"</li>
              <li>Name it (e.g., seo-mcp)</li>
              <li>Skip the optional role/permission steps</li>
              <li>Click "Keys" → "Add Key" → "Create new key" → JSON</li>
              <li>Save the downloaded JSON file (e.g., ~/service-account.json)</li>
            </ul>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Step 4: Grant access</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Share your properties with the service account email (looks like <code style={{ color: 'var(--amber)' }}>seo-mcp@your-project.iam.gserviceaccount.com</code>):
            </p>
            <ul style={{ color: 'var(--text-secondary)', marginLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Google Search Console:</strong> Go to Search Console → Settings → Users and permissions → Add user (Full or Restricted)</li>
              <li><strong>Google Analytics:</strong> Go to GA4 → Admin → Property → Property Access Management → Add user (Viewer role)</li>
            </ul>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', marginTop: '32px' }}>Step 5: Start using GSC/GA4 tools</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              The proxy will automatically discover your available properties. Just ask your agent:
            </p>
            <div style={{ 
              background: 'var(--bg-surface)', 
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
              borderLeft: '3px solid var(--amber)'
            }}>
              <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                "List my Google Search Console sites"
              </p>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              💡 The <code style={{ color: 'var(--amber)' }}>discover_property</code> tool automatically finds your GSC and GA4 properties. No manual configuration needed.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Security</h3>
            <ul style={{ color: 'var(--text-secondary)', marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>The JSON file never leaves your machine — the proxy reads it locally</li>
              <li>Credentials are sent to our API over HTTPS, used for 1-15 seconds, then the process dies</li>
              <li>Nothing is logged, stored, or persisted on our servers</li>
              <li>Credentials are re-read from disk on every request — rotate keys without restarting</li>
            </ul>
          </section>

          {/* Rate Limits */}
          <section id="limits" style={{ marginBottom: '64px', scrollMarginTop: '80px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px' }}>⏱️ Rate Limits</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Rate limits are enforced per user (not per key) on a monthly rolling window.
            </p>

            <div style={{ 
              background: 'rgba(248, 113, 113, 0.08)', 
              border: '1px solid rgba(248, 113, 113, 0.2)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
            }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                📧 <strong>Email verification required for full limits.</strong> Unverified free accounts are limited to 10 calls/month. 
                Verify your email to unlock the full 100 calls/month. Check your inbox after signup.
              </p>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '14px', fontWeight: 600 }}>Plan</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '14px', fontWeight: 600 }}>Calls/month</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '14px', fontWeight: 600 }}>Sites</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '14px', fontWeight: 600 }}>API Keys</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-primary)' }}>Free</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>100</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>1</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>1</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-primary)' }}>Pro ($29/mo)</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>2,000</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>5</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>5</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-primary)' }}>Agency ($79/mo)</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>10,000</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Unlimited</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>20</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-primary)' }}>Enterprise</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Unlimited</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Unlimited</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Unlimited</td>
                </tr>
              </tbody>
            </table>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>When rate limited</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              The MCP tool call will return an error with a message indicating you've exceeded your plan limit. The usage counter resets on the 1st of each month.
            </p>
          </section>

          {/* Error Handling */}
          <section id="errors" style={{ marginBottom: '64px', scrollMarginTop: '80px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px' }}>❌ Error Handling</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Errors follow MCP JSON-RPC error format.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Error Response Example</h3>
            <CodeBlock 
              label="JSON-RPC Error"
              id="error-example"
              code={`{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "Rate limit exceeded"
  },
  "id": 1
}`}
            />

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', marginTop: '32px' }}>HTTP Status Codes</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '14px', fontWeight: 600 }}>Code</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '14px', fontWeight: 600 }}>Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>200</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Success</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>400</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Bad request (missing Mcp-Session-Id or invalid JSON)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>401</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Missing or invalid API key</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>404</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Session not found</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>429</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Rate limit exceeded</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Billing */}
          <section id="billing" style={{ marginBottom: '64px', scrollMarginTop: '80px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '24px' }}>💳 Billing</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Billing is handled by Paddle. Upgrade, downgrade, or cancel anytime from your dashboard.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Plan changes</h3>
            <ul style={{ color: 'var(--text-secondary)', marginLeft: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Upgrade:</strong> Takes effect immediately. Your usage limit increases right away.</li>
              <li><strong>Downgrade:</strong> Takes effect at end of billing period. You keep your current limits until then.</li>
              <li><strong>Cancel:</strong> Access continues until end of billing period. You can resume before it expires.</li>
            </ul>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Payment methods</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              Cards (Visa, Mastercard, Amex), PayPal, Apple Pay, and Google Pay via Paddle.
            </p>

            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', marginTop: '32px' }}>Refunds</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              We offer a 14-day money-back guarantee. If you're not satisfied, contact us for a full refund.
            </p>
          </section>

          {/* Footer */}
          <footer style={{ paddingTop: '48px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
              Questions? Email <a href="mailto:support@seomcp.dev" style={{ color: 'var(--amber)' }}>support@seomcp.dev</a>
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '16px' }}>
              <Link to="/" style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Home</Link>
              <Link to="/docs" style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Docs</Link>
              <Link to="/dashboard" style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Dashboard</Link>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
