export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  paypalLinked: boolean;
  paypalAccountEmail: string;
  paypalEnvironment: "SANDBOX" | "PRODUCTION";
  accountBalance: number;
  currency: string;
}

export type IdentityStatus = "UNVERIFIED" | "VERIFIED" | "SUSPENDED";
export type PasskeyStatus = "NOT_REGISTERED" | "REGISTERED";
export type VoiceEnrollmentStatus = "NOT_ENROLLED" | "ENROLLED";
export type DeviceTrustStatus = "UNTRUSTED" | "TRUSTED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RegisteredPasskey {
  id: string;
  credentialId: string;
  deviceName: string;
  deviceType: "platform" | "cross-platform" | "virtual_authenticator";
  createdAt: string;
  lastUsedAt: string;
  transports?: string[];
  isBackupEligible?: boolean;
}

export interface VoiceProfile {
  profileId: string;
  enrolledAt: string;
  phrasePattern: string;
  voiceSampleHash?: string;
  verifiedCount: number;
}

export interface HumanVerificationEvidence {
  identityVerified: boolean;
  authenticationMethod: "PASSKEY" | "VOICE" | "MULTI_FACTOR" | "NONE";
  passkeyVerified?: boolean;
  voiceVerified?: boolean;
  credentialId?: string;
  challenge?: string;
  timestamp: string;
  riskLevel: RiskLevel;
  deviceTrusted: boolean;
  verifiedBy?: string;
}

export interface IdentitySecuritySettings {
  requirePasskeyForHighRisk: boolean;
  requireVoiceVerification: boolean;
  requireFreshIntentConfirmation: boolean;
  highRiskThreshold: number; // e.g. 15000
}

export interface UserIdentity {
  userId: string;
  displayName: string;
  email: string;
  identityStatus: IdentityStatus;
  passkeyStatus: PasskeyStatus;
  voiceEnrollmentStatus: VoiceEnrollmentStatus;
  deviceTrustStatus: DeviceTrustStatus;
  createdAt: string;
  lastAuthenticatedAt: string;
  registeredPasskeys: RegisteredPasskey[];
  voiceProfile?: VoiceProfile;
  securitySettings: IdentitySecuritySettings;
}

export type AuthorizationStatus = "ACTIVE" | "USED" | "EXPIRED" | "REVOKED";
export type IntentAction = "PURCHASE" | "TRANSFER" | "BILL_PAY" | "SUBSCRIPTION";
export type MerchantConstraintType = "ANY" | "SPECIFIC" | "WHITELISTED";

export interface IntentLock {
  id: string;
  userId: string;
  action: IntentAction;
  purpose: string;
  category: string;
  recipient: string | null;
  merchant: string | null;
  merchantConstraint: MerchantConstraintType;
  maxAmount: number;
  remainingAmount: number;
  currency: string;
  transactionLimit: number;
  usedTransactions: number;
  allowedPaymentMethods: string[];
  constraints: string[];
  createdAt: string;
  expiresAt: string;
  nonce: string;
  status: AuthorizationStatus;
  humanVerification?: HumanVerificationEvidence;
  rawPrompt?: string;
  confidenceScore?: number;
}

export interface Authorization {
  id: string;
  userId: string;
  action?: IntentAction;
  purpose: string;
  category?: string;
  recipient?: string | null;
  merchant?: string | null;
  merchantConstraint?: MerchantConstraintType;
  maxAmount: number;
  remainingAmount: number;
  currency: string;
  transactionLimit: number;
  transactionsUsed: number;
  allowedPaymentMethods?: string[];
  constraints?: string[];
  createdAt: string;
  expiresAt: string;
  status: AuthorizationStatus;
  scopeDescription: string;
  nonce?: string;
  humanVerification?: HumanVerificationEvidence;
  rawPrompt?: string;
  confidenceScore?: number;
}

