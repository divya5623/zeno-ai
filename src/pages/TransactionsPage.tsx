import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Transaction } from '../types';

export const TransactionsPage: React.FC = () => {
  const { transactions, authorization } = useApp();
  const [filter, setFilter] = useState<'ALL' | 'APPROVED' | 'BLOCKED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  const filteredTxns = transactions.filter((t) => {
    if (filter !== 'ALL' && t.status !== filter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = t.productName.toLowerCase().includes(q);
      const matchMerchant = t.merchant.toLowerCase().includes(q);
      const matchPurpose = t.purpose.toLowerCase().includes(q);
      const matchId = t.id.toLowerCase().includes(q);
      return matchName || matchMerchant || matchPurpose || matchId;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--paypal-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Auditable Ledger
          </span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy-dark)', letterSpacing: '-0.02em' }}>
          Transaction History
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Complete record of agent payment requests, evaluated against PayGuard Intent Locks and PayPal Sandbox.
        </p>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setFilter('ALL')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: filter === 'ALL' ? 'var(--paypal-blue)' : '#FFFFFF',
              color: filter === 'ALL' ? '#FFFFFF' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            All Activity ({transactions.length})
          </button>
          <button
            onClick={() => setFilter('APPROVED')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: filter === 'APPROVED' ? 'var(--color-approved)' : '#FFFFFF',
              color: filter === 'APPROVED' ? '#FFFFFF' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            🟢 Approved ({transactions.filter((t) => t.status === 'APPROVED').length})
          </button>
          <button
            onClick={() => setFilter('BLOCKED')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: filter === 'BLOCKED' ? 'var(--color-blocked)' : '#FFFFFF',
              color: filter === 'BLOCKED' ? '#FFFFFF' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            🔴 Blocked ({transactions.filter((t) => t.status === 'BLOCKED').length})
          </button>
        </div>

        {/* Functional Search Field */}
        <div style={{ position: 'relative', minWidth: '260px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product, merchant, or ID..."
            style={{
              width: '100%',
              padding: '0.5rem 2rem 0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-strong)',
              fontSize: '0.85rem'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Responsive Transaction Table (Card layout on small screens via CSS) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Product</th>
                <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Merchant</th>
                <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Amount</th>
                <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Purpose</th>
                <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Auth ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxns.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No transactions match your query.
                  </td>
                </tr>
              ) : (
                filteredTxns.map((txn) => (
                  <tr
                    key={txn.id}
                    onClick={() => setSelectedTxn(txn)}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                      {txn.productName}
                      {txn.reason && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-blocked)', marginTop: '0.2rem' }}>
                          Reason: {txn.reason}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {txn.merchant}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: txn.status === 'BLOCKED' ? 'var(--color-blocked)' : 'var(--navy-dark)' }}>
                      ₹{txn.amount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {txn.purpose}
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      {txn.status === 'APPROVED' && (
                        <span className="badge badge-approved">
                          🟢 Approved
                        </span>
                      )}
                      {txn.status === 'BLOCKED' && (
                        <span className="badge badge-blocked">
                          🔴 Blocked
                        </span>
                      )}
                      {txn.status === 'PENDING' && (
                        <span className="badge badge-warning">
                          🟡 Pending
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {txn.date}
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {txn.authorizationId}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Modal Detail with Security Reasoning */}
      {selectedTxn && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 25, 47, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem'
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '540px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              border: selectedTxn.status === 'BLOCKED' ? '2px solid #DC2626' : '2px solid var(--paypal-blue)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                Transaction & Policy Detail
              </h3>
              <button onClick={() => setSelectedTxn(null)} style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Transaction Reference:</span>
                <span className="mono" style={{ fontWeight: 700 }}>{selectedTxn.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Target Product:</span>
                <span style={{ fontWeight: 600 }}>{selectedTxn.productName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Merchant:</span>
                <span>{selectedTxn.merchant}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Transaction Amount:</span>
                <span style={{ fontWeight: 800, color: selectedTxn.status === 'BLOCKED' ? 'var(--color-blocked)' : 'var(--paypal-blue)' }}>
                  ₹{selectedTxn.amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Gateway Status:</span>
                <span className={selectedTxn.status === 'APPROVED' ? 'badge badge-approved' : 'badge badge-blocked'}>
                  {selectedTxn.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Authorization Token:</span>
                <span className="mono" style={{ color: 'var(--text-secondary)' }}>{selectedTxn.authorizationId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment Channel:</span>
                <span style={{ fontWeight: 600, color: selectedTxn.status === 'APPROVED' ? 'var(--paypal-blue)' : 'var(--color-blocked)' }}>
                  {selectedTxn.status === 'APPROVED' ? 'PayPal Sandbox (Dispatched)' : 'PAYPAL NOT CALLED'}
                </span>
              </div>

              {/* Transaction Trace (Step 8 Requirement) */}
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.35rem' }}>
                  CONTINUOUS AUTHORIZATION TRACE:
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {selectedTxn.status === 'APPROVED' ? (
                    <>
                      Human Identity ✓ → Intent Lock ✓ → Capability ✓ → Session ✓ → Gateway: ALLOW → PayPal Sandbox (Captured)
                    </>
                  ) : (
                    <>
                      Human Identity ✓ → Intent Lock ✓ → Capability ✓ → Gateway: <strong>BLOCK</strong> → <strong>PAYPAL NOT CALLED</strong>
                    </>
                  )}
                </div>
              </div>

              {selectedTxn.reason && (
                <div style={{ padding: '0.75rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: '#991B1B', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    Policy Enforcement Reason
                  </div>
                  <div style={{ color: '#7F1D1D', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    {selectedTxn.reason}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => setSelectedTxn(null)}
                style={{
                  padding: '0.65rem 1.5rem',
                  backgroundColor: 'var(--navy-dark)',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600
                }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
