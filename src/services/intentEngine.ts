import {
  IntentAction,
  IntentLock,
  IntentParsingResult,
  IntentDriftResult,
  AgentCapability,
  MerchantConstraintType,
  HumanVerificationEvidence,
  Authorization
} from "../types";

/**
 * PayGuard Intent Engine
 * Deterministically parses natural-language human intent into structured payment authorities.
 * Detects ambiguity, enforces strict boundaries, and mints immutable Intent Locks.
 */

// Keyword mapping for categories
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  LAPTOP: ["laptop", "notebook", "macbook", "chromebook", "thinkpad", "dell", "hp", "lenovo"],
  ELECTRONICS: ["monitor", "keyboard", "mouse", "headphone", "charger", "cable", "tablet", "screen", "webcam"],
  FURNITURE: ["chair", "desk", "table", "stand", "ergonomic"],
  OFFICE_EQUIPMENT: ["printer", "scanner", "paper", "shredder", "supplies"],
  SERVICES: ["cloud", "hosting", "aws", "domain", "api", "software", "license"],
  TRANSFER: ["send", "transfer", "remit", "wire"],
  UTILITY: ["electricity", "water", "wifi", "internet", "gas", "utility", "bill"],
  ENTERTAINMENT: ["spotify", "netflix", "prime", "movie", "game", "streaming"]
};

// Known merchants
const KNOWN_MERCHANTS = [
  "Amazon",
  "Flipkart",
  "Croma",
  "Apple Store",
  "Reliance Digital",
  "Dell Direct",
  "HP Store",
  "Best Buy",
  "Target",
  "Walmart"
];

/**
 * Parses raw natural language into a structured IntentParsingResult.
 */
export function parseIntent(prompt: string): IntentParsingResult {
  const cleanPrompt = prompt.trim();
  const lower = cleanPrompt.toLowerCase();

  // 1. Determine Action
  let action: IntentAction = "PURCHASE";
  if (lower.startsWith("send ") || lower.includes("transfer to") || lower.includes("pay alice") || lower.includes("pay bob")) {
    action = "TRANSFER";
  } else if (lower.includes("bill") || lower.includes("utility") || lower.includes("electricity") || lower.includes("wifi")) {
    action = "BILL_PAY";
  } else if (lower.includes("subscribe") || lower.includes("subscription") || lower.includes("recurring")) {
    action = "SUBSCRIPTION";
  }

  // 2. Extract Spending Limit & Currency
  let spendingLimit = 0;
  let currency = "INR";
  if (lower.includes("$") || lower.includes("usd")) {
    currency = "USD";
  } else if (lower.includes("€") || lower.includes("eur")) {
    currency = "EUR";
  }

  // Regex patterns for amounts: ₹20,000, 20000, 20k, $500, etc.
  const amountPatterns = [
    /(?:₹|rs\.?|inr|\$|eur|€)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(?:k|thousand)?/i,
    /under\s+(?:₹|rs\.?|inr|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(k)?/i,
    /max(?:imum)?\s+(?:of\s+)?(?:₹|rs\.?|inr|\$)?\s*([0-9]+)(k)?/i,
    /limit\s+(?:of\s+)?(?:₹|rs\.?|inr|\$)?\s*([0-9]+)(k)?/i,
    /(?:₹|rs\.?|inr|\$)\s*([0-9]+)(k)?/i
  ];

  // Specific check for 'k' notation (e.g. 20k)
  const kMatch = lower.match(/(?:₹|rs\.?|\$)?\s*([0-9]+(?:\.[0-9]+)?)\s*k\b/i);
  if (kMatch) {
    spendingLimit = parseFloat(kMatch[1]) * 1000;
  } else {
    // Check general under/max patterns
    const underMatch = lower.match(/(?:under|max|limit|within|budget of)\s*(?:₹|rs\.?|inr|\$|€)?\s*([0-9,]+)/i);
    if (underMatch) {
      spendingLimit = parseFloat(underMatch[1].replace(/,/g, ""));
    } else {
      // Direct currency match
      const directMatch = lower.match(/(?:₹|rs\.?|inr|\$|€)\s*([0-9,]+)/i);
      if (directMatch) {
        spendingLimit = parseFloat(directMatch[1].replace(/,/g, ""));
      } else {
        // Fallback: any standalone number > 50
        const numberMatches = lower.match(/\b([1-9][0-9]{2,6})\b/);
        if (numberMatches) {
          spendingLimit = parseFloat(numberMatches[1]);
        }
      }
    }
  }

  // 3. Extract Category
  let category = "GENERAL";
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some(kw => lower.includes(kw))) {
      category = cat;
      break;
    }
  }

  // 4. Extract Recipient (if transfer)
  let recipient: string | null = null;
  const toMatch = cleanPrompt.match(/(?:to|send to|pay)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (toMatch && action === "TRANSFER") {
    recipient = toMatch[1].trim();
  }

  // 5. Extract Merchant (if specified)
  let merchant: string | null = null;
  let merchantConstraint: MerchantConstraintType = "ANY";
  for (const km of KNOWN_MERCHANTS) {
    if (new RegExp(`\\b${km}\\b`, "i").test(cleanPrompt)) {
      merchant = km;
      merchantConstraint = "SPECIFIC";
      break;
    }
  }

  // 6. Extract Purpose / Description
  let purpose = "";
  if (cleanPrompt.length > 0) {
    // Clean out command prefixes
    purpose = cleanPrompt
      .replace(/^(buy me a|buy a|purchase a|order a|get me a|find me a|send|pay for)\s+/i, "")
      .replace(/\s+(under|below|for less than|up to|max|within)\s+.*$/i, "")
      .trim();
    if (!purpose) {
      purpose = cleanPrompt;
    }
  }

  // 7. Extract constraints
  const constraints: string[] = [];
  if (spendingLimit > 0) {
    constraints.push(`Maximum expenditure bounded at ${currency === "INR" ? "₹" : "$"}${spendingLimit.toLocaleString()}`);
  }
  if (merchant) {
    constraints.push(`Restricted strictly to merchant: ${merchant}`);
  } else {
    constraints.push("Permitted on any verified authorized merchant");
  }
  if (recipient) {
    constraints.push(`Restricted recipient: ${recipient}`);
  }
  constraints.push("Maximum 1 continuous authorization cycle");
  constraints.push("Auto-expires within 60 minutes if unfulfilled");

  // 8. Missing field detection & validation
  const missingFields: string[] = [];
  if (!purpose || lower === "buy me something" || lower === "spend some money" || lower.length < 4) {
    missingFields.push("purpose");
  }
  if (spendingLimit <= 0) {
    missingFields.push("spendingLimit");
  }

  // Clarification prompt generation if ambiguous
  let clarificationPrompt: string | undefined;
  let confidence: "HIGH" | "MEDIUM" | "LOW" = "HIGH";
  let confidenceScore = 0.95;

  if (missingFields.length > 0) {
    confidence = "LOW";
    confidenceScore = 0.35;
    if (missingFields.includes("purpose") && missingFields.includes("spendingLimit")) {
      clarificationPrompt = "I need more information to safely authorize this action. What specific item or service do you want to purchase, and what is your maximum budget?";
    } else if (missingFields.includes("spendingLimit")) {
      clarificationPrompt = `Please specify a maximum spending limit (e.g., under ₹20,000) so the agent cannot spend beyond your threshold.`;
    } else {
      clarificationPrompt = "Please specify what you would like the AI agent to purchase or do.";
    }
  } else if (category === "GENERAL") {
    confidence = "MEDIUM";
    confidenceScore = 0.78;
  }

  const isValidForLock = missingFields.length === 0 && spendingLimit > 0;

  return {
    action,
    purpose: purpose || "General Purchase",
    category,
    recipient,
    merchant,
    merchantConstraint,
    spendingLimit,
    currency,
    transactionLimit: 1,
    expiryMinutes: 60,
    constraints,
    confidence,
    confidenceScore,
    rawPrompt: cleanPrompt,
    missingFields,
    clarificationPrompt,
    isValidForLock
  };
}

