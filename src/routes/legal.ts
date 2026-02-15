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
  h3{font-size:15px;font-weight:600;color:#EDEDF0;margin-top:20px;margin-bottom:8px}
  p{margin-bottom:12px;font-size:15px}
  ul{padding-left:20px;margin-bottom:12px}li{margin-bottom:6px;font-size:15px}
  code{font-family:'JetBrains Mono',monospace;font-size:13px;background:rgba(229,164,48,0.08);color:#E5A430;padding:1px 5px;border-radius:3px}
  strong{color:#EDEDF0;font-weight:500}
  table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px}
  th{text-align:left;padding:8px;border-bottom:1px solid #2A2A36;color:#EDEDF0;font-weight:500;font-size:13px}
  td{padding:8px;border-bottom:1px solid rgba(42,42,54,0.4)}
  footer{border-top:1px solid #2A2A36;margin-top:48px;padding:24px;text-align:center;font-size:13px;color:#5C5C6E}
  footer a{color:#8E8EA0;text-decoration:none;margin:0 8px}footer a:hover{color:#EDEDF0}
  .highlight-box{background:rgba(229,164,48,0.06);border:1px solid rgba(229,164,48,0.15);border-radius:8px;padding:16px 20px;margin:16px 0}
  .highlight-box strong{color:#E5A430}
  @media(max-width:768px){main{padding:32px 16px}h1{font-size:22px}}
</style>`;

const NAV = `<nav>
  <a href="/" class="logo">seomcp<span class="dot">.dev</span></a>
  <span class="crumb">/`;

const HEAD = (title: string, path: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — seomcp.dev</title>
  <meta name="description" content="${title} for seomcp.dev — 37 SEO tools for AI agents via MCP.">
  <link rel="canonical" href="https://seomcp.dev${path}">
  <meta property="og:title" content="${title} — seomcp.dev">
  <meta property="og:url" content="https://seomcp.dev${path}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="seomcp.dev">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  ${LEGAL_STYLES}
</head>`;

const FOOTER = `<footer>
  <a href="/">Home</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/refund">Refund</a> · <a href="https://api.seomcp.dev/docs">Docs</a>
  <div style="margin-top:12px;font-size:12px;">© 2026 <a href="https://quantacodes.ai" target="_blank" rel="noopener noreferrer">QuantaCodes Solutions</a>. All rights reserved.</div>
</footer>`;

// ═══════════════════════════════════════════════
// PRIVACY POLICY
// ═══════════════════════════════════════════════
const PRIVACY_HTML = `${HEAD("Privacy Policy", "/privacy")}
<body>
  ${NAV} Privacy Policy</span></nav>
  <main>
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: February 15, 2026</p>

    <section>
      <h2>1. Introduction</h2>
      <p>seomcp.dev, operated by <strong>QuantaCodes Solutions</strong> ("we", "us", or "our"), provides SEO tools via the Model Context Protocol (MCP). This Privacy Policy explains how we collect, use, and protect your information.</p>

      <h2>2. What We Collect</h2>
      <table>
        <thead><tr>
          <th>Data</th><th>Purpose</th><th>Stored</th>
        </tr></thead>
        <tbody>
          <tr><td>Email address</td><td>Account + billing</td><td>Until you delete your account</td></tr>
          <tr><td>Password hash</td><td>Authentication</td><td>Bcrypt hash only — never plaintext</td></tr>
          <tr><td>Google OAuth tokens</td><td>GSC + GA4 access</td><td>AES-256-GCM encrypted. Deleted on disconnect.</td></tr>
          <tr><td>API usage logs</td><td>Rate limiting + billing</td><td>Tool name + timestamp only. No request/response content.</td></tr>
          <tr><td>IP addresses</td><td>Rate limiting + abuse prevention</td><td>In-memory only, not persisted to disk</td></tr>
          <tr><td>Payment info</td><td>Subscription billing</td><td>Processed by Lemon Squeezy — we never store card details</td></tr>
        </tbody>
      </table>

      <h2>3. What We DON'T Collect</h2>
      <ul>
        <li>We don't log or store the content of your tool call requests or responses.</li>
        <li>We don't store your Google Search Console or Analytics data.</li>
        <li>We don't use cookies for tracking (only a session cookie for the dashboard).</li>
        <li>We don't sell your data. Period.</li>
        <li>We don't use third-party tracking or advertising cookies.</li>
      </ul>

      <h2>4. How We Use Your Information</h2>
      <ul>
        <li>Providing and maintaining our MCP SEO tools platform</li>
        <li>Processing payments and managing your subscription</li>
        <li>Enforcing rate limits and preventing abuse</li>
        <li>Sending important updates about your account and our services</li>
        <li>Improving our platform based on aggregate usage patterns</li>
        <li>Complying with legal obligations</li>
      </ul>

      <h2>5. Google Data</h2>
      <p>When you connect Google, we request these scopes:</p>
      <ul>
        <li><code>webmasters.readonly</code> — Read your Search Console data</li>
        <li><code>analytics.readonly</code> — Read your Analytics data</li>
      </ul>
      <p>We use Google data exclusively to serve your MCP tool requests. We don't cache, aggregate, or share your Google data with anyone. You can disconnect your Google account at any time from the dashboard, which immediately deletes your stored tokens.</p>
      <p>Our use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer" target="_blank">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

      <h2>6. Security</h2>
      <ul>
        <li><strong>Passwords:</strong> bcrypt hashed</li>
        <li><strong>API keys:</strong> SHA-256 hashed (we only store the hash)</li>
        <li><strong>OAuth tokens:</strong> AES-256-GCM encrypted with unique IVs</li>
        <li><strong>All traffic:</strong> HTTPS/TLS</li>
        <li><strong>User isolation:</strong> Each user gets isolated processes — no cross-account data access</li>
        <li><strong>Credentials:</strong> Passed via stdin pipe, not environment variables</li>
      </ul>

      <h2>7. Third-Party Services</h2>
      <ul>
        <li><strong>Lemon Squeezy</strong> — Payment processing. See their <a href="https://www.lemonsqueezy.com/privacy" rel="noopener noreferrer" target="_blank">privacy policy</a>.</li>
        <li><strong>Hetzner Cloud</strong> — Hosting infrastructure (Ashburn, VA).</li>
        <li><strong>Cloudflare</strong> — DNS and content delivery for the landing page.</li>
        <li><strong>Google APIs</strong> — We access your GSC/GA4 data on your behalf.</li>
      </ul>
      <p>Each third-party service has its own privacy policy governing the use of your information.</p>

      <h2>8. Data Retention</h2>
      <ul>
        <li><strong>Account data:</strong> Kept until you delete your account.</li>
        <li><strong>Usage logs:</strong> Kept for 90 days for billing, then automatically purged.</li>
        <li><strong>After account deletion:</strong> All personal data removed within 30 days.</li>
        <li><strong>Backups:</strong> Purged within 60 days of account deletion.</li>
      </ul>

      <h2>9. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access:</strong> View your data in the dashboard.</li>
        <li><strong>Correct:</strong> Update inaccurate personal data.</li>
        <li><strong>Delete:</strong> Delete your account to remove all data.</li>
        <li><strong>Disconnect:</strong> Revoke Google access anytime.</li>
        <li><strong>Export:</strong> Request a data export by contacting us.</li>
        <li><strong>Opt out:</strong> Unsubscribe from marketing communications at any time.</li>
      </ul>

      <h2>10. International Transfers</h2>
      <p>Data may be processed in the US (Hetzner Ashburn datacenter). Standard Contractual Clauses and adequate safeguards are in place for all transfers.</p>

      <h2>11. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We'll email you about material changes. Continued use after changes constitutes acceptance.</p>

      <h2>12. Contact Us</h2>
      <p>Privacy questions? Email <a href="mailto:support@seomcp.dev">support@seomcp.dev</a></p>
      <p style="margin-top:4px;font-size:13px;color:#5C5C6E;">QuantaCodes Solutions · Gujarat, India</p>
    </section>
  </main>
  ${FOOTER}
</body>
</html>`;

// ═══════════════════════════════════════════════
// TERMS OF SERVICE
// ═══════════════════════════════════════════════
const TERMS_HTML = `${HEAD("Terms of Service", "/terms")}
<body>
  ${NAV} Terms of Service</span></nav>
  <main>
    <h1>Terms of Service</h1>
    <p class="updated">Last updated: February 15, 2026</p>

    <section>
      <h2>1. Acceptance of Terms</h2>
      <p>By accessing or using seomcp.dev ("the Service"), operated by <strong>QuantaCodes Solutions</strong>, you agree to be bound by these Terms. If you don't agree, don't use the Service.</p>

      <h2>2. Description of Service</h2>
      <p>seomcp.dev provides 37 SEO tools via the Model Context Protocol (MCP). We proxy requests to Google Search Console, Google Analytics 4, PageSpeed API, and other services on your behalf using credentials you provide. Our tools include site auditing, keyword analysis, Core Web Vitals testing, IndexNow URL submission, schema validation, and comprehensive SEO reporting.</p>

      <h2>3. Account Registration</h2>
      <ul>
        <li>You must provide accurate information when creating an account.</li>
        <li>You are responsible for your API key's security. Don't share it publicly.</li>
        <li>You must be at least 18 years old to use the Service.</li>
        <li>One account per person. No reselling API keys without written permission.</li>
        <li>Notify us immediately of any unauthorized access to your account.</li>
      </ul>

      <h2>4. Acceptable Use</h2>
      <p>You agree NOT to:</p>
      <ul>
        <li>Use the Service to violate any law or third-party rights.</li>
        <li>Attempt to circumvent rate limits or access controls.</li>
        <li>Use the Service to crawl, scrape, or test websites you don't own or have permission to test.</li>
        <li>Resell or redistribute access to the Service without authorization.</li>
        <li>Reverse-engineer, decompile, or attempt to extract the source code.</li>
        <li>Interfere with or disrupt the Service's infrastructure.</li>
        <li>Abuse API rate limits or attempt to circumvent usage restrictions.</li>
      </ul>

      <h2>5. Google Data & API Credentials</h2>
      <p>When you connect your Google account, you grant us permission to access your data on your behalf. We:</p>
      <ul>
        <li>Only access data you explicitly authorize via Google OAuth.</li>
        <li>Store your OAuth tokens encrypted (AES-256-GCM) and never share them.</li>
        <li>Do not store your Google data long-term — we proxy requests in real-time.</li>
        <li>Allow you to revoke access at any time via your dashboard.</li>
        <li>Operate in <strong>read-only mode</strong> — we never modify your Google Search Console, website, or any connected services.</li>
      </ul>
      <p>You are responsible for any charges incurred through third-party API credentials you provide (e.g., Google APIs). Monitor your third-party usage and billing independently.</p>

      <h2>6. Subscription and Payments</h2>
      <ul>
        <li><strong>Free tier:</strong> 100 tool calls/month. No credit card required.</li>
        <li>Paid subscriptions are billed monthly through <strong>Lemon Squeezy</strong>.</li>
        <li>Prices are subject to change with 30 days' notice.</li>
        <li>You may cancel your subscription at any time. Access continues until the end of your billing period.</li>
        <li>Refunds are handled per our <a href="/refund">Refund Policy</a>.</li>
      </ul>

      <h2>7. Service Availability</h2>
      <p>We strive for high availability but do not guarantee 100% uptime. The Service depends on third-party APIs (Google, etc.) which may have their own outages. We are not liable for any losses resulting from service interruptions.</p>

      <h2>8. Intellectual Property</h2>
      <p>The Service, including its code, design, and documentation, is owned by QuantaCodes Solutions. You retain ownership of your data. We claim no intellectual property rights over your SEO data, reports, or any content you create using our tools.</p>

      <h2>9. Limitation of Liability</h2>
      <p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES. OUR TOTAL LIABILITY IS LIMITED TO THE AMOUNT YOU PAID FOR THE SERVICE IN THE 12 MONTHS PRECEDING THE CLAIM.</p>
      <p>We are not liable for SEO performance results, search engine penalties, ranking changes, or revenue impacts from SEO strategies implemented using our tools.</p>

      <h2>10. Termination</h2>
      <ul>
        <li>We may suspend or terminate your account if you violate these Terms.</li>
        <li>You may delete your account at any time through account settings.</li>
        <li>Upon termination, your data will be deleted within 30 days.</li>
        <li>API credentials are immediately revoked upon account deletion.</li>
      </ul>

      <h2>11. Changes to Terms</h2>
      <p>We may update these Terms from time to time. Material changes will be communicated via email at least 30 days before taking effect. Continued use after changes constitutes acceptance.</p>

      <h2>12. Governing Law</h2>
      <p>These Terms are governed by the laws of India. Any disputes shall be resolved in the courts of Gujarat, India.</p>

      <h2>13. Contact Us</h2>
      <p>Questions about these Terms? Email <a href="mailto:support@seomcp.dev">support@seomcp.dev</a></p>
      <p style="margin-top:4px;font-size:13px;color:#5C5C6E;">QuantaCodes Solutions · Gujarat, India</p>
    </section>
  </main>
  ${FOOTER}
</body>
</html>`;

// ═══════════════════════════════════════════════
// REFUND POLICY
// ═══════════════════════════════════════════════
const REFUND_HTML = `${HEAD("Refund Policy", "/refund")}
<body>
  ${NAV} Refund Policy</span></nav>
  <main>
    <h1>Refund Policy</h1>
    <p class="updated">Last updated: February 15, 2026</p>

    <section>
      <h2>1. Our Commitment</h2>
      <p>We want you to be completely satisfied with seomcp.dev. If our SEO tools don't meet your expectations, we offer a straightforward refund process.</p>

      <h2>2. 14-Day Money-Back Guarantee</h2>
      <div class="highlight-box">
        <p><strong>14-day money-back guarantee</strong> on all paid subscriptions. If you're not satisfied within the first 14 days, contact us for a full refund — no questions asked.</p>
      </div>

      <h2>3. Refund Eligibility</h2>
      <p>Refunds are available in the following cases:</p>
      <ul>
        <li><strong>Within 14 days:</strong> Full refund, no questions asked.</li>
        <li><strong>Service outage:</strong> Pro-rated refund for extended downtime (&gt;24 hours).</li>
        <li><strong>Billing errors:</strong> Full refund for any duplicate or incorrect charges.</li>
        <li><strong>Feature unavailability:</strong> If a core advertised feature is unavailable for an extended period.</li>
      </ul>

      <h3>What's NOT covered</h3>
      <ul>
        <li>Third-party API charges (Google APIs, etc.) — those are billed by the respective providers.</li>
        <li>Subscription renewals older than 14 days.</li>
        <li>Accounts terminated for Terms of Service violations.</li>
      </ul>

      <h2>4. How to Request a Refund</h2>
      <p>To request a refund:</p>
      <ul>
        <li>Email <a href="mailto:support@seomcp.dev">support@seomcp.dev</a> with subject: "Refund Request"</li>
        <li>Include your account email address</li>
        <li>Reason for refund (optional, but helps us improve)</li>
      </ul>
      <p>We process all refund requests within <strong>5 business days</strong>. Refunds are processed through Lemon Squeezy and may take 5–10 business days to appear in your account.</p>

      <h2>5. Cancellation</h2>
      <ul>
        <li>You can cancel your subscription at any time through your account dashboard.</li>
        <li>Your access continues until the end of your current billing period.</li>
        <li>No partial refunds for unused time after the 14-day guarantee period.</li>
        <li>All your data remains accessible during the remaining billing period.</li>
        <li>Data export tools are available throughout your subscription.</li>
      </ul>

      <h2>6. Reactivation</h2>
      <p>Changed your mind? You can reactivate your subscription anytime within 30 days of cancellation. All your previous data and configurations will be restored.</p>

      <h2>7. Before You Go</h2>
      <p>Before requesting a refund, consider reaching out to our support team:</p>
      <ul>
        <li><strong>Technical issues?</strong> We can help resolve platform problems.</li>
        <li><strong>Need guidance?</strong> We offer onboarding help for new users.</li>
        <li><strong>Plan too big?</strong> Downgrade to a smaller plan instead.</li>
      </ul>

      <h2>8. Contact Us</h2>
      <p>Questions about refunds? Email <a href="mailto:support@seomcp.dev">support@seomcp.dev</a></p>
      <p style="margin-top:4px;font-size:13px;color:#5C5C6E;">QuantaCodes Solutions · Gujarat, India</p>
    </section>
  </main>
  ${FOOTER}
</body>
</html>`;

legalRoutes.get("/terms", (c) => c.html(TERMS_HTML));
legalRoutes.get("/privacy", (c) => c.html(PRIVACY_HTML));
legalRoutes.get("/refund", (c) => c.html(REFUND_HTML));

export { legalRoutes };
