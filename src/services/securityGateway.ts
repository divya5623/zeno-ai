import {
  PaymentRequest,
  Authorization,
  AgentCapability,
  AgentSession,
  UserIdentity,
  HumanVerificationEvidence,
  PolicyEvaluation,
  PolicyCheck,
  PolicyDecision,
  RiskLevel
} from '../types';

export const USED_NONCES_STORAGE_KEY = 'payguard_used_nonces_v2';
export const PAYMENT_HISTORY_TIMESTAMPS_KEY = 'payguard_recent_payment_timestamps_v2';

// 5 minutes max age for payment requests
export const REQUEST_MAX_AGE_MS = 5 * 60 * 1000;

export interface GatewayContext {
  identity?: UserIdentity;
  humanVerification?: HumanVerificationEvidence;
  intentLock?: Authorization | null;
  capability?: AgentCapability | null;
  agentSession?: AgentSession | null;
  externalContentFlags?: {
    isUntrusted?: boolean;
    isMalicious?: boolean;
    detectedInstruction?: string;
  };
  agentContext?: {
    isPromptInjected?: boolean;
    isReplayNonce?: boolean;
    isSplitPayment?: boolean;
    cumulativeSpent?: number;
    isStolenSession?: boolean;
    isVoiceReplay?: boolean;
    bypassAttempt?: boolean;
    isLockTampered?: boolean;
    isEscalatedLimit?: boolean;
    isRecipientSubstituted?: boolean;
    isMerchantMismatch?: boolean;
    isPurposeDrift?: boolean;
    isStaleRequest?: boolean;
    isCapabilityTampered?: boolean;
    isSessionRevoked?: boolean;
    isIdentityExpired?: boolean;
    isRapidBurst?: boolean;
    simulatedRequestAgeMs?: number;
  };
}

