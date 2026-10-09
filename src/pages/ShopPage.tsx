import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheckIcon, LockIcon, XIcon, CheckIcon, PayPalMark } from '../components/common/Icons';
import { Product } from '../types';

export const ShopPage: React.FC = () => {
  const {
    authorization,
    intentLock,
    validateIntentDrift,
    products,
    selectedProduct,
    preparePayment,
    confirmPayPalPayment,
    activePaymentRequest,
    clearPaymentRequest,
    parseAndSetIntent,
    verifyDevicePasskey,
    userIdentity,
    lastHumanVerification
  } = useApp();

  const [promptInput, setPromptInput] = useState("Find me a laptop for college under ₹20,000.");
  const [isSearching, setIsSearching] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [paymentEvaluating, setPaymentEvaluating] = useState(false);
  const [isVerifyingHumanStepUp, setIsVerifyingHumanStepUp] = useState(false);

  // PayPal checkout simulation states: 'idle' | 'processing' | 'done'
  const [payPalCheckoutStep, setPayPalCheckoutStep] = useState<'idle' | 'processing' | 'done'>('idle');
  const [completedTxnId, setCompletedTxnId] = useState<string | null>(null);

  // Dynamic live agent activity steps
  const agentSteps = [
    {
      id: "step-1",
      label: "Understanding your request",
      status: "completed" as const,
      details: `Prompt parsed. Category: Laptop | Cap: ₹${authorization ? authorization.maxAmount.toLocaleString('en-IN') : '20,000'}`
    },
    {
      id: "step-2",
      label: "Searching registered merchant catalogs",
      status: "completed" as const,
      details: "Queried CampusTech & MegaByte for student computing inventory"
    },
    {
      id: "step-3",
      label: "Filtering within Intent Lock bounds",
      status: "completed" as const,
      details: `Active boundary: ₹${authorization?.status === 'ACTIVE' ? authorization.remainingAmount.toLocaleString('en-IN') : '0 (Authority Terminated)'}`
    },
    {
      id: "step-4",
      label: "Checking authorization status",
      status: authorization?.status === 'ACTIVE' ? "completed" as const : "pending" as const,
      details: authorization ? `Token ${authorization.id} status: ${authorization.status}` : "No active token found"
    },
    {
      id: "step-5",
      label: "Ready for user checkout selection",
      status: isSearching ? "in_progress" as const : "completed" as const,
      details: "Enclave waiting for bounded purchase request"
    }
  ];

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    parseAndSetIntent(promptInput);
    setTimeout(() => {
      setIsSearching(false);
    }, 600);
  };

  const handleInitiatePurchase = async (product: Product) => {
    setPaymentEvaluating(true);
    setPayPalCheckoutStep('idle');
    setCompletedTxnId(null);
    setTimeout(async () => {
      await preparePayment(product);
      setPaymentEvaluating(false);
    }, 350);
  };

  const handleStepUpPasskeyAuth = async () => {
    if (!selectedProduct) return;
    setIsVerifyingHumanStepUp(true);
    try {
      const authRes = await verifyDevicePasskey();
      if (authRes.success) {
        // Re-evaluate payment with newly verified human evidence
        await preparePayment(selectedProduct);
      }
    } finally {
      setIsVerifyingHumanStepUp(false);
    }
  };

  const handleExecutePayPalDispatch = async () => {
    setPayPalCheckoutStep('processing');
    try {
      setTimeout(async () => {
        const res = await confirmPayPalPayment();
        setCompletedTxnId(res.txnId);
        setPayPalCheckoutStep('done');
      }, 1200);
    } catch (err) {
      console.error(err);
      setPayPalCheckoutStep('idle');
    }
  };

  const handleModalClose = () => {
    clearPaymentRequest();
    setPayPalCheckoutStep('idle');
    setCompletedTxnId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Title & Shop Entry Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--paypal-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Continuous Authorization in Action
          </span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy-dark)', letterSpacing: '-0.02em' }}>
          Shop with AI
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Tell your AI what you want. PayGuard controls what it is allowed to purchase.
        </p>
      </div>

      {/* NATURAL-LANGUAGE INPUT BAR with Mic & Send */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <form onSubmit={handlePromptSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.6rem 1rem'
            }}
          >
            <span style={{ color: 'var(--text-muted)', marginRight: '0.75rem', fontSize: '1.1rem' }}>💬</span>
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="e.g. Find me a laptop for college under ₹20,000."
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'var(--text-primary)',
                fontWeight: 500
              }}
              aria-label="AI shopping prompt"
            />
          </div>

          {/* Microphone button (UI placeholder as instructed) */}
          <button
            type="button"
            title="Microphone voice input (UI placeholder)"
            style={{
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-strong)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem'
            }}
            onClick={() => {
              setPromptInput("Find me a laptop for college under ₹20,000.");
              parseAndSetIntent("Find me a laptop for college under ₹20,000.");
            }}
          >
            🎤
          </button>

          {/* Send button */}
          <button
            type="submit"
            style={{
              backgroundColor: 'var(--paypal-blue)',
              color: '#FFFFFF',
              fontWeight: 600,
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 6px rgba(0, 69, 124, 0.3)'
            }}
          >
            <span>{isSearching ? 'Analyzing...' : 'Instruct Agent'}</span>
            <span>➔</span>
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <div>Parsed Intent: "College laptop" • Bounded Cap: ₹{authorization?.status === 'ACTIVE' ? authorization.remainingAmount.toLocaleString('en-IN') : '0'}</div>
          <div style={{ color: authorization?.status === 'ACTIVE' ? 'var(--color-approved)' : 'var(--color-blocked)', fontWeight: 600 }}>
            ● Policy Gateway: {authorization?.status === 'ACTIVE' ? `Active Authorization (₹${authorization.remainingAmount.toLocaleString('en-IN')} remaining)` : `Authorization ${authorization?.status || 'Missing'}`}
          </div>
        </div>
      </div>

      {/* TWO COLUMN GRID: Left = Products, Right = Live Agent Activity & Bounded Authority */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
          alignItems: 'start'
        }}
      >
        {/* PRODUCTS SECTION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
              Candidate Products Found by Agent
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Evaluated against real authorization state
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {products.map((product) => {
              // Dynamic check against active authorization
              const currentCap = authorization && authorization.status === 'ACTIVE'
                ? authorization.remainingAmount
                : 0;
              const isOverBudget = product.price > currentCap;
              const driftResult = validateIntentDrift({
                title: product.name,
                category: product.category,
                merchant: product.merchant,
                amount: product.price
              });
              const isBlockedState = !authorization || authorization.status !== 'ACTIVE' || isOverBudget || driftResult.hasDrift;

              return (
                <div
                  key={product.id}
                  style={{
                    backgroundColor: isBlockedState ? '#FFF8F8' : '#FFFFFF',
                    border: isBlockedState ? '1.5px solid #FECACA' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                          {product.name}
                        </h3>

                        {isBlockedState ? (
                          <span
                            className="badge badge-blocked"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <LockIcon size={12} color="var(--color-blocked)" />
                            <span>{driftResult.hasDrift ? `Drift: ${driftResult.driftType}` : 'Outside authorized budget'}</span>
                          </span>
                        ) : (
                          <span className="badge badge-approved">
                            ✓ Within authorization
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        {product.subtitle}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                        Merchant: <strong>{product.merchant}</strong>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '110px' }}>
                      <div
                        style={{
                          fontSize: '1.35rem',
                          fontWeight: 800,
                          color: isBlockedState ? 'var(--color-blocked)' : 'var(--navy-dark)'
                        }}
                      >
                        ₹{product.price.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {isOverBudget ? `Exceeds current authority` : 'Eligible for checkout'}
                      </div>
                    </div>
                  </div>

                  {/* Specs list */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                    {product.specs.map((spec, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '0.75rem',
                          backgroundColor: isBlockedState ? '#FEE2E2' : 'var(--bg-card-subtle)',
                          color: isBlockedState ? '#991B1B' : 'var(--text-secondary)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px'
                        }}
                      >
                        {spec}
                      </span>
                    ))}
                  </div>

                  {/* Action row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '0.75rem',
                      marginTop: '0.25rem'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: isBlockedState ? '#B91C1C' : 'var(--color-neutral)' }}>
                      {isBlockedState
                        ? (driftResult.hasDrift ? `🔒 PayGuard Rule: ${driftResult.explanation}` : `🔒 PayGuard Rule: Exceeds authorized budget (Remaining: ₹${currentCap.toLocaleString('en-IN')})`)
                        : `✓ Authorized under "${authorization?.purpose}" intent`}
                    </div>

                    <button
                      onClick={() => handleInitiatePurchase(product)}
                      disabled={paymentEvaluating}
                      style={{
                        backgroundColor: isBlockedState ? '#DC2626' : 'var(--paypal-blue)',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        padding: '0.55rem 1.1rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: isBlockedState ? 'none' : '0 2px 6px rgba(0, 69, 124, 0.25)'
                      }}
                    >
                      {isBlockedState ? (
                        <>
                          <LockIcon size={14} color="#FFFFFF" />
                          <span>Attempt Purchase (Overrun Demo)</span>
                        </>
                      ) : (
                        <>
                          <span>Select & Review</span>
                          <span>→</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Agent Activity & Agent Authority Boundary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: '300px' }}>
          {/* Live-looking Agent Activity Panel */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: authorization?.status === 'ACTIVE' ? '#059669' : '#DC2626' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                  Live Agent Activity
                </h3>
              </div>
              <span className="badge badge-paypal" style={{ fontSize: '0.65rem' }}>
                Autonomous Session
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {agentSteps.map((step) => (
                <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                  <div style={{ marginTop: '2px' }}>
                    {step.status === 'completed' && (
                      <span style={{ color: 'var(--color-approved)', fontWeight: 800, fontSize: '0.9rem' }}>✓</span>
                    )}
                    {step.status === 'in_progress' && (
                      <span style={{ color: 'var(--paypal-accent)', fontWeight: 800, fontSize: '0.9rem' }}>●</span>
                    )}
                    {step.status === 'pending' && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>○</span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: step.status === 'in_progress' ? 700 : 600, color: 'var(--navy-dark)' }}>
                      {step.label}
                    </div>
                    {step.details && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                        {step.details}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Authority Details Box */}
          <div
            style={{
              backgroundColor: 'var(--navy-dark)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-md)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <ShieldCheckIcon size={18} color="#38BDF8" />
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38BDF8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Agent Authority Bounds
              </h3>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#CBD5E1', marginBottom: '1rem' }}>
              The AI is operating under bounded capability. PayGuard will instantly terminate any transaction exceeding these parameters.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#94A3B8' }}>Purpose:</span>
                <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{authorization?.purpose || 'None'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#94A3B8' }}>Maximum:</span>
                <span style={{ fontWeight: 700, color: '#34D399' }}>₹{authorization ? authorization.maxAmount.toLocaleString('en-IN') : '0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#94A3B8' }}>Remaining:</span>
                <span style={{ fontWeight: 700, color: '#60A5FA' }}>₹{authorization ? authorization.remainingAmount.toLocaleString('en-IN') : '0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#94A3B8' }}>Transactions:</span>
                <span style={{ fontWeight: 600, color: '#FFFFFF' }}>
                  {authorization ? `${authorization.transactionsUsed} / ${authorization.transactionLimit} used` : '0/0'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
                <span style={{ color: '#94A3B8' }}>Status:</span>
                <span style={{ fontWeight: 700, color: authorization?.status === 'ACTIVE' ? '#10B981' : '#F87171' }}>
                  {authorization?.status || 'No Authorization'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.2rem' }}>
                <span style={{ color: '#94A3B8' }}>Target Gateway:</span>
                <span style={{ fontWeight: 600, color: '#60A5FA' }}>PayPal Sandbox</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAYMENT REVIEW / APPROVED / BLOCKED MODAL SYSTEM */}
      {activePaymentRequest && (
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
            padding: '1.5rem',
            backdropFilter: 'blur(3px)'
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl)',
              border: activePaymentRequest.status === 'BLOCKED' ? '2px solid #DC2626' : '2px solid var(--paypal-accent)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: activePaymentRequest.status === 'BLOCKED' ? '#FEF2F2' : '#F0F9FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {activePaymentRequest.status === 'BLOCKED' ? (
                  <div style={{ width: '28px', height: '28px', backgroundColor: '#DC2626', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <XIcon size={16} color="#FFFFFF" />
                  </div>
                ) : (
                  <div style={{ width: '28px', height: '28px', backgroundColor: '#059669', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckIcon size={16} color="#FFFFFF" />
                  </div>
                )}
                <h2
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: activePaymentRequest.status === 'BLOCKED' ? '#991B1B' : '#075985'
                  }}
                >
                  {activePaymentRequest.status === 'BLOCKED' ? 'Payment Blocked' : 'Payment Approved'}
                </h2>
              </div>

              <button
                onClick={handleModalClose}
                aria-label="Close dialog"
                style={{ color: 'var(--text-secondary)', padding: '0.25rem', borderRadius: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Product and Amount Breakdown */}
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Product</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                    {activePaymentRequest.productName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    Merchant: {activePaymentRequest.merchant}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Requested</div>
                  <div
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      color: activePaymentRequest.status === 'BLOCKED' ? 'var(--color-blocked)' : 'var(--paypal-blue)'
                    }}
                  >
                    ₹{activePaymentRequest.requestedAmount.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Authorized: ₹{activePaymentRequest.authorizedAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* SPECIFIC STATE: BLOCKED PAYMENT STATE */}
              {activePaymentRequest.status === 'BLOCKED' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: 'var(--color-blocked-bg)',
                      border: '1px solid var(--color-blocked-border)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#991B1B', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                      Why was this blocked?
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#7F1D1D', lineHeight: 1.4 }}>
                      <strong>{activePaymentRequest.blockReason || 'The AI agent attempted to exceed the financial authority granted by the user.'}</strong>
                    </div>
                  </div>

                  {/* PayPal Boundary Defense Indicator */}
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991B1B', fontWeight: 700 }}>
                      <LockIcon size={16} color="#DC2626" />
                      <span>PayPal Sandbox API: <strong>NOT CALLED</strong></span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#7F1D1D', fontWeight: 600 }}>
                      Terminated at Policy Gateway
                    </span>
                  </div>

                  {/* Step-Up Authentication Required Banner (Step 4) */}
                  {activePaymentRequest.blockReason?.includes('Human verification required') && (
                    <div
                      style={{
                        padding: '1rem',
                        backgroundColor: '#EFF6FF',
                        border: '1.5px solid #3B82F6',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1E40AF', fontWeight: 800 }}>
                        <LockIcon size={18} color="#1E40AF" />
                        <span>High-Risk Transaction: Device Step-Up Required</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#1E3A8A' }}>
                        This payment exceeds normal risk limits. Please authenticate with your registered device passkey to authorize capability.
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={handleStepUpPasskeyAuth}
                          disabled={isVerifyingHumanStepUp}
                          style={{
                            padding: '0.55rem 1.25rem',
                            backgroundColor: 'var(--paypal-blue)',
                            color: '#FFFFFF',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {isVerifyingHumanStepUp ? 'Authenticating with Device...' : '⚡ Authenticate with Device Passkey'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Policy Gate Checklist */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '1rem'
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
                      PayGuard Policy Evaluation Checklist
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                      {activePaymentRequest.checks.map((chk, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{chk.name}</span>
                          <span style={{ color: chk.passed ? 'var(--color-approved)' : 'var(--color-blocked)', fontWeight: 700 }}>
                            {chk.passed ? '✓ Passed' : '✕ Failed'}
                          </span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.4rem' }}>
                        <span style={{ fontWeight: 700 }}>Final Gateway Decision</span>
                        <span className="badge badge-blocked" style={{ fontWeight: 800 }}>BLOCKED</span>
                      </div>
                    </div>
                  </div>

                  {/* Security Details Toggle */}
                  {showSecurityModal && (
                    <div
                      style={{
                        padding: '1rem',
                        backgroundColor: '#1E293B',
                        color: '#F8FAFC',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                      }}
                    >
                      <div style={{ color: '#38BDF8', fontWeight: 700 }}>[Evidence Vault Intercept Token]</div>
                      <div>User Authorization: ₹{activePaymentRequest.authorizedAmount.toLocaleString('en-IN')}</div>
                      <div>Agent Request: ₹{activePaymentRequest.requestedAmount.toLocaleString('en-IN')}</div>
                      <div>Difference: ₹{Math.max(0, activePaymentRequest.requestedAmount - activePaymentRequest.authorizedAmount).toLocaleString('en-IN')}</div>
                      <div>Violation: {activePaymentRequest.blockReason || 'Budget exceeded'}</div>
                      <div>Decision: BLOCKED</div>
                      <div style={{ color: '#94A3B8', fontSize: '0.75rem', marginTop: '0.2rem' }}>Status: Terminated at Policy Gateway</div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowSecurityModal(!showSecurityModal)}
                      style={{
                        padding: '0.65rem 1rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {showSecurityModal ? 'Hide Security Details' : 'View Security Details'}
                    </button>
                    <button
                      type="button"
                      onClick={handleModalClose}
                      style={{
                        padding: '0.65rem 1.25rem',
                        backgroundColor: 'var(--navy-dark)',
                        color: '#FFFFFF',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}
                    >
                      Return to Shopping
                    </button>
                  </div>
                </div>
              )}

              {/* SPECIFIC STATE: APPROVED PAYMENT STATE */}
              {activePaymentRequest.status === 'APPROVED' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {payPalCheckoutStep === 'done' ? (
                    <div
                      style={{
                        padding: '1.25rem',
                        backgroundColor: 'var(--color-approved-bg)',
                        border: '1.5px solid var(--color-approved-border)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065F46', fontWeight: 800, fontSize: '1.1rem' }}>
                        <span>✓</span>
                        <span>PayPal Sandbox Payment Complete!</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#047857' }}>
                        Transaction successfully dispatched and confirmed in demo mode. Remaining authorization budget and transaction counts have been updated.
                      </div>
                      <div className="mono" style={{ fontSize: '0.8rem', color: '#064E3B', marginTop: '0.25rem' }}>
                        Mock Transaction ID: <strong>{completedTxnId}</strong>
                      </div>
                      <div style={{ marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={handleModalClose}
                          style={{
                            padding: '0.5rem 1.25rem',
                            backgroundColor: 'var(--color-approved)',
                            color: '#FFFFFF',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}
                        >
                          Return to Shop
                        </button>
                      </div>
                    </div>
                  ) : payPalCheckoutStep === 'processing' ? (
                    <div
                      style={{
                        padding: '2rem',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}
                    >
                      <PayPalMark size={32} />
                      <div style={{ fontWeight: 700, color: 'var(--navy-dark)', fontSize: '1rem' }}>
                        Connecting to PayPal Sandbox Gateway...
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Validating continuous intent signature and clearing dispatch...
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          padding: '1rem',
                          backgroundColor: 'var(--color-approved-bg)',
                          border: '1px solid var(--color-approved-border)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#065F46', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                          PayGuard Security Clearance Confirmed
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#047857' }}>
                          This request has passed all automated policy gates and is approved for dispatch to PayPal Sandbox.
                        </div>
                      </div>

                      <div
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '1rem'
                        }}
                      >
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
                          Policy Verification Results
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.85rem' }}>
                          {activePaymentRequest.checks.map((chk, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-approved)' }}>
                              <span style={{ fontWeight: 800 }}>✓</span> {chk.name} ({chk.description})
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Human Presence Evidence (Step 4) */}
                      <div
                        style={{
                          padding: '0.75rem 1rem',
                          backgroundColor: '#F0FDF4',
                          border: '1px solid #BBF7D0',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div style={{ color: '#166534', fontWeight: 600 }}>
                          ✓ Human Presence: Passkey Verified on Device (WebAuthn)
                        </div>
                        <span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>
                          Risk: {activePaymentRequest.riskLevel || 'LOW'}
                        </span>
                      </div>

                      {/* Clear Demo Label */}
                      <div
                        style={{
                          padding: '0.75rem 1rem',
                          backgroundColor: 'var(--paypal-light)',
                          border: '1px solid #BAE6FD',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem'
                        }}
                      >
                        <PayPalMark size={18} />
                        <div style={{ fontSize: '0.8rem', color: 'var(--paypal-blue)' }}>
                          <strong>PayPal Sandbox — Demo Mode</strong>. Clicking continue will simulate the sandbox payment and burn used authorization limits.
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={handleModalClose}
                          style={{
                            padding: '0.65rem 1rem',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)'
                          }}
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleExecutePayPalDispatch}
                          style={{
                            padding: '0.65rem 1.5rem',
                            backgroundColor: 'var(--paypal-blue)',
                            color: '#FFFFFF',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 2px 6px rgba(0, 69, 124, 0.3)'
                          }}
                        >
                          <PayPalMark size={16} />
                          <span>Continue with PayPal</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
