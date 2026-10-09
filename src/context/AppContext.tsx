import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  User,
  Authorization,
  Intent,
  IntentLock,
  IntentParsingResult,
  IntentDriftResult,
  AgentCapability,
  Product,
  Transaction,
  SecurityEvent,
  PaymentRequest,
  AgentSession,
  AttackExecutionResult,
  EvidenceDetail,
  AgentActivityStep,
  UserIdentity,
  RegisteredPasskey,
  VoiceProfile,
  HumanVerificationEvidence,
  IdentitySecuritySettings,
  RiskLevel
} from '../types';
import {
  mockUser,
  initialAuthorization,
  mockProducts,
  initialAgentSteps,
  mockTransactions,
  mockSecurityEvents,
  mockAttackScenarios,
  mockEvidenceDetail
} from '../data/mockData';
import { policyService, evaluatePaymentRequest, parseNaturalLanguageIntent } from '../services/apiServices';
import { passkeyService } from '../services/passkeyService';
import { voiceIdentityService, VoiceChallenge } from '../services/voiceIdentityService';
import { identityService, initialUserIdentity } from '../services/identityService';
import { IntentService, parseIntent, detectIntentDrift, createAgentCapability } from '../services/intentService';

const STORAGE_KEY_AUTH = 'payguard_auth_v2';
const STORAGE_KEY_AUTH_HIST = 'payguard_auth_hist_v2';
const STORAGE_KEY_TXNS = 'payguard_txns_v2';
const STORAGE_KEY_EVENTS = 'payguard_events_v2';
const STORAGE_KEY_USER = 'payguard_user_v2';
const STORAGE_KEY_INTENT = 'payguard_intent_v2';
const STORAGE_KEY_EVIDENCE = 'payguard_evidence_v2';
const STORAGE_KEY_PAYPAL = 'payguard_paypal_v2';
const STORAGE_KEY_IDENTITY = 'payguard_identity_v2';

interface AppContextType {
  user: User;
  userIdentity: UserIdentity;
  lastHumanVerification: HumanVerificationEvidence | null;
  accountBalance: number;
  aiAuthorizedBudget: number;
  authorization: Authorization | null;
  authorizationHistory: Authorization[];
  currentIntent: Intent | null;
  agentSession: AgentSession;
  products: Product[];
  selectedProduct: Product | null;
  activePaymentRequest: PaymentRequest | null;
  transactions: Transaction[];
  securityEvents: SecurityEvent[];
  attackResults: Record<string, AttackExecutionResult>;
  paypalConnectionStatus: { connected: boolean; environment: "SANDBOX"; status: string };
  paypalConnected: boolean;
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Step 5: Intent Engine & Intent Lock State
  intentLock: IntentLock | null;
  agentCapability: AgentCapability | null;
  currentParsedIntent: IntentParsingResult | null;
  parseIntentPrompt: (prompt: string) => IntentParsingResult;
  createIntentLock: (parsed: IntentParsingResult, requirePasskey?: boolean) => Promise<{ success: boolean; lock: IntentLock | null }>;
  editActiveLock: (updatedParsed: IntentParsingResult) => Promise<{ success: boolean; newLock: IntentLock | null; message: string }>;
  validateIntentDrift: (candidate: { title?: string; category?: string; merchant?: string; recipient?: string; amount?: number }) => IntentDriftResult;
  
  // Actions
  createAuthorization: (purpose: string, maxAmount: number, transactionLimit: number, expiryMinutes: number, rawPrompt?: string) => void;
  updateBudgetLimit: (newMaxAmount: number) => void;
  revokeAuthorization: () => void;
  extendAuthorizationExpiry: (additionalMinutes: number) => void;
  preparePayment: (product: Product) => Promise<PaymentRequest>;
  confirmPayPalPayment: () => Promise<{ success: boolean; txnId: string }>;
  clearPaymentRequest: () => void;
  setSelectedProduct: (product: Product | null) => void;
  runAttackScenario: (scenarioId: string) => AttackExecutionResult;
  runAllAttackScenarios: () => Promise<Record<string, AttackExecutionResult>>;
  togglePayPalConnection: () => Promise<boolean>;
  updateUser: (name: string, email: string) => void;
  resetDemoData: () => void;
  getEvidenceForEvent: (eventId: string) => EvidenceDetail | null;
  parseAndSetIntent: (prompt: string) => Intent;