export class NonceStore {
  static getUsedNonces(): Set<string> {
    try {
      const data = localStorage.getItem(USED_NONCES_STORAGE_KEY);
      return data ? new Set(JSON.parse(data)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  }

  static hasNonce(nonce: string): boolean {
    const nonces = this.getUsedNonces();
    return nonces.has(nonce);
  }

  static recordNonce(nonce: string): void {
    try {
      const nonces = this.getUsedNonces();
      nonces.add(nonce);
      localStorage.setItem(USED_NONCES_STORAGE_KEY, JSON.stringify(Array.from(nonces)));
    } catch (e) {
      console.error('Failed to save nonce', e);
    }
  }

  static clear(): void {
    localStorage.removeItem(USED_NONCES_STORAGE_KEY);
  }
}

export class RateLimitMonitor {
  static getRecentTimestamps(): number[] {
    try {
      const data = localStorage.getItem(PAYMENT_HISTORY_TIMESTAMPS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static recordAttempt(): number {
    try {
      const now = Date.now();
      const recent = this.getRecentTimestamps().filter(t => now - t < 30000); // within 30s
      recent.push(now);
      localStorage.setItem(PAYMENT_HISTORY_TIMESTAMPS_KEY, JSON.stringify(recent));
      return recent.length;
    } catch {
      return 1;
    }
  }

  static getAttemptsInWindow(): number {
    const now = Date.now();
    return this.getRecentTimestamps().filter(t => now - t < 30000).length;
  }
}

export function calculateDeterministicIntentDrift(
  request: PaymentRequest,
  auth: Authorization | null
): { driftScore: number; driftLevel: string; driftReasons: string[] } {
  if (!auth) {
    return { driftScore: 100, driftLevel: 'CRITICAL DRIFT', driftReasons: ['No active Intent Lock'] };
  }

  let driftScore = 0;
  const driftReasons: string[] = [];

  // Action mismatch +40
  const authAction = auth.action || 'PURCHASE';
  if (request.purpose?.toUpperCase().includes('TRANSFER') && authAction === 'PURCHASE') {
    driftScore += 40;
    driftReasons.push('Action mismatch: Transfer attempted under Purchase authorization (+40)');
  }

  // Amount mismatch +30
  if (request.requestedAmount > auth.remainingAmount) {
    driftScore += 30;
    driftReasons.push(`Amount exceeds remaining budget: ₹${request.requestedAmount} > ₹${auth.remainingAmount} (+30)`);
  }

  // Category mismatch +20
  const authCategory = (auth.category || 'LAPTOP').toUpperCase();
  const reqCategory = (request.category || '').toUpperCase();
  if (reqCategory && authCategory && authCategory !== 'GENERAL' && reqCategory !== authCategory) {
    const isRelated = (authCategory === 'LAPTOP' && reqCategory === 'ELECTRONICS') || (authCategory === 'ELECTRONICS' && reqCategory === 'LAPTOP');
    if (!isRelated) {
      driftScore += 20;
      driftReasons.push(`Category mismatch: ${reqCategory} vs authorized ${authCategory} (+20)`);
    }
  }

  // Purpose mismatch +20
  if (request.purpose && auth.purpose) {
    const authPurpLower = auth.purpose.toLowerCase();
    const reqPurpLower = request.purpose.toLowerCase();
    const isEducation = authPurpLower.includes('college') || authPurpLower.includes('laptop') || authPurpLower.includes('study');
    const isGamingOrLuxury = reqPurpLower.includes('gaming') || reqPurpLower.includes('crypto') || reqPurpLower.includes('gift card') || reqPurpLower.includes('luxury');
    if (isEducation && isGamingOrLuxury) {
      driftScore += 20;
      driftReasons.push(`Semantic purpose mismatch: '${request.purpose}' deviates from '${auth.purpose}' (+20)`);
    }
  }

  // Recipient mismatch +30
  if (auth.recipient && request.recipient && auth.recipient.toLowerCase() !== request.recipient.toLowerCase()) {
    driftScore += 30;
    driftReasons.push(`Recipient substitution: Attempting to pay '${request.recipient}' instead of '${auth.recipient}' (+30)`);
  }

  // Merchant mismatch +20
  if (auth.merchant && request.merchant && !request.merchant.toLowerCase().includes(auth.merchant.toLowerCase())) {
    driftScore += 20;
    driftReasons.push(`Merchant mismatch: '${request.merchant}' does not match locked vendor '${auth.merchant}' (+20)`);
  }

  // Currency mismatch +20
  if (request.currency && auth.currency && request.currency.toUpperCase() !== auth.currency.toUpperCase()) {
    driftScore += 20;
    driftReasons.push(`Currency mismatch: ${request.currency} vs ${auth.currency} (+20)`);
  }

  driftScore = Math.min(100, Math.max(0, driftScore));

  let driftLevel = 'NO DRIFT';
  if (driftScore >= 80) driftLevel = 'CRITICAL DRIFT';
  else if (driftScore >= 60) driftLevel = 'HIGH DRIFT';
  else if (driftScore >= 40) driftLevel = 'MEDIUM DRIFT';
  else if (driftScore >= 20) driftLevel = 'LOW DRIFT';

  return { driftScore, driftLevel, driftReasons };
}

export function calculateDeterministicRiskScore(
  request: PaymentRequest,
  auth: Authorization | null,
  context?: GatewayContext,
  driftScore = 0
): { riskScore: number; riskLevel: RiskLevel; riskFactors: string[] } {
  let risk = 0;
  const riskFactors: string[] = [];

  const agentCtx = context?.agentContext;

  // Replay +50
  if (agentCtx?.isReplayNonce) {
    risk += 50;
    riskFactors.push('Replay attack pattern (+50)');
  }

  // Capability tampering +50
  if (agentCtx?.isLockTampered || agentCtx?.isEscalatedLimit || agentCtx?.isCapabilityTampered) {
    risk += 50;
    riskFactors.push('Capability or Intent Lock tampering (+50)');
  }

  // External injection +15
  if (agentCtx?.isPromptInjected || context?.externalContentFlags?.isMalicious) {
    risk += 15;
    riskFactors.push('External untrusted instruction detected (+15)');
  }

  // Identity anomaly +20
  if (agentCtx?.isStolenSession || agentCtx?.isVoiceReplay || agentCtx?.isIdentityExpired) {
    risk += 20;
    riskFactors.push('Identity / session anomaly (+20)');
  }

  // Intent drift contribution (max +25)
  if (driftScore > 0) {
    const driftRiskAdd = Math.round((driftScore / 100) * 25);
    risk += driftRiskAdd;
    riskFactors.push(`Intent drift contribution (+${driftRiskAdd})`);
  }

  // Amount mismatch +30
  if (auth && request.requestedAmount > auth.remainingAmount) {
    risk += 30;
    riskFactors.push('Amount exceeds authorized remaining budget (+30)');
  }

  // Recipient mismatch +30
  if (agentCtx?.isRecipientSubstituted || (auth?.recipient && request.recipient && auth.recipient.toLowerCase() !== request.recipient.toLowerCase())) {
    risk += 30;
    riskFactors.push('Recipient substitution (+30)');
  }

  // Merchant mismatch +20
  if (agentCtx?.isMerchantMismatch || (auth?.merchant && request.merchant && !request.merchant.toLowerCase().includes(auth.merchant.toLowerCase()))) {
    risk += 20;
    riskFactors.push('Merchant constraint mismatch (+20)');
  }

  // Rapid requests +10
  const recentCount = RateLimitMonitor.getAttemptsInWindow();
  if (agentCtx?.isRapidBurst || recentCount >= 5) {
    risk += 10;
    riskFactors.push('Rapid request burst detected (+10)');
  }

  // Clamped to 0 - 100
  risk = Math.min(100, Math.max(0, risk));

  let riskLevel: RiskLevel = 'LOW';
  if (risk >= 80) riskLevel = 'CRITICAL';
  else if (risk >= 60) riskLevel = 'HIGH';
  else if (risk >= 30) riskLevel = 'MEDIUM';

  return { riskScore: risk, riskLevel, riskFactors };
}

/**
 * PayGuard Continuous Security Gateway
 * Evaluates payment requests in strict deterministic order across 25 security checkpoints.
 */
export function evaluatePaymentRequestGateway(
  request: PaymentRequest,
  auth: Authorization | null,
  context?: GatewayContext
): PolicyEvaluation {
  const checks: PolicyCheck[] = [];
  const evaluatedAt = new Date().toISOString();
  const requestId = request.id || `PREQ-${Date.now()}`;
  const userId = request.userId || auth?.userId || 'usr_anonymous';
  const agentCtx = context?.agentContext;

  const idEvidence = request.humanVerification || context?.humanVerification || auth?.humanVerification;
  const isHumanVerified = !!idEvidence?.identityVerified && (idEvidence.authenticationMethod === 'PASSKEY' || idEvidence.authenticationMethod === 'MULTI_FACTOR' || !!idEvidence.passkeyVerified);

  // Calculate Drift and Risk early for inclusion in trace
  const drift = calculateDeterministicIntentDrift(request, auth);
  const risk = calculateDeterministicRiskScore(request, auth, context, drift.driftScore);

  const makeCheck = (
    checkId: string,
    name: string,
    status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED',
    reason: string,
    severity: PolicyCheck['severity'] = 'HIGH'
  ): PolicyCheck => ({ checkId, name, status, reason, severity });

  // 1. Identity Check
  const identityStatus = context?.identity?.identityStatus || (isHumanVerified ? 'VERIFIED' : 'UNVERIFIED');
  const isIdentityExpired = !!agentCtx?.isIdentityExpired;
  if (identityStatus !== 'VERIFIED' || isIdentityExpired || agentCtx?.isStolenSession || agentCtx?.isVoiceReplay) {
    checks.push(makeCheck(
      'CHK-01-IDENTITY',
      'Human Identity Continuous Verification',
      'FAIL',
      isIdentityExpired
        ? 'Human identity verification has expired. Device passkey session elapsed.'
        : agentCtx?.isVoiceReplay
        ? 'Voice replay intercepted by dynamic challenge code verification.'
        : 'Missing or unverified device-native passkey assertion.',
      'CRITICAL'
    ));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: Math.max(risk.riskScore, 75),
      riskLevel: 'CRITICAL',
      primaryReason: isIdentityExpired
        ? 'Human identity verification has expired.'
        : 'Human identity verification is no longer valid or unverified.',
      reasonCode: 'IDENTITY_FAILURE',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-01-IDENTITY', 'Human Identity Continuous Verification', 'PASS', 'Device passkey identity verified.', 'INFO'));

  // 2. User Authorization Existence Check
  if (!auth) {
    checks.push(makeCheck('CHK-02-AUTH-EXISTS', 'User Authorization Existence', 'FAIL', 'No active user authorization or Intent Lock found.', 'CRITICAL'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 90,
      riskLevel: 'CRITICAL',
      primaryReason: 'No active authorization found. AI agent has zero spending authority.',
      reasonCode: 'NO_AUTHORIZATION',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-02-AUTH-EXISTS', 'User Authorization Existence', 'PASS', `Authorization ${auth.id} loaded.`, 'INFO'));

  // 3. Intent Lock Status Check
  if (auth.status === 'REVOKED') {
    checks.push(makeCheck('CHK-03-INTENT-STATUS', 'Intent Lock Active Status', 'FAIL', 'Authorization has been revoked by the user.', 'CRITICAL'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 85,
      riskLevel: 'CRITICAL',
      primaryReason: 'Intent Lock was revoked by user. AI capability permanently disabled.',
      reasonCode: 'AUTHORIZATION_REVOKED',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  if (auth.status === 'EXPIRED') {
    checks.push(makeCheck('CHK-03-INTENT-STATUS', 'Intent Lock Active Status', 'FAIL', 'Intent Lock has expired.', 'HIGH'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 70,
      riskLevel: 'HIGH',
      primaryReason: 'Intent Lock has expired. AI cannot reuse stale tokens.',
      reasonCode: 'AUTHORIZATION_EXPIRED',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-03-INTENT-STATUS', 'Intent Lock Active Status', 'PASS', `Intent Lock is ACTIVE.`, 'INFO'));

  // 4. Agent Identity Check
  const agentId = request.agentId || context?.agentSession?.agentId || 'agent_shopping_01';
  if (!agentId || agentId.startsWith('unregistered')) {
    checks.push(makeCheck('CHK-04-AGENT-ID', 'Agent Identity & Trust Level', 'FAIL', 'Unregistered or untrusted AI agent.', 'HIGH'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 80,
      riskLevel: 'HIGH',
      primaryReason: 'Agent identity verification failed.',
      reasonCode: 'AGENT_UNTRUSTED',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-04-AGENT-ID', 'Agent Identity & Trust Level', 'PASS', `Agent ${agentId} sandboxed and recognized.`, 'INFO'));

  // 5. Agent Session Check
  const session = context?.agentSession;
  const isSessionRevoked = agentCtx?.isSessionRevoked || session?.status === 'REVOKED' || session?.status === 'TERMINATED' || session?.status === 'SUSPENDED';
  if (isSessionRevoked) {
    checks.push(makeCheck('CHK-05-AGENT-SESSION', 'Agent Session Validity', 'FAIL', 'Agent session has been revoked or stopped by kill switch.', 'CRITICAL'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 90,
      riskLevel: 'CRITICAL',
      primaryReason: 'Agent session revoked. Kill switch activated.',
      reasonCode: 'SESSION_VIOLATION',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-05-AGENT-SESSION', 'Agent Session Validity', 'PASS', 'Agent session is ACTIVE.', 'INFO'));

  // 6. Agent Capability Validation
  const capability = context?.capability;
  const isCapTampered = agentCtx?.isCapabilityTampered || agentCtx?.isLockTampered;
  if (isCapTampered) {
    checks.push(makeCheck('CHK-06-CAPABILITY-MUTATION', 'Agent Capability Integrity', 'FAIL', 'Capability tampering detected. Field mutation intercepted.', 'CRITICAL'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 95,
      riskLevel: 'CRITICAL',
      primaryReason: 'Capability tampering detected. Agent attempted to escalate limits or spoof nonces.',
      reasonCode: 'CAPABILITY_TAMPERING',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }

  if (capability) {
    if (capability.status === 'REVOKED') {
      checks.push(makeCheck('CHK-06-CAPABILITY-STATUS', 'Agent Capability Lifecycle', 'FAIL', 'Capability has been revoked.', 'CRITICAL'));
      return {
        decision: 'BLOCK',
        requestId,
        userId,
        checks,
        riskScore: 85,
        riskLevel: 'CRITICAL',
        primaryReason: 'Agent capability revoked.',
        reasonCode: 'CAPABILITY_VIOLATION',
        evaluatedAt,
        paypalEligible: false,
        evidenceId: `EV-${requestId}`
      };
    }
    if (capability.status === 'EXHAUSTED' || capability.status === 'USED') {
      checks.push(makeCheck('CHK-06-CAPABILITY-STATUS', 'Agent Capability Lifecycle', 'FAIL', 'Capability has been exhausted.', 'HIGH'));
      return {
        decision: 'BLOCK',
        requestId,
        userId,
        checks,
        riskScore: 80,
        riskLevel: 'HIGH',
        primaryReason: 'Capability quota exhausted.',
        reasonCode: 'TRANSACTION_LIMIT_EXCEEDED',
        evaluatedAt,
        paypalEligible: false,
        evidenceId: `EV-${requestId}`
      };
    }
  }
  checks.push(makeCheck('CHK-06-CAPABILITY', 'Agent Capability Validation', 'PASS', 'Capability parameters valid.', 'INFO'));

  // 7. Capability Expiry Check
  const capExpires = capability ? new Date(capability.expiresAt).getTime() : Infinity;
  const now = Date.now();
  if (now > capExpires || agentCtx?.isExpiredCapability) {
    checks.push(makeCheck('CHK-07-CAP-EXPIRY', 'Capability Expiration Window', 'FAIL', 'Capability token has expired.', 'HIGH'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 75,
      riskLevel: 'HIGH',
      primaryReason: 'Capability token has expired. Stale token rejected.',
      reasonCode: 'CAPABILITY_VIOLATION',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-07-CAP-EXPIRY', 'Capability Expiration Window', 'PASS', 'Capability is within validity timeframe.', 'INFO'));

  // 8. Intent Lock Expiry Check (TTL)
  const authExpires = new Date(auth.expiresAt).getTime();
  if (now > authExpires) {
    checks.push(makeCheck('CHK-08-LOCK-TTL', 'Intent Lock TTL Countdown', 'FAIL', 'Intent Lock TTL countdown reached zero.', 'HIGH'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 75,
      riskLevel: 'HIGH',
      primaryReason: 'Authorization timer expired. AI spending window is closed.',
      reasonCode: 'AUTHORIZATION_EXPIRED',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-08-LOCK-TTL', 'Intent Lock TTL Countdown', 'PASS', 'Intent Lock TTL valid.', 'INFO'));

  // 9. Session Expiry Check
  const sessionExpires = session?.expiresAt ? new Date(session.expiresAt).getTime() : Infinity;
  if (now > sessionExpires) {
    checks.push(makeCheck('CHK-09-SESSION-EXPIRY', 'Agent Session Expiration', 'FAIL', 'Agent session expired.', 'HIGH'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 75,
      riskLevel: 'HIGH',
      primaryReason: 'Agent session expired.',
      reasonCode: 'SESSION_VIOLATION',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-09-SESSION-EXPIRY', 'Agent Session Expiration', 'PASS', 'Session active.', 'INFO'));

  // 10. Transaction Amount Check (Versus Authorization Max)
  if (request.requestedAmount > auth.maxAmount || agentCtx?.isEscalatedLimit) {
    checks.push(makeCheck(
      'CHK-10-AMOUNT-LIMIT',
      'Transaction Amount Ceiling Check',
      'FAIL',
      `Requested amount (₹${request.requestedAmount.toLocaleString('en-IN')}) exceeds authorized maximum (₹${auth.maxAmount.toLocaleString('en-IN')}).`,
      'CRITICAL'
    ));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: Math.max(risk.riskScore, 85),
      riskLevel: 'CRITICAL',
      primaryReason: `The AI agent attempted to exceed the financial authority granted by the user (Requested ₹${request.requestedAmount.toLocaleString('en-IN')} > Max ₹${auth.maxAmount.toLocaleString('en-IN')}).`,
      reasonCode: 'AMOUNT_LIMIT_EXCEEDED',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-10-AMOUNT-LIMIT', 'Transaction Amount Ceiling Check', 'PASS', `Amount ₹${request.requestedAmount.toLocaleString('en-IN')} <= Max ₹${auth.maxAmount.toLocaleString('en-IN')}.`, 'INFO'));

  // 11. Remaining Capability Budget Check
  if (request.requestedAmount > auth.remainingAmount) {
    const diff = request.requestedAmount - auth.remainingAmount;
    checks.push(makeCheck(
      'CHK-11-REMAINING-BUDGET',
      'Remaining Capability Budget Check',
      'FAIL',
      `Requested amount (₹${request.requestedAmount.toLocaleString('en-IN')}) exceeds remaining budget (₹${auth.remainingAmount.toLocaleString('en-IN')}) by ₹${diff.toLocaleString('en-IN')}.`,
      'CRITICAL'
    ));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: Math.max(risk.riskScore, 80),
      riskLevel: 'CRITICAL',
      primaryReason: `Budget exceeded. Available budget: ₹${auth.remainingAmount.toLocaleString('en-IN')}. Requested: ₹${request.requestedAmount.toLocaleString('en-IN')}.`,
      reasonCode: 'BUDGET_EXCEEDED',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-11-REMAINING-BUDGET', 'Remaining Capability Budget Check', 'PASS', `Requested ₹${request.requestedAmount.toLocaleString('en-IN')} within remaining ₹${auth.remainingAmount.toLocaleString('en-IN')}.`, 'INFO'));

  // 12. Transaction Count Quota Check
  if (auth.transactionsUsed >= auth.transactionLimit) {
    checks.push(makeCheck(
      'CHK-12-TXN-LIMIT',
      'Transaction Count Quota Check',
      'FAIL',
      `Transaction limit exhausted (${auth.transactionsUsed}/${auth.transactionLimit} used).`,
      'HIGH'
    ));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 75,
      riskLevel: 'HIGH',
      primaryReason: `Transaction limit reached (${auth.transactionsUsed}/${auth.transactionLimit} used).`,
      reasonCode: 'TRANSACTION_LIMIT_EXCEEDED',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-12-TXN-LIMIT', 'Transaction Count Quota Check', 'PASS', `Transaction quota valid (${auth.transactionsUsed}/${auth.transactionLimit}).`, 'INFO'));

  // 13. Anti-Splitting Cumulative Spending Check
  if (agentCtx?.isSplitPayment && agentCtx.cumulativeSpent && agentCtx.cumulativeSpent > auth.maxAmount) {
    checks.push(makeCheck(
      'CHK-13-ANTI-SPLITTING',
      'Anti-Splitting Protection & Cumulative Velocity',
      'FAIL',
      `Payment splitting intercepted. Cumulative spend ₹${agentCtx.cumulativeSpent.toLocaleString('en-IN')} > Max ₹${auth.maxAmount.toLocaleString('en-IN')}.`,
      'CRITICAL'
    ));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 85,
      riskLevel: 'CRITICAL',
      primaryReason: 'Payment splitting detected. Consecutive transactions exceed cumulative limit.',
      reasonCode: 'PAYMENT_SPLITTING_DETECTED',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-13-ANTI-SPLITTING', 'Anti-Splitting Protection', 'PASS', 'Single transaction boundary intact.', 'INFO'));

  // 14. Recipient Constraint Check
  const lockedRecipient = auth.recipient;
  const reqRecipient = request.recipient;
  if (agentCtx?.isRecipientSubstituted || (lockedRecipient && reqRecipient && lockedRecipient.toLowerCase() !== reqRecipient.toLowerCase())) {
    checks.push(makeCheck(
      'CHK-14-RECIPIENT',
      'Recipient Constraint Enforcement',
      'FAIL',
      `Recipient mismatch. Authorization locked to '${lockedRecipient || 'Target'}', but candidate requested '${reqRecipient || 'Substituted'}'.`,
      'CRITICAL'
    ));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 85,
      riskLevel: 'CRITICAL',
      primaryReason: `Recipient substitution blocked. Payment locked to '${lockedRecipient || 'original recipient'}'.`,
      reasonCode: 'RECIPIENT_MISMATCH',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-14-RECIPIENT', 'Recipient Constraint Enforcement', 'PASS', 'Recipient verified or unconstrained.', 'INFO'));

  // 15. Merchant Constraint Check
  const lockedMerchant = auth.merchant;
  const reqMerchant = request.merchant;
  if (agentCtx?.isMerchantMismatch || (lockedMerchant && reqMerchant && !reqMerchant.toLowerCase().includes(lockedMerchant.toLowerCase()))) {
    checks.push(makeCheck(
      'CHK-15-MERCHANT',
      'Merchant Whitelist Constraint',
      'FAIL',
      `Merchant boundary violation. Locked to '${lockedMerchant}', but transaction routed to '${reqMerchant}'.`,
      'HIGH'
    ));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 75,
      riskLevel: 'HIGH',
      primaryReason: `Merchant constraint violation. Authorization bounded strictly to '${lockedMerchant}'.`,
      reasonCode: 'MERCHANT_MISMATCH',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-15-MERCHANT', 'Merchant Whitelist Constraint', 'PASS', 'Merchant validated.', 'INFO'));

  // 16. Category Constraint Check
  if (auth.category && request.category && auth.category !== 'GENERAL' && auth.category.toUpperCase() !== request.category.toUpperCase()) {
    const isRelated = (auth.category.toUpperCase() === 'LAPTOP' && request.category.toUpperCase() === 'ELECTRONICS') ||
                      (auth.category.toUpperCase() === 'ELECTRONICS' && request.category.toUpperCase() === 'LAPTOP');
    if (!isRelated) {
      checks.push(makeCheck(
        'CHK-16-CATEGORY',
        'Category Boundary Constraint',
        'FAIL',
        `Category mismatch. Locked to '${auth.category}', received item in category '${request.category}'.`,
        'HIGH'
      ));
      return {
        decision: 'BLOCK',
        requestId,
        userId,
        checks,
        riskScore: 75,
        riskLevel: 'HIGH',
        primaryReason: `Category boundary violation. Expected '${auth.category}', received '${request.category}'.`,
        reasonCode: 'CATEGORY_MISMATCH',
        evaluatedAt,
        paypalEligible: false,
        evidenceId: `EV-${requestId}`
      };
    }
  }
  checks.push(makeCheck('CHK-16-CATEGORY', 'Category Boundary Constraint', 'PASS', 'Category matches intent scope.', 'INFO'));

  // 17. Purpose Semantic Alignment Check
  if (agentCtx?.isPurposeDrift) {
    checks.push(makeCheck(
      'CHK-17-PURPOSE-DRIFT',
      'Purpose Semantic Alignment',
      'FAIL',
      `Semantic purpose drift intercepted. Candidate diverges from authorized purpose: "${auth.purpose}".`,
      'HIGH'
    ));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 75,
      riskLevel: 'HIGH',
      primaryReason: 'Semantic purpose mismatch. Item deviates from human-authorized purpose.',
      reasonCode: 'PURPOSE_MISMATCH',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  if (request.purpose && auth.purpose) {
    const isCollegeScope = auth.purpose.toLowerCase().includes('laptop') || auth.purpose.toLowerCase().includes('college') || auth.purpose.toLowerCase().includes('study');
    const isGamingOrCard = request.purpose.toLowerCase().includes('gaming') || request.purpose.toLowerCase().includes('gift card') || request.purpose.toLowerCase().includes('crypto');
    if (isCollegeScope && isGamingOrCard) {
      checks.push(makeCheck('CHK-17-PURPOSE', 'Purpose Semantic Alignment', 'FAIL', 'High-risk purpose deviation: Gaming/Bearer instrument vs Education Tech.', 'HIGH'));
      return {
        decision: 'BLOCK',
        requestId,
        userId,
        checks,
        riskScore: 80,
        riskLevel: 'HIGH',
        primaryReason: "Purpose manipulation detected. Requested item deviates from authorized 'College laptop' scope.",
        reasonCode: 'PURPOSE_MISMATCH',
        evaluatedAt,
        paypalEligible: false,
        evidenceId: `EV-${requestId}`
      };
    }
  }
  checks.push(makeCheck('CHK-17-PURPOSE', 'Purpose Semantic Alignment', 'PASS', 'Purpose conforms to intent lock.', 'INFO'));

  // 18. Currency Integrity Check
  if (request.currency && auth.currency && request.currency.toUpperCase() !== auth.currency.toUpperCase()) {
    checks.push(makeCheck('CHK-18-CURRENCY', 'Currency Integrity Constraint', 'FAIL', `Currency mismatch: ${request.currency} vs ${auth.currency}.`, 'HIGH'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 70,
      riskLevel: 'HIGH',
      primaryReason: `Currency mismatch. Authorized currency is ${auth.currency}, requested ${request.currency}.`,
      reasonCode: 'INTENT_MISMATCH',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-18-CURRENCY', 'Currency Integrity Constraint', 'PASS', `Currency ${request.currency || 'INR'} verified.`, 'INFO'));

  // 19. Nonce / Replay Defense Check
  const effectiveNonce = request.nonce || auth.nonce || 'nonce_default';
  const isReplay = agentCtx?.isReplayNonce || NonceStore.hasNonce(effectiveNonce);
  if (isReplay) {
    checks.push(makeCheck('CHK-19-REPLAY', 'Cryptographic Nonce & Replay Defense', 'FAIL', 'Cryptographic replay detected. Nonce has already been consumed.', 'CRITICAL'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 90,
      riskLevel: 'CRITICAL',
      primaryReason: 'Replay attack detected. Nonce already consumed and permanently burned in PayGuard ledger.',
      reasonCode: 'REPLAY_ATTACK_DETECTED',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-19-REPLAY', 'Cryptographic Nonce & Replay Defense', 'PASS', 'Nonce is fresh and unconsumed.', 'INFO'));

  // 20. Request Freshness Window Check (Max 5 minutes)
  const reqTimestamp = new Date(request.timestamp).getTime();
  const simulatedAge = agentCtx?.simulatedRequestAgeMs || (agentCtx?.isStaleRequest ? REQUEST_MAX_AGE_MS + 1000 : 0);
  const actualAge = now - reqTimestamp + simulatedAge;
  if (actualAge > REQUEST_MAX_AGE_MS || agentCtx?.isStaleRequest) {
    checks.push(makeCheck('CHK-20-FRESHNESS', 'Request Freshness & Stale Defense', 'FAIL', `Payment request is stale (${Math.round(actualAge / 1000)}s old > 300s limit).`, 'HIGH'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 75,
      riskLevel: 'HIGH',
      primaryReason: 'Stale payment request. Timed out past 5-minute freshness window.',
      reasonCode: 'STALE_PAYMENT_REQUEST',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-20-FRESHNESS', 'Request Freshness & Stale Defense', 'PASS', 'Payment request is fresh (< 5 mins).', 'INFO'));

  // 21. Untrusted External Content Firewall
  const isMaliciousContent = agentCtx?.isPromptInjected || context?.externalContentFlags?.isMalicious;
  if (isMaliciousContent) {
    checks.push(makeCheck('CHK-21-UNTRUSTED-CONTENT', 'External Content Firewall', 'FAIL', 'Prompt injection payload intercepted in external merchant content.', 'CRITICAL'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: 90,
      riskLevel: 'CRITICAL',
      primaryReason: 'Untrusted external content firewall breach. External webpage/prompt instructions cannot alter Intent Lock.',
      reasonCode: 'UNTRUSTED_AUTHORITY_ATTEMPT',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-21-UNTRUSTED-CONTENT', 'External Content Firewall', 'PASS', 'No prompt injection payloads detected in agent context.', 'INFO'));

  // 22. Agent Behavioral Monitoring & Rapid Request Check
  const attemptsInWindow = RateLimitMonitor.getAttemptsInWindow();
  if (attemptsInWindow >= 10 || agentCtx?.isRapidBurst) {
    checks.push(makeCheck('CHK-22-BEHAVIOR', 'Agent Behavioral & Rate Anomaly', 'WARNING', `Rapid request burst detected (${attemptsInWindow} requests in 30s).`, 'MEDIUM'));
  } else {
    checks.push(makeCheck('CHK-22-BEHAVIOR', 'Agent Behavioral Anomaly Check', 'PASS', 'Behavioral profile within normal parameters.', 'INFO'));
  }

  // 23. Intent Drift Score Gate
  if (drift.driftScore >= 60) {
    checks.push(makeCheck('CHK-23-DRIFT-SCORE', 'Continuous Intent Drift Metric', 'FAIL', `Drift score ${drift.driftScore}/100 exceeds threshold (${drift.driftLevel}).`, 'HIGH'));
    return {
      decision: 'BLOCK',
      requestId,
      userId,
      checks,
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      primaryReason: `Intent drift threshold breached (${drift.driftLevel}: ${drift.driftReasons.join(', ')}).`,
      reasonCode: 'INTENT_DRIFT_DETECTED',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-23-DRIFT-SCORE', 'Continuous Intent Drift Metric', 'PASS', `Drift score ${drift.driftScore}/100 (${drift.driftLevel}).`, 'INFO'));

  // 24. Step-Up Authentication Requirement Check
  // If Risk is elevated (>= 60) or transaction is high risk but valid, require fresh device step-up
  const requiresStepUp = risk.riskScore >= 60 || (request.requestedAmount >= 15000 && !idEvidence?.passkeyVerified);
  if (requiresStepUp && (!idEvidence || !idEvidence.passkeyVerified)) {
    checks.push(makeCheck('CHK-24-STEP-UP', 'Human Step-Up Authentication Required', 'WARNING', 'High-risk parameters require fresh physical device passkey assertion.', 'HIGH'));
    return {
      decision: 'STEP_UP',
      requestId,
      userId,
      checks,
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      primaryReason: 'High-risk transaction requires device-native passkey step-up authentication.',
      reasonCode: 'STEP_UP_REQUIRED',
      evaluatedAt,
      paypalEligible: false,
      evidenceId: `EV-${requestId}`
    };
  }
  checks.push(makeCheck('CHK-24-STEP-UP', 'Step-Up Verification Gate', 'PASS', 'Step-up verified or not required.', 'INFO'));

  // 25. Final Policy Decision & PayPal Eligibility
  checks.push(makeCheck('CHK-25-PAYPAL-GATE', 'PayPal Dispatch Gateway Clearance', 'PASS', 'All 25 security checkpoints cleared. Authorized for PayPal Sandbox.', 'INFO'));

  // Record nonce so it cannot be replayed in future
  NonceStore.recordNonce(effectiveNonce);
  RateLimitMonitor.recordAttempt();

  return {
    decision: 'ALLOW',
    requestId,
    userId,
    checks,
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    primaryReason: 'All continuous authorization checkpoints validated. Request conforms strictly to human Intent Lock.',
    reasonCode: 'PAYMENT_ALLOWED',
    evaluatedAt,
    paypalEligible: true,
    evidenceId: `EV-${requestId}`
  };
}

/**
 * Explicit PayPal Gateway Boundary:
 * Can ONLY be executed if policy evaluation decision === 'ALLOW' and paypalEligible === true.
 */
export function executeAuthorizedPayment(
  request: PaymentRequest,
  evaluation: PolicyEvaluation
): { success: boolean; message: string; paypalDispatched: boolean; mockTxnId?: string } {
  if (evaluation.decision !== 'ALLOW' || !evaluation.paypalEligible) {
    throw new Error(
      `SECURITY BOUNDARY REFUSAL: Cannot execute payment. Gateway decision was '${evaluation.decision}' (Eligible: ${evaluation.paypalEligible}). Reason: ${evaluation.primaryReason || 'Policy check failed'}. PayPal API was NOT called.`
    );
  }

  // Generate safe sandbox transaction ID
  const mockTxnId = `PP-SANDBOX-${Math.floor(100000 + Math.random() * 900000)}`;

  return {
    success: true,
    message: `Payment authorized and cleared for PayPal Sandbox. Order ID: ${mockTxnId}`,
    paypalDispatched: true,
    mockTxnId
  };
}
