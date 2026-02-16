import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser, useClerk } from '@clerk/clerk-react';
import type { ApiKey, UsageStats } from '../lib/api';
import { useApiClient, getErrorMessage } from '../lib/api';
import { 
  Key, 
  BarChart3, 
  Settings, 
  LogOut, 
  Copy, 
  Check, 
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  Menu,
  X
} from 'lucide-react';

// Sidebar Component
function Sidebar({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  plan = 'free'
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  isOpen: boolean;
  onClose: () => void;
  plan?: string;
}) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'keys', label: 'API Keys', icon: Key },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    signOut();
    navigate('/');
  };

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onClose();
  };

  return (
    <>
      {/* Mobile Overlay - only show on mobile */}
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 40,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
        className="mobile-overlay"
        onClick={onClose}
      />
      
      <aside style={{
        width: '240px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 50,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
      }}>
      {/* Logo */}
      <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ fontSize: '20px', fontWeight: 600 }}>
          seomcp<span style={{ color: 'var(--amber)' }}>.dev</span>
        </Link>
        <button 
          onClick={onClose}
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
          }}
          className="mobile-close-btn"
        >
          <X size={24} />
        </button>
      </div>

      {/* User info */}
      <div style={{
        padding: '0 24px 24px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Logged in as</p>
        <p style={{ fontSize: '14px', fontWeight: 500 }}>{user?.primaryEmailAddress?.emailAddress}</p>
        <span style={{
          display: 'inline-block',
          marginTop: '8px',
          padding: '4px 12px',
          background: plan === 'pro' ? 'var(--amber-muted)' : 'var(--bg-raised)',
          color: plan === 'pro' ? 'var(--amber)' : 'var(--text-secondary)',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          {plan} Plan
        </span>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: activeTab === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: activeTab === item.id ? 'var(--bg-raised)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '4px',
              }}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
    </>
  );
}

