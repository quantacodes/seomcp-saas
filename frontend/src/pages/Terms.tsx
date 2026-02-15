import { Link } from 'react-router-dom';

export default function Terms() {
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
            Terms of Service
          </h1>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: '48px' }}>
            Last updated: February 15, 2026
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', color: 'var(--text-secondary)' }}>
            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                1. Legal Entity
              </h2>
              <p>
                This Service is operated by QUANTACODES SOLUTIONS ("we", "us", or "our"). 
                By accessing or using seomcp.dev ("the Service"), you agree to be bound by these Terms of Service. 
                If you disagree with any part of the terms, you may not access the Service.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                2. Description of Service
              </h2>
              <p>
                seomcp.dev provides SEO tools through the Model Context Protocol (MCP) for AI assistants. 
                Our service includes access to Google Search Console, Google Analytics, site audits, and other SEO utilities.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                3. User Accounts
              </h2>
              <p>
                You must provide accurate and complete information when creating an account. 
                You are responsible for maintaining the security of your account and API keys. 
                Notify us immediately of any unauthorized access or use of your account.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                4. API Usage and Rate Limits
              </h2>
              <p>
                Each plan has specific API call limits. Free plans receive 100 calls/month, 
                Pro plans receive 2,000 calls/month. Rate limiting is enforced per API key. 
                We reserve the right to throttle or suspend access if usage patterns indicate abuse.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                5. Prohibited Activities
              </h2>
              <p>You agree not to:</p>
              <ul style={{ marginLeft: '24px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Use the service for any illegal purpose</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Resell, redistribute, or sublicense the API without written permission</li>
                <li>Engage in automated scraping or data harvesting</li>
                <li>Interfere with or disrupt the service or servers</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                6. Service Availability
              </h2>
              <p>
                We strive for 99.9% uptime but do not guarantee uninterrupted access. 
                Scheduled maintenance will be announced in advance. We are not liable for 
                downtime caused by factors beyond our control, including third-party API failures 
                (Google Search Console, Google Analytics).
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                7. Intellectual Property
              </h2>
              <p>
                All content, trademarks, and data on seomcp.dev are our property or licensed to us. 
                You retain ownership of your data. By using our service, you grant us a license to 
                process your data solely for the purpose of providing the service.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                8. Termination
              </h2>
              <p>
                We may terminate or suspend your account immediately for violations of these terms. 
                You may cancel your subscription at any time. Upon termination, your API keys will 
                be deactivated, and you must cease using the service.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                9. Limitation of Liability
              </h2>
              <p>
                seomcp.dev is provided "as is" without warranties. We are not liable for any 
                indirect, incidental, or consequential damages arising from your use of the service. 
                Our total liability shall not exceed the amount you paid us in the last 12 months.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                10. Changes to Terms
              </h2>
              <p>
                We may modify these terms at any time. We will notify users of significant changes 
                via email or dashboard notification. Continued use of the service after changes 
                constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                11. Contact
              </h2>
              <p>
                For questions about these Terms, contact us at: support@seomcp.dev
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
