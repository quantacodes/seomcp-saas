import { Hono } from "hono";

const legalRoutes = new Hono();

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
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-gray-950 text-gray-300 min-h-screen">
  <nav class="border-b border-gray-800 px-6 py-4">
    <a href="/" class="text-white font-bold text-lg">🔍 seomcp.dev</a>
    <span class="text-gray-500 ml-2">/ Terms of Service</span>
  </nav>
  <main class="max-w-3xl mx-auto px-6 py-12">
    <h1 class="text-3xl font-bold text-white mb-8">Terms of Service</h1>
    <p class="text-sm text-gray-500 mb-8">Last updated: February 2026</p>

    <section class="space-y-6 text-gray-400 leading-relaxed">
      <h2 class="text-xl font-semibold text-white mt-8">1. Acceptance</h2>
      <p>By accessing or using seomcp.dev ("the Service"), you agree to these Terms. If you don't agree, don't use the Service.</p>

      <h2 class="text-xl font-semibold text-white mt-8">2. The Service</h2>
      <p>seomcp.dev provides SEO tools via the Model Context Protocol (MCP). We proxy requests to Google Search Console, Google Analytics, and other third-party APIs on your behalf using credentials you provide.</p>

      <h2 class="text-xl font-semibold text-white mt-8">3. Your Account</h2>
      <ul class="list-disc pl-6 space-y-2">
        <li>You must provide accurate information when creating an account.</li>
        <li>You are responsible for your API key's security. Don't share it publicly.</li>
        <li>You must be at least 18 years old to use the Service.</li>
        <li>One account per person. No reselling API keys.</li>
      </ul>

      <h2 class="text-xl font-semibold text-white mt-8">4. Acceptable Use</h2>
      <p>You agree NOT to:</p>
      <ul class="list-disc pl-6 space-y-2">
        <li>Use the Service to violate any law or third-party rights.</li>
        <li>Attempt to circumvent rate limits or access controls.</li>
        <li>Use the Service to scrape, crawl, or DDoS websites you don't own or have permission to test.</li>
        <li>Resell access to the Service without written permission.</li>
        <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service.</li>
      </ul>

      <h2 class="text-xl font-semibold text-white mt-8">5. Google Data</h2>
      <p>When you connect your Google account, you grant us permission to access your Google Search Console and Google Analytics data on your behalf. We:</p>
      <ul class="list-disc pl-6 space-y-2">
        <li>Only access data you explicitly authorize via Google OAuth.</li>
        <li>Store your OAuth tokens encrypted (AES-256-GCM) and never share them.</li>
        <li>Do not store your Google data long-term — we proxy requests in real-time.</li>
        <li>Allow you to revoke access at any time via your dashboard.</li>
      </ul>

      <h2 class="text-xl font-semibold text-white mt-8">6. Billing</h2>
      <ul class="list-disc pl-6 space-y-2">
        <li>Free tier: 50 tool calls/month. No credit card required.</li>
        <li>Paid plans are billed monthly through Lemon Squeezy.</li>
        <li>You can cancel anytime. Access continues until the end of your billing period.</li>
        <li>Refunds are handled on a case-by-case basis.</li>
      </ul>

      <h2 class="text-xl font-semibold text-white mt-8">7. Availability</h2>
      <p>We aim for high availability but don't guarantee 100% uptime. The Service depends on third-party APIs (Google, etc.) which may have their own outages.</p>

      <h2 class="text-xl font-semibold text-white mt-8">8. Limitation of Liability</h2>
      <p>THE SERVICE IS PROVIDED "AS IS." WE ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES. OUR TOTAL LIABILITY IS LIMITED TO THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS.</p>

      <h2 class="text-xl font-semibold text-white mt-8">9. Termination</h2>
      <p>We may suspend or terminate your account if you violate these Terms. You may delete your account at any time.</p>

      <h2 class="text-xl font-semibold text-white mt-8">10. Changes</h2>
      <p>We may update these Terms. We'll notify you via email for material changes. Continued use after changes constitutes acceptance.</p>

      <h2 class="text-xl font-semibold text-white mt-8">11. Contact</h2>
      <p>Questions? Email <a href="mailto:support@seomcp.dev" class="text-blue-400 hover:text-blue-300">support@seomcp.dev</a></p>
    </section>
  </main>
  <footer class="border-t border-gray-800 mt-12 px-6 py-6 text-center text-gray-600 text-sm">
    <a href="/" class="hover:text-gray-400">Home</a> ·
    <a href="/privacy" class="hover:text-gray-400">Privacy Policy</a> ·
    <a href="/docs" class="hover:text-gray-400">Docs</a>
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
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-gray-950 text-gray-300 min-h-screen">
  <nav class="border-b border-gray-800 px-6 py-4">
    <a href="/" class="text-white font-bold text-lg">🔍 seomcp.dev</a>
    <span class="text-gray-500 ml-2">/ Privacy Policy</span>
  </nav>
  <main class="max-w-3xl mx-auto px-6 py-12">
    <h1 class="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
    <p class="text-sm text-gray-500 mb-8">Last updated: February 2026</p>

    <section class="space-y-6 text-gray-400 leading-relaxed">
      <h2 class="text-xl font-semibold text-white mt-8">What We Collect</h2>
      <table class="w-full text-sm border border-gray-800 rounded">
        <thead><tr class="border-b border-gray-800 text-left text-gray-300">
          <th class="px-4 py-2">Data</th><th class="px-4 py-2">Purpose</th><th class="px-4 py-2">Stored</th>
        </tr></thead>
        <tbody class="divide-y divide-gray-800">
          <tr><td class="px-4 py-2">Email</td><td class="px-4 py-2">Account + billing</td><td class="px-4 py-2">Until you delete your account</td></tr>
          <tr><td class="px-4 py-2">Password hash</td><td class="px-4 py-2">Authentication</td><td class="px-4 py-2">Bcrypt hash only — we never store plaintext</td></tr>
          <tr><td class="px-4 py-2">Google OAuth tokens</td><td class="px-4 py-2">GSC + GA4 access</td><td class="px-4 py-2">AES-256-GCM encrypted. Deleted when you disconnect.</td></tr>
          <tr><td class="px-4 py-2">API usage logs</td><td class="px-4 py-2">Rate limiting + billing</td><td class="px-4 py-2">Tool name + timestamp. No request/response content.</td></tr>
          <tr><td class="px-4 py-2">IP addresses</td><td class="px-4 py-2">Rate limiting + abuse prevention</td><td class="px-4 py-2">In-memory only, not persisted to disk</td></tr>
        </tbody>
      </table>

      <h2 class="text-xl font-semibold text-white mt-8">What We DON'T Collect</h2>
      <ul class="list-disc pl-6 space-y-2">
        <li>We don't log or store the content of your tool call requests or responses.</li>
        <li>We don't store your Google Search Console or Analytics data.</li>
        <li>We don't use cookies for tracking (only a session cookie for the dashboard).</li>
        <li>We don't sell your data. Period.</li>
      </ul>

      <h2 class="text-xl font-semibold text-white mt-8">Google Data</h2>
      <p>When you connect Google, we request these scopes:</p>
      <ul class="list-disc pl-6 space-y-2">
        <li><code class="text-blue-400">webmasters.readonly</code> — Read your Search Console data</li>
        <li><code class="text-blue-400">analytics.readonly</code> — Read your Analytics data</li>
      </ul>
      <p>We use Google data exclusively to serve your MCP tool requests. We don't cache, aggregate, or share your Google data with anyone. You can disconnect your Google account at any time from the dashboard, which immediately deletes your stored tokens.</p>
      <p>Our use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" class="text-blue-400 hover:text-blue-300" rel="noopener noreferrer" target="_blank">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

      <h2 class="text-xl font-semibold text-white mt-8">Third-Party Services</h2>
      <ul class="list-disc pl-6 space-y-2">
        <li><strong>Lemon Squeezy</strong> — Payment processing. See their <a href="https://www.lemonsqueezy.com/privacy" class="text-blue-400 hover:text-blue-300" rel="noopener noreferrer" target="_blank">privacy policy</a>.</li>
        <li><strong>Fly.io</strong> — Hosting. Your data is processed on their infrastructure.</li>
        <li><strong>Google APIs</strong> — We access your GSC/GA4 data on your behalf.</li>
      </ul>

      <h2 class="text-xl font-semibold text-white mt-8">Security</h2>
      <ul class="list-disc pl-6 space-y-2">
        <li>Passwords: bcrypt hashed</li>
        <li>API keys: SHA-256 hashed (we only store the hash)</li>
        <li>OAuth tokens: AES-256-GCM encrypted with unique IVs</li>
        <li>All traffic: HTTPS/TLS</li>
        <li>Database: SQLite with WAL mode, persisted to encrypted volume</li>
      </ul>

      <h2 class="text-xl font-semibold text-white mt-8">Your Rights</h2>
      <ul class="list-disc pl-6 space-y-2">
        <li><strong>Access:</strong> View your data in the dashboard.</li>
        <li><strong>Delete:</strong> Delete your account to remove all data.</li>
        <li><strong>Disconnect:</strong> Revoke Google access anytime.</li>
        <li><strong>Export:</strong> Contact us for a data export.</li>
      </ul>

      <h2 class="text-xl font-semibold text-white mt-8">Data Retention</h2>
      <p>Account data is kept until you delete your account. Usage logs are kept for 90 days for billing purposes, then automatically purged.</p>

      <h2 class="text-xl font-semibold text-white mt-8">Changes</h2>
      <p>We'll email you about material changes to this policy.</p>

      <h2 class="text-xl font-semibold text-white mt-8">Contact</h2>
      <p>Privacy questions? Email <a href="mailto:privacy@seomcp.dev" class="text-blue-400 hover:text-blue-300">privacy@seomcp.dev</a></p>
    </section>
  </main>
  <footer class="border-t border-gray-800 mt-12 px-6 py-6 text-center text-gray-600 text-sm">
    <a href="/" class="hover:text-gray-400">Home</a> ·
    <a href="/terms" class="hover:text-gray-400">Terms of Service</a> ·
    <a href="/docs" class="hover:text-gray-400">Docs</a>
  </footer>
</body>
</html>`;

legalRoutes.get("/terms", (c) => c.html(TERMS_HTML));
legalRoutes.get("/privacy", (c) => c.html(PRIVACY_HTML));

export { legalRoutes };
