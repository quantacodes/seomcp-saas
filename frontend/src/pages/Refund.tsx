import { Link } from 'react-router-dom';
import { useLayoutEffect } from 'react';

export default function Refund() {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
            Last updated: February 16, 2026
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', color: 'var(--text-secondary)' }}>
            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Our Commitment
              </h2>
              <p>
                We want you to be completely satisfied with seomcp.dev. If our service doesn't meet
                your expectations, we offer a straightforward refund policy.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                14-Day Money-Back Guarantee
              </h2>
              <p>
                If you're not satisfied with seomcp.dev, you can request a full refund within 14 days
                of your purchase.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                How to Request a Refund
              </h2>
              <p>
                Email us at <a href="mailto:support@seomcp.dev" style={{ color: 'var(--amber)', textDecoration: 'none' }}>support@seomcp.dev</a> with
                your account email. Refunds are processed through Paddle, our payment provider, within 5-10 business days.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Cancellation
              </h2>
              <p>
                You can cancel your subscription at any time from your account settings or by contacting us.
                You'll retain access until the end of your current billing period.
              </p>
            </section>

            <section>
              <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Contact Us
              </h2>
              <p>
                Have questions about refunds or cancellations? We're here to help.
              </p>
              <p style={{ marginTop: '12px' }}>
                <strong>Email:</strong> <a href="mailto:support@seomcp.dev" style={{ color: 'var(--amber)', textDecoration: 'none' }}>support@seomcp.dev</a><br />
                <strong>Response time:</strong> Within 24 hours on business days
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