  // Identity & Biometrics Layer (Step 4)
  registerDevicePasskey: (deviceName?: string) => Promise<boolean>;
  removeDevicePasskey: (id: string) => void;
  enrollVoiceIdentity: (phrase?: string) => Promise<boolean>;
  removeVoiceIdentity: () => void;
  updateIdentitySettings: (newSettings: Partial<IdentitySecuritySettings>) => void;
  verifyDevicePasskey: () => Promise<{ success: boolean; evidence?: HumanVerificationEvidence; message: string }>;
  verifyVoiceChallenge: (challenge: VoiceChallenge, responseCode: string) => Promise<{ success: boolean; message: string }>;
  getNewVoiceChallenge: () => VoiceChallenge;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize state with localStorage or default mock data
  const [user, setUser] = useState<User>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      return stored ? JSON.parse(stored) : mockUser;
    } catch {
      return mockUser;
    }
  });

  const [authorization, setAuthorization] = useState<Authorization | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTH);
      return stored ? JSON.parse(stored) : initialAuthorization;
    } catch {
      return initialAuthorization;
    }
  });

  const [authorizationHistory, setAuthorizationHistory] = useState<Authorization[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTH_HIST);
      return stored ? JSON.parse(stored) : [
        {
          id: "AUTH-2026-TEXTB-402",
          userId: mockUser.id,
          purpose: "Academic Books",
          maxAmount: 2000,
          remainingAmount: 550,
          currency: "INR",
          transactionLimit: 1,
          transactionsUsed: 1,
          createdAt: "2026-10-07T10:00:00Z",
          expiresAt: "2026-10-07T12:00:00Z",
          status: "USED",
          scopeDescription: "Authorized for Academic Books under ₹2,000"
        },
        {
          id: "AUTH-2026-DESK-210",
          userId: mockUser.id,
          purpose: "Dorm Furniture",
          maxAmount: 5000,
          remainingAmount: 101,
          currency: "INR",
          transactionLimit: 1,
          transactionsUsed: 1,
          createdAt: "2026-10-06T09:00:00Z",
          expiresAt: "2026-10-06T11:00:00Z",
          status: "USED",
          scopeDescription: "Authorized for Dorm Furniture under ₹5,000"
        }
      ];
    } catch {
      return [];
    }
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TXNS);
      return stored ? JSON.parse(stored) : mockTransactions;
    } catch {
      return mockTransactions;
    }
  });

  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_EVENTS);
      return stored ? JSON.parse(stored) : mockSecurityEvents;
    } catch {
      return mockSecurityEvents;
    }
  });

  const [currentIntent, setCurrentIntent] = useState<Intent | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_INTENT);
      return stored ? JSON.parse(stored) : {
        id: "INT-INIT-1",
        userId: mockUser.id,
        rawPrompt: "Find me a laptop for college under ₹20,000.",
        parsedPurpose: "College laptop",
        spendingLimit: 20000,
        currency: "INR",
        transactionLimit: 1,
        expiryMinutes: 30,
        createdAt: new Date().toISOString(),
        status: "LOCKED",
        category: "Laptop",
        action: "Purchase"
      };
    } catch {
      return null;
    }
  });

  const [evidenceVault, setEvidenceVault] = useState<Record<string, EvidenceDetail>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_EVIDENCE);
      return stored ? JSON.parse(stored) : { [mockEvidenceDetail.id]: mockEvidenceDetail };
    } catch {
      return { [mockEvidenceDetail.id]: mockEvidenceDetail };
    }
  });

  const [paypalConnected, setPaypalConnected] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PAYPAL);
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  const [userIdentity, setUserIdentity] = useState<UserIdentity>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_IDENTITY);
      return stored ? JSON.parse(stored) : initialUserIdentity;
    } catch {
      return initialUserIdentity;
    }
  });

  const [lastHumanVerification, setLastHumanVerification] = useState<HumanVerificationEvidence | null>(() => {
    return identityService.createVerificationEvidence("PASSKEY", "LOW", initialUserIdentity.registeredPasskeys[0]?.credentialId);
  });

  const [products] = useState<Product[]>(mockProducts);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activePaymentRequest, setActivePaymentRequest] = useState<PaymentRequest | null>(null);
  const [attackResults, setAttackResults] = useState<Record<string, AttackExecutionResult>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Step 5: Intent Lock and Capability state
  const [intentLock, setIntentLock] = useState<IntentLock | null>(() => {
    const active = IntentService.getActiveLock();
    if (active) return active;
    if (initialAuthorization) {
      return {
        id: initialAuthorization.id,
        userId: initialAuthorization.userId,
        action: initialAuthorization.action || "PURCHASE",
        purpose: initialAuthorization.purpose,
        category: initialAuthorization.category || "LAPTOP",
        recipient: initialAuthorization.recipient || null,
        merchant: initialAuthorization.merchant || null,
        merchantConstraint: initialAuthorization.merchantConstraint || "ANY",
        maxAmount: initialAuthorization.maxAmount,
        remainingAmount: initialAuthorization.remainingAmount,
        currency: initialAuthorization.currency,
        transactionLimit: initialAuthorization.transactionLimit,
        usedTransactions: initialAuthorization.transactionsUsed,
        allowedPaymentMethods: ["PAYPAL_WALLET", "VERIFIED_CARDS"],
        constraints: initialAuthorization.constraints || ["Bounded budget", "Single continuous transaction"],
        createdAt: initialAuthorization.createdAt,
        expiresAt: initialAuthorization.expiresAt,
        nonce: initialAuthorization.nonce || "nonce_initial",
        status: initialAuthorization.status,
        rawPrompt: "Find me a laptop for college under ₹20,000.",
        confidenceScore: 0.95
      };
    }
    return null;
  });

  const [currentParsedIntent, setCurrentParsedIntent] = useState<IntentParsingResult | null>(null);

  const agentCapability: AgentCapability | null = useMemo(() => {
    if (intentLock && intentLock.status === 'ACTIVE') {
      return createAgentCapability(intentLock);
    }
    if (authorization && authorization.status === 'ACTIVE') {
      return createAgentCapability(authorization);
    }
    return null;
  }, [intentLock, authorization]);

  const [agentSteps] = useState<AgentActivityStep[]>(initialAgentSteps);
  const [agentSession] = useState<AgentSession>({
    id: "SESS-AGENT-094",
    userId: user.id,
    agentName: "PayGuard Autonomous Shopping Agent",
    status: authorization?.status === 'ACTIVE' ? "ACTIVE" : "RESTRICTED",
    authorizationId: authorization?.id || "NONE",
    currentTask: "Continuous bounded product search & checkout",
    steps: agentSteps,
    startedAt: new Date().toISOString()
  });

  const paypalConnectionStatus = {
    connected: paypalConnected,
    environment: "SANDBOX" as const,
    status: paypalConnected ? "PayPal Sandbox — Demo Mode (Connected)" : "PayPal Sandbox (Disconnected)"
  };

  // Synchronize localStorage
  useEffect(() => {
    try {
      if (authorization) localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(authorization));
      else localStorage.removeItem(STORAGE_KEY_AUTH);
    } catch (e) { console.error(e); }
  }, [authorization]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AUTH_HIST, JSON.stringify(authorizationHistory));
    } catch (e) { console.error(e); }
  }, [authorizationHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TXNS, JSON.stringify(transactions));
    } catch (e) { console.error(e); }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(securityEvents));
    } catch (e) { console.error(e); }
  }, [securityEvents]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => {
    try {
      if (currentIntent) localStorage.setItem(STORAGE_KEY_INTENT, JSON.stringify(currentIntent));
    } catch (e) { console.error(e); }
  }, [currentIntent]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EVIDENCE, JSON.stringify(evidenceVault));
    } catch (e) { console.error(e); }
  }, [evidenceVault]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PAYPAL, JSON.stringify(paypalConnected));
    } catch (e) { console.error(e); }
  }, [paypalConnected]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_IDENTITY, JSON.stringify(userIdentity));
    } catch (e) { console.error(e); }
  }, [userIdentity]);

  // Toast Notification handler
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Active Authorization TTL countdown & Auto-Expire check
  useEffect(() => {
    if (!authorization || authorization.status !== 'ACTIVE') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const expiresAt = new Date(authorization.expiresAt).getTime();

      if (now >= expiresAt) {
        // Automatically expire
        const expiredAuth: Authorization = {
          ...authorization,
          status: 'EXPIRED'
        };
        setAuthorization(expiredAuth);
        setAuthorizationHistory(prev => [expiredAuth, ...prev]);

        const newSecEvent: SecurityEvent = {
          id: `SEC-EVT-${Date.now()}`,
          userId: user.id,
          type: 'AUTHORIZATION_EXPIRED',
          severity: 'MEDIUM',
          title: 'Authorization Expired (TTL Elapsed)',
          description: `Authorization ${authorization.id} reached expiry threshold. AI agent spending window closed.`,
          reason: 'Time-to-live expired (countdown reached zero)',
          timestamp: 'Just now'
        };
        setSecurityEvents(prev => [newSecEvent, ...prev]);
        showToast('Your AI authorization has expired.');
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [authorization, user.id]);

  // Derived Financial Boundaries
  const accountBalance = user.accountBalance;
  const aiAuthorizedBudget = authorization && authorization.status === 'ACTIVE'
    ? authorization.remainingAmount
    : 0;

  // Intent parsing helper
  const parseAndSetIntent = (prompt: string): Intent => {
    const parsed = parseNaturalLanguageIntent(prompt);
    const newIntent: Intent = {
      id: `INT-${Date.now()}`,
      userId: user.id,
      rawPrompt: prompt,
      parsedPurpose: parsed.purpose,
      spendingLimit: parsed.spendingLimit,
      currency: parsed.currency,
      transactionLimit: parsed.transactionLimit,
      expiryMinutes: parsed.expiryMinutes,
      createdAt: new Date().toISOString(),
      status: "DRAFT",
      category: parsed.category,
      action: parsed.action
    };
    setCurrentIntent(newIntent);
    return newIntent;
  };

  // Step 5: Parse natural-language prompt with confidence and missing-field checking
  const parseIntentPrompt = (prompt: string): IntentParsingResult => {
    const result = parseIntent(prompt);
    setCurrentParsedIntent(result);
    return result;
  };

  // Step 5: Mint immutable Intent Lock with explicit human authority
  const createIntentLock = async (
    parsed: IntentParsingResult,
    requirePasskey = false
  ): Promise<{ success: boolean; lock: IntentLock | null }> => {
    let humanEvidence = lastHumanVerification || undefined;
    if (requirePasskey || userIdentity.securitySettings.requirePasskeyForHighRisk) {
      const authRes = await verifyDevicePasskey();
      if (!authRes.success) {
        showToast("Human verification failed. Cannot issue Intent Lock without passkey assertion.");
        return { success: false, lock: null };
      }
      humanEvidence = authRes.evidence;
    }

    const newLock = IntentService.mintIntentLock(parsed, user.id, humanEvidence);
    setIntentLock(newLock);

    const newAuth: Authorization = {
      id: newLock.id,
      userId: newLock.userId,
      action: newLock.action,
      purpose: newLock.purpose,
      category: newLock.category,
      recipient: newLock.recipient,
      merchant: newLock.merchant,
      merchantConstraint: newLock.merchantConstraint,
      maxAmount: newLock.maxAmount,
      remainingAmount: newLock.maxAmount,
      currency: newLock.currency,
      transactionLimit: newLock.transactionLimit,
      transactionsUsed: 0,
      allowedPaymentMethods: newLock.allowedPaymentMethods,
      constraints: newLock.constraints,
      createdAt: newLock.createdAt,
      expiresAt: newLock.expiresAt,
      status: 'ACTIVE',
      scopeDescription: `Authorized for ${newLock.purpose} under ₹${newLock.maxAmount.toLocaleString('en-IN')}`,
      nonce: newLock.nonce,
      humanVerification: humanEvidence,
      rawPrompt: newLock.rawPrompt,
      confidenceScore: newLock.confidenceScore
    };
    if (authorization) {
      setAuthorizationHistory(prev => [authorization, ...prev]);
    }
    setAuthorization(newAuth);

    setCurrentIntent({
      id: `INT-${Date.now()}`,
      userId: user.id,
      rawPrompt: parsed.rawPrompt,
      parsedPurpose: parsed.purpose,
      spendingLimit: parsed.spendingLimit,
      currency: parsed.currency,
      transactionLimit: parsed.transactionLimit,
      expiryMinutes: parsed.expiryMinutes,
      createdAt: newLock.createdAt,
      status: "LOCKED",
      category: parsed.category,
      action: parsed.action
    });

    const secEvent: SecurityEvent = {
      id: `SEC-EVT-${Date.now()}`,
      userId: user.id,
      type: 'AUTHORIZATION_CREATED',
      severity: 'INFO',
      title: 'Intent Lock Issued (Human Verified)',
      description: `Active authorization minted for "${newLock.purpose}" with bounded ceiling ₹${newLock.maxAmount.toLocaleString('en-IN')}. Device passkey verified.`,
      authorizedAmount: newLock.maxAmount,
      authorizationId: newLock.id,
      reason: 'Human Intent Authorization verified with device passkey',
      timestamp: 'Just now'
    };
    setSecurityEvents(prev => [secEvent, ...prev]);
    showToast(`Intent Lock created: ₹${newLock.maxAmount.toLocaleString('en-IN')} for "${newLock.purpose}".`);

    return { success: true, lock: newLock };
  };

  // Step 5: Safe edit of active lock — enforces immutability by revoking old lock and minting fresh lock
  const editActiveLock = async (
    updatedParsed: IntentParsingResult
  ): Promise<{ success: boolean; newLock: IntentLock | null; message: string }> => {
    if (!intentLock && !authorization) {
      return { success: false, newLock: null, message: "No active authorization found to edit." };
    }
    const currentId = intentLock?.id || authorization?.id || "";

    // 1. Revoke existing lock
    IntentService.revokeLock(currentId);
    if (authorization) {
      setAuthorizationHistory(prev => [{ ...authorization, status: "REVOKED", remainingAmount: 0 }, ...prev]);
    }

    // 2. Mint fresh lock
    const humanEvidence = identityService.createVerificationEvidence(
      userIdentity.passkeyStatus === 'REGISTERED' ? "PASSKEY" : "NONE",
      "LOW",
      userIdentity.registeredPasskeys[0]?.credentialId
    );
    const newLock = IntentService.mintIntentLock(updatedParsed, user.id, humanEvidence);
    setIntentLock(newLock);

    const newAuth: Authorization = {
      id: newLock.id,
      userId: newLock.userId,
      action: newLock.action,
      purpose: newLock.purpose,
      category: newLock.category,
      recipient: newLock.recipient,
      merchant: newLock.merchant,
      merchantConstraint: newLock.merchantConstraint,
      maxAmount: newLock.maxAmount,
      remainingAmount: newLock.maxAmount,
      currency: newLock.currency,
      transactionLimit: newLock.transactionLimit,
      transactionsUsed: 0,
      allowedPaymentMethods: newLock.allowedPaymentMethods,
      constraints: newLock.constraints,
      createdAt: newLock.createdAt,
      expiresAt: newLock.expiresAt,
      status: 'ACTIVE',
      scopeDescription: `Authorized for ${newLock.purpose} under ₹${newLock.maxAmount.toLocaleString('en-IN')}`,
      nonce: newLock.nonce,
      humanVerification: humanEvidence,
      rawPrompt: newLock.rawPrompt,
      confidenceScore: newLock.confidenceScore
    };
    setAuthorization(newAuth);

    const secEvent: SecurityEvent = {
      id: `SEC-EVT-${Date.now()}`,
      userId: user.id,
      type: 'AUTHORIZATION_CREATED',
      severity: 'INFO',
      title: 'Intent Lock Safely Replaced (Immutability Defense)',
      description: `Active lock ${currentId} was revoked. Fresh Intent Lock ${newLock.id} minted with new nonce and updated bounds.`,
      authorizedAmount: newLock.maxAmount,
      authorizationId: newLock.id,
      reason: 'Human Intent updated via atomic revoke-and-mint',
      timestamp: 'Just now'
    };
    setSecurityEvents(prev => [secEvent, ...prev]);
    showToast(`Previous Intent Lock revoked. New Intent Lock created for ₹${newLock.maxAmount.toLocaleString('en-IN')}.`);

    return {
      success: true,
      newLock,
      message: `Previous lock ${currentId} revoked. New Intent Lock minted.`
    };
  };

  // Step 5: Detect Intent Drift against candidate purchase
  const validateIntentDrift = (candidate: {
    title?: string;
    category?: string;
    merchant?: string;
    recipient?: string;
    amount?: number;
  }): IntentDriftResult => {
    const lockToTest = intentLock || authorization;
    if (!lockToTest) {
      return {
        hasDrift: true,
        driftType: "PURPOSE_DRIFT",
        explanation: "No active Intent Lock exists.",
        similarityScore: 0
      };
    }
    return detectIntentDrift(candidate, lockToTest);
  };

  // Update budget limit on current authorization
  const updateBudgetLimit = (newMaxAmount: number) => {
    if (!authorization) {
      showToast('No authorization to update. Please create one first.');
      return;
    }
    const spentSoFar = authorization.maxAmount - authorization.remainingAmount;
    const newRemaining = Math.max(0, newMaxAmount - spentSoFar);

    const updatedAuth: Authorization = {
      ...authorization,
      maxAmount: newMaxAmount,
      remainingAmount: newRemaining
    };
    setAuthorization(updatedAuth);

    const secEvent: SecurityEvent = {
      id: `SEC-EVT-${Date.now()}`,
      userId: user.id,
      type: 'SETTINGS_UPDATED',
      severity: 'INFO',
      title: 'AI Budget Limit Adjusted',
      description: `User adjusted authorized budget cap to ₹${newMaxAmount.toLocaleString('en-IN')}.`,
      authorizedAmount: newMaxAmount,
      authorizationId: authorization.id,
      reason: 'Human parameter adjustment',
      timestamp: 'Just now'
    };
    setSecurityEvents(prev => [secEvent, ...prev]);
    showToast(`AI Authorized Budget updated to ₹${newMaxAmount.toLocaleString('en-IN')}.`);
  };

  // Extend expiry on current active authorization
  const extendAuthorizationExpiry = (additionalMinutes: number) => {
    if (!authorization) return;
    const currentExpiryMs = new Date(authorization.expiresAt).getTime();
    const newExpiresAt = new Date(Math.max(Date.now(), currentExpiryMs) + additionalMinutes * 60 * 1000).toISOString();

    const extendedAuth: Authorization = {
      ...authorization,
      status: 'ACTIVE',
      expiresAt: newExpiresAt
    };
    setAuthorization(extendedAuth);

    showToast(`Authorization extended by ${additionalMinutes} minutes.`);
  };

  // Create Authorization
  const createAuthorization = (
    purpose: string,
    maxAmount: number,
    transactionLimit: number,
    expiryMinutes: number,
    rawPrompt?: string
  ) => {
    // If there was an active one, move it to history
    if (authorization) {
      setAuthorizationHistory(prev => [authorization, ...prev]);
    }

    // Attach verified human evidence to the newly created authorization
    const humanEvidence = identityService.createVerificationEvidence(
      userIdentity.passkeyStatus === 'REGISTERED' ? "PASSKEY" : "NONE",
      "LOW",
      userIdentity.registeredPasskeys[0]?.credentialId
    );

    const newAuth: Authorization = {
      id: `AUTH-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-01`,
      userId: user.id,
      purpose,
      maxAmount,
      remainingAmount: maxAmount,
      currency: 'INR',
      transactionLimit,
      transactionsUsed: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString(),
      status: 'ACTIVE',
      scopeDescription: `Authorized for ${purpose} under ₹${maxAmount.toLocaleString('en-IN')}`,
      nonce: `NONCE-${Date.now().toString(36)}`,
      humanVerification: humanEvidence
    };

    setAuthorization(newAuth);
    setLastHumanVerification(humanEvidence);

    if (rawPrompt) {
      setCurrentIntent({
        id: `INT-${Date.now()}`,
        userId: user.id,
        rawPrompt,
        parsedPurpose: purpose,
        spendingLimit: maxAmount,
        currency: 'INR',
        transactionLimit,
        expiryMinutes,
        createdAt: new Date().toISOString(),
        status: "LOCKED"
      });
    }

    const secEvent: SecurityEvent = {
      id: `SEC-EVT-${Date.now()}`,
      userId: user.id,
      type: 'AUTHORIZATION_CREATED',
      severity: 'INFO',
      title: 'Intent Lock Issued (Human Verified)',
      description: `Active authorization minted for "${purpose}" with bounded ceiling ₹${maxAmount.toLocaleString('en-IN')}. Device passkey verified.`,
      authorizedAmount: maxAmount,
      authorizationId: newAuth.id,
      reason: 'Human Intent Authorization verified with device passkey',
      timestamp: 'Just now'
    };

    setSecurityEvents(prev => [secEvent, ...prev]);
    showToast(`Authorization created: ₹${maxAmount.toLocaleString('en-IN')} for "${purpose}".`);
  };

  // Revoke Authorization
  const revokeAuthorization = () => {
    if (!authorization) return;

    const revokedAuth: Authorization = {
      ...authorization,
      status: 'REVOKED',
      remainingAmount: 0
    };
    setAuthorization(revokedAuth);
    setAuthorizationHistory(prev => [revokedAuth, ...prev]);

    if (intentLock) {
      IntentService.revokeLock(intentLock.id);
      setIntentLock({ ...intentLock, status: 'REVOKED', remainingAmount: 0 });
    }

    const newEvent: SecurityEvent = {
      id: `SEC-EVT-${Date.now()}`,
      userId: user.id,
      type: 'AUTHORIZATION_REVOKED',
      severity: 'HIGH',
      title: 'Human Authorization Revoked',
      description: `User revoked authorization ${authorization.id}. AI capability immediately severed.`,
      authorizationId: authorization.id,
      reason: 'User manual revocation',
      timestamp: 'Just now'
    };

    setSecurityEvents(prev => [newEvent, ...prev]);
    showToast('Your AI authorization has been revoked. AI purchasing authority disabled.');
  };

  // Prepare & Evaluate Payment Request
  // Prepare & Evaluate Payment Request
  const preparePayment = async (product: Product): Promise<PaymentRequest> => {
    setSelectedProduct(product);

    const effectiveRisk: RiskLevel = identityService.calculateRiskLevel(
      product.price,
      userIdentity.securitySettings,
      authorization?.remainingAmount || 20000
    );

    const idCtx = {
      identityStatus: userIdentity.identityStatus,
      passkeyStatus: userIdentity.passkeyStatus,
      voiceEnrollmentStatus: userIdentity.voiceEnrollmentStatus,
      deviceTrustStatus: userIdentity.deviceTrustStatus,
      securitySettings: userIdentity.securitySettings
    };

    const policyResult = evaluatePaymentRequest(
      {
        amount: product.price,
        purpose: product.name,
        merchant: product.merchant,
        category: product.category,
        humanVerification: lastHumanVerification || undefined,
        riskLevel: effectiveRisk
      },
      authorization,
      undefined,
      idCtx
    );

    const isBlocked = policyResult.decision === 'BLOCK';
    const authLimit = authorization ? authorization.remainingAmount : 0;
    const authId = authorization ? authorization.id : 'NO-AUTH';

    const req: PaymentRequest = {
      id: `PREQ-${Date.now()}`,
      userId: user.id,
      productId: product.id,
      productName: product.name,
      merchant: product.merchant,
      requestedAmount: product.price,
      authorizedAmount: authLimit,
      currency: product.currency,
      purpose: authorization?.purpose || 'College laptop',
      authorizationId: authId,
      status: isBlocked ? 'BLOCKED' : 'APPROVED',
      blockReason: isBlocked ? policyResult.reason : undefined,
      checks: policyResult.checks,
      timestamp: new Date().toISOString(),
      humanVerification: lastHumanVerification || undefined,
      riskLevel: effectiveRisk
    };

    setActivePaymentRequest(req);

    const nowFormatted = 'Just now';
    const txnId = `TXN-${Math.floor(10000 + Math.random() * 90000)}`;

    if (isBlocked) {
      // 1. Record Blocked Transaction
      const newBlockedTxn: Transaction = {
        id: txnId,
        userId: user.id,
        authorizationId: authId,
        productName: product.name,
        merchant: product.merchant,
        amount: product.price,
        currency: 'INR',
        purpose: authorization?.purpose || 'Unassigned Intent',
        status: 'BLOCKED',
        reason: req.blockReason || 'Policy check failed',
        date: nowFormatted,
        timestamp: new Date().toISOString(),
        riskLevel: effectiveRisk,
        paymentMethod: "PayPal Sandbox",
        humanVerified: policyResult.identityVerified,
        authenticationMethod: policyResult.authenticationMethod
      };
      setTransactions(prev => [newBlockedTxn, ...prev]);

      // 2. Record Security Event
      const diff = product.price > authLimit ? product.price - authLimit : 0;
      const secEventId = `SEC-EVT-${Date.now()}`;
      const isHumanRequired = policyResult.violations.includes('HUMAN_AUTH_REQUIRED');

      const newSecEvent: SecurityEvent = {
        id: secEventId,
        userId: user.id,
        type: isHumanRequired ? 'HUMAN_AUTH_REQUIRED' : 'PAYMENT_BLOCKED',
        severity: 'HIGH',
        title: isHumanRequired ? 'Human Verification Required' : 'Payment Blocked: Exceeded Financial Authority',
        description: isHumanRequired
          ? `High-risk transaction (₹${product.price.toLocaleString('en-IN')}) requires device-native passkey assertion.`
          : `Agent requested ₹${product.price.toLocaleString('en-IN')} for "${product.name}", exceeding authorized capability.`,
        requestedAmount: product.price,
        authorizedAmount: authLimit,
        authorizationId: authId,
        reason: req.blockReason || 'Policy boundary breached',
        timestamp: nowFormatted,
        transactionId: txnId,
        rawDetails: {
          userAuthorization: authLimit,
          agentRequest: product.price,
          difference: diff,
          violation: req.blockReason || 'Policy violation',
          decision: 'BLOCKED'
        }
      };
      setSecurityEvents(prev => [newSecEvent, ...prev]);

      // 3. Record Evidence Vault Trace
      const evidenceRecord: EvidenceDetail = {
        id: `EVID-${Date.now().toString().slice(-6)}`,
        userId: user.id,
        transactionId: txnId,
        authorizationId: authId,
        humanIntent: currentIntent?.rawPrompt || `Find me a ${authorization?.purpose || 'laptop'} under ₹${authorization?.maxAmount || 20000}`,
        agentAction: `Agent attempted purchase of ${product.name} (₹${product.price.toLocaleString('en-IN')})`,
        paymentRequestAmount: product.price,
        authorizedAmount: authLimit,
        merchant: product.merchant,
        policyChecks: req.checks,
        decision: 'BLOCKED',
        decisionSummary: req.blockReason || 'AI agent attempted to move money outside bounded authority.',
        timestamp: new Date().toISOString(),
        humanVerification: lastHumanVerification || undefined,
        riskLevel: effectiveRisk,
        flowSteps: [
          { step: "Human Intent", entity: user.name, data: currentIntent?.rawPrompt || "Authorized purchase", verified: true },
          { step: "Intent Lock", entity: "PayGuard Core", data: `Token: ${authId} | Max: ₹${authorization?.maxAmount.toLocaleString('en-IN') || 0}`, verified: !!authorization },
          { step: "Agent Capability", entity: "AI Shopping Agent", data: `Attempting checkout for ${product.name}`, verified: true },
          { step: "Policy Evaluation", entity: "PayGuard Enclave", data: `Check failed: ${req.blockReason}`, verified: false },
          { step: "PayPal Dispatch Gate", entity: "PayPal Sandbox", data: "DISPATCH PREVENTED. Zero exposure to user funds.", verified: false }
        ]
      };

      setEvidenceVault(prev => ({
        ...prev,
        [secEventId]: evidenceRecord,
        [txnId]: evidenceRecord
      }));

      showToast(isHumanRequired ? 'Human verification required: Verify with device passkey.' : 'Payment blocked: Policy boundary breached.');
    }

    return req;
  };

  // Continue with PayPal (Simulate Sandbox dispatch with loading & state updates)
  const confirmPayPalPayment = async (): Promise<{ success: boolean; txnId: string }> => {
    if (!activePaymentRequest || activePaymentRequest.status !== 'APPROVED') {
      throw new Error('No approved payment request to confirm');
    }

    const prodAmount = activePaymentRequest.requestedAmount;
    const prodName = activePaymentRequest.productName;
    const merchant = activePaymentRequest.merchant;
    const authId = activePaymentRequest.authorizationId;

    const mockTxnId = `PP-SANDBOX-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowFormatted = 'Just now';

    // 1. Update Authorization remaining budget & increment used transaction count
    if (authorization) {
      const newRemaining = Math.max(0, authorization.remainingAmount - prodAmount);
      const newTxnsUsed = authorization.transactionsUsed + 1;
      const isExhausted = newTxnsUsed >= authorization.transactionLimit || newRemaining <= 0;

      const updatedAuth: Authorization = {
        ...authorization,
        remainingAmount: newRemaining,
        transactionsUsed: newTxnsUsed,
        status: isExhausted ? 'USED' : authorization.status
      };
      setAuthorization(updatedAuth);
      if (isExhausted) {
        setAuthorizationHistory(prev => [updatedAuth, ...prev]);
      }
    }

    // 2. Record Approved Transaction
    const approvedTxn: Transaction = {
      id: mockTxnId,
      userId: user.id,
      authorizationId: authId,
      productName: prodName,
      merchant: merchant,
      amount: prodAmount,
      currency: 'INR',
      purpose: authorization?.purpose || 'College laptop',
      status: 'APPROVED',
      date: nowFormatted,
      timestamp: new Date().toISOString(),
      riskLevel: activePaymentRequest.riskLevel || "LOW",
      paymentMethod: "PayPal Sandbox",
      humanVerified: true,
      authenticationMethod: activePaymentRequest.humanVerification?.authenticationMethod || "PASSKEY"
    };
    setTransactions(prev => [approvedTxn, ...prev]);

    // 3. Record Security Clearance Event
    const secEventId = `SEC-EVT-${Date.now()}`;
    const clearedSecEvent: SecurityEvent = {
      id: secEventId,
      userId: user.id,
      type: 'PAYMENT_APPROVED',
      severity: 'INFO',
      title: 'Payment Cleared & Dispatched to PayPal Sandbox',
      description: `Dispatched ₹${prodAmount.toLocaleString('en-IN')} for "${prodName}". Txn: ${mockTxnId}. Passkey confirmed.`,
      requestedAmount: prodAmount,
      authorizedAmount: authorization?.remainingAmount || 20000,
      authorizationId: authId,
      reason: '100% Policy and human presence checks passed. Sandbox payment simulated.',
      timestamp: nowFormatted,
      transactionId: mockTxnId,
      rawDetails: {
        userAuthorization: authorization?.remainingAmount || 20000,
        agentRequest: prodAmount,
        difference: 0,
        violation: 'None',
        decision: 'ALLOWED'
      }
    };
    setSecurityEvents(prev => [clearedSecEvent, ...prev]);

    // 4. Create Evidence Vault Entry
    const evidenceRecord: EvidenceDetail = {
      id: `EVID-${Date.now().toString().slice(-6)}`,
      userId: user.id,
      transactionId: mockTxnId,
      authorizationId: authId,
      humanIntent: currentIntent?.rawPrompt || "College laptop under ₹20,000",
      agentAction: `Agent initiated purchase for ${prodName} (₹${prodAmount.toLocaleString('en-IN')})`,
      paymentRequestAmount: prodAmount,
      authorizedAmount: authorization?.maxAmount || 20000,
      merchant,
      policyChecks: activePaymentRequest.checks,
      decision: 'APPROVED',
      decisionSummary: 'Continuous policy evaluation verified. Human presence verified, intent matched, budget satisfied, transaction cleared for PayPal Sandbox.',
      timestamp: new Date().toISOString(),
      humanVerification: activePaymentRequest.humanVerification,
      riskLevel: activePaymentRequest.riskLevel,
      flowSteps: [
        { step: "Human Intent", entity: user.name, data: currentIntent?.rawPrompt || "College laptop", verified: true },
        { step: "Intent Lock", entity: "PayGuard Core", data: `Token: ${authId} | Bound: ₹${authorization?.maxAmount.toLocaleString('en-IN')}`, verified: true },
        { step: "Agent Capability", entity: "AI Shopping Agent", data: `Selected ${prodName} within authorization`, verified: true },
        { step: "Human Verification", entity: "Device Enclave", data: "Device Passkey Assertion verified", verified: true },
        { step: "Policy Evaluation", entity: "PayGuard Enclave", data: "All policy & identity gates passed", verified: true },
        { step: "PayPal Dispatch Gate", entity: "PayPal Sandbox (Demo Mode)", data: `Payment complete: ${mockTxnId}`, verified: true }
      ]
    };

    setEvidenceVault(prev => ({
      ...prev,
      [secEventId]: evidenceRecord,
      [mockTxnId]: evidenceRecord
    }));

    clearPaymentRequest();
    showToast(`Payment Approved! ₹${prodAmount.toLocaleString('en-IN')} sent via PayPal Sandbox.`);
    return { success: true, txnId: mockTxnId };
  };

  const clearPaymentRequest = () => {
    setActivePaymentRequest(null);
  };

  // Run single attack test against real frontend policy
  const runAttackScenario = (scenarioId: string): AttackExecutionResult => {
    const scenario = mockAttackScenarios.find(s => s.id === scenarioId);
    if (!scenario) throw new Error("Scenario not found");

    const currentCap = authorization ? authorization.remainingAmount : 0;

    const idCtx = {
      identityStatus: userIdentity.identityStatus,
      passkeyStatus: userIdentity.passkeyStatus,
      voiceEnrollmentStatus: userIdentity.voiceEnrollmentStatus,
      deviceTrustStatus: userIdentity.deviceTrustStatus,
      securitySettings: userIdentity.securitySettings
    };

    let evalResult;
    if (scenario.category === 'budget_manipulation') {
      evalResult = evaluatePaymentRequest({ amount: 75000, purpose: authorization?.purpose || "College laptop" }, authorization, undefined, idCtx);
    } else if (scenario.category === 'prompt_injection') {
      evalResult = evaluatePaymentRequest({ amount: 18999, purpose: authorization?.purpose || "College laptop" }, authorization, { isPromptInjected: true }, idCtx);
    } else if (scenario.category === 'purpose_manipulation') {
      evalResult = evaluatePaymentRequest({ amount: 18500, purpose: "Gaming hardware" }, authorization, undefined, idCtx);
    } else if (scenario.category === 'replay_attack') {
      evalResult = evaluatePaymentRequest({ amount: 18999, purpose: authorization?.purpose || "College laptop" }, authorization, { isReplayNonce: true }, idCtx);
    } else if (scenario.category === 'payment_splitting') {
      evalResult = evaluatePaymentRequest({ amount: 7000, purpose: authorization?.purpose || "College laptop" }, authorization, { isSplitPayment: true, cumulativeSpent: currentCap + 1000 }, idCtx);
    } else if (scenario.category === 'stolen_session') {
      // Attacker has web session cookies but lacks physical device passkey assertion
      evalResult = evaluatePaymentRequest({ amount: 18500, purpose: authorization?.purpose || "College laptop" }, authorization, { isStolenSession: true }, idCtx);
    } else if (scenario.category === 'voice_replay') {
      // Attacker replays stale voice without matching dynamic challenge code
      evalResult = evaluatePaymentRequest({ amount: 12000, purpose: authorization?.purpose || "College laptop" }, authorization, { isVoiceReplay: true }, idCtx);
    } else if (scenario.category === 'identity_bypass') {
      // Genuine human passkey verified, but payment exceeds budget (₹75,000 vs ₹20,000)
      const verifiedEvidence = identityService.createVerificationEvidence("PASSKEY", "CRITICAL", userIdentity.registeredPasskeys[0]?.credentialId);
      evalResult = evaluatePaymentRequest({ amount: 75000, purpose: authorization?.purpose || "College laptop", humanVerification: verifiedEvidence }, authorization, { bypassAttempt: true }, idCtx);
    } else if (scenario.category === 'intent_tampering') {
      // AI Agent attempts to escalate maxAmount to ₹65,000 without human re-authorization
      evalResult = evaluatePaymentRequest(
        { amount: 65000, purpose: authorization?.purpose || "College laptop" },
        authorization,
        { isLockTampered: true, isEscalatedLimit: true },
        idCtx
      );
    } else if (scenario.category === 'recipient_substitution') {
      // Adversary attempts to divert payment to Mallory when locked to Alice
      const transferAuth = { ...(authorization || initialAuthorization), recipient: "Alice", remainingAmount: 4500, maxAmount: 4500 };
      evalResult = evaluatePaymentRequest(
        { amount: 4500, purpose: "Direct Transfer", recipient: "Mallory" },
        transferAuth,
        { isRecipientSubstituted: true },
        idCtx
      );
    } else if (scenario.category === 'merchant_drift') {
      // Agent redirected to unapproved merchant domain ApexDealsNow.xyz when locked to Amazon
      const merchantAuth = { ...(authorization || initialAuthorization), merchant: "Amazon" };
      evalResult = evaluatePaymentRequest(
        { amount: 18999, purpose: "College laptop", merchant: "ApexDealsNow.xyz" },
        merchantAuth,
        { isMerchantMismatch: true },
        idCtx
      );
    } else if (scenario.category === 'purpose_drift') {
      // Agent attempts checkout of digital gift card when locked to laptop accessories
      const purposeAuth = { ...(authorization || initialAuthorization), purpose: "College laptop accessories", category: "LAPTOP" };
      evalResult = evaluatePaymentRequest(
        { amount: 15000, purpose: "Amazon Digital Gift Card ₹15,000", category: "ENTERTAINMENT" },
        purposeAuth,
        { isPurposeDrift: true },
        idCtx
      );
    } else if (scenario.category === 'capability_escalation') {
      // AI Agent attempts to spend beyond capability bounds (₹75,000 vs ₹20,000 limit)
      evalResult = evaluatePaymentRequest(
        { amount: 75000, purpose: "Workstation Upgrade" },
        authorization,
        { isEscalatedLimit: true },
        idCtx
      );
    } else if (scenario.category === 'capability_tampering') {
      // AI Agent injects mutated capability parameters / nonce
      evalResult = evaluatePaymentRequest(
        { amount: 50000, purpose: authorization?.purpose || "College laptop" },
        authorization,
        { isLockTampered: true },
        idCtx
      );
    } else if (scenario.category === 'expired_capability') {
      // AI Agent attempts transaction using expired capability
      const expiredAuth = { ...(authorization || initialAuthorization), status: "EXPIRED" as const, expiresAt: new Date(Date.now() - 3600000).toISOString() };
      evalResult = evaluatePaymentRequest(
        { amount: 18999, purpose: authorization?.purpose || "College laptop" },
        expiredAuth,
        undefined,
        idCtx
      );
    } else if (scenario.category === 'session_revocation') {
      // User hit kill switch, agent attempts to continue purchasing
      evalResult = evaluatePaymentRequest(
        { amount: 18999, purpose: authorization?.purpose || "College laptop" },
        authorization,
        { isStolenSession: true },
        idCtx
      );
    } else if (scenario.category === 'capability_replay') {
      // Agent attempts double spending by replaying consumed nonce
      evalResult = evaluatePaymentRequest(
        { amount: 18999, purpose: authorization?.purpose || "College laptop" },
        authorization,
        { isReplayNonce: true },
        idCtx
      );
    } else if (scenario.category === 'prompt_injection_product') {
      // Product page injects prompt override payload
      evalResult = evaluatePaymentRequest(
        { amount: 75000, purpose: "SellerWallet Transfer" },
        authorization,
        { isPromptInjected: true },
        idCtx
      );
    } else {
      // Legitimate payment: Genuine passkey verified, within budget, matching purpose
      const verifiedEvidence = identityService.createVerificationEvidence("PASSKEY", "LOW", userIdentity.registeredPasskeys[0]?.credentialId);
      evalResult = evaluatePaymentRequest({ amount: 18999, purpose: authorization?.purpose || "College laptop", humanVerification: verifiedEvidence }, authorization, undefined, idCtx);
    }

    const actualDecision: "BLOCKED" | "ALLOWED" = evalResult.decision;
    const failureReason = evalResult.reason;
    const passed = actualDecision === scenario.result;

    const result: AttackExecutionResult = {
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      expectedResult: scenario.result,
      actualResult: actualDecision,
      decision: actualDecision,
      reason: failureReason,
      timestamp: 'Just now',
      passed,
      checks: evalResult.checks.map(c => ({ name: c.name, passed: c.passed, rule: c.description }))
    };

    setAttackResults(prev => ({ ...prev, [scenarioId]: result }));

    const secEventId = `SEC-EVT-${Date.now()}`;
    const newEvt: SecurityEvent = {
      id: secEventId,
      userId: user.id,
      type: actualDecision === 'BLOCKED' ? 'ATTACK_INTERCEPTED' : 'PAYMENT_APPROVED',
      severity: actualDecision === 'BLOCKED' ? 'HIGH' : 'INFO',
      title: `Attack Lab: ${scenario.title}`,
      description: `Simulated attack [${scenario.title}] evaluated: ${actualDecision}.`,
      reason: failureReason,
      timestamp: 'Just now'
    };
    setSecurityEvents(prev => [newEvt, ...prev]);

    return result;
  };

  // Run all attack scenarios sequentially
  const runAllAttackScenarios = async (): Promise<Record<string, AttackExecutionResult>> => {
    const results: Record<string, AttackExecutionResult> = {};
    for (const sc of mockAttackScenarios) {
      results[sc.id] = runAttackScenario(sc.id);
    }
    showToast(`Attack Lab: All ${mockAttackScenarios.length} scenarios executed. Defense Policy verified.`);
    return Promise.resolve(results);
  };

  // Toggle PayPal connection state
  const togglePayPalConnection = async (): Promise<boolean> => {
    const nextState = !paypalConnected;
    setPaypalConnected(nextState);

    const secEventId = `SEC-EVT-${Date.now()}`;
    const newEvt: SecurityEvent = {
      id: secEventId,
      userId: user.id,
      type: nextState ? 'PAYPAL_CONNECTED' : 'PAYPAL_DISCONNECTED',
      severity: 'INFO',
      title: nextState ? 'PayPal Sandbox Connected' : 'PayPal Sandbox Disconnected',
      description: nextState ? `Gateway session linked with ${user.paypalAccountEmail}.` : 'User severed PayPal Sandbox gateway link.',
      reason: nextState ? 'Gateway connection initialized' : 'Gateway manually paused',
      timestamp: 'Just now'
    };
    setSecurityEvents(prev => [newEvt, ...prev]);
    showToast(nextState ? 'PayPal Sandbox connected.' : 'PayPal Sandbox disconnected.');
    return Promise.resolve(nextState);
  };

  const updateUser = (name: string, email: string) => {
    setUser(prev => ({ ...prev, name, email }));
    showToast('Profile updated.');
  };

  // --- Step 4 Identity & Biometrics Layer Methods ---
  const registerDevicePasskey = async (deviceName: string = 'Authorized Workstation / Mobile Device'): Promise<boolean> => {
    const res = await passkeyService.registerPasskey(deviceName);
    if (res.success && res.credential) {
      const updatedPasskeys = [res.credential, ...userIdentity.registeredPasskeys.filter(p => p.id !== res.credential!.id)];
      const updatedIdentity: UserIdentity = {
        ...userIdentity,
        identityStatus: 'VERIFIED',
        passkeyStatus: 'REGISTERED',
        deviceTrustStatus: 'TRUSTED',
        lastAuthenticatedAt: new Date().toISOString(),
        registeredPasskeys: updatedPasskeys
      };
      setUserIdentity(updatedIdentity);

      const secEvent: SecurityEvent = {
        id: `SEC-EVT-${Date.now()}`,
        userId: user.id,
        type: 'PASSKEY_REGISTERED',
        severity: 'INFO',
        title: 'Device Passkey Registered',
        description: `Passkey registered for "${res.credential.deviceName}". Device marked TRUSTED. Biometrics remain strictly on-device.`,
        reason: res.message,
        timestamp: 'Just now'
      };
      setSecurityEvents(prev => [secEvent, ...prev]);
      showToast(res.message);
      return true;
    } else {
      showToast(res.error || 'Passkey registration cancelled or failed.');
      return false;
    }
  };

  const removeDevicePasskey = (id: string) => {
    const updated = userIdentity.registeredPasskeys.filter(p => p.id !== id);
    const hasAny = updated.length > 0;
    const updatedIdentity: UserIdentity = {
      ...userIdentity,
      registeredPasskeys: updated,
      passkeyStatus: hasAny ? 'REGISTERED' : 'NOT_REGISTERED',
      deviceTrustStatus: hasAny ? 'TRUSTED' : 'UNTRUSTED'
    };
    setUserIdentity(updatedIdentity);
    showToast('Device passkey removed.');
  };

  const enrollVoiceIdentity = async (phrase: string = 'PayGuard authorizes bounded payments'): Promise<boolean> => {
    const res = await voiceIdentityService.enrollVoice(phrase);
    if (res.success && res.profile) {
      const updatedIdentity: UserIdentity = {
        ...userIdentity,
        voiceEnrollmentStatus: 'ENROLLED',
        voiceProfile: res.profile
      };
      setUserIdentity(updatedIdentity);

      const secEvent: SecurityEvent = {
        id: `SEC-EVT-${Date.now()}`,
        userId: user.id,
        type: 'VOICE_ENROLLED',
        severity: 'INFO',
        title: 'Voice Identity Enrolled',
        description: 'Auxiliary voice authorization profile enrolled. Dynamic challenge phrase required for high-risk authorization.',
        reason: 'Voice identity profile initialized',
        timestamp: 'Just now'
      };
      setSecurityEvents(prev => [secEvent, ...prev]);
      showToast(res.message);
      return true;
    }
    return false;
  };

  const removeVoiceIdentity = () => {
    const updatedIdentity: UserIdentity = {
      ...userIdentity,
      voiceEnrollmentStatus: 'NOT_ENROLLED',
      voiceProfile: undefined
    };
    setUserIdentity(updatedIdentity);
    showToast('Voice identity enrollment removed.');
  };

  const updateIdentitySettings = (newSettings: Partial<IdentitySecuritySettings>) => {
    const updated: UserIdentity = {
      ...userIdentity,
      securitySettings: {
        ...userIdentity.securitySettings,
        ...newSettings
      }
    };
    setUserIdentity(updated);

    const secEvent: SecurityEvent = {
      id: `SEC-EVT-${Date.now()}`,
      userId: user.id,
      type: 'SETTINGS_UPDATED',
      severity: 'INFO',
      title: 'Identity & Biometric Policy Updated',
      description: 'Human step-up authentication thresholds updated.',
      reason: 'User policy configuration',
      timestamp: 'Just now'
    };
    setSecurityEvents(prev => [secEvent, ...prev]);
    showToast('Identity security settings updated.');
  };

  const verifyDevicePasskey = async (): Promise<{ success: boolean; evidence?: HumanVerificationEvidence; message: string }> => {
    const primaryPasskey = userIdentity.registeredPasskeys[0];
    const res = await passkeyService.authenticatePasskey(primaryPasskey?.credentialId);

    if (res.success) {
      const evidence = identityService.createVerificationEvidence("PASSKEY", "LOW", res.assertion?.credentialId);
      setLastHumanVerification(evidence);

      const secEvent: SecurityEvent = {
        id: `SEC-EVT-${Date.now()}`,
        userId: user.id,
        type: 'PASSKEY_AUTHENTICATED',
        severity: 'INFO',
        title: 'Device Passkey Verified',
        description: 'Human presence and biometric verified on device. Cryptographic assertion valid.',
        reason: res.message,
        timestamp: 'Just now'
      };
      setSecurityEvents(prev => [secEvent, ...prev]);
      showToast('Human presence verified via Device Passkey.');
      return { success: true, evidence, message: res.message };
    } else {
      const secEvent: SecurityEvent = {
        id: `SEC-EVT-${Date.now()}`,
        userId: user.id,
        type: 'PASSKEY_AUTH_FAILED',
        severity: 'HIGH',
        title: 'Passkey Authentication Failed',
        description: 'Device biometric or passkey assertion could not be verified.',
        reason: res.error || 'Authentication rejected by authenticator',
        timestamp: 'Just now'
      };
      setSecurityEvents(prev => [secEvent, ...prev]);
      showToast('Passkey authentication failed.');
      return { success: false, message: res.error || 'Failed' };
    }
  };

  const getNewVoiceChallenge = (): VoiceChallenge => {
    return voiceIdentityService.generateChallenge();
  };

  const verifyVoiceChallenge = async (challenge: VoiceChallenge, responseCode: string): Promise<{ success: boolean; message: string }> => {
    const res = await voiceIdentityService.verifyVoiceChallenge(challenge, responseCode, userIdentity.voiceEnrollmentStatus === 'ENROLLED');
    const secEvent: SecurityEvent = {
      id: `SEC-EVT-${Date.now()}`,
      userId: user.id,
      type: res.success ? 'VOICE_VERIFIED' : 'VOICE_VERIFICATION_FAILED',
      severity: res.success ? 'INFO' : 'HIGH',
      title: res.success ? 'Voice Challenge Cleared' : 'Voice Challenge Failed',
      description: res.message,
      reason: res.success ? 'Challenge code matched dynamic challenge' : (res.error || 'Verification mismatch'),
      timestamp: 'Just now'
    };
    setSecurityEvents(prev => [secEvent, ...prev]);
    showToast(res.message);
    return { success: res.success, message: res.message };
  };

  // Safe demo reset
  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY_AUTH);
    localStorage.removeItem(STORAGE_KEY_AUTH_HIST);
    localStorage.removeItem(STORAGE_KEY_TXNS);
    localStorage.removeItem(STORAGE_KEY_EVENTS);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_INTENT);
    localStorage.removeItem(STORAGE_KEY_EVIDENCE);
    localStorage.removeItem(STORAGE_KEY_PAYPAL);
    localStorage.removeItem(STORAGE_KEY_IDENTITY);

    setUser(mockUser);
    setUserIdentity(initialUserIdentity);
    setLastHumanVerification(identityService.createVerificationEvidence("PASSKEY", "LOW", initialUserIdentity.registeredPasskeys[0]?.credentialId));
    setAuthorization(initialAuthorization);
    setTransactions(mockTransactions);
    setSecurityEvents(mockSecurityEvents);
    setEvidenceVault({ [mockEvidenceDetail.id]: mockEvidenceDetail });
    setPaypalConnected(true);
    setCurrentIntent({
      id: "INT-INIT-1",
      userId: mockUser.id,
      rawPrompt: "Find me a laptop for college under ₹20,000.",
      parsedPurpose: "College laptop",
      spendingLimit: 20000,
      currency: "INR",
      transactionLimit: 1,
      expiryMinutes: 30,
      createdAt: new Date().toISOString(),
      status: "LOCKED",
      category: "Laptop",
      action: "Purchase"
    });
    setAttackResults({});
    setActivePaymentRequest(null);
    showToast('Demo state reset to initial factory values.');
  };

  const getEvidenceForEvent = (eventId: string): EvidenceDetail | null => {
    if (evidenceVault[eventId]) return evidenceVault[eventId];

    const evt = securityEvents.find(e => e.id === eventId);
    if (evt && evt.transactionId && evidenceVault[evt.transactionId]) {
      return evidenceVault[evt.transactionId];
    }

    if (evt) {
      const isBlocked = evt.type === 'PAYMENT_BLOCKED' || evt.type === 'ATTACK_INTERCEPTED' || evt.severity === 'HIGH';
      return {
        id: `EVID-${evt.id.slice(-6)}`,
        userId: user.id,
        transactionId: evt.transactionId || `TXN-${evt.id.slice(-5)}`,
        authorizationId: evt.authorizationId || authorization?.id || 'AUTH-RECORD',
        humanIntent: currentIntent?.rawPrompt || "College laptop under ₹20,000",
        agentAction: evt.description,
        paymentRequestAmount: evt.requestedAmount || 0,
        authorizedAmount: evt.authorizedAmount || authorization?.remainingAmount || 0,
        merchant: "Merchant Gateway",
        policyChecks: [
          { name: "Identity & Passkey Verification", passed: true, description: "Passkey session validated" },
          { name: "Intent Lock Enforcement", passed: !isBlocked, description: evt.reason },
          { name: "Budget Ceiling Gate", passed: !isBlocked, description: `Authorized: ₹${evt.authorizedAmount || 0}` },
          { name: "Agent Non-Custody Enclave", passed: true, description: "Agent does not have raw funds access" }
        ],
        decision: isBlocked ? 'BLOCKED' : 'APPROVED',
        decisionSummary: evt.description,
        timestamp: evt.timestamp,
        humanVerification: lastHumanVerification || undefined,
        riskLevel: "MEDIUM",
        flowSteps: [
          { step: "Human Intent", entity: user.name, data: currentIntent?.rawPrompt || "College laptop", verified: true },
          { step: "Authorization", entity: "PayGuard Core", data: `Token ${evt.authorizationId || 'AUTH-LOCK'}`, verified: true },
          { step: "Agent Request", entity: "AI Shopping Agent", data: evt.title, verified: true },
          { step: "Policy Gate", entity: "Security Gateway", data: evt.reason, verified: !isBlocked },
          { step: "PayPal Dispatch Gate", entity: "PayPal Sandbox", data: isBlocked ? "DISPATCH PREVENTED" : "PAYMENT CONFIRMED", verified: !isBlocked }
        ]
      };
    }

    return mockEvidenceDetail;
  };

  return (
    <AppContext.Provider
      value={{
        user,
        userIdentity,
        lastHumanVerification,
        accountBalance,
        aiAuthorizedBudget,
        authorization,
        authorizationHistory,
        currentIntent,
        intentLock,
        agentCapability,
        currentParsedIntent,
        parseIntentPrompt,
        createIntentLock,
        editActiveLock,
        validateIntentDrift,
        agentSession,
        products,
        selectedProduct,
        activePaymentRequest,
        transactions,
        securityEvents,
        attackResults,
        paypalConnectionStatus,
        paypalConnected,
        toastMessage,
        showToast,
        createAuthorization,
        updateBudgetLimit,
        revokeAuthorization,
        extendAuthorizationExpiry,
        preparePayment,
        confirmPayPalPayment,
        clearPaymentRequest,
        setSelectedProduct,
        runAttackScenario,
        runAllAttackScenarios,
        togglePayPalConnection,
        updateUser,
        resetDemoData,
        getEvidenceForEvent,
        parseAndSetIntent,
        registerDevicePasskey,
        removeDevicePasskey,
        enrollVoiceIdentity,
        removeVoiceIdentity,
        updateIdentitySettings,
        verifyDevicePasskey,
        verifyVoiceChallenge,
        getNewVoiceChallenge
      }}
    >
      {children}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#0A192F',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.9rem',
            border: '1px solid #1E3A8A'
          }}
        >
          <span style={{ color: '#059669', fontSize: '1.2rem', fontWeight: 800 }}>●</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