// Overview Tab
function OverviewTab() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { user } = useUser();
  const api = useApiClient();

  useEffect(() => {
    // Fetch stats initially
    const fetchStats = (isBackgroundRefresh = false) => {
      if (isBackgroundRefresh) setIsRefreshing(true);
      
      api.getStats()
        .then((data) => {
          setStats(data);
          setError(null);
          setLastUpdated(new Date());
        })
        .catch((err) => {
          // Only show error on initial load, not on background refresh
          if (!isBackgroundRefresh) {
            setError(getErrorMessage(err));
          }
        })
        .finally(() => {
          setIsLoading(false);
          setIsRefreshing(false);
        });
    };
    
    fetchStats(false);
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => fetchStats(true), 10000);
    
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Dashboard</h1>
        <div style={{ 
          height: '24px', 
          width: '200px', 
          background: 'var(--bg-raised)', 
          borderRadius: '4px',
          marginBottom: '32px',
          animation: 'pulse 2s ease-in-out infinite'
        }} />
        
        {/* Skeleton Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
          marginBottom: '32px',
        }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '24px',
            }}>
              <div style={{ height: '16px', width: '120px', background: 'var(--bg-raised)', borderRadius: '4px', marginBottom: '8px', animation: 'pulse 2s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
              <div style={{ height: '44px', width: '80px', background: 'var(--bg-raised)', borderRadius: '4px', marginBottom: '16px', animation: 'pulse 2s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
              <div style={{ height: '8px', width: '100%', background: 'var(--bg-raised)', borderRadius: '4px', marginBottom: '8px', animation: 'pulse 2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
            </div>
          ))}
        </div>
        
        {/* Skeleton API Keys */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <div style={{ height: '24px', width: '100px', background: 'var(--bg-raised)', borderRadius: '4px', marginBottom: '16px', animation: 'pulse 2s ease-in-out infinite' }} />
          <div style={{ height: '60px', width: '100%', background: 'var(--bg-raised)', borderRadius: '4px', animation: 'pulse 2s ease-in-out infinite', animationDelay: '0.1s' }} />
        </div>
      </div>
    );
  }

  if (error || !stats || typeof stats.used !== 'number') {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '400px',
        padding: '40px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'var(--coral-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}>
          <span style={{ fontSize: '32px' }}>⚠️</span>
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
          Something went wrong
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '400px' }}>
          {error || 'Failed to load stats'}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => window.location.reload()}
            className="btn-primary"
            style={{ padding: '10px 20px', fontSize: '14px' }}
          >
            Try Again
          </button>
          <button 
            onClick={() => setError(null)}
            className="btn-text"
            style={{ padding: '10px 20px', fontSize: '14px' }}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  const isUnlimited = typeof stats.limit === 'string' && (stats.limit === 'unlimited' || stats.limit === '∞');
  const limitNum = typeof stats.limit === 'number' ? stats.limit : 0;
  const usagePercent = isUnlimited ? 0 : Math.min(100, (stats.used / limitNum) * 100);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700 }}>Dashboard</h1>
        {isRefreshing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Refreshing...</span>
          </div>
        )}
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Welcome back, {user?.firstName || user?.primaryEmailAddress?.emailAddress?.split('@')[0]}!
        {lastUpdated && (
          <span style={{ marginLeft: '12px', opacity: 0.6 }}>
            (Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
          </span>
        )}
      </p>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '24px',
        marginBottom: '32px',
      }} className="stats-grid">
        {/* Usage Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              API Calls This Month
            </p>
            {lastUpdated && (
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <p style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>
            {stats?.used.toLocaleString()}
            <span style={{ fontSize: '16px', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
              / {isUnlimited ? '∞' : limitNum.toLocaleString()}
            </span>
          </p>
          
          {/* Progress bar */}
          <div style={{
            height: '8px',
            background: 'var(--bg-raised)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${usagePercent}%`,
              height: '100%',
              background: usagePercent > 80 ? 'var(--coral)' : usagePercent > 50 ? 'var(--amber)' : 'var(--sage)',
              borderRadius: '4px',
              transition: 'width 0.3s',
            }} />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
            {isUnlimited ? 'Unlimited' : `${stats?.remaining} calls remaining`}
          </p>
        </div>

        {/* Plan Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Current Plan
          </p>
          <p style={{ fontSize: '24px', fontWeight: 700, textTransform: 'capitalize', marginBottom: '8px' }}>
            {stats?.plan}
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
            {stats?.plan === 'free' 
              ? '1,000 calls/month' 
              : stats?.plan === 'pro' 
                ? '10,000 calls/month'
                : 'Unlimited calls'
            }
          </p>
          {stats?.plan === 'free' && (
            <Link to="/dashboard?tab=billing" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              color: 'var(--amber)',
            }}>
              Upgrade to Pro <ExternalLink size={14} />
            </Link>
          )}
        </div>

        {/* Quick Links Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Quick Links
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <a 
              href="https://api.seomcp.dev/docs" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <ExternalLink size={14} /> Documentation
            </a>
            <a 
              href="https://api.seomcp.dev/tools" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <ExternalLink size={14} /> Tool Catalog
            </a>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '24px',
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Getting Started</h3>
        <ol style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '20px' }}>
          <li style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Copy your API key</strong> from the API Keys tab
          </li>
          <li style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Add the MCP config</strong> to your AI agent (Claude, Cursor, etc.)
          </li>
          <li style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Start asking questions</strong> like "Audit my site" or "What keywords should I target?"
          </li>
        </ol>
      </div>
    </div>
  );
}

// API Keys Tab
function KeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = useApiClient();

  const loadKeys = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.listKeys();
      setKeys(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setError(null);
    try {
      const result = await api.createKey(newKeyName);
      setCreatedKey(result.key);
      setNewKeyName('');
      loadKeys();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    setError(null);
    try {
      await api.revokeKey(id);
      loadKeys();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (createdKey) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Success Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--sage-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Check size={28} style={{ color: 'var(--sage)' }} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>API Key Created</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            Copy this key now. You won't be able to see it again.
          </p>
          <div style={{
            background: 'var(--bg-deep)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <code style={{ flex: 1, fontSize: '13px', wordBreak: 'break-all', textAlign: 'left' }}>
              {createdKey}
            </code>
            <button
              onClick={() => copyKey(createdKey, 'new')}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              {copiedId === 'new' ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="btn-text"
          >
            Done
          </button>
        </div>

        {/* Setup Guide */}
        <SetupGuide apiKey={createdKey} />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>API Keys</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Manage your API keys. Keep them secure — don't share or expose in client-side code.
      </p>

      {/* Error Alert */}
      {error && (
        <div style={{
          background: 'var(--coral-muted)',
          border: '1px solid var(--coral)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <span style={{ flex: 1, fontSize: '14px' }}>{error}</span>
          <button 
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--coral)',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Create Key */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Create New Key</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g., Claude Desktop, Cursor IDE, Personal Laptop"
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '12px 16px',
              background: 'var(--bg-deep)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
          />
          <button
            onClick={createKey}
            disabled={!newKeyName.trim()}
            className="btn-primary"
            style={{ whiteSpace: 'nowrap' }}
          >
            <Plus size={18} /> Create Key
          </button>
        </div>
      </div>

      {/* Keys List */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--amber)' }} />
          </div>
        ) : keys.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            No API keys yet. Create one above.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>Key</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>Last Used</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const isKeyActive = key.isActive;
                return (
                  <tr key={key.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '16px 24px', fontSize: '14px' }}>{key.name}</td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', fontFamily: 'var(--font-mono)' }}>
                      {key.keyPrefix}...
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: isKeyActive ? 'var(--sage-muted)' : 'var(--bg-raised)',
                        color: isKeyActive ? 'var(--sage)' : 'var(--text-tertiary)',
                      }}>
                        {isKeyActive ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-tertiary)' }}>
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      {isKeyActive ? (
                        <button
                          type="button"
                          className="revoke-btn"
                          onClick={() => revokeKey(key.id)}
                          aria-label={`Revoke ${key.name} API key`}
                        >
                          <Trash2 size={16} /> Revoke
                        </button>
                      ) : (
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: 'var(--bg-raised)',
                          color: 'var(--text-tertiary)',
                        }}>
                          Revoked
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Settings Tab
function SettingsTab() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();

  return (
    <div>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>Settings</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Manage your account settings.
      </p>

      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Account Information</h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Email
            </label>
            <p style={{ fontSize: '14px' }}>{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Name
            </label>
            <p style={{ fontSize: '14px' }}>{user?.fullName || 'Not set'}</p>
          </div>
        </div>
        <button
          onClick={() => openUserProfile()}
          className="btn-primary"
          style={{ marginTop: '24px' }}
        >
          Manage Account
        </button>
      </div>

      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '24px',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--coral)' }}>Danger Zone</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Once you delete your account, there is no going back.
        </p>
        <button
          style={{
            padding: '10px 20px',
            background: 'transparent',
            border: '1px solid var(--coral)',
            color: 'var(--coral)',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
          onClick={() => openUserProfile()}
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}

// Setup Guide Component
function SetupGuide({ apiKey }: { apiKey: string }) {
  const [activeTab, setActiveTab] = useState('claude');

  const tabs = [
    { id: 'claude', label: 'Claude Desktop' },
    { id: 'cursor', label: 'Cursor' },
    { id: 'vscode', label: 'VS Code' },
  ];

  const configs = {
    claude: `// ~/Library/Application Support/Claude/claude_desktop_config.json (Mac)
// %APPDATA%/Claude/claude_desktop_config.json (Windows)
{
  "mcpServers": {
    "seo-mcp": {
      "command": "npx",
      "args": ["-y", "github:quantacodes/seomcp-proxy"],
      "env": {
        "SEOMCP_API_KEY": "${apiKey}",
        "GOOGLE_SERVICE_ACCOUNT": "/path/to/service-account.json",
        "GA4_PROPERTIES": "123456789:example.com,987654321:blog.example.com",
        "GSC_PROPERTIES": "example.com,blog.example.com"
      }
    }
  }
}`,
    cursor: `// .cursor/mcp.json (project) or ~/.cursor/mcp.json (global)
{
  "mcpServers": {
    "seo-mcp": {
      "command": "npx",
      "args": ["-y", "github:quantacodes/seomcp-proxy"],
      "env": {
        "SEOMCP_API_KEY": "${apiKey}",
        "GOOGLE_SERVICE_ACCOUNT": "/path/to/service-account.json",
        "GA4_PROPERTIES": "123456789:example.com,987654321:blog.example.com",
        "GSC_PROPERTIES": "example.com,blog.example.com"
      }
    }
  }
}`,
    vscode: `// VS Code settings.json or .vscode/mcp.json
{
  "mcp": {
    "servers": {
      "seo-mcp": {
        "command": "npx",
        "args": ["-y", "github:quantacodes/seomcp-proxy"],
        "env": {
          "SEOMCP_API_KEY": "${apiKey}",
          "GOOGLE_SERVICE_ACCOUNT": "/path/to/service-account.json",
          "GA4_PROPERTIES": "123456789:example.com,987654321:blog.example.com",
          "GSC_PROPERTIES": "example.com,blog.example.com"
        }
      }
    }
  }
}`,
  };

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px',
      padding: '24px',
    }}>
      <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
        Next Steps: Configure Your MCP Client
      </h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        Choose your editor and copy the configuration. You'll also need a Google service account for full functionality.
      </p>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '16px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '12px'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              background: activeTab === tab.id ? 'var(--bg-raised)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Config Display */}
      <div style={{
        background: 'var(--bg-deep)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
            Configuration
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(configs[activeTab as keyof typeof configs])}
            className="btn-primary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            <Copy size={14} /> Copy
          </button>
        </div>
        <pre style={{ 
          fontSize: '13px', 
          overflow: 'auto',
          color: 'var(--text-secondary)'
        }}>
          {configs[activeTab as keyof typeof configs]}
        </pre>
      </div>

      {/* Instructions */}
      <div style={{ 
        padding: '16px',
        background: 'var(--bg-deep)',
        borderRadius: '8px',
        marginBottom: '16px',
      }}>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Setup Steps:</strong>
        </p>
        <ol style={{ fontSize: '14px', color: 'var(--text-secondary)', marginLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <li>Copy the config above</li>
          <li>Paste into your {activeTab === 'claude' ? 'Claude Desktop config file' : activeTab === 'cursor' ? 'Cursor MCP settings' : 'VS Code MCP settings'}</li>
          <li>Add your <code>GOOGLE_SERVICE_ACCOUNT</code> path</li>
          <li><strong>Required:</strong> Set your <code>GA4_PROPERTIES</code> and <code>GSC_PROPERTIES</code></li>
          <li>Restart your editor</li>
        </ol>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '12px' }}>
          <strong>Quick Setup:</strong>
          <br/>• <code>GA4_PROPERTIES</code>: <code>propertyID:domain</code> format
          <br/>• <code>GSC_PROPERTIES</code>: Just domain names (we auto-add <code>sc-domain:</code>)
          <br/><br/>
          💡 Find GA4 Property ID in GA4 → Admin → Property Settings
          <br/>💡 Find GSC Property in Search Console → Settings
          <br/><br/>
          <strong>Example mapping:</strong> example.com ↔ 123456789, blog.example.com ↔ 987654321
        </p>
      </div>

      {/* Help Links */}
      <div style={{ 
        display: 'flex', 
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <Link 
          to="/docs"
          style={{ fontSize: '14px', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          Full Documentation →
        </Link>
        <Link 
          to="/docs#google-setup"
          style={{ fontSize: '14px', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          Google Setup →
        </Link>
      </div>
    </div>
  );
}

// Main Dashboard
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userPlan, setUserPlan] = useState<string>('free');
  const api = useApiClient();

  // Fetch user plan from API on mount
  useEffect(() => {
    api.getStats()
      .then((data) => {
        if (data.plan) {
          setUserPlan(data.plan);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-deep)' }}>
      {/* Desktop Sidebar */}
      <div className="desktop-sidebar">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={true}
          onClose={() => setSidebarOpen(false)}
          plan={userPlan}
        />
      </div>

      {/* Mobile Sidebar */}
      <div className="mobile-sidebar">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          plan={userPlan}
        />
      </div>
      
      <main style={{
        flex: 1,
        marginLeft: '0',
        padding: '32px 40px',
      }} className="main-content">
        {/* Mobile Header */}
        <div className="mobile-header" style={{
          display: 'none',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
        }}>
          <button 
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '10px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <Menu size={20} />
          </button>
          <span style={{ fontSize: '18px', fontWeight: 600 }}>
            seomcp<span style={{ color: 'var(--amber)' }}>.dev</span>
          </span>
        </div>
        
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'keys' && <KeysTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
      
      {/* Responsive Styles */}
      <style>{`
        @media (min-width: 1024px) {
          .desktop-sidebar { display: block; }
          .mobile-sidebar { display: none; }
          .mobile-header { display: none !important; }
          .main-content { margin-left: 240px !important; }
          .mobile-close-btn { display: none !important; }
          .mobile-overlay { display: none !important; }
        }
        
        @media (max-width: 1023px) {
          .desktop-sidebar { display: none; }
          .mobile-sidebar { display: block; }
          .mobile-header { display: flex !important; }
          .main-content { margin-left: 0 !important; padding: 24px !important; }
          .mobile-close-btn { display: block !important; }
        }
      `}</style>
    </div>
  );
}
