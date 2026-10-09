import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheckIcon, LockIcon } from '../components/common/Icons';
import { IntentParsingResult } from '../types';

export const AuthorizationsPage: React.FC = () => {
  const {
    authorization,
    authorizationHistory,
    intentLock,
    agentCapability,
    revokeAuthorization,
    createIntentLock,
    editActiveLock,
    parseIntentPrompt,
    extendAuthorizationExpiry,
    showToast
  } = useApp();

  // Wizard step: 'create' | 'review'
  const [step, setStep] = useState<'create' | 'review'>('create');

  // Form state
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('Find me a laptop for college under ₹20,000.');
  const [parsedResult, setParsedResult] = useState<IntentParsingResult>(() => parseIntentPrompt('Find me a laptop for college under ₹20,000.'));
  
  // Editable form fields
  const [action, setAction] = useState<"PURCHASE" | "TRANSFER" | "BILL_PAY" | "SUBSCRIPTION">('PURCHASE');
  const [purpose, setPurpose] = useState('College laptop');
  const [category, setCategory] = useState('LAPTOP');
  const [spendingLimit, setSpendingLimit] = useState(20000);
  const [recipient, setRecipient] = useState('');
  const [merchant, setMerchant] = useState('');
  const [transactionLimit, setTransactionLimit] = useState(1);
  const [expiryMinutes, setExpiryMinutes] = useState(30);

  // Modals
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState(15);
  const [showSafeEditModal, setShowSafeEditModal] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'USED' | 'REVOKED' | 'EXPIRED'>('ALL');

  // Live countdown timer state
  const [timeLeftStr, setTimeLeftStr] = useState('29:42');

  // Parse prompt when naturalLanguageInput changes
  const handlePromptChange = (newPrompt: string) => {
    setNaturalLanguageInput(newPrompt);
    const parsed = parseIntentPrompt(newPrompt);
    setParsedResult(parsed);
    setAction(parsed.action);
    setPurpose(parsed.purpose);
    setCategory(parsed.category);
    if (parsed.spendingLimit > 0) {
      setSpendingLimit(parsed.spendingLimit);
    }
    setRecipient(parsed.recipient || '');
    setMerchant(parsed.merchant || '');
    setTransactionLimit(parsed.transactionLimit || 1);
    setExpiryMinutes(parsed.expiryMinutes || 30);
  };

  const applySamplePrompt = (sample: string) => {
    handlePromptChange(sample);
  };

  useEffect(() => {
    const activeObj = intentLock || authorization;
    if (!activeObj || activeObj.status !== 'ACTIVE') {
      setTimeLeftStr('Expired');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const expires = new Date(activeObj.expiresAt).getTime();
      const diffMs = expires - now;

      if (diffMs <= 0) {
        setTimeLeftStr('00:00 (Expired)');
      } else {
        const totalSecs = Math.floor(diffMs / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        setTimeLeftStr(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [intentLock, authorization]);

  const handleReviewClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (spendingLimit < 100) {
      showToast('Spending limit must be at least ₹100.');
      return;
    }
    if (!purpose.trim()) {
      showToast('Purpose is required.');
      return;
    }
    // Update parsed result with custom edits
    setParsedResult({
      ...parsedResult,
      action,
      purpose,
      category,
      spendingLimit,
      recipient: recipient.trim() ? recipient.trim() : null,
      merchant: merchant.trim() ? merchant.trim() : null,
      merchantConstraint: merchant.trim() ? "SPECIFIC" : "ANY",
      transactionLimit,
      expiryMinutes,
      isValidForLock: true
    });
    setStep('review');
  };

  const handleConfirmLock = async () => {
    if (authorization && authorization.status === 'ACTIVE') {
      // Safe replacement (Immutability Defense: revoke old, mint new)
      await editActiveLock(parsedResult);
    } else {
      await createIntentLock(parsedResult, false);
    }
    setStep('create');
  };

  const handleConfirmRevoke = () => {
    revokeAuthorization();
    setShowRevokeConfirm(false);
  };

  const handleConfirmExtend = () => {
    extendAuthorizationExpiry(extendMinutes);
    setShowExtendModal(false);
  };

  const filteredHistory = authorizationHistory.filter(h => {
    if (historyFilter === 'ALL') return true;
    return h.status === historyFilter;
  });

  const activeAuth = intentLock || authorization;
  const isLockActive = activeAuth && activeAuth.status === 'ACTIVE';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--paypal-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Intent Engine & Intent Lock Layer
          </span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy-dark)', letterSpacing: '-0.02em' }}>
          Financial Authorizations & Intent Locks
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Convert verified human intent into immutable payment boundaries. AI gets capability, not custody.
        </p>
      </div>

      {/* ACTIVE INTENT LOCK & CAPABILITY DISPLAY CARD */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: isLockActive ? '2px solid var(--paypal-blue)' : '2px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          boxShadow: '0 4px 12px rgba(0, 69, 124, 0.08)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--paypal-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--paypal-blue)'
              }}
            >
              <ShieldCheckIcon size={20} color="var(--paypal-blue)" />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Active Intent Lock Token
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                {activeAuth ? activeAuth.purpose : 'No Active Authorization'}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {activeAuth && activeAuth.status === 'ACTIVE' && (
              <span className="badge badge-approved" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                🟢 Locked & Active
              </span>
            )}
            {activeAuth && activeAuth.status === 'USED' && (
              <span className="badge badge-neutral" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                ⚪ Used (Quota Complete)
              </span>
            )}
            {activeAuth && activeAuth.status === 'REVOKED' && (
              <span className="badge badge-blocked" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                🔴 Revoked
              </span>
            )}
            {activeAuth && activeAuth.status === 'EXPIRED' && (
              <span className="badge badge-warning" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                🟡 Expired
              </span>
            )}

            {isLockActive && (
              <>
                <button
                  type="button"
                  onClick={() => setShowExtendModal(true)}
                  style={{
                    backgroundColor: 'var(--paypal-light)',
                    color: 'var(--paypal-blue)',
                    border: '1px solid #BAE6FD',
                    padding: '0.45rem 0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  Extend Expiry ⏱
                </button>
                <button
                  type="button"
                  onClick={() => setShowSafeEditModal(true)}
                  style={{
                    backgroundColor: '#EFF6FF',
                    color: 'var(--paypal-blue)',
                    border: '1px solid #BFDBFE',
                    padding: '0.45rem 0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  Edit Lock ✏️
                </button>
                <button
                  type="button"
                  onClick={() => setShowRevokeConfirm(true)}
                  style={{
                    backgroundColor: '#FEE2E2',
                    color: '#B91C1C',
                    border: '1px solid #FECACA',
                    padding: '0.45rem 0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  Revoke Authorization
                </button>
              </>
            )}
          </div>
        </div>

        {/* Authorization Parameters Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            backgroundColor: 'var(--bg-card-subtle)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACTION / CATEGORY</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy-dark)', marginTop: '0.2rem' }}>
              {activeAuth?.action || "PURCHASE"} / {activeAuth?.category || "LAPTOP"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>AUTHORIZED AMOUNT</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy-dark)', marginTop: '0.2rem' }}>
              ₹{activeAuth ? activeAuth.maxAmount.toLocaleString('en-IN') : '0'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>REMAINING BUDGET</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: activeAuth?.remainingAmount && activeAuth.remainingAmount > 0 ? 'var(--color-approved)' : 'var(--text-muted)', marginTop: '0.2rem' }}>
              ₹{activeAuth ? activeAuth.remainingAmount.toLocaleString('en-IN') : '0'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>MERCHANT / RECIPIENT</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-dark)', marginTop: '0.2rem' }}>
              {activeAuth?.merchant ? `Vendor: ${activeAuth.merchant}` : activeAuth?.recipient ? `Recipient: ${activeAuth.recipient}` : 'Any Authorized Store'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>EXPIRES IN</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: isLockActive ? 'var(--color-warning)' : 'var(--text-muted)', marginTop: '0.2rem' }}>
              {timeLeftStr}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>HUMAN VERIFICATION</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: activeAuth?.humanVerification?.identityVerified ? 'var(--color-approved)' : 'var(--navy-dark)', marginTop: '0.35rem' }}>
              {activeAuth?.humanVerification?.identityVerified ? '✓ Passkey Verified' : '○ Verified Session'}
            </div>
          </div>
        </div>

        {/* AI Capability Projection Box */}
        {agentCapability && isLockActive && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '1rem 1.25rem',
              backgroundColor: '#F8FAFC',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                🤖 AI Agent Capability Projection (Privilege Separation)
              </span>
              <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: '#E0F2FE', color: '#0369A1', borderRadius: '4px', fontWeight: 700 }}>
                NO CUSTODY • BOUNDED CAPABILITY
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              The AI agent holds only a temporary capability projection (<code className="mono">{agentCapability.capabilityId}</code>). It cannot access funds directly, change limits, or elevate authority.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', color: '#334155' }}>
                Allowed Action: <strong>{agentCapability.allowedAction}</strong>
              </span>
              <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', color: '#334155' }}>
                Category Boundary: <strong>{agentCapability.allowedCategory}</strong>
              </span>
              <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '4px', color: '#991B1B' }}>
                Mutate Lock: <strong>DENIED (Read-Only)</strong>
              </span>
              <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', color: '#334155' }}>
                Nonce: <code className="mono">{agentCapability.nonce.substring(0, 14)}...</code>
              </span>
            </div>
          </div>
        )}

        <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <LockIcon size={14} color="var(--paypal-blue)" />
            <span>Intent Lock ID: <code className="mono">{activeAuth ? activeAuth.id : 'N/A'}</code></span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0369A1' }}>
            Enclave Rule: Active Intent Locks are strictly immutable. Editing revokes and mints fresh tokens.
          </div>
        </div>
      </div>

      {/* CREATE INTENT & REVIEW FLOW */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.75rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {step === 'create' ? (
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-paypal" style={{ fontSize: '0.75rem' }}>
                  Step 1 of 2: Intent Specification
                </span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-dark)', marginTop: '0.5rem' }}>
                Specify Intent with Natural Language
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                The PayGuard Intent Engine deterministically parses your instruction into an enforceable payment policy.
              </p>
            </div>

            {/* Quick Sample Prompts */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Try Example Intents:
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => applySamplePrompt('Buy me a laptop for college under ₹20,000')}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.65rem',
                    backgroundColor: '#F0F9FF',
                    color: '#0369A1',
                    border: '1px solid #BAE6FD',
                    borderRadius: '4px',
                    fontWeight: 600
                  }}
                >
                  💻 College laptop &lt; ₹20k
                </button>
                <button
                  type="button"
                  onClick={() => applySamplePrompt('Send ₹4,500 to Alice for book share')}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.65rem',
                    backgroundColor: '#F0FDF4',
                    color: '#15803D',
                    border: '1px solid #BBF7D0',
                    borderRadius: '4px',
                    fontWeight: 600
                  }}
                >
                  💸 Send ₹4,500 to Alice
                </button>
                <button
                  type="button"
                  onClick={() => applySamplePrompt('Ergonomic office chair under ₹8,000 from Amazon')}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.65rem',
                    backgroundColor: '#FAF5FF',
                    color: '#7E22CE',
                    border: '1px solid #E9D5FF',
                    borderRadius: '4px',
                    fontWeight: 600
                  }}
                >
                  🪑 Office chair &lt; ₹8k (Amazon)
                </button>
                <button
                  type="button"
                  onClick={() => applySamplePrompt('Buy me something')}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.65rem',
                    backgroundColor: '#FFFBEB',
                    color: '#B45309',
                    border: '1px solid #FDE68A',
                    borderRadius: '4px',
                    fontWeight: 600
                  }}
                >
                  ⚠️ Ambiguous: "Buy me something"
                </button>
              </div>
            </div>

            <form onSubmit={handleReviewClick} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Natural-language input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                  Natural-Language Intent
                </label>
                <textarea
                  rows={3}
                  value={naturalLanguageInput}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="e.g. Find me a laptop for college under ₹20,000."
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    outline: 'none',
                    fontSize: '0.95rem'
                  }}
                  required
                />
              </div>

              {/* Parsing Feedback & Confidence */}
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: parsedResult.confidence === 'HIGH' ? '#F0FDF4' : parsedResult.confidence === 'MEDIUM' ? '#EFF6FF' : '#FFFBEB',
                  border: `1px solid ${parsedResult.confidence === 'HIGH' ? '#BBF7D0' : parsedResult.confidence === 'MEDIUM' ? '#BFDBFE' : '#FDE68A'}`,
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                      Intent Engine Parsing Analysis
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: parsedResult.confidence === 'HIGH' ? '#DCFCE7' : parsedResult.confidence === 'MEDIUM' ? '#DBEAFE' : '#FEF3C7',
                        color: parsedResult.confidence === 'HIGH' ? '#166534' : parsedResult.confidence === 'MEDIUM' ? '#1E40AF' : '#92400E'
                      }}
                    >
                      {parsedResult.confidence} CONFIDENCE ({Math.round(parsedResult.confidenceScore * 100)}%)
                    </span>
                  </div>
                </div>

                {/* Clarification prompt banner if ambiguous */}
                {parsedResult.clarificationPrompt ? (
                  <div style={{ color: '#B45309', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>⚠️ Ambiguity Detected:</span> {parsedResult.clarificationPrompt}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', color: '#166534' }}>
                    ✓ Extracted: <strong>{parsedResult.action}</strong> for <strong>"{parsedResult.purpose}"</strong> (Category: {parsedResult.category}) capped at <strong>₹{parsedResult.spendingLimit.toLocaleString('en-IN')}</strong>
                  </div>
                )}
              </div>

              {/* Structured Parameter Adjustments */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem'
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                    Action
                  </label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    <option value="PURCHASE">PURCHASE (Product / Item)</option>
                    <option value="TRANSFER">TRANSFER (Send funds)</option>
                    <option value="BILL_PAY">BILL_PAY (Utilities / Services)</option>
                    <option value="SUBSCRIPTION">SUBSCRIPTION (Recurring)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                    Purpose
                  </label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    <option value="LAPTOP">LAPTOP</option>
                    <option value="ELECTRONICS">ELECTRONICS</option>
                    <option value="FURNITURE">FURNITURE</option>
                    <option value="SERVICES">SERVICES</option>
                    <option value="UTILITY">UTILITY</option>
                    <option value="GENERAL">GENERAL</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                    Spending Limit (INR)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>₹</span>
                    <input
                      type="number"
                      value={spendingLimit}
                      onChange={(e) => setSpendingLimit(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.75rem 0.65rem 2rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                      min={100}
                      step={500}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                    Merchant Restriction (Optional)
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    placeholder="e.g. Amazon (Leave blank for ANY)"
                    onChange={(e) => setMerchant(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                    Recipient Restriction (Optional)
                  </label>
                  <input
                    type="text"
                    value={recipient}
                    placeholder="e.g. Alice (Leave blank for purchase)"
                    onChange={(e) => setRecipient(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                    Transaction Quota
                  </label>
                  <input
                    type="number"
                    value={transactionLimit}
                    onChange={(e) => setTransactionLimit(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    min={1}
                    max={5}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                    Authorization Expiry (TTL)
                  </label>
                  <select
                    value={expiryMinutes}
                    onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={!parsedResult.isValidForLock && spendingLimit <= 0}
                  style={{
                    backgroundColor: 'var(--paypal-blue)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    padding: '0.75rem 1.75rem',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 2px 8px rgba(0, 69, 124, 0.3)',
                    cursor: 'pointer'
                  }}
                >
                  Review Authorization & Policy →
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* STEP 2: MANDATORY HUMAN REVIEW SCREEN */
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <span className="badge badge-paypal" style={{ marginBottom: '0.5rem' }}>
                Step 2 of 2: Human Review & Cryptographic Anchor
              </span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                Review Intent Lock Authority Parameters
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                The AI agent will receive only the bounded authority listed below. Review before minting token.
              </p>
            </div>

            {/* Immutability / Existing Active Warning */}
            {isLockActive && (
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#92400E',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                <LockIcon size={18} color="#D97706" />
                <span>
                  <strong>Active Intent Lock Present ({activeAuth?.id}):</strong> Creating this authorization will atomically revoke the active lock and issue a new Intent Lock with a fresh nonce. Active locks cannot be edited in place.
                </span>
              </div>
            )}

            {/* Parameters Table */}
            <div
              style={{
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                marginBottom: '1.5rem'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Action</span>
                <span style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{action}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Purpose</span>
                <span style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{purpose}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Category</span>
                <span style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{category}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Maximum Spending Ceiling</span>
                <span style={{ fontWeight: 800, color: 'var(--paypal-blue)', fontSize: '1.15rem' }}>₹{spendingLimit.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Merchant Constraint</span>
                <span style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{merchant ? `Restricted strictly to: ${merchant}` : 'Any Authorized Merchant'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Recipient Constraint</span>
                <span style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{recipient ? `Restricted to: ${recipient}` : 'N/A (Merchant purchase)'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Transaction Limit</span>
                <span style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{transactionLimit} cycle(s)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: '0.85rem 1.25rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>Expires In</span>
                <span style={{ fontWeight: 600, color: 'var(--navy-dark)' }}>{expiryMinutes} minutes</span>
              </div>
            </div>

            {/* WHAT THE AI CAN DO vs WHAT THE AI CANNOT DO */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#166534', marginBottom: '0.5rem' }}>
                  ✓ The AI Agent CAN:
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#15803D', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li>Search and recommend items for <strong>"{purpose}"</strong></li>
                  <li>Initiate checkout up to ₹{spendingLimit.toLocaleString('en-IN')}</li>
                  <li>Act within the next {expiryMinutes} minutes</li>
                  <li>Complete exactly {transactionLimit} transaction(s)</li>
                </ul>
              </div>

              <div style={{ padding: '1rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#991B1B', marginBottom: '0.5rem' }}>
                  ✕ The AI Agent CANNOT:
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#B91C1C', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li>Spend ₹1 beyond ₹{spendingLimit.toLocaleString('en-IN')}</li>
                  <li>Modify, escalate, or tamper with this Intent Lock</li>
                  <li>Divert payment to unauthorized merchants or recipients</li>
                  <li>Hold or transfer custody of your funds</li>
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setStep('create')}
                style={{
                  padding: '0.75rem 1.25rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  color: 'var(--text-secondary)'
                }}
              >
                ← Edit Intent
              </button>
              <button
                type="button"
                onClick={handleConfirmLock}
                style={{
                  padding: '0.75rem 1.75rem',
                  backgroundColor: 'var(--paypal-blue)',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(0, 69, 124, 0.3)'
                }}
              >
                Confirm & Lock Intent 🔒
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AUTHORIZATION HISTORY SECTION */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
              Authorization History & Audit Ledger
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Tokens minted, consumed, safely replaced, revoked, or expired.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {(['ALL', 'USED', 'REVOKED', 'EXPIRED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setHistoryFilter(tab)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: historyFilter === tab ? 'var(--navy-dark)' : 'var(--bg-card-subtle)',
                  color: historyFilter === tab ? '#FFFFFF' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredHistory.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '1rem', textAlign: 'center' }}>
              No authorizations match filter.
            </div>
          ) : (
            filteredHistory.map((hist) => (
              <div
                key={hist.id}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>{hist.purpose}</span>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hist.id}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Limit: <strong>₹{hist.maxAmount.toLocaleString('en-IN')}</strong> • Used: {hist.transactionsUsed}/{hist.transactionLimit} txns • Nonce: <code className="mono">{hist.nonce?.substring(0, 10) || 'auth_token'}...</code>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={hist.status === 'ACTIVE' ? 'badge badge-approved' : hist.status === 'REVOKED' ? 'badge badge-blocked' : hist.status === 'USED' ? 'badge badge-neutral' : 'badge badge-warning'}>
                    {hist.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      {showRevokeConfirm && (
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
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              border: '2px solid #DC2626'
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#991B1B' }}>
              Revoke AI Purchasing Authority?
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to revoke this authorization? The AI agent's capability token will be immediately severed and burned. Any pending or in-flight checkout attempts will be blocked by the PayGuard policy gateway.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(false)}
                style={{
                  padding: '0.65rem 1.25rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  color: 'var(--text-secondary)'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                style={{
                  padding: '0.65rem 1.5rem',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700
                }}
              >
                Yes, Revoke Authority
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Edit Intent Modal */}
      {showSafeEditModal && (
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
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              border: '2px solid var(--paypal-blue)'
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
              Safe Re-Authorization (Immutability Defense)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Changing this authorization will <strong>revoke the current active token ({activeAuth?.id})</strong> and mint a new Intent Lock with a fresh cryptographic nonce. This ensures agents cannot escalate or mutate active permissions. Continue?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowSafeEditModal(false)}
                style={{
                  padding: '0.65rem 1.25rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  color: 'var(--text-secondary)'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSafeEditModal(false);
                  setStep('create');
                }}
                style={{
                  padding: '0.65rem 1.5rem',
                  backgroundColor: 'var(--paypal-blue)',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700
                }}
              >
                Proceed to Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Expiry Modal */}
      {showExtendModal && (
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
              maxWidth: '440px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              border: '2px solid var(--paypal-blue)'
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
              Extend Authorization Expiry
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Grant your AI shopping agent additional execution window to complete its search under human oversight.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                Additional Time (Minutes)
              </label>
              <select
                value={extendMinutes}
                onChange={(e) => setExtendMinutes(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#FFFFFF'
                }}
              >
                <option value={15}>+15 minutes</option>
                <option value={30}>+30 minutes</option>
                <option value={60}>+60 minutes</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowExtendModal(false)}
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
                type="button"
                onClick={handleConfirmExtend}
                style={{
                  padding: '0.65rem 1.5rem',
                  backgroundColor: 'var(--paypal-blue)',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700
                }}
              >
                Extend Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
