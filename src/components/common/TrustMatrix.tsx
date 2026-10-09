import React from 'react';

export const TrustMatrix: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: compact ? '1rem' : '1.5rem',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-dark)', letterSpacing: '-0.01em' }}>
          Continuous Financial Authority Matrix
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          AI gets capability, not custody. PayGuard strictly enforces authorization boundaries at the policy gateway.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem'
        }}
      >
        {/* What AI Can Do */}
        <div
          style={{
            backgroundColor: 'var(--color-approved-bg)',
            border: '1px solid var(--color-approved-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--color-approved)',
              fontWeight: 700,
              fontSize: '0.85rem',
              marginBottom: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            <span>AI CAN</span>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: '#064E3B' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800 }}>✓</span> Search vendor catalogs & query specs
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800 }}>✓</span> Compare pricing across authorized merchants
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800 }}>✓</span> Recommend products matching student criteria
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800 }}>✓</span> Request bounded checkout under strict policy limit
            </li>
          </ul>
        </div>

        {/* What AI Cannot Do */}
        <div
          style={{
            backgroundColor: 'var(--color-blocked-bg)',
            border: '1px solid var(--color-blocked-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--color-blocked)',
              fontWeight: 700,
              fontSize: '0.85rem',
              marginBottom: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            <span>AI CANNOT</span>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: '#7F1D1D' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800 }}>✕</span> Increase its spending authority or budget limit
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800 }}>✕</span> Change purpose scope without re-authentication
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800 }}>✕</span> Reuse expired nonces or consumed transaction quotas
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800 }}>✕</span> Approve its own payments or touch account balance
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