export interface IntentParsingResult {
  action: IntentAction;
  purpose: string;
  category: string;
  recipient: string | null;
  merchant: string | null;
  merchantConstraint: MerchantConstraintType;
  spendingLimit: number;
  currency: string;
  transactionLimit: number;
  expiryMinutes: number;
  constraints: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  confidenceScore: number;
  rawPrompt: string;
  missingFields: string[];
  clarificationPrompt?: string;
  isValidForLock: boolean;
}

export interface IntentDriftResult {
  hasDrift: boolean;
  driftType?: "PURPOSE_DRIFT" | "CATEGORY_DRIFT" | "RECIPIENT_DRIFT" | "MERCHANT_DRIFT" | "NONE";
  explanation: string;
  similarityScore: number;
}

export interface Intent {
  id: string;
  userId: string;
  rawPrompt: string;
  parsedPurpose: string;
  spendingLimit: number;
  currency: string;
  transactionLimit: number;
  expiryMinutes: number;
  createdAt: string;
  status: "DRAFT" | "CONFIRMED" | "LOCKED";
  category?: string;
  action?: string;
  recipient?: string | null;
  merchant?: string | null;
  confidenceScore?: number;
  missingFields?: string[];
}

export type AgentStepStatus = "completed" | "in_progress" | "pending";

export interface AgentActivityStep {
  id: string;
  label: string;
  status: AgentStepStatus;
  timestamp?: string;
  details?: string;
}

export type CapabilityStatus = "PENDING" | "ACTIVE" | "PARTIALLY_USED" | "EXPIRED" | "REVOKED" | "EXHAUSTED" | "BLOCKED" | "USED";

export interface AgentCapability {
  capabilityId: string;
  authorizationId: string;
  agentId?: string;
  allowedAction: string;
  allowedPurpose: string;
  allowedCategory: string;
  maxAmount: number;
  remainingAmount: number;
  transactionLimit: number;
  remainingTransactions: number;
  recipientConstraint: string | null;
  merchantConstraint: string;
  currency?: string;
  issuedAt?: string;
  expiresAt: string;
  nonce: string;
  status: CapabilityStatus;
  allowedActions?: string[];
  restrictedActions?: string[];
  maxSpendingLimit?: number;
  purposeBoundary?: string;
  requiresUserStepUp?: boolean;
  createdAt?: string;
}

export type AgentSessionStatus = "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED" | "COMPLETED" | "BLOCKED";

export interface AgentAction {
  id: string;
  type: "SEARCH" | "VIEW_PRODUCT" | "COMPARE" | "SELECT" | "CREATE_PAYMENT_REQUEST" | "EXTERNAL_FETCH";
  description: string;
  timestamp: string;
  result?: string;
  riskContribution: number;
  metadata?: Record<string, unknown>;
}

export interface AgentToolCall {
  id: string;
  tool: "searchProducts" | "getProduct" | "compareProducts" | "createPaymentRequest" | "fetchExternalContent";
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  timestamp: string;
  duration: number;
  trustLevel: "TRUSTED" | "UNTRUSTED" | "MALICIOUS";
}

export interface AgentDecision {
  id: string;
  sessionId: string;
  type: "PRODUCT_SELECTED" | "PAYMENT_INITIATED" | "SEARCH_REFINED" | "CONTENT_REJECTED" | "DRIFT_DETECTED";
  reasoning: string;
  timestamp: string;
  riskScore: number;
}

export interface AgentBehaviorEvent {
  id: string;
  sessionId: string;
  type: "TOOL_CALL" | "DECISION" | "RISK_CHANGE" | "CONTENT_CLASSIFICATION" | "DRIFT_DETECTED" | "CAPABILITY_CHECK" | "PAYMENT_ATTEMPT" | "SESSION_EVENT";
  title: string;
  description: string;
  timestamp: string;
  riskDelta: number;
  cumulativeRisk: number;
}

export type ContentTrustLevel = "TRUSTED" | "UNTRUSTED" | "MALICIOUS";

