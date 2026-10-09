import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheckIcon, PayPalMark } from '../components/common/Icons';
import { useApp } from '../context/AppContext';

export const MainLayout: React.FC = () => {
  const { user, paypalConnected } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/shop', label: 'Shop with AI', icon: '🛍️' },
    { path: '/authorizations', label: 'Authorizations', icon: '🛡️' },
    { path: '/transactions', label: 'Transactions', icon: '💳' },
    { path: '/security', label: 'Security Center', icon: '🔒' },
    { path: '/attack-lab', label: 'Attack Lab', icon: '⚡' },
    { path: '/settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* Sidebar - Desktop */}
      <aside
        style={{
          width: '260px',
          backgroundColor: 'var(--navy-dark)',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 40
        }}
        className="desktop-sidebar"
      >
        {/* Brand Header */}
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                backgroundColor: 'var(--paypal-blue)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 69, 124, 0.4)'
              }}
            >
              <ShieldCheckIcon size={20} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.05em', color: '#FFFFFF' }}>
                PAYGUARD
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: '0.7rem',
              color: '#94A3B8',
              marginTop: '0.35rem',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              lineHeight: 1.3
            }}
          >
            Continuous Authorization for AI Payments
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ padding: '1rem 0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.7rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#FFFFFF' : '#94A3B8',
                backgroundColor: isActive ? 'var(--paypal-blue)' : 'transparent',
                transition: 'background-color 0.15s ease, color 0.15s ease'
              })}
            >
              <span style={{ fontSize: '1rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer: PayPal Sandbox Status & User Profile */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#071324' }}>
          {/* PayPal Sandbox Status Badge */}
          <button
            onClick={() => navigate('/settings')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 0.75rem',
              backgroundColor: paypalConnected ? 'rgba(0, 69, 124, 0.25)' : 'rgba(239, 68, 68, 0.1)',
              border: paypalConnected ? '1px solid rgba(0, 121, 193, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1rem',
              cursor: 'pointer',
              textAlign: 'left'
            }}
            title="Click to configure PayPal Gateway in Settings"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PayPalMark size={16} />
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E2E8F0' }}>
                  PayPal Sandbox
                </div>
                <div style={{ fontSize: '0.65rem', color: paypalConnected ? '#94A3B8' : '#FCA5A5' }}>
                  {paypalConnected ? 'Connected (Gateway Active)' : 'Disconnected (Inactive)'}
                </div>
              </div>
            </div>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: paypalConnected ? '#10B981' : '#EF4444',
                boxShadow: paypalConnected ? '0 0 6px #10B981' : '0 0 6px #EF4444'
              }}
              title={paypalConnected ? 'Connected to PayPal Sandbox' : 'PayPal Gateway Disconnected'}
            />
          </button>

          {/* User Profile */}
          <button
            onClick={() => navigate('/settings')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'transparent',
              border: 'none',
              padding: '0.25rem 0',
              cursor: 'pointer',
              textAlign: 'left'
            }}
            title="View User Profile in Settings"
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#1E293B',
                border: '2px solid #334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: '#E2E8F0'
              }}
            >
              AV
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F1F5F9', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748B', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.email}
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile Header Bar */}
        <header
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.25rem',
            backgroundColor: 'var(--navy-dark)',
            color: '#FFFFFF',
            position: 'sticky',
            top: 0,
            zIndex: 50
          }}
          className="mobile-header"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheckIcon size={20} color="#FFFFFF" />
            <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.04em' }}>PAYGUARD</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => navigate('/settings')}
              className={paypalConnected ? "badge badge-paypal" : "badge badge-blocked"}
              style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', cursor: 'pointer', border: 'none' }}
              title="Configure in Settings"
            >
              {paypalConnected ? 'Sandbox Active' : 'Sandbox Inactive'}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              style={{
                color: '#FFFFFF',
                padding: '0.4rem',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              top: '56px',
              backgroundColor: 'var(--navy-dark)',
              zIndex: 45,
              display: 'flex',
              flexDirection: 'column',
              padding: '1rem'
            }}
            className="mobile-drawer"
          >
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '1rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#FFFFFF' : '#94A3B8',
                    backgroundColor: isActive ? 'var(--paypal-blue)' : 'rgba(255,255,255,0.03)'
                  })}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Logged in as {user.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>PayPal: {user.paypalAccountEmail}</div>
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <main style={{ flex: 1, padding: '2rem', maxWidth: '1400px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }} className="main-viewport">
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .desktop-sidebar {
            display: none !important;
          }
          .mobile-header {
            display: flex !important;
          }
          .main-viewport {
            padding: 1.25rem !important;
          }
        }
      `}</style>
    </div>
  );
};
