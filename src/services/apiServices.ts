import {
  User,
  Authorization,
  Intent,
  Product,
  PaymentRequest,
  Transaction,
  SecurityEvent,
  AttackScenario,
  EvidenceDetail,
  AgentActivityStep
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

// --- Natural Language Intent Parser ---
export interface ParsedIntentResult {
  action: string;
  purpose: string;
  category: string;
  recipient?: string;
  spendingLimit: number;
  currency: string;
  transactionLimit: number;
  expiryMinutes: number;
  rawPrompt: string;
}

export const parseNaturalLanguageIntent = (prompt: string): ParsedIntentResult => {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  // 1. Currency
  let currency = "INR";
  if (lower.includes("$") || lower.includes("usd")) currency = "USD";
  if (lower.includes("€") || lower.includes("eur")) currency = "EUR";

  // 2. Spending Limit extraction (supports 20000, 20k, ₹20,000, under 1000, etc.)
  let spendingLimit = 20000;
  const kMatch = lower.match(/(?:₹|\$|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/i);
  const numberMatch = text.match(/(?:₹|\$|rs\.?|inr)?\s*(\d{1,3}(?:,\d{3})+|\d+)\s*(?:inr|rs|dollars|rupees)?/i);

  if (kMatch && kMatch[1]) {
    spendingLimit = Math.round(parseFloat(kMatch[1]) * 1000);
  } else if (numberMatch && numberMatch[1]) {
    const cleanNum = parseInt(numberMatch[1].replace(/,/g, ''), 10);
    if (cleanNum >= 100) {
      spendingLimit = cleanNum;
    }
  }

  // 3. Recipient detection (e.g., "Send ₹1,000 to Rahul for laptop repair")
  let recipient: string | undefined = undefined;
  const toMatch = text.match(/\bto\s+([A-Z][a-z]+)\b/);
  if (toMatch && toMatch[1]) {
    recipient = toMatch[1];
  }

  // 4. Category & Action & Purpose
  let category = "Laptop";
  let purpose = "College laptop";
  let action = "Purchase";

  if (lower.includes("send") || lower.includes("transfer") || lower.includes("pay")) {
    action = "Direct Payment";
    if (recipient) {
      purpose = lower.includes("repair") ? `Laptop repair for ${recipient}` : `Transfer to ${recipient}`;
      category = "P2P Payment";
    }
  } else if (lower.includes("find") || lower.includes("search")) {
    action = "Search & Recommend";
  }

  if (lower.includes("laptop") || lower.includes("macbook") || lower.includes("computer") || lower.includes("notebook")) {
    category = "Laptop";
    if (!recipient) {
      purpose = lower.includes("college") || lower.includes("student") || lower.includes("study")
        ? "College laptop"
        : "Personal computer";
    }
  } else if (lower.includes("book") || lower.includes("textbook")) {
    category = "Academic Books";
    purpose = "Course textbooks";
  } else if (lower.includes("phone") || lower.includes("mobile")) {
    category = "Smartphone";
    purpose = "Mobile communication";
  } else if (lower.includes("headphone") || lower.includes("audio") || lower.includes("earbuds")) {
    category = "Audio Equipment";
    purpose = "Audio accessory";
  }

  return {
    action,
    purpose,
    category,
    recipient,
    spendingLimit,
    currency,
    transactionLimit: 1,
    expiryMinutes: 30,
    rawPrompt: text
  };
};

// --- Frontend Policy Evaluation Engine (Step 4 Standardized with Human Identity Layer) ---
export { evaluatePaymentRequest } from './policyEngine';
export type { PolicyEvaluationResult } from './policyEngine';

// --- Mock Services Export ---
export const authService = {
  getCurrentUser: async (): Promise<User> => Promise.resolve({ ...mockUser }),
  updateProfile: async (name: string, email: string): Promise<User> => Promise.resolve({ ...mockUser, name, email })
};

export const voiceService = {
  startListening: async (): Promise<string> => Promise.resolve("Find me a laptop for college under ₹20,000."),
  stopListening: async (): Promise<void> => Promise.resolve()
};

export const intentService = {
  parseNaturalLanguageIntent: async (prompt: string, userId = "usr_pg_88219"): Promise<Intent> => {
    const parsed = parseNaturalLanguageIntent(prompt);
    return Promise.resolve({
      id: `INT-${Date.now()}`,
      userId,
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
    });
  }
};

export const authorizationService = {
  getActiveAuthorization: async (): Promise<Authorization | null> => Promise.resolve({ ...initialAuthorization }),
  createAuthorization: async (intent: Intent): Promise<Authorization> => {
    return Promise.resolve({
      id: `AUTH-2026-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      userId: intent.userId,
      purpose: intent.parsedPurpose,
      maxAmount: intent.spendingLimit,
      remainingAmount: intent.spendingLimit,
      currency: intent.currency,
      transactionLimit: intent.transactionLimit,
      transactionsUsed: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + intent.expiryMinutes * 60 * 1000).toISOString(),
      status: "ACTIVE",
      scopeDescription: `Authorized for ${intent.parsedPurpose} under ₹${intent.spendingLimit.toLocaleString('en-IN')}`,
      nonce: `NONCE-${Date.now().toString(36)}`
    });
  },
  revokeAuthorization: async (id: string): Promise<boolean> => Promise.resolve(true)
};

export const agentService = {
  getAgentActivitySteps: async (): Promise<AgentActivityStep[]> => Promise.resolve([...initialAgentSteps]),
  searchProducts: async (_query: string): Promise<Product[]> => Promise.resolve([...mockProducts])
};

export const policyService = {
  evaluatePurchaseRequest: async (
    product: Product,
    auth: Authorization | null,
    userId = "usr_pg_88219"
  ): Promise<PaymentRequest> => {
    const res = evaluatePaymentRequest({ amount: product.price, purpose: product.name }, auth);
    const authAmount = auth ? auth.remainingAmount : 0;
    const authId = auth ? auth.id : "NO-AUTH";
    const authPurpose = auth ? auth.purpose : "None";

    return Promise.resolve({
      id: `PREQ-${Date.now()}`,
      userId,
      productId: product.id,
      productName: product.name,
      merchant: product.merchant,
      requestedAmount: product.price,
      authorizedAmount: authAmount,
      currency: product.currency,
      purpose: authPurpose,
      authorizationId: authId,
      status: res.decision === "ALLOW" ? "APPROVED" : "BLOCKED",
      blockReason: res.decision === "BLOCK" ? res.reason : undefined,
      checks: res.checks,
      timestamp: new Date().toISOString()
    });
  }
};

export const securityService = {
  getSecurityEvents: async (): Promise<SecurityEvent[]> => Promise.resolve([...mockSecurityEvents]),
  getAttackScenarios: async (): Promise<AttackScenario[]> => Promise.resolve([...mockAttackScenarios])
};

export const paypalService = {
  getSandboxStatus: async () => Promise.resolve({
    connected: true,
    environment: "SANDBOX" as const,
    account: "sb-alex.vance@personal.example.com",
    status: "READY"
  }),
  dispatchPayment: async (paymentRequestId: string) => {
    return Promise.resolve({ success: true, txnHash: `PP-SANDBOX-${Math.floor(100000 + Math.random() * 900000)}` });
  }
};

export const transactionService = {
  getTransactions: async (): Promise<Transaction[]> => Promise.resolve([...mockTransactions])
};

export const auditService = {
  getEvidenceDetail: async (id: string): Promise<EvidenceDetail> => Promise.resolve({ ...mockEvidenceDetail, id })
};
