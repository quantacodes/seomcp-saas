import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import { Menu, X, Copy, Check, ArrowRight, ChevronDown } from 'lucide-react';

// Navigation Component
function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { isSignedIn } = useUser();
  const { signOut, openSignIn, openSignUp } = useClerk();
  
  // Redirect to dashboard after auth
  const signInRedirect = { redirectUrl: '/dashboard' };
  const signUpRedirect = { redirectUrl: '/dashboard' };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav className={`nav ${isScrolled ? 'scrolled' : ''}`}>
        <div className="nav-inner">
          <Link to="/" className="nav-logo">seomcp<span className="dot">.dev</span></Link>
          <div className="nav-links">
            <a href="#tools">Tools</a>
            <a href="#pricing">Pricing</a>
            <Link to="/docs">Docs</Link>
            {isSignedIn ? (
              <>
                <Link to="/dashboard">Dashboard</Link>
                <button 
                  onClick={() => signOut()}
                  style={{ fontSize: '14px', color: 'var(--text-secondary)' }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => openSignIn(signInRedirect)}
                  className="nav-link-btn"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => openSignUp(signUpRedirect)}
                  className="nav-cta"
                >
                  Get Free Key
                </button>
              </>
            )}
          </div>
          <button 
            className="nav-hamburger" 
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            aria-label="Menu"
          >
            {isMobileNavOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Nav */}
      <div className={`mobile-nav ${isMobileNavOpen ? 'open' : ''}`}>
        <a href="#tools" onClick={() => setIsMobileNavOpen(false)}>Tools</a>
        <a href="#pricing" onClick={() => setIsMobileNavOpen(false)}>Pricing</a>
        <Link to="/docs" onClick={() => setIsMobileNavOpen(false)}>Docs</Link>
        {isSignedIn ? (
          <>
            <Link to="/dashboard" onClick={() => setIsMobileNavOpen(false)}>Dashboard</Link>
            <button onClick={() => { signOut(); setIsMobileNavOpen(false); }}>Sign Out</button>
          </>
        ) : (
          <>
            <button 
              onClick={() => { openSignIn(signInRedirect); setIsMobileNavOpen(false); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '18px', fontWeight: 500, textAlign: 'left', padding: '16px' }}
            >
              Sign In
            </button>
            <button 
              onClick={() => { openSignUp(signUpRedirect); setIsMobileNavOpen(false); }}
              className="nav-cta-mobile"
            >
              Start Free — 100 API Calls
            </button>
          </>
        )}
      </div>
    </>
  );
}