export interface ContentClassification {
  source: string;
  trustLevel: ContentTrustLevel;
  flags: string[];
  explanation: string;
}

export interface AgentIdentity {
  agentId: string;
  name: string;
  version: string;
  trustLevel: "SANDBOXED" | "RESTRICTED" | "VERIFIED";
  permissions: string[];
  restrictedActions: string[];
  createdAt: string;
}

export interface AgentSession {
  id: string;
  userId: string;
  agentName: string;
  status: AgentSessionStatus | "IDLE" | "RESTRICTED" | "TERMINATED";
  authorizationId: string;
  capabilityId?: string;
  currentTask: string;
  steps: AgentActivityStep[];
  actions?: AgentAction[];
  toolCalls?: AgentToolCall[];
  decisions?: AgentDecision[];
  behaviorTimeline?: AgentBehaviorEvent[];
  startedAt: string;
  expiresAt?: string;
  lastActivityAt?: string;
  actionCount?: number;
  maxActions?: number;
  riskScore?: number;
  contentClassifications?: ContentClassification[];
}

export interface AgentShoppingResult {
  selectedProduct: Product | null;
  searchActions: AgentAction[];
  toolCalls: AgentToolCall[];
  decisions: AgentDecision[];
  behaviorTimeline: AgentBehaviorEvent[];
  finalRiskScore: number;
  recommendation: string;
  contentClassifications: ContentClassification[];
}


export interface Product {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  currency: string;
  merchant: string;
  rating: number;
  specs: string[];
  inStock: boolean;
  category?: string;
  isMaliciousOrOverBudget?: boolean;
  badgeLabel?: string;
  imageUrl?: string;
}

export interface SecurityCheckResult {
  name: string;
  passed: boolean;
  description: string;
}

export interface PaymentRequest {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  merchant: string;
  requestedAmount: number;
  authorizedAmount: number;
  currency: string;
  purpose: string;
  authorizationId: string;
  status: "PENDING" | "APPROVED" | "BLOCKED" | "STEP_UP";
  blockReason?: string;
  checks: SecurityCheckResult[];
  timestamp: string;
  humanVerification?: HumanVerificationEvidence;
  riskLevel?: RiskLevel;
  nonce?: string;
  capabilityId?: string;
  agentId?: string;
  sessionId?: string;
}

export type PolicyDecision = "ALLOW" | "BLOCK" | "STEP_UP";

