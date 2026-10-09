import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ShieldCheckIcon, LockIcon } from '../components/common/Icons';
import { TrustMatrix } from '../components/common/TrustMatrix';

export const DashboardPage: React.FC = () => {
  const { user, authorization, accountBalance, aiAuthorizedBudget, updateBudgetLimit, showToast } = useApp();

  const [showEditBudgetModal, setShowEditBudgetModal] = useState(false);
  const [newBudgetAmount, setNewBudgetAmount] = useState(authorization?.maxAmount || 20000);

  const isProtectionActive = authorization && authorization.status === 'ACTIVE' && authorization.remainingAmount > 0;

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBudgetAmount < 500) {
      showToast('Minimum budget is ₹500.');
      return;
    }
    updateBudgetLimit(newBudgetAmount);
    setShowEditBudgetModal(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Greeting Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy-dark)', letterSpacing: '-0.02em' }}>
              Good evening, {user.name.split(' ')[0]}
            </h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Your AI is protected by <strong style={{ color: 'var(--paypal-blue)' }}>PayGuard</strong>.
            </p>
          </div>

          {/* Prominent Protection Status Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 1rem',
              backgroundColor: isProtectionActive ? 'var(--color-approved-bg)' : 'var(--color-blocked-bg)',
              border: isProtectionActive ? '1px solid var(--color-approved-border)' : '1px solid var(--color-blocked-border)',
              borderRadius: 'var(--radius-full)'
            }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isProtectionActive ? 'var(--color-approved)' : 'var(--color-blocked)',
                boxShadow: `0 0 8px ${isProtectionActive ? 'var(--color-approved)' : 'var(--color-blocked)'}`
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: isProtectionActive ? '#065F46' : '#991B1B', fontWeight: 700, letterSpacing: '0.05em' }}>
                PayGuard Protection
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isProtectionActive ? 'var(--color-approved)' : 'var(--color-blocked)' }}>
                {isProtectionActive ? '🟢 Active & Enforcing Limits' : `🔴 Inactive (${authorization?.status || 'No Authorization'})`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CORE FINANCIAL BOUNDARY: Account Balance vs AI Authorized Budget */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem'
        }}
      >
        {/* Account Balance Card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Account Balance
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card-subtle)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              PayPal Wallet
            </span>
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--navy-dark)', letterSpacing: '-0.03em' }}>
            ₹{accountBalance.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Total liquid balance in your linked account.
          </div>
          <div
            style={{
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              color: 'var(--color-neutral)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <LockIcon size={14} color="var(--text-muted)" />
            <span>AI does <strong>not</strong> have direct access to this balance</span>
          </div>
        </div>

        {/* AI Authorized Budget Card - With functional Edit Budget button */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: isProtectionActive ? '2px solid var(--paypal-accent)' : '2px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            boxShadow: isProtectionActive ? '0 4px 12px rgba(0, 121, 193, 0.1)' : 'var(--shadow-sm)',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--paypal-blue)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              AI Authorized Budget
            </span>
            <button
              type="button"
              onClick={() => {
                setNewBudgetAmount(authorization?.maxAmount || 20000);
                setShowEditBudgetModal(true);
              }}
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--paypal-blue)',
                backgroundColor: 'var(--paypal-light)',
                border: '1px solid #BAE6FD',
                padding: '0.2rem 0.55rem',
                borderRadius: 'var(--radius-full)'
              }}
            >
              Change Limit ✎
            </button>
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: isProtectionActive ? 'var(--paypal-blue)' : 'var(--text-muted)', letterSpacing: '-0.03em' }}>
            ₹{aiAuthorizedBudget.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {authorization ? `Max Cap: ₹${authorization.maxAmount.toLocaleString('en-IN')} • ${authorization.transactionsUsed}/${authorization.transactionLimit} used` : 'No active budget granted to agent.'}
          </div>
          <div
            style={{
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              color: isProtectionActive ? 'var(--paypal-blue)' : 'var(--color-blocked)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <ShieldCheckIcon size={14} color={isProtectionActive ? "var(--paypal-blue)" : "var(--color-blocked)"} />
            <span>{isProtectionActive ? 'Strict ceiling enforced by PayGuard Gateway' : 'Zero funds accessible to AI'}</span>
          </div>
        </div>

        {/* Active Authorization Scope */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Active Authorization
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {authorization ? `${authorization.transactionLimit} Txn Max` : '0 Txn'}
            </span>
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
            {authorization && authorization.status === 'ACTIVE' ? authorization.purpose : authorization?.status === 'REVOKED' ? 'Revoked (No Authority)' : authorization?.status === 'USED' ? 'Completed' : 'None Active'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Remaining budget: <strong>₹{aiAuthorizedBudget.toLocaleString('en-IN')}</strong>
          </div>
          <div
            style={{
              marginTop: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {authorization ? authorization.id : 'N/A'}
            </span>
            <Link
              to="/authorizations"
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--paypal-accent)',
                textDecoration: 'underline'
              }}
            >
              Manage Authorization →
            </Link>
          </div>
        </div>
      </div>

      {/* Trust Callout Banner: The Bounded Principle */}
      <div
        style={{
          backgroundColor: 'var(--navy-card)',
          color: '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          border: '1px solid #1E3A8A'
        }}
      >
        <div style={{ maxWidth: '750px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <ShieldCheckIcon size={18} color="#38BDF8" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38BDF8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Core Principle
            </span>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFFFFF' }}>
            "AI gets capability, not custody."
          </div>
          <div style={{ fontSize: '0.85rem', color: '#CBD5E1', marginTop: '0.2rem' }}>
            The AI agent cannot move money outside the financial authority explicitly granted by you. If it tries to purchase beyond ₹{aiAuthorizedBudget.toLocaleString('en-IN')} or for another purpose, PayGuard terminates the transaction.
          </div>
        </div>

        <Link
          to="/shop"
          style={{
            backgroundColor: 'var(--paypal-accent)',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '0.9rem',
            padding: '0.75rem 1.5rem',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 4px 10px rgba(0, 121, 193, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>Shop with AI</span>
          <span>→</span>
        </Link>
      </div>

      {/* PAYGUARD SECURITY GATEWAY CARD (Step 8 Requirement) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '2px solid var(--paypal-blue)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          boxShadow: '0 4px 14px rgba(0, 69, 124, 0.09)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#059669', boxShadow: '0 0 8px #059669' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
              PAYGUARD SECURITY GATEWAY
            </h2>
            <span className="badge badge-approved" style={{ fontSize: '0.75rem' }}>
              PROTECTED
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Continuous Authorization: <strong style={{ color: '#059669' }}>ACTIVE</strong> • PayPal Access: <strong style={{ color: 'var(--paypal-blue)' }}>GATED (ALLOW ONLY)</strong>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.85rem',
            backgroundColor: 'var(--bg-card-subtle)',
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem'
          }}
        >
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>IDENTITY</div>
            <div style={{ fontWeight: 700, color: '#065F46', marginTop: '0.2rem' }}>✓ Passkey Verified</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>INTENT LOCK</div>
            <div style={{ fontWeight: 700, color: '#065F46', marginTop: '0.2rem' }}>✓ Locked & Bound</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>AGENT SESSION</div>
            <div style={{ fontWeight: 700, color: '#065F46', marginTop: '0.2rem' }}>✓ Bounded Sandbox</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>REPLAY DEFENSE</div>
            <div style={{ fontWeight: 700, color: '#065F46', marginTop: '0.2rem' }}>✓ Burned Nonce Ledger</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>GATEWAY RISK</div>
            <div style={{ fontWeight: 700, color: 'var(--paypal-blue)', marginTop: '0.2rem' }}>LOW (0/100)</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>PAYPAL DISPATCH</div>
            <div style={{ fontWeight: 700, color: '#0369A1', marginTop: '0.2rem' }}>Enclave-Gated</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <div>
            Defends against: Prompt Injections • Budget Overruns • Recipient Tampering • Replay Tokens • Stale Requests
          </div>
          <Link to="/attack-lab" style={{ color: 'var(--paypal-blue)', fontWeight: 700, textDecoration: 'underline' }}>
            Run Gateway Tests in Attack Lab →
          </Link>
        </div>
      </div>

      {/* Security Status Detailed Component */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
              Security Status & Gateway Health
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Continuous verification stream between Agent Capability, PayGuard Policy Engine, and PayPal Sandbox.
            </p>
          </div>
          <span className={isProtectionActive ? "badge badge-approved" : "badge badge-blocked"}>
            {isProtectionActive ? "● 100% Policy Interception" : "● Authority Revoked"}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
          }}
        >
          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE AUTHORIZATION</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-dark)', marginTop: '0.25rem' }}>
              {authorization ? authorization.purpose : 'None'}
            </div>
            <div style={{ fontSize: '0.75rem', color: isProtectionActive ? 'var(--color-approved)' : 'var(--color-blocked)', marginTop: '0.25rem' }}>
              {isProtectionActive ? "✓ Intent token valid" : "✕ Inactive / Terminated"}
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>POLICY PROTECTION</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-dark)', marginTop: '0.25rem' }}>
              Hard Cap ₹{aiAuthorizedBudget.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-approved)', marginTop: '0.25rem' }}>
              ✓ Overrun blocker armed
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TRANSACTION MONITORING</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-dark)', marginTop: '0.25rem' }}>
              Zero-Trust Nonce
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-approved)', marginTop: '0.25rem' }}>
              ✓ Replay defense active
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>AGENT AUTHORITY STATUS</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy-dark)', marginTop: '0.25rem' }}>
              Bounded Capability
            </div>
            <div style={{ fontSize: '0.75rem', color: isProtectionActive ? 'var(--color-approved)' : 'var(--color-blocked)', marginTop: '0.25rem' }}>
              {isProtectionActive ? "✓ Custody-free session" : "✕ Session blocked"}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '1rem' }}>
          Quick Actions
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
          }}
        >
          <Link
            to="/shop"
            style={{
              padding: '1.25rem',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ fontSize: '1.5rem' }}>🛍️</div>
            <div style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>Shop with AI</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Give instructions to your AI shopping assistant within bounded limits.
            </div>
          </Link>

          <Link
            to="/authorizations"
            style={{
              padding: '1.25rem',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ fontSize: '1.5rem' }}>🛡️</div>
            <div style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>Create Authorization</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Define purpose, transaction quota, and spending limits with Intent Lock.
            </div>
          </Link>

          <Link
            to="/transactions"
            style={{
              padding: '1.25rem',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ fontSize: '1.5rem' }}>💳</div>
            <div style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>View Transactions</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Inspect cleared payments and blocked overreach attempts.
            </div>
          </Link>

          <Link
            to="/attack-lab"
            style={{
              padding: '1.25rem',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ fontSize: '1.5rem' }}>⚡</div>
            <div style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>Run Security Test</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Execute adversarial simulation tests in Attack Lab against current policy.
            </div>
          </Link>
        </div>
      </div>

      {/* Edit Budget Modal */}
      {showEditBudgetModal && (
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
              maxWidth: '460px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              border: '2px solid var(--paypal-blue)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                Adjust AI Spending Authority
              </h3>
              <button onClick={() => setShowEditBudgetModal(false)} style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <form onSubmit={handleSaveBudget} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                  New Authorized Maximum (INR)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>₹</span>
                  <input
                    type="number"
                    value={newBudgetAmount}
                    onChange={(e) => setNewBudgetAmount(Number(e.target.value))}
                    min={500}
                    step={500}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem 0.65rem 2rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '1rem'
                    }}
                    required
                  />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  This updates the bounding ceiling enforced by the PayGuard policy gateway across all pages and the Attack Lab.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditBudgetModal(false)}
                  style={{
                    padding: '0.65rem 1rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    color: 'var(--text-secondary)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.65rem 1.5rem',
                    backgroundColor: 'var(--paypal-blue)',
                    color: '#FFFFFF',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 700
                  }}
                >
                  Save Budget Limit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Signature Trust Matrix */}
      <TrustMatrix />
    </div>
  );
};
