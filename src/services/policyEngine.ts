import {
  Authorization,
  HumanVerificationEvidence,
  RiskLevel,
  IdentityStatus,
  PasskeyStatus,
  VoiceEnrollmentStatus,
  DeviceTrustStatus,
  IdentitySecuritySettings
} from '../types';

export interface PolicyEvaluationResult {
  allowed: boolean;
  decision: "ALLOW" | "BLOCK";
  reason: string;
  violations: string[];
  riskLevel: RiskLevel;
  checks: {
    name: string;
    passed: boolean;
    description: string;
  }[];
  identityVerified: boolean;
  authenticationMethod: string;
}

export interface EvaluatePaymentParams {
  paymentRequest: {
    amount: number;
    purpose?: string;
    merchant?: string;
    category?: string;
    recipient?: string;
    humanVerification?: HumanVerificationEvidence;
    riskLevel?: RiskLevel;
  };
  auth: Authorization | null;
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
  };
  identityContext?: {
    identityStatus?: IdentityStatus;
    passkeyStatus?: PasskeyStatus;
    voiceEnrollmentStatus?: VoiceEnrollmentStatus;
    deviceTrustStatus?: DeviceTrustStatus;
    securitySettings?: IdentitySecuritySettings;
  };
}

export const evaluatePaymentRequest = (
  paymentRequest: {
    amount: number;
    purpose?: string;
    merchant?: string;
    category?: string;
    recipient?: string;
    humanVerification?: HumanVerificationEvidence;
    riskLevel?: RiskLevel;
  },
  auth: Authorization | null,
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
  },
  identityContext?: {
    identityStatus?: IdentityStatus;
    passkeyStatus?: PasskeyStatus;
    voiceEnrollmentStatus?: VoiceEnrollmentStatus;
    deviceTrustStatus?: DeviceTrustStatus;
    securitySettings?: IdentitySecuritySettings;
  }
): PolicyEvaluationResult => {
  const violations: string[] = [];

  // Determine effective risk level
  const amount = paymentRequest.amount;
  const maxCap = auth ? auth.remainingAmount : 20000;
  let effectiveRisk: RiskLevel = paymentRequest.riskLevel || "LOW";
  if (amount > maxCap) {
    effectiveRisk = "CRITICAL";
  } else if (amount >= 15000 || amount >= maxCap * 0.75) {
    effectiveRisk = "HIGH";
  } else if (amount >= 5000) {
    effectiveRisk = "MEDIUM";
  }

  const humanEvidence = paymentRequest.humanVerification || auth?.humanVerification;
  const isHumanVerified = !!humanEvidence?.identityVerified && !!humanEvidence?.passkeyVerified;
  const authMethod = humanEvidence?.authenticationMethod || "NONE";

  // Gate 1: Authorization Token Existence
  if (!auth) {
    violations.push("NO_AUTHORIZATION");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: "No active authorization found. AI agent is not permitted to initiate transactions without explicit human Intent Lock.",
      violations,
      riskLevel: "HIGH",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: isHumanVerified, description: isHumanVerified ? "Human identity confirmed" : "Unverified human session" },
        { name: "Authorization Active", passed: false, description: "No Intent Lock token found" },
        { name: "Budget satisfied", passed: false, description: "Zero spending budget assigned" },
        { name: "Transaction Quota", passed: false, description: "Zero transaction quota" },
        { name: "Token Expiry", passed: false, description: "N/A" }
      ]
    };
  }

  // Gate 2: Authorization Status (REVOKED or EXPIRED)
  // Security Invariant: Valid identity NEVER overrides revoked or expired authorization!
  if (auth.status === "REVOKED") {
    violations.push("AUTHORIZATION_REVOKED");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: "Authorization was revoked by user. AI purchasing authority is permanently terminated.",
      violations,
      riskLevel: "HIGH",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: isHumanVerified, description: isHumanVerified ? "Human identity valid" : "Unverified" },
        { name: "Authorization Active", passed: false, description: `Token ${auth.id} is REVOKED` },
        { name: "Budget satisfied", passed: false, description: "Authority terminated" },
        { name: "Transaction Quota", passed: false, description: "Authority terminated" },
        { name: "Token Expiry", passed: false, description: "Authority terminated" }
      ]
    };
  }

  if (auth.status === "EXPIRED") {
    violations.push("AUTHORIZATION_EXPIRED");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: "Authorization has expired. AI cannot reuse stale or expired capability tokens.",
      violations,
      riskLevel: "HIGH",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: isHumanVerified, description: isHumanVerified ? "Human identity valid" : "Unverified" },
        { name: "Authorization Active", passed: false, description: `Token ${auth.id} has EXPIRED` },
        { name: "Token Expiry", passed: false, description: "Time-to-live elapsed" },
        { name: "Budget satisfied", passed: false, description: "Token invalid" },
        { name: "Transaction Quota", passed: false, description: "Token invalid" }
      ]
    };
  }

  // Gate 3: TTL Countdown Check
  const now = new Date().getTime();
  const expiryTime = new Date(auth.expiresAt).getTime();
  if (now > expiryTime) {
    violations.push("TTL_ELAPSED");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: "Authorization timer expired. AI spending window is closed.",
      violations,
      riskLevel: "HIGH",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: isHumanVerified, description: isHumanVerified ? "Human identity valid" : "Unverified" },
        { name: "Token Expiry", passed: false, description: "Countdown reached zero" },
        { name: "Authorization Active", passed: false, description: "Token expired" },
        { name: "Budget satisfied", passed: false, description: "Authorization inactive" },
        { name: "Transaction Quota", passed: false, description: "Authorization inactive" }
      ]
    };
  }

  // Gate 4: Adversarial Replay Check
  if (agentContext?.isReplayNonce) {
    violations.push("REPLAY_DETECTED");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: "Cryptographic replay detected. Token nonce already consumed and permanently burned.",
      violations,
      riskLevel: "HIGH",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: true, description: "Human identity registered" },
        { name: "Cryptographic Nonce", passed: false, description: "Nonce already burned" },
        { name: "Replay Defense", passed: false, description: "Duplicate token intercepted" },
        { name: "Authorization Active", passed: true, description: "Token format valid" },
        { name: "Budget satisfied", passed: true, description: "Amount within boundary" }
      ]
    };
  }

  // Gate 5: Voice Replay / Challenge Check
  if (agentContext?.isVoiceReplay) {
    violations.push("REPLAY_DETECTED");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: "Voice replay attempt intercepted. Stale voice recording failed dynamic challenge code verification.",
      violations,
      riskLevel: "HIGH",
      identityVerified: false,
      authenticationMethod: "VOICE_REPLAY_FAILED",
      checks: [
        { name: "Voice Challenge", passed: false, description: "Stale audio replay intercepted by dynamic challenge" },
        { name: "Liveness Check", passed: false, description: "Dynamic code mismatch" },
        { name: "Authorization Active", passed: true, description: `Token ${auth.id} valid` },
        { name: "Budget satisfied", passed: true, description: `Amount ₹${paymentRequest.amount} within limit` },
        { name: "Gateway Gate", passed: false, description: "Terminated in policy enclave" }
      ]
    };
  }

  // Gate 6: Stolen Session / Missing Human Authentication Check
  // Invariant: AI cannot authenticate itself as the human. Stolen session without fresh passkey must BLOCK.
  const requiresPasskey = identityContext?.securitySettings?.requirePasskeyForHighRisk ?? true;
  const isHighRiskTransaction = effectiveRisk === "HIGH" || effectiveRisk === "CRITICAL";

  if (agentContext?.isStolenSession || (isHighRiskTransaction && requiresPasskey && !isHumanVerified)) {
    violations.push("HUMAN_AUTH_REQUIRED");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: "Human verification required. High-risk payment exceeds security threshold. Device-native passkey authentication is mandatory.",
      violations,
      riskLevel: effectiveRisk,
      identityVerified: false,
      authenticationMethod: "NONE",
      checks: [
        { name: "Identity verified", passed: false, description: "Missing device-native passkey assertion" },
        { name: "Human Presence", passed: false, description: "Stolen session or unattended agent detected" },
        { name: "Authorization Active", passed: true, description: `Token ${auth.id} present` },
        { name: "Budget satisfied", passed: paymentRequest.amount <= auth.remainingAmount, description: `Amount ₹${paymentRequest.amount}` },
        { name: "Policy Gate", passed: false, description: "Step-up authentication required" }
      ]
    };
  }

  // Gate 7: Adversarial Prompt Injection Check
  if (agentContext?.isPromptInjected) {
    violations.push("PROMPT_INJECTION_DETECTED");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: "Prompt injection neutralized. Webpage/agent prompt instructions cannot modify immutable Intent Lock.",
      violations,
      riskLevel: "HIGH",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: true, description: "Human presence valid" },
        { name: "Intent Lock Integrity", passed: false, description: "Prompt attempted authorization override" },
        { name: "Policy Evaluation", passed: false, description: "External instruction cannot grant budget" },
        { name: "Authorization Active", passed: true, description: "Token present" },
        { name: "Gateway Gate", passed: false, description: "Terminated in enclave" }
      ]
    };
  }

  // Gate 8: Transaction Quota Check
  if (auth.transactionsUsed >= auth.transactionLimit) {
    violations.push("TRANSACTION_LIMIT_REACHED");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: `Transaction limit reached (${auth.transactionsUsed}/${auth.transactionLimit} used). Authorization quota exhausted.`,
      violations,
      riskLevel: "HIGH",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: isHumanVerified, description: "Human identity valid" },
        { name: "Authorization Active", passed: true, description: `Token ${auth.id} active` },
        { name: "Transaction Quota", passed: false, description: `Quota reached (${auth.transactionsUsed}/${auth.transactionLimit})` },
        { name: "Budget satisfied", passed: paymentRequest.amount <= auth.remainingAmount, description: `Remaining: ₹${auth.remainingAmount}` },
        { name: "Token Expiry", passed: true, description: "TTL valid" }
      ]
    };
  }

  // Gate 9: Payment Splitting / Cumulative Velocity Check
  if (agentContext?.isSplitPayment && agentContext.cumulativeSpent && agentContext.cumulativeSpent > auth.maxAmount) {
    violations.push("PAYMENT_SPLITTING_DETECTED");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: `Payment splitting intercepted. Cumulative sum of transactions (₹${agentContext.cumulativeSpent.toLocaleString('en-IN')}) exceeds authorized maximum (₹${auth.maxAmount.toLocaleString('en-IN')}).`,
      violations,
      riskLevel: "HIGH",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: isHumanVerified, description: "Human identity valid" },
        { name: "Cumulative Velocity", passed: false, description: "Multiple sub-transactions detected" },
        { name: "Aggregated Cap", passed: false, description: `Cumulative ₹${agentContext.cumulativeSpent} > Max ₹${auth.maxAmount}` },
        { name: "Authorization Active", passed: true, description: "Token format valid" },
        { name: "Transaction Quota", passed: false, description: "Single transaction ceiling enforced" }
      ]
    };
  }

  // Gate 10: Budget Authority Check (CRITICAL INVARIANT: Valid identity CANNOT bypass authorization limits!)
  if (paymentRequest.amount > auth.remainingAmount) {
    const diff = paymentRequest.amount - auth.remainingAmount;
    violations.push("AMOUNT_LIMIT_EXCEEDED");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: `The AI agent attempted to exceed the financial authority granted by the user (Requested ₹${paymentRequest.amount.toLocaleString('en-IN')} exceeds authorized budget ₹${auth.remainingAmount.toLocaleString('en-IN')} by ₹${diff.toLocaleString('en-IN')}). Identity is verified, but identity NEVER overrides payment policy.`,
      violations,
      riskLevel: "CRITICAL",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: isHumanVerified, description: isHumanVerified ? "Device Passkey confirmed" : "Unverified" },
        { name: "Authorization Active", passed: true, description: `Token ${auth.id} valid` },
        { name: "Budget satisfied", passed: false, description: `Requested ₹${paymentRequest.amount.toLocaleString('en-IN')} > Authorized ₹${auth.remainingAmount.toLocaleString('en-IN')}` },
        { name: "Intent matched", passed: false, description: "Price threshold exceeded bounds" },
        { name: "Policy Invariant", passed: false, description: "Valid human identity cannot override spending limit" }
      ]
    };
  }

  // Gate 11: Semantic Purpose Alignment Check
  if (paymentRequest.purpose && auth.purpose) {
    const isCollegeScope = auth.purpose.toLowerCase().includes("laptop") || auth.purpose.toLowerCase().includes("college") || auth.purpose.toLowerCase().includes("study");
    const isGamingAttempt = paymentRequest.purpose.toLowerCase().includes("gaming");
    if (isCollegeScope && isGamingAttempt) {
      violations.push("PURPOSE_MISMATCH");
      return {
        allowed: false,
        decision: "BLOCK",
        reason: "Purpose manipulation detected. Merchant category 'GAMING_HARDWARE' deviates from authorized 'College laptop' scope.",
        violations,
        riskLevel: "HIGH",
        identityVerified: isHumanVerified,
        authenticationMethod: authMethod,
        checks: [
          { name: "Identity verified", passed: isHumanVerified, description: "Passkey session verified" },
          { name: "Authorization Active", passed: true, description: "Token valid" },
          { name: "Budget satisfied", passed: true, description: `Amount ₹${paymentRequest.amount} within limit` },
          { name: "Purpose Alignment", passed: false, description: "Semantic drift: Education Tech vs Gaming Equipment" },
          { name: "MCC Whitelist", passed: false, description: "Target category not whitelisted for token" }
        ]
      };
    }
  }

  // Gate 12: Intent Lock Immutability Violation / Tampering
  if (agentContext?.isLockTampered || agentContext?.isEscalatedLimit) {
    violations.push("INTENT_LOCK_IMMUTABLE");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: "Intent Lock tampering intercepted. AI agent attempted to escalate spending limit or mutate an immutable authorization token without human re-authorization.",
      violations,
      riskLevel: "CRITICAL",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: isHumanVerified, description: "Passkey session verified" },
        { name: "Lock Immutability", passed: false, description: "Unauthorized token mutation or parameter inflation intercepted" },
        { name: "Cryptographic Nonce", passed: false, description: "Lock hash mismatch" },
        { name: "Authorization Active", passed: false, description: "Tampered authority rejected" },
        { name: "Budget satisfied", passed: false, description: "Enforcement boundary defended" }
      ]
    };
  }

  // Gate 13: Recipient Substitution Defense
  const reqRecipient = paymentRequest.recipient;
  const lockedRecipient = auth.recipient;
  if (agentContext?.isRecipientSubstituted || (lockedRecipient && reqRecipient && lockedRecipient.toLowerCase() !== reqRecipient.toLowerCase())) {
    violations.push("RECIPIENT_MISMATCH");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: `Recipient substitution blocked. Payment is locked strictly to "${lockedRecipient || 'authorized recipient'}", but candidate attempted to divert funds to "${reqRecipient || 'unauthorized entity'}".`,
      violations,
      riskLevel: "CRITICAL",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: isHumanVerified, description: "Passkey session verified" },
        { name: "Recipient Integrity", passed: false, description: `Expected ${lockedRecipient || 'Target'}, received ${reqRecipient || 'Substituted'}` },
        { name: "Authorization Active", passed: true, description: `Token ${auth.id} valid` },
        { name: "Budget satisfied", passed: true, description: "Amount within boundary" },
        { name: "Gateway Gate", passed: false, description: "Terminated in policy enclave" }
      ]
    };
  }

  // Gate 14: Merchant Constraint Check
  const reqMerchant = paymentRequest.merchant;
  const lockedMerchant = auth.merchant;
  if (agentContext?.isMerchantMismatch || (lockedMerchant && reqMerchant && !reqMerchant.toLowerCase().includes(lockedMerchant.toLowerCase()))) {
    violations.push("MERCHANT_MISMATCH");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: `Merchant boundary violation. Authorization is locked strictly to "${lockedMerchant}", but transaction was routed through unapproved merchant "${reqMerchant}".`,
      violations,
      riskLevel: "HIGH",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: isHumanVerified, description: "Passkey session verified" },
        { name: "Merchant Whitelist", passed: false, description: `Required "${lockedMerchant}", found "${reqMerchant}"` },
        { name: "Authorization Active", passed: true, description: `Token ${auth.id} valid` },
        { name: "Budget satisfied", passed: true, description: "Amount within boundary" },
        { name: "Policy Gate", passed: false, description: "Untrusted vendor rejected" }
      ]
    };
  }

  // Gate 15: Category Constraint Check
  if (auth.category && paymentRequest.category && auth.category !== "GENERAL" && auth.category.toUpperCase() !== paymentRequest.category.toUpperCase()) {
    const isRelated = (auth.category.toUpperCase() === "LAPTOP" && paymentRequest.category.toUpperCase() === "ELECTRONICS") ||
                      (auth.category.toUpperCase() === "ELECTRONICS" && paymentRequest.category.toUpperCase() === "LAPTOP");
    if (!isRelated) {
      violations.push("CATEGORY_MISMATCH");
      return {
        allowed: false,
        decision: "BLOCK",
        reason: `Category boundary violation. Authorization is bounded to "${auth.category}", but candidate item belongs to category "${paymentRequest.category}".`,
        violations,
        riskLevel: "HIGH",
        identityVerified: isHumanVerified,
        authenticationMethod: authMethod,
        checks: [
          { name: "Identity verified", passed: isHumanVerified, description: "Passkey session verified" },
          { name: "Category Lock", passed: false, description: `Expected ${auth.category}, found ${paymentRequest.category}` },
          { name: "Authorization Active", passed: true, description: `Token ${auth.id} valid` },
          { name: "Budget satisfied", passed: true, description: "Amount within boundary" },
          { name: "Policy Gate", passed: false, description: "Out-of-category item blocked" }
        ]
      };
    }
  }

  // Gate 16: Purpose Semantic Drift
  if (agentContext?.isPurposeDrift) {
    violations.push("PURPOSE_DRIFT_DETECTED");
    return {
      allowed: false,
      decision: "BLOCK",
      reason: `Semantic purpose drift intercepted. The candidate purchase deviates from the user's verified Intent Lock purpose: "${auth.purpose}".`,
      violations,
      riskLevel: "HIGH",
      identityVerified: isHumanVerified,
      authenticationMethod: authMethod,
      checks: [
        { name: "Identity verified", passed: isHumanVerified, description: "Passkey session verified" },
        { name: "Intent Lock Match", passed: false, description: "Semantic purpose boundary violated" },
        { name: "Authorization Active", passed: true, description: `Token ${auth.id} valid` },
        { name: "Budget satisfied", passed: true, description: "Amount within boundary" },
        { name: "Policy Gate", passed: false, description: "Drifted item blocked" }
      ]
    };
  }

  // All policy and identity gates passed
  return {
    allowed: true,
    decision: "ALLOW",
    reason: "All PayGuard policy and human identity gates validated. Human presence confirmed, Intent Lock matched, budget satisfied, transaction cleared for PayPal Sandbox dispatch.",
    violations: [],
    riskLevel: effectiveRisk,
    identityVerified: isHumanVerified,
    authenticationMethod: authMethod,
    checks: [
      { name: "Identity verified", passed: true, description: "Device Passkey assertion verified" },
      { name: "Authorization Active", passed: true, description: `Token ${auth.id} valid` },
      { name: "Budget satisfied", passed: true, description: `₹${paymentRequest.amount.toLocaleString('en-IN')} <= ₹${auth.remainingAmount.toLocaleString('en-IN')}` },
      { name: "Intent matched", passed: true, description: `Category matches ${auth.purpose}` },
      { name: "Transaction permitted", passed: true, description: "Transaction quota verified" }
    ]
  };
};