export interface PolicyCheck {
  checkId: string;
  name: string;
  status: "PASS" | "FAIL" | "WARNING" | "SKIPPED";
  reason: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface PolicyEvaluation {
  decision: PolicyDecision;
  requestId: string;
  userId: string;
  checks: PolicyCheck[];
  riskScore: number;
  riskLevel: RiskLevel;
  primaryReason?: string;
  reasonCode?: string;
  evaluatedAt: string;
  paypalEligible: boolean;
  evidenceId?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  authorizationId: string;
  productName: string;
  merchant: string;
  amount: number;
  currency: string;
  purpose: string;
  status: "APPROVED" | "BLOCKED" | "PENDING";
  reason?: string;
  date: string;
  timestamp?: string;
  riskLevel?: RiskLevel;
  paymentMethod?: string;
  humanVerified?: boolean;
  authenticationMethod?: string;
}

export interface SecurityEvent {
  id: string;
  userId: string;
  type:
    | "PAYMENT_BLOCKED"
    | "ATTACK_INTERCEPTED"
    | "AUTHORIZATION_REVOKED"
    | "LIMIT_EXCEEDED"
    | "PAYMENT_APPROVED"
    | "AUTHORIZATION_CREATED"
    | "AUTHORIZATION_EXPIRED"
    | "PAYPAL_CONNECTED"
    | "PAYPAL_DISCONNECTED"
    | "SETTINGS_UPDATED"
    | "PASSKEY_REGISTERED"
    | "PASSKEY_AUTHENTICATED"
    | "PASSKEY_AUTH_FAILED"
    | "VOICE_ENROLLED"
    | "VOICE_VERIFIED"
    | "VOICE_VERIFICATION_FAILED"
    | "HIGH_RISK_AUTH_REQUESTED"
    | "HUMAN_AUTH_REQUIRED"
    | "HUMAN_AUTH_COMPLETED"
    | "HUMAN_AUTH_FAILED"
    | "IDENTITY_FAILURE"
    | "INTENT_MISMATCH"
    | "CAPABILITY_VIOLATION"
    | "CAPABILITY_TAMPERING"
    | "SESSION_VIOLATION"
    | "BUDGET_EXCEEDED"
    | "TRANSACTION_LIMIT_EXCEEDED"
    | "PAYMENT_SPLITTING_DETECTED"
    | "REPLAY_ATTACK_DETECTED"
    | "STALE_PAYMENT_REQUEST"
    | "RECIPIENT_MISMATCH"
    | "MERCHANT_MISMATCH"
    | "CATEGORY_MISMATCH"
    | "PURPOSE_MISMATCH"
    | "UNTRUSTED_AUTHORITY_ATTEMPT"
    | "INTENT_DRIFT_DETECTED"
    | "RISK_THRESHOLD_EXCEEDED"
    | "STEP_UP_REQUIRED"
    | "STEP_UP_SUCCESS"
    | "STEP_UP_FAILURE"
    | "PAYMENT_ALLOWED";
  severity: "HIGH" | "MEDIUM" | "INFO";
  title: string;
  description: string;
  requestedAmount?: number;
  authorizedAmount?: number;
  authorizationId?: string;
  reason: string;
  timestamp: string;
  transactionId?: string;
  rawDetails?: {
    userAuthorization: number;
    agentRequest: number;
    difference: number;
    violation: string;
    decision: "BLOCKED" | "ALLOWED";
  };
}

export interface AttackScenario {
  id: string;
  title: string;
  category:
    | "budget_manipulation"
    | "prompt_injection"
    | "purpose_manipulation"
    | "replay_attack"
    | "payment_splitting"
    | "legitimate_payment"
    | "identity_bypass"
    | "voice_replay"
    | "stolen_session"
    | "intent_tampering"
    | "recipient_substitution"
    | "merchant_drift"
    | "purpose_drift"
    | "capability_escalation"
    | "capability_tampering"
    | "expired_capability"
    | "session_revocation"
    | "capability_replay"
    | "prompt_injection_product";
  subtitle: string;
  attemptDescription: string;
  attemptAmount?: number;
  authorizedAmount?: number;
  maliciousInstruction?: string;
  result: "BLOCKED" | "ALLOWED";
  violationReason: string;
  securityChecks: {
    name: string;
    passed: boolean;
    rule: string;
  }[];
}

export interface AttackExecutionResult {
  scenarioId: string;
  scenarioTitle: string;
  expectedResult: "BLOCKED" | "ALLOWED";
  actualResult: "BLOCKED" | "ALLOWED";
  decision: "BLOCKED" | "ALLOWED";
  reason: string;
  timestamp: string;
  passed: boolean;
  checks: {
    name: string;
    passed: boolean;
    rule: string;
  }[];
}

export interface EvidenceFlowStep {
  step: string;
  entity: string;
  data: string;
  verified: boolean;
}

export interface EvidenceDetail {
  id: string;
  userId?: string;
  transactionId: string;
  authorizationId: string;
  humanIntent: string;
  agentAction: string;
  paymentRequestAmount: number;
  authorizedAmount: number;
  merchant: string;
  policyChecks: SecurityCheckResult[];
  decision: "APPROVED" | "BLOCKED";
  decisionSummary: string;
  timestamp: string;
  flowSteps: EvidenceFlowStep[];
  humanVerification?: HumanVerificationEvidence;
  riskLevel?: RiskLevel;
}
