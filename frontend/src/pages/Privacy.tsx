import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)' }}>
      {/* Header */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: '64px', display: 'flex', alignItems: 'center',
        background: 'rgba(12, 12, 15, 0.8)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', maxWidth: '1120px', margin: '0 auto', padding: '0 24px'
        }}>
          <Link to="/" className="nav-logo" style={{ fontSize: '18px', fontWeight: 600 }}>
            seomcp<span style={{ color: 'var(--amber)' }}>.dev</span>
          </Link>
          <Link to="/" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            ← Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main style={{ paddingTop: '120px', paddingBottom: '80px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>
            Privacy Policy
          </h1>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: '48px' }}>
            Last updated: February 15, 2026
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', color: 'var(--text-secondary)' }}>
            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                1. Information We Collect
              </h2>
              <p style={{ marginBottom: '16px' }}>
                We collect minimal data necessary to provide our service:
              </p>
              <ul style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong>Account information:</strong> Email address, authentication data (via Clerk)</li>
                <li><strong>API usage:</strong> Tool calls, timestamps, and response metadata for billing and rate limiting</li>
                <li><strong>Payment information:</strong> Processed securely by Paddle (we never store credit card numbers)</li>
              </ul>
              
              <p style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', borderLeft: '3px solid var(--sage)' }}>
                <strong>Important:</strong> Your Google service account keys are never stored on our servers. 
                They are passed through to our proxy server for API calls and destroyed immediately after the call completes.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                2. What We Don't Collect
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Your privacy is important to us. We explicitly do not:
              </p>
              <ul style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong>Google service account keys</strong> — Never stored on our servers (passed through for API calls only)</li>
                <li><strong>Google OAuth tokens</strong> — Not stored (we don't use OAuth flow)</li>
                <li><strong>Your Search Console or Analytics data</strong> — We only pass through requests, we don't persist your data</li>
                <li><strong>Content of tool calls or responses</strong> — Only metadata (call count, timestamp) for billing</li>
                <li><strong>Credit card numbers</strong> — Payment info handled entirely by Paddle</li>
                <li><strong>Tracking data</strong> — We don't track your browsing activity outside our service</li>
                <li><strong>Marketing data</strong> — We don't sell or share your data with third parties</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                3. How We Use Your Data
              </h2>
              <ul style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>To provide and maintain our SEO MCP service</li>
                <li>To track API usage for billing and rate limiting</li>
                <li>To send service-related notifications (billing, security alerts)</li>
                <li>To improve our service based on aggregated usage patterns</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                4. Data Security
              </h2>
              <p>
                We implement industry-standard security measures:
              </p>
              <ul style={{ marginLeft: '24px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>API keys are SHA-256 hashed (we only store the hash)</li>
                <li>Google service account credentials are never stored — passed through for API calls only</li>
                <li>All data transmission uses TLS 1.3</li>
                <li>Database backups are encrypted</li>
                <li>Each user runs in isolated processes</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                5. Third-Party Services
              </h2>
              <p>
                We use trusted third-party services:
              </p>
              <ul style={{ marginLeft: '24px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong>Clerk</strong> - Authentication services</li>
                <li><strong>Paddle</strong> - Payment processing</li>
                <li><strong>Hetzner</strong> - Infrastructure hosting</li>
                <li><strong>Google APIs</strong> - Search Console & Analytics (your credentials, your connection)</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                6. Data Retention
              </h2>
              <p>
                We retain your data as long as your account is active. You can delete your account 
                at any time from the dashboard. Upon deletion, we remove all personal data within 30 days, 
                except where legal obligations require longer retention (e.g., billing records for 7 years).
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                7. Your Rights
              </h2>
              <p>You have the right to:</p>
              <ul style={{ marginLeft: '24px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data</li>
                <li>Opt out of non-essential communications</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                8. Cookies
              </h2>
              <p>
                We use minimal cookies: essential session cookies for authentication and 
                optional analytics cookies (with your consent). You can manage cookie preferences 
                via the cookie banner or your browser settings.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                9. Children's Privacy
              </h2>
              <p>
                Our service is not intended for users under 13. We do not knowingly collect 
                data from children. If you believe we have inadvertently collected such data, 
                please contact us immediately.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                10. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy periodically. We will notify users of 
                significant changes via email or dashboard notification. Continued use of 
                the service after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                11. Contact Us
              </h2>
              <p>
                For privacy-related questions or requests, contact us at: privacy@seomcp.dev
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ padding: '32px 0', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
          © 2026 seomcp.dev. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
