import { Link } from 'react-router-dom';

export default function Refund() {
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
            Refund Policy
          </h1>
          <p style={{ color: 'var(--text-tertiary)', marginBottom: '48px' }}>
            Last updated: February 15, 2026
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', color: 'var(--text-secondary)' }}>
            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Free Trial
              </h2>
              <p>
                Our Free plan requires no credit card and provides 100 API calls per month 
                at no cost. You can use the Free plan indefinitely to evaluate our service 
                before upgrading.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                48-Hour Money-Back Guarantee
              </h2>
              <p>
                We offer a 48-hour money-back guarantee for all paid subscriptions. If you're 
                not satisfied with our service, you can request a full refund within 48 hours 
                of your initial purchase. No questions asked.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Eligibility for Refunds
              </h2>
              <p style={{ marginBottom: '16px' }}>
                You are eligible for a refund if:
              </p>
              <ul style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>You request within 48 hours of your first payment</li>
                <li>You haven't used more than 25% of your monthly API call allowance</li>
                <li>You haven't previously received a refund for the same account</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                How to Request a Refund
              </h2>
              <p>
                To request a refund, email us at support@seomcp.dev with:
              </p>
              <ul style={{ marginLeft: '24px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Your account email address</li>
                <li>Reason for the refund (optional, but helps us improve)</li>
                <li>Date of purchase</li>
              </ul>
              <p style={{ marginTop: '16px' }}>
                We process refund requests within 3-5 business days. Refunds are issued to 
                the original payment method.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Subscription Cancellations
              </h2>
              <p>
                You can cancel your subscription at any time from your dashboard. 
                Cancellation takes effect at the end of your current billing period. 
                You will continue to have access until the period ends.
              </p>
              <p style={{ marginTop: '16px' }}>
                <strong>Important:</strong> Canceling a subscription does not automatically 
                trigger a refund. You must explicitly request a refund within the 48-hour 
                window if eligible.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Exceptions
              </h2>
              <p style={{ marginBottom: '16px' }}>
                Refunds are generally not provided for:
              </p>
              <ul style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Requests made after the 48-hour window</li>
                <li>Accounts that have violated our Terms of Service</li>
                <li>Usage exceeding 25% of monthly allowance</li>
                <li>Refund requests for the same account (one refund per customer)</li>
              </ul>
              <p style={{ marginTop: '16px' }}>
                However, we review all requests individually and may make exceptions 
                on a case-by-case basis.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Downgrades
              </h2>
              <p>
                You can downgrade from Pro to Free at any time. Downgrades take effect 
                at the end of your current billing period. We do not provide partial 
                refunds for unused time when downgrading.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Service Issues
              </h2>
              <p>
                If our service experiences significant downtime or issues that prevent 
                you from using it, we may offer account credits or pro-rated refunds 
                at our discretion. Contact us with details of the issue.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Contact Us
              </h2>
              <p>
                For refund requests or billing questions, contact us at: support@seomcp.dev
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