/**
 * Creates an immutable IntentLock from parsed intent.
 */
export function generateIntentLockFromParsed(
  parsed: IntentParsingResult,
  userId: string,
  humanVerification?: HumanVerificationEvidence
): IntentLock {
  const nonce = `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (parsed.expiryMinutes || 60) * 60 * 1000).toISOString();

  return {
    id: `intent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    action: parsed.action,
    purpose: parsed.purpose,
    category: parsed.category,
    recipient: parsed.recipient,
    merchant: parsed.merchant,
    merchantConstraint: parsed.merchantConstraint,
    maxAmount: parsed.spendingLimit,
    remainingAmount: parsed.spendingLimit,
    currency: parsed.currency,
    transactionLimit: parsed.transactionLimit || 1,
    usedTransactions: 0,
    allowedPaymentMethods: ["PAYPAL_WALLET", "VERIFIED_CARDS"],
    constraints: parsed.constraints,
    createdAt: now.toISOString(),
    expiresAt,
    nonce,
    status: "ACTIVE",
    humanVerification,
    rawPrompt: parsed.rawPrompt,
    confidenceScore: parsed.confidenceScore
  };
}

/**
 * Generates an isolated AgentCapability projection from an IntentLock or Authorization.
 * The AI Agent receives ONLY this capability projection — never direct custody or lock mutation rights.
 */
