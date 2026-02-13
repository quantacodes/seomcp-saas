import { Hono } from "hono";

const legalRoutes = new Hono();

const LEGAL_STYLES = `<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',system-ui,sans-serif;background:#0C0C0F;color:#8E8EA0;min-height:100vh;line-height:1.7;-webkit-font-smoothing:antialiased}
  a{color:#E5A430;text-decoration:none}a:hover{opacity:0.85}
  nav{border-bottom:1px solid #2A2A36;padding:16px 24px;display:flex;align-items:center;gap:8px}
  nav a.logo{color:#EDEDF0;font-weight:600;font-size:16px;text-decoration:none}
  nav a.logo .dot{color:#E5A430}
  nav .crumb{font-size:14px;color:#5C5C6E}
  main{max-width:720px;margin:0 auto;padding:48px 24px}
  h1{font-size:28px;font-weight:700;color:#EDEDF0;margin-bottom:8px;letter-spacing:-0.02em}
  .updated{font-size:13px;color:#5C5C6E;margin-bottom:40px}
  h2{font-size:18px;font-weight:600;color:#EDEDF0;margin-top:32px;margin-bottom:12px}
  p{margin-bottom:12px;font-size:15px}
  ul{padding-left:20px;margin-bottom:12px}li{margin-bottom:6px;font-size:15px}
  code{font-family:'JetBrains Mono',monospace;font-size:13px;background:rgba(229,164,48,0.08);color:#E5A430;padding:1px 5px;border-radius:3px}
  strong{color:#EDEDF0;font-weight:500}
  table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px}
  th{text-align:left;padding:8px;border-bottom:1px solid #2A2A36;color:#EDEDF0;font-weight:500;font-size:13px}
  td{padding:8px;border-bottom:1px solid rgba(42,42,54,0.4)}
  footer{border-top:1px solid #2A2A36;margin-top:48px;padding:24px;text-align:center;font-size:13px;color:#5C5C6E}
  footer a{color:#8E8EA0;text-decoration:none}footer a:hover{color:#EDEDF0}
  @media(max-width:768px){main{padding:32px 16px}h1{font-size:22px}}
</style>`;

const TERMS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service — seomcp.dev</title>
  <link rel="canonical" href="https://seomcp.dev/terms">
  <meta property="og:title" content="Terms of Service — seomcp.dev">
  <meta property="og:url" content="https://seomcp.dev/terms">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="seomcp.dev">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  ${LEGAL_STYLES}
</head>
<body>
  <nav>
    <a href="/" class="logo">seomcp<span class="dot">.dev</span></a>
    <span class="crumb">/ Terms of Service</span>
  </nav>
  <main>
    <h1>Terms of Service</h1>
    <p class="updated">Last updated: February 2026</p>

    <section>
      <h2>1. Acceptance</h2>
      <p>By accessing or using seomcp.dev ("the Service"), you agree to these Terms. If you don't agree, don't use the Service.</p>

      <h2 >2. The Service</h2>
      <p>seomcp.dev provides SEO tools via the Model Context Protocol (MCP). We proxy requests to Google Search Console, Google Analytics, and other third-party APIs on your behalf using credentials you provide.</p>

      <h2 >3. Your Account</h2>
      <ul >
        <li>You must provide accurate information when creating an account.</li>
        <li>You are responsible for your API key's security. Don't share it publicly.</li>
        <li>You must be at least 18 years old to use the Service.</li>
        <li>One account per person. No reselling API keys.</li>
      </ul>

      <h2 >4. Acceptable Use</h2>
      <p>You agree NOT to:</p>
      <ul >
        <li>Use the Service to violate any law or third-party rights.</li>
        <li>Attempt to circumvent rate limits or access controls.</li>
        <li>Use the Service to scrape, crawl, or DDoS websites you don't own or have permission to test.</li>
        <li>Resell access to the Service without written permission.</li>
        <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service.</li>
      </ul>

      <h2 >5. Google Data</h2>
      <p>When you connect your Google account, you grant us permission to access your Google Search Console and Google Analytics data on your behalf. We:</p>
      <ul >
        <li>Only access data you explicitly authorize via Google OAuth.</li>
        <li>Store your OAuth tokens encrypted (AES-256-GCM) and never share them.</li>
        <li>Do not store your Google data long-term — we proxy requests in real-time.</li>
        <li>Allow you to revoke access at any time via your dashboard.</li>
      </ul>

      <h2 >6. Billing</h2>
      <ul >
        <li>Free tier: 50 tool calls/month. No credit card required.</li>
        <li>Paid plans are billed monthly through Lemon Squeezy.</li>
        <li>You can cancel anytime. Access continues until the end of your billing period.</li>
        <li>Refunds are handled on a case-by-case basis.</li>
      </ul>

      <h2 >7. Availability</h2>
      <p>We aim for high availability but don't guarantee 100% uptime. The Service depends on third-party APIs (Google, etc.) which may have their own outages.</p>

      <h2 >8. Limitation of Liability</h2>
      <p>THE SERVICE IS PROVIDED "AS IS." WE ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES. OUR TOTAL LIABILITY IS LIMITED TO THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS.</p>

      <h2 >9. Termination</h2>
      <p>We may suspend or terminate your account if you violate these Terms. You may delete your account at any time.</p>

      <h2 >10. Changes</h2>
      <p>We may update these Terms. We'll notify you via email for material changes. Continued use after changes constitutes acceptance.</p>

      <h2 >11. Contact</h2>
      <p>Questions? Email <a href="mailto:support@seomcp.dev" >support@seomcp.dev</a></p>
    </section>
  </main>
  <footer>
    <a href="/">Home</a> · <a href="/privacy">Privacy Policy</a> · <a href="/docs">Docs</a>
  </footer>
