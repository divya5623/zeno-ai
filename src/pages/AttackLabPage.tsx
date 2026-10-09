import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { mockAttackScenarios } from '../data/mockData';
import { AttackScenario, AttackExecutionResult } from '../types';
import { ShieldAlertIcon, ShieldCheckIcon } from '../components/common/Icons';

export const AttackLabPage: React.FC = () => {
  const { runAttackScenario, runAllAttackScenarios, attackResults, authorization, userIdentity } = useApp();
  const [scenarios] = useState<AttackScenario[]>(mockAttackScenarios);
  const [selectedResult, setSelectedResult] = useState<AttackExecutionResult | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningStepText, setRunningStepText] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'INTENT_LOCK' | 'CAPABILITY' | 'IDENTITY' | 'POLICY' | 'ALLOWED'>('ALL');

  const currentCap = authorization ? authorization.remainingAmount : 20000;

  const handleRunSingle = (id: string) => {
    const res = runAttackScenario(id);
    setSelectedResult(res);
  };

  const handleRunAllSequentially = async () => {
    setIsRunningAll(true);
    for (let i = 0; i < filteredScenarios.length; i++) {
      setRunningStepText(`Running ${i + 1}/${filteredScenarios.length}: ${filteredScenarios[i].title}...`);
      await new Promise(r => setTimeout(r, 220));
      runAttackScenario(filteredScenarios[i].id);
    }
    setRunningStepText(null);
    setIsRunningAll(false);
  };

  // Filter scenarios
  const filteredScenarios = scenarios.filter(s => {
    if (filterType === 'ALLOWED') return s.result === 'ALLOWED';
    if (filterType === 'INTENT_LOCK') return s.category === 'intent_tampering' || s.category === 'recipient_substitution' || s.category === 'merchant_drift' || s.category === 'purpose_drift';
    if (filterType === 'CAPABILITY') return s.category === 'capability_escalation' || s.category === 'capability_tampering' || s.category === 'expired_capability' || s.category === 'session_revocation' || s.category === 'capability_replay' || s.category === 'prompt_injection_product';
    if (filterType === 'IDENTITY') return s.category === 'stolen_session' || s.category === 'voice_replay' || s.category === 'identity_bypass';
    if (filterType === 'POLICY') return s.category === 'budget_manipulation' || s.category === 'prompt_injection' || s.category === 'purpose_manipulation' || s.category === 'replay_attack' || s.category === 'payment_splitting';
    return true;
  });

  // Calculate live results summary
  const executedCount = Object.keys(attackResults).length;
  const blockedCount = Object.values(attackResults).filter(r => r.decision === 'BLOCKED').length;
  const allowedCount = Object.values(attackResults).filter(r => r.decision === 'ALLOWED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-blocked)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Adversarial Simulation & Policy Testing
          </span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy-dark)', letterSpacing: '-0.02em' }}>
          Attack Lab
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Test what happens when an AI agent is manipulated by prompt injection, stolen sessions, voice replay, or budget overruns.
        </p>
      </div>

      {/* Action Bar & Banner */}
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', backgroundColor: '#FEE2E2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlertIcon size={20} color="var(--color-blocked)" />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                Zero-Trust Adversarial Suite (Deterministic Policy Enclave)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Evaluating 8 adversarial attack vectors + 1 compliant baseline against live application identity.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {executedCount > 0 && (
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                {blockedCount} Blocked • {allowedCount} Allowed
              </span>
            )}

            <button
              type="button"
              onClick={handleRunAllSequentially}
              disabled={isRunningAll}
              style={{
                padding: '0.65rem 1.25rem',
                backgroundColor: 'var(--navy-dark)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 2px 6px rgba(10, 25, 47, 0.2)',
                cursor: 'pointer'
              }}
            >
              <span>{isRunningAll ? runningStepText : '⚡ Run All Attack Scenarios'}</span>
            </button>
          </div>
        </div>

        {/* Live Identity Parameters Pillbox */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--bg-card-subtle)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem'
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Target User: </span>
            <strong style={{ color: 'var(--navy-dark)' }}>{userIdentity.displayName}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Device Passkey: </span>
            <strong style={{ color: userIdentity.passkeyStatus === 'REGISTERED' ? '#065F46' : '#991B1B' }}>
              {userIdentity.passkeyStatus === 'REGISTERED' ? '✓ Registered (WebAuthn)' : '○ Not Registered'}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Voice Identity: </span>
            <strong style={{ color: userIdentity.voiceEnrollmentStatus === 'ENROLLED' ? '#065F46' : '#D97706' }}>
              {userIdentity.voiceEnrollmentStatus === 'ENROLLED' ? '✓ Enrolled (Dynamic Challenge)' : '○ Not Enrolled'}
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Spending Cap: </span>
            <strong style={{ color: 'var(--paypal-blue)' }}>₹{currentCap.toLocaleString('en-IN')}</strong>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['ALL', 'INTENT_LOCK', 'CAPABILITY', 'IDENTITY', 'POLICY', 'ALLOWED'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterType(tab)}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: filterType === tab ? '1px solid var(--paypal-blue)' : '1px solid var(--border-subtle)',
                backgroundColor: filterType === tab ? 'var(--paypal-blue)' : '#FFFFFF',
                color: filterType === tab ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              {tab === 'ALL' && `All Scenarios (${scenarios.length})`}
              {tab === 'INTENT_LOCK' && 'Intent Lock & Drift Attacks (4)'}
              {tab === 'CAPABILITY' && 'Agent & Capability Attacks (6)'}
              {tab === 'IDENTITY' && 'Identity & Session Attacks (3)'}
              {tab === 'POLICY' && 'Budget & Prompt Attacks (5)'}
              {tab === 'ALLOWED' && 'Legitimate Baseline (1)'}
            </button>
          ))}
        </div>
      </div>

      {/* ATTACK CARDS GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem'
        }}
      >
        {filteredScenarios.map((scenario) => {
          const resultRecord = attackResults[scenario.id];
          const isAllowed = scenario.result === 'ALLOWED';
          const displayedAuthLimit = scenario.category === 'budget_manipulation' || scenario.category === 'legitimate_payment'
            ? currentCap
            : (scenario.authorizedAmount || currentCap);

          return (
            <div
              key={scenario.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--radius-md)',
                border: isAllowed ? '2px solid var(--color-approved-border)' : '2px solid var(--color-blocked-border)',
                padding: '1.25rem',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem'
              }}
            >
              <div>
                {/* Card Header & Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                      {scenario.title}
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {scenario.subtitle}
                    </div>
                  </div>

                  <span
                    className={isAllowed ? "badge badge-approved" : "badge badge-blocked"}
                    style={{ fontSize: '0.75rem', fontWeight: 800 }}
                  >
                    {isAllowed ? "🟢 ALLOWED" : "🔴 BLOCKED"}
                  </span>
                </div>

                {/* Scenario details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                  {scenario.maliciousInstruction && (
                    <div
                      style={{
                        padding: '0.65rem 0.85rem',
                        backgroundColor: '#1E293B',
                        color: '#F87171',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        lineHeight: 1.4
                      }}
                    >
                      <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.65rem' }}>// Malicious instruction payload</span>
                      "{scenario.maliciousInstruction}"
                    </div>
                  )}

                  {scenario.attemptAmount && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: 'var(--bg-card-subtle)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Attempt: </span>
                        <strong style={{ color: isAllowed ? 'var(--navy-dark)' : 'var(--color-blocked)' }}>
                          ₹{scenario.attemptAmount.toLocaleString('en-IN')}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Authorized: </span>
                        <strong style={{ color: 'var(--color-approved)' }}>
                          ₹{displayedAuthLimit.toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {scenario.attemptDescription}
                  </div>
                </div>
              </div>

              {/* Execution Status & Trigger */}
              <div>
                {resultRecord && (
                  <div
                    style={{
                      padding: '0.6rem 0.75rem',
                      backgroundColor: resultRecord.passed ? 'var(--color-approved-bg)' : 'var(--color-blocked-bg)',
                      border: resultRecord.passed ? '1px solid var(--color-approved-border)' : '1px solid var(--color-blocked-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.75rem'
                    }}
                  >
                    <span style={{ fontWeight: 700, color: resultRecord.passed ? '#065F46' : '#991B1B' }}>
                      {resultRecord.passed ? '🟢 PASSED (Rule Enforced)' : '🔴 FAILED'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      Decision: {resultRecord.decision}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    padding: '0.75rem',
                    backgroundColor: isAllowed ? 'var(--color-approved-bg)' : 'var(--color-blocked-bg)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    color: isAllowed ? '#065F46' : '#991B1B',
                    fontWeight: 500,
                    marginBottom: '0.75rem'
                  }}
                >
                  <strong>Policy Decision: </strong>{scenario.violationReason}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleRunSingle(scenario.id)}
                    style={{
                      flex: 1,
                      padding: '0.55rem',
                      backgroundColor: 'var(--paypal-blue)',
                      color: '#FFFFFF',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      fontWeight: 700
                    }}
                  >
                    Simulate Attack
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const res = resultRecord || runAttackScenario(scenario.id);
                      setSelectedResult(res);
                    }}
                    style={{
                      padding: '0.55rem 0.85rem',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Inspect
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scenario Evaluation Rule Inspection Modal */}
      {selectedResult && (
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
              maxWidth: '560px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                  {selectedResult.scenarioTitle}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <span className={selectedResult.passed ? 'badge badge-approved' : 'badge badge-blocked'}>
                    {selectedResult.passed ? '🟢 PASSED' : '🔴 FAILED'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Expected: {selectedResult.expectedResult} • Actual: {selectedResult.actualResult}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedResult(null)} style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Execution trace of PayGuard Security Gateway evaluating policy assertions:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedResult.checks.map((chk, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-card-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                      {chk.name}
                    </div>
                    <code className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {chk.rule}
                    </code>
                  </div>

                  <span style={{ fontWeight: 800, fontSize: '0.85rem', color: chk.passed ? 'var(--color-approved)' : 'var(--color-blocked)' }}>
                    {chk.passed ? '✓ PASS' : '✕ FAIL'}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
              <strong>Gateway Reasoning: </strong>
              <span style={{ color: 'var(--text-secondary)' }}>{selectedResult.reason}</span>
            </div>

            <button
              onClick={() => setSelectedResult(null)}
              style={{
                marginTop: '0.5rem',
                padding: '0.65rem',
                backgroundColor: 'var(--navy-dark)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