// Hero Section
function HeroSection() {
  const [copied, setCopied] = useState(false);
  const { isSignedIn } = useUser();
  const { openSignUp } = useClerk();
  const signUpRedirect = { redirectUrl: '/dashboard' };

  const copyCode = () => {
    navigator.clipboard.writeText(`{
  "mcpServers": {
    "seo-mcp": {
      "command": "npx",
      "args": ["-y", "github:quantacodes/seomcp-proxy"],
      "env": {
        "SEOMCP_API_KEY": "YOUR_API_KEY_HERE",
        "GOOGLE_SERVICE_ACCOUNT": "/path/to/service-account.json",
        "GA4_PROPERTIES": "123456789:example.com",
        "GSC_PROPERTIES": "example.com"
      }
    }
  }
}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="hero" style={{
      position: 'relative',
      padding: '168px 0 120px',
      textAlign: 'center',
      overflow: 'hidden',
    }}>
      {/* Background gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(229,164,48,0.06) 0%, rgba(74,222,128,0.03) 50%, transparent 100%)',
        pointerEvents: 'none',
      }} />
      
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '900px',
        height: '500px',
        background: 'rgba(229, 164, 48, 0.10)',
        borderRadius: '50%',
        filter: 'blur(120px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div className="container" style={{ position: 'relative', zIndex: 10 }}>
        {/* Early Access Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '9999px',
          background: 'rgba(229, 164, 48, 0.04)',
          border: '1px solid rgba(229, 164, 48, 0.12)',
          color: 'var(--amber)',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          marginBottom: '16px',
        }}>
          <span style={{ position: 'relative', width: '8px', height: '8px' }}>
            <span style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'var(--amber)',
              animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
            }} />
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--amber)',
              display: 'block',
            }} />
          </span>
          EARLY ACCESS
        </div>

        <h1 className="h1 h1-shimmer" style={{ marginBottom: '20px' }}>
          39 SEO tools.<br />One line of config.
        </h1>
        
        <p className="body-lg text-secondary" style={{ maxWidth: '640px', margin: '0 auto 40px' }}>
          Give your AI agent real SEO superpowers. Google Search Console
          analytics, site audits, indexing automation, performance reports —
          all through the Model Context Protocol.
        </p>

        {/* Code Block */}
        <div style={{ maxWidth: '520px', margin: '0 auto 40px', textAlign: 'left' }}>
          <div className="code-block">
            <div className="code-header">
              <div className="code-dots">
                <span className="red" /><span className="yellow" /><span className="green" />
              </div>
              <span className="code-filename">mcp.json</span>
              <button className="code-copy" onClick={copyCode}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? ' Copied' : ' Copy'}
              </button>
            </div>
            <div className="code-body" style={{ padding: '16px 20px' }}>
              <pre style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
<span className="punct">{'{'}</span> <span className="key">&quot;mcpServers&quot;</span><span className="punct">: {'{'}</span> <span className="key">&quot;seo-mcp&quot;</span><span className="punct">: {'{'}</span> <span className="key">&quot;command&quot;</span><span className="punct">:</span> <span className="str">&quot;npx&quot;</span><span className="punct">, </span><span className="key">&quot;args&quot;</span><span className="punct">: [</span><span className="str">&quot;-y&quot;</span><span className="punct">, </span><span className="str">&quot;github:quantacodes/seomcp-proxy&quot;</span><span className="punct">], </span><span className="key">&quot;env&quot;</span><span className="punct">: {'{'}</span> <span className="key">&quot;SEOMCP_API_KEY&quot;</span><span className="punct">:</span> <span className="str">&quot;...&quot;</span><span className="punct">, </span><span className="key">&quot;GOOGLE_SERVICE_ACCOUNT&quot;</span><span className="punct">:</span> <span className="str">&quot;...&quot;</span><span className="punct">, </span><span className="key">&quot;GA4_PROPERTIES&quot;</span><span className="punct">:</span> <span className="str">&quot;...&quot;</span><span className="punct">, </span><span className="key">&quot;GSC_PROPERTIES&quot;</span><span className="punct">:</span> <span className="str">&quot;...&quot;</span> <span className="punct">{'}'}{'}'}{'}'}</span> <span className="punct">{'}'}</span>
              </pre>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="hero-ctas" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '32px',
        }}>
          {isSignedIn ? (
            <Link to="/dashboard" className="btn-primary">
              Go to Dashboard <ArrowRight size={18} />
            </Link>
          ) : (
            <div className="btn-glow-wrap">
              <button className="btn-primary" onClick={() => openSignUp(signUpRedirect)}>
                Get Free API Key <ArrowRight size={18} />
              </button>
            </div>
          )}
          <a href="#demo" className="btn-text">See Live Demo</a>
        </div>

        {/* Subline */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          marginTop: '20px',
        }}>
          <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>✓ No credit card</span>
          <span style={{ color: 'var(--amber)', fontWeight: 600 }}>·</span>
          <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>✓ 1,000 free calls/mo</span>
          <span style={{ color: 'var(--amber)', fontWeight: 600 }}>·</span>
          <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>✓ 39 tools</span>
          <span style={{ color: 'var(--amber)', fontWeight: 600 }}>·</span>
          <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>✓ 30 second setup</span>
        </div>

        {/* Trust line */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          marginTop: '32px',
        }}>
          <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Works with</span>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Claude</span>
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Cursor</span>
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Windsurf</span>
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>Any MCP client</span>
        </div>
      </div>
    </section>
  );
}

// Tools Section
function ToolsSection() {
  const categories = [
    {
      icon: '🔍',
      name: 'Crawling & Audit',
      count: '5 tools',
      tools: [
        'Full Site Audit — Crawl your entire site',
        'Single Page Analysis — Deep-dive into any URL',
        'Robots.txt Testing — Validate crawl directives',
        'Comprehensive Report — 16-section audit',
      ],
    },
    {
      icon: '📊',
      name: 'Search Console',
      count: '8 tools',
      tools: [
        'Search Performance — Clicks, impressions, CTR',
        'URL Inspection — Check indexing status',
        'Sitemap Management — Submit and manage sitemaps',
        'Keyword Analysis — Top-performing queries',
      ],
    },
    {
      icon: '📈',
      name: 'Google Analytics',
      count: '9 tools',
      tools: [
        'Custom Reports — Flexible metrics and dimensions',
        'Top Pages — Best-performing content',
        'Real-Time Analytics — Live visitor activity',
        'Traffic Sources — Where visitors come from',
      ],
    },
    {
      icon: '⚡',
      name: 'Core Web Vitals',
      count: '2 tools',
      tools: [
        'Performance Scoring — LCP, INP, CLS metrics',
        'Lighthouse Analysis — Full PageSpeed report',
      ],
    },
    {
      icon: '🏗️',
      name: 'Schema & Validation',
      count: '3 tools',
      tools: [
        'Structured Data Check — Validate JSON-LD',
        'Robots.txt Analysis — Deep crawl analysis',
        'Sitemap Validation — Verify XML structure',
      ],
    },
    {
      icon: '🚀',
      name: 'Instant Indexing',
      count: '4 tools',
      tools: [
        'Submit URLs — Push pages to search engines',
        'Bulk Submission — Submit hundreds of URLs',
        'Sitemap-Based Submit — Index from sitemap',
        'File-Based Submit — Submit from text file',
      ],
    },
  ];

  return (
    <section className="section section-border" id="tools">
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 className="h2" style={{ marginBottom: '12px' }}>Every SEO tool your agent needs</h2>
          <p className="body-lg text-secondary">Organized by workflow. Your agent picks the right tool automatically.</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
        }}>
          {categories.map((cat) => (
            <div key={cat.name} style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '28px',
              transition: 'border-color 0.2s, transform 0.2s',
            }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>{cat.icon}</div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{cat.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>{cat.count}</div>
              <ul style={{ listStyle: 'none' }}>
                {cat.tools.map((tool, i) => (
                  <li key={i} style={{
                    fontSize: '14px',
                    color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: i === 0 ? 500 : 400,
                    padding: '8px 0',
                    borderTop: i > 0 ? '1px solid rgba(42, 42, 54, 0.5)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: 'var(--amber)',
                      opacity: 0.6,
                    }} />
                    {tool}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: '32px' }}>
          <Link to="/docs" className="btn-text" style={{ color: 'var(--amber)' }}>
            View full documentation →
          </Link>
        </p>
      </div>
    </section>
  );
}

// Pricing Section
function PricingSection() {
  const { isSignedIn } = useUser();
  const { openSignUp } = useClerk();
  const signUpRedirect = { redirectUrl: '/dashboard' };

  return (
    <section className="section section-border" id="pricing">
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 className="h2" style={{ marginBottom: '12px' }}>Start free. Scale when ready.</h2>
          <p className="body-lg text-secondary">No credit card required. Get your API key in 30 seconds.</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '32px',
          maxWidth: '820px',
          margin: '0 auto',
        }}>
          {/* Free */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Free</div>
            <div style={{ fontSize: '56px', lineHeight: '64px', fontWeight: 700, marginBottom: '4px' }}>$0</div>
            <div style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '8px' }}>forever</div>
            <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '28px' }}>
              Perfect for trying it out. No strings attached.
            </div>
            <ul style={{ listStyle: 'none', textAlign: 'left', marginBottom: '28px' }}>
              {['All 39 SEO tools', '1,000 tool calls per month', 'All MCP clients supported', '1 API key', 'Google Search Console', 'Core Web Vitals & PageSpeed', 'IndexNow instant indexing'].map((feat, i) => (
                <li key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '9px 0',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  borderTop: i > 0 ? '1px solid rgba(42,42,54,0.5)' : 'none',
                }}>
                  <span style={{ color: 'var(--sage)' }}>✓</span> {feat}
                </li>
              ))}
              <li style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 0', fontSize: '14px', color: 'var(--text-tertiary)' }}>
                <span>—</span> <span>Google Analytics 4</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 0', fontSize: '14px', color: 'var(--text-tertiary)' }}>
                <span>—</span> <span>Priority support</span>
              </li>
            </ul>
            {isSignedIn ? (
              <Link to="/dashboard" className="btn-primary" style={{
                width: '100%',
                justifyContent: 'center',
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-active)',
                color: 'var(--text-primary)',
              }}>
                Go to Dashboard
              </Link>
            ) : (
              <button 
                className="btn-primary" 
                onClick={() => openSignUp(signUpRedirect)}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-active)',
                  color: 'var(--text-primary)',
                }}
              >
                Get Free API Key
              </button>
            )}
          </div>

          {/* Pro */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid rgba(229,164,48,0.4)',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            position: 'relative',
            boxShadow: '0 0 40px rgba(229,164,48,0.08)',
          }}>
            <div style={{
              position: 'absolute',
              top: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--amber)',
              color: 'var(--bg-deep)',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '4px 16px',
              borderRadius: '20px',
            }}>Most Popular</div>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Pro</div>
            <div style={{ fontSize: '56px', lineHeight: '64px', fontWeight: 700, marginBottom: '4px', color: 'var(--amber)' }}>$29</div>
            <div style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '8px' }}>per month</div>
            <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '28px' }}>
              Replace $200+/mo in API subscriptions. Cancel anytime.
            </div>
            <ul style={{ listStyle: 'none', textAlign: 'left', marginBottom: '28px' }}>
              {['All 39 SEO tools', '10,000 tool calls/month', 'All MCP clients supported', '5 API keys', 'Google Search Console + Analytics', 'Core Web Vitals & PageSpeed', 'IndexNow instant indexing', 'Audit history & scheduling', 'Rate limit handling built-in', 'Priority support'].map((feat, i) => (
                <li key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '9px 0',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  borderTop: i > 0 ? '1px solid rgba(42,42,54,0.5)' : 'none',
                }}>
                  <span style={{ color: 'var(--sage)' }}>✓</span> {feat}
                </li>
              ))}
            </ul>
            {isSignedIn ? (
              <Link to="/dashboard" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Go to Dashboard
              </Link>
            ) : (
              <button 
                className="btn-primary" 
                onClick={() => openSignUp(signUpRedirect)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Start Free — Upgrade Anytime
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// FAQ Section
function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is MCP?',
      a: 'MCP (Model Context Protocol) is an open standard by Anthropic that lets AI tools connect to external services. Think of it like USB-C for AI — one protocol, any tool. Claude, Cursor, Windsurf, and OpenAI all support MCP.',
    },
    {
      q: 'What tools are included?',
      a: '39 tools across 6 categories: Site crawling & audits, Google Search Console (8 tools), Google Analytics 4 (11 tools), Core Web Vitals, Schema validation, and IndexNow instant indexing.',
    },
    {
      q: 'Is there a free tier?',
      a: 'Yes. Free tier includes 1,000 tool calls per month with access to all 39 tools. No credit card required.',
    },
    {
      q: 'Can I use this with my AI framework?',
      a: 'If it supports MCP remote servers, yes. We use the standard Streamable HTTP transport. Works with Claude Desktop, Cursor, Windsurf, VS Code, and any custom MCP client.',
    },
    {
      q: 'How is this different from using SEO APIs directly?',
      a: 'Instead of managing 5+ API subscriptions ($200+/month), juggling multiple auth flows, and spending weeks on integration, you get one API key, one config line, and 30 seconds to setup.',
    },
    {
      q: 'Is my data secure?',
      a: 'Yes. API keys are SHA-256 hashed. Google tokens are AES-256-GCM encrypted. Each user gets isolated processes. All traffic is HTTPS. We never store your SEO data — it flows through our server directly to your AI tool.',
    },
  ];

  return (
    <section className="section section-border" id="faq">
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h2 className="h2">Frequently asked questions</h2>
        </div>

        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{
              borderTop: '1px solid var(--border-subtle)',
              borderBottom: i === faqs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '20px 0',
                  textAlign: 'left',
                  fontSize: '17px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                {faq.q}
                <ChevronDown
                  size={18}
                  style={{
                    color: 'var(--text-tertiary)',
                    transform: openIndex === i ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.3s',
                  }}
                />
              </button>
              <div style={{
                maxHeight: openIndex === i ? '200px' : 0,
                overflow: 'hidden',
                transition: 'max-height 0.4s ease, padding 0.3s ease',
                paddingBottom: openIndex === i ? '24px' : 0,
              }}>
                <p style={{ fontSize: '15px', lineHeight: '24px', color: 'var(--text-secondary)' }}>
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Footer Section
function Footer() {
  const { isSignedIn } = useUser();
  const { openSignUp } = useClerk();
  const signUpRedirect = { redirectUrl: '/dashboard' };

  return (
    <>
      <section style={{
        padding: '120px 0',
        textAlign: 'center',
        background: 'linear-gradient(180deg, var(--bg-deep) 0%, rgba(229,164,48,0.04) 100%)',
      }}>
        <div className="container">
          <h2 className="h2" style={{ marginBottom: '24px' }}>
            Your agent is one config line away<br />from 39 SEO tools.
          </h2>
          {isSignedIn ? (
            <Link to="/dashboard" className="btn-primary" style={{ fontSize: '18px', padding: '16px 36px' }}>
              Go to Dashboard →
            </Link>
          ) : (
            <button className="btn-primary" onClick={() => openSignUp(signUpRedirect)} style={{ fontSize: '18px', padding: '16px 36px' }}>
              Start Free — Get API Key →
            </button>
          )}
        </div>
      </section>

      <footer style={{ padding: '32px 0', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
              <span style={{ fontWeight: 600 }}>seomcp<span style={{ color: 'var(--amber)' }}>.dev</span></span>
              <span style={{ marginLeft: '16px' }}>© 2026</span>
            </div>
            <div style={{ display: 'flex', gap: '24px' }}>
              <Link to="/docs" style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Docs</Link>
              <a href="#pricing" style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Pricing</a>
              <Link to="/terms" style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Terms</Link>
              <Link to="/privacy" style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Privacy</Link>
              <Link to="/refund" style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Refund</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

// Cookie Banner
function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('seomcp_cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem('seomcp_cookie_consent', 'accepted');
    setShow(false);
  };

  const decline = () => {
    localStorage.setItem('seomcp_cookie_consent', 'declined');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className={`cookie-banner show`}>
      <div className="cookie-content">
        <p className="cookie-text">
          We use cookies for analytics and to improve your experience. No tracking pixels or third-party ads.
        </p>
        <div className="cookie-actions">
          <button className="cookie-btn cookie-btn-secondary" onClick={decline}>Decline</button>
          <button className="cookie-btn cookie-btn-primary" onClick={accept}>Accept</button>
        </div>
      </div>
    </div>
  );
}

// Main Landing Page
export default function LandingPage() {
  return (
    <>
      <Navigation />
      <main>
        <HeroSection />

        <ToolsSection />
        <PricingSection />
        <FAQSection />
        <Footer />
      </main>
      <CookieBanner />
    </>
  );
}