export function createAgentCapability(lock: IntentLock | Authorization): AgentCapability {
  const maxAmt = lock.maxAmount;
  const remAmt = lock.remainingAmount !== undefined ? lock.remainingAmount : lock.maxAmount;
  const usedTx = "usedTransactions" in lock ? lock.usedTransactions : lock.transactionsUsed;
  const actionStr = lock.action || "PURCHASE";

  return {
    capabilityId: `cap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    authorizationId: lock.id,
    allowedAction: actionStr,
    allowedPurpose: lock.purpose,
    allowedCategory: lock.category || "GENERAL",
    maxAmount: maxAmt,
    remainingAmount: remAmt,
    transactionLimit: lock.transactionLimit,
    remainingTransactions: Math.max(0, lock.transactionLimit - (usedTx || 0)),
    recipientConstraint: lock.recipient || null,
    merchantConstraint: lock.merchant || "ANY",
    expiresAt: lock.expiresAt,
    nonce: lock.nonce || `nonce_${Date.now()}`,
    status: lock.status,
    allowedActions: [actionStr],
    restrictedActions: [
      "TRANSFERS_ABOVE_LIMIT",
      "ARBITRARY_REFUNDS",
      "ESCROW_OVERRIDE",
      "POLICY_REWRITE",
      "LOCK_ELEVATION",
      "MUTATE_INTENT_LOCK"
    ],
    maxSpendingLimit: maxAmt,
    purposeBoundary: lock.purpose,
    requiresUserStepUp: false
  };
}

/**
 * Detects Intent Drift between candidate action/item and the locked Intent.
 */
export function detectIntentDrift(
  candidate: {
    title?: string;
    category?: string;
    merchant?: string;
    recipient?: string;
    amount?: number;
  },
  lock: IntentLock | Authorization
): IntentDriftResult {
  // 1. Recipient Drift Check
  if (lock.recipient && candidate.recipient && candidate.recipient.toLowerCase() !== lock.recipient.toLowerCase()) {
    return {
      hasDrift: true,
      driftType: "RECIPIENT_DRIFT",
      explanation: `Recipient substitution detected. Authorization is locked strictly to "${lock.recipient}", but candidate attempts to pay "${candidate.recipient}".`,
      similarityScore: 0.12
    };
  }

  // 2. Merchant Drift Check
  if (lock.merchant && candidate.merchant) {
    if (!candidate.merchant.toLowerCase().includes(lock.merchant.toLowerCase())) {
      return {
        hasDrift: true,
        driftType: "MERCHANT_DRIFT",
        explanation: `Merchant mismatch detected. Authorization is locked to "${lock.merchant}", but candidate is hosted on "${candidate.merchant}".`,
        similarityScore: 0.25
      };
    }
  }

  // 3. Category Drift Check
  if (lock.category && lock.category !== "GENERAL" && candidate.category) {
    const lockCat = lock.category.toUpperCase();
    const candCat = candidate.category.toUpperCase();
    if (lockCat !== candCat) {
      // Check if related (e.g. LAPTOP vs ELECTRONICS)
      const isRelated = (lockCat === "LAPTOP" && candCat === "ELECTRONICS") || (lockCat === "ELECTRONICS" && candCat === "LAPTOP");
      if (!isRelated) {
        return {
          hasDrift: true,
          driftType: "CATEGORY_DRIFT",
          explanation: `Category drift detected. Locked authority is for "${lock.category}", but candidate item is classified under "${candidate.category}".`,
          similarityScore: 0.3
        };
      }
    }
  }

  // 4. Purpose Semantic Drift Check
  if (candidate.title && lock.purpose) {
    const lockTokens = lock.purpose.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const titleTokens = candidate.title.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    let matchCount = 0;
    for (const t of lockTokens) {
      if (titleTokens.some(ct => ct.includes(t) || t.includes(ct))) {
        matchCount++;
      }
    }

    const similarity = lockTokens.length > 0 ? matchCount / lockTokens.length : 1.0;

    // Detect known forbidden drifted items (e.g. gift cards, crypto, luxury watch when buying laptop)
    const dangerousTokens = ["gift card", "crypto", "bitcoin", "luxury watch", "gold coin"];
    for (const dt of dangerousTokens) {
      if (candidate.title.toLowerCase().includes(dt) && !lock.purpose.toLowerCase().includes(dt)) {
        return {
          hasDrift: true,
          driftType: "PURPOSE_DRIFT",
          explanation: `Dangerous purpose drift detected. Item "${candidate.title}" does not align with authorized purpose "${lock.purpose}".`,
          similarityScore: 0.05
        };
      }
    }

    if (similarity < 0.2 && lockTokens.length >= 2) {
      return {
        hasDrift: true,
        driftType: "PURPOSE_DRIFT",
        explanation: `Semantic purpose mismatch (${Math.round(similarity * 100)}% match). Candidate item "${candidate.title}" deviates from authorized purpose "${lock.purpose}".`,
        similarityScore: similarity
      };
    }

    return {
      hasDrift: false,
      driftType: "NONE",
      explanation: "Candidate matches authorized purpose and category boundaries.",
      similarityScore: Math.max(0.85, similarity)
    };
  }

  return {
    hasDrift: false,
    driftType: "NONE",
    explanation: "Candidate conforms to authorized constraints.",
    similarityScore: 0.9
  };
}