</body>
</html>`;

const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy — seomcp.dev</title>
  <link rel="canonical" href="https://seomcp.dev/privacy">
  <meta property="og:title" content="Privacy Policy — seomcp.dev">
  <meta property="og:url" content="https://seomcp.dev/privacy">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="seomcp.dev">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  ${LEGAL_STYLES}
</head>
<body>
  <nav>
    <a href="/" class="logo">seomcp<span class="dot">.dev</span></a>
    <span class="crumb">/ Privacy Policy</span>
  </nav>
  <main>
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: February 2026</p>

    <section>
      <h2>What We Collect</h2>
      <table>
        <thead><tr>
          <th>Data</th><th>Purpose</th><th>Stored</th>
        </tr></thead>
        <tbody>
          <tr><td >Email</td><td >Account + billing</td><td >Until you delete your account</td></tr>
          <tr><td >Password hash</td><td >Authentication</td><td >Bcrypt hash only — we never store plaintext</td></tr>
          <tr><td >Google OAuth tokens</td><td >GSC + GA4 access</td><td >AES-256-GCM encrypted. Deleted when you disconnect.</td></tr>
          <tr><td >API usage logs</td><td >Rate limiting + billing</td><td >Tool name + timestamp. No request/response content.</td></tr>
          <tr><td >IP addresses</td><td >Rate limiting + abuse prevention</td><td >In-memory only, not persisted to disk</td></tr>
        </tbody>
      </table>

      <h2 >What We DON'T Collect</h2>
      <ul >
        <li>We don't log or store the content of your tool call requests or responses.</li>
        <li>We don't store your Google Search Console or Analytics data.</li>
        <li>We don't use cookies for tracking (only a session cookie for the dashboard).</li>
        <li>We don't sell your data. Period.</li>
      </ul>

      <h2 >Google Data</h2>
      <p>When you connect Google, we request these scopes:</p>
      <ul >
        <li><code class="text-blue-400">webmasters.readonly</code> — Read your Search Console data</li>
        <li><code class="text-blue-400">analytics.readonly</code> — Read your Analytics data</li>
      </ul>
      <p>We use Google data exclusively to serve your MCP tool requests. We don't cache, aggregate, or share your Google data with anyone. You can disconnect your Google account at any time from the dashboard, which immediately deletes your stored tokens.</p>
      <p>Our use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy"  rel="noopener noreferrer" target="_blank">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

      <h2 >Third-Party Services</h2>
      <ul >
        <li><strong>Lemon Squeezy</strong> — Payment processing. See their <a href="https://www.lemonsqueezy.com/privacy"  rel="noopener noreferrer" target="_blank">privacy policy</a>.</li>
        <li><strong>Fly.io</strong> — Hosting. Your data is processed on their infrastructure.</li>
        <li><strong>Google APIs</strong> — We access your GSC/GA4 data on your behalf.</li>
      </ul>

      <h2 >Security</h2>
      <ul >
        <li>Passwords: bcrypt hashed</li>
        <li>API keys: SHA-256 hashed (we only store the hash)</li>
        <li>OAuth tokens: AES-256-GCM encrypted with unique IVs</li>
        <li>All traffic: HTTPS/TLS</li>
        <li>Database: SQLite with WAL mode, persisted to encrypted volume</li>
      </ul>

      <h2 >Your Rights</h2>
      <ul >
        <li><strong>Access:</strong> View your data in the dashboard.</li>
        <li><strong>Delete:</strong> Delete your account to remove all data.</li>
        <li><strong>Disconnect:</strong> Revoke Google access anytime.</li>
        <li><strong>Export:</strong> Contact us for a data export.</li>
      </ul>

      <h2 >Data Retention</h2>
      <p>Account data is kept until you delete your account. Usage logs are kept for 90 days for billing purposes, then automatically purged.</p>

      <h2 >Changes</h2>
      <p>We'll email you about material changes to this policy.</p>

      <h2 >Contact</h2>
      <p>Privacy questions? Email <a href="mailto:privacy@seomcp.dev" >privacy@seomcp.dev</a></p>
    </section>
  </main>
  <footer>
    <a href="/">Home</a> · <a href="/terms">Terms of Service</a> · <a href="/docs">Docs</a>
  </footer>
</body>
</html>`;

legalRoutes.get("/terms", (c) => c.html(TERMS_HTML));
legalRoutes.get("/privacy", (c) => c.html(PRIVACY_HTML));

export { legalRoutes };
