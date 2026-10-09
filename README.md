# PayGuard: Bounded Financial Authority for AI Agents

> **"AI gets capability, not custody."**  
> An intent and authorization layer for AI-powered autonomous commerce, featuring deterministic policy enforcement, bounded agent runtime capabilities, continuous security evaluation, and PayPal Sandbox integration.

---

## 🛡️ Core Problem & Value Proposition

As autonomous AI agents evolve from conversational assistants into economic actors capable of executing purchases, traditional payment mechanisms expose users to critical vulnerabilities:
- **Prompt Injection & Context Manipulation**: Hidden instructions in web pages or product descriptions altering purchase parameters.
- **Budget Escalation & Overruns**: Agents attempting purchases beyond human expectations.
- **Intent Drift & Recipient Diversion**: Autonomous diversion of funds to rogue merchants or unauthorized accounts.
- **Replay Attacks & Split Payments**: Reusing stale tokens or splitting transactions to circumvent velocity caps.

**PayGuard resolves this fundamental challenge:**  
The AI agent is **never** granted custody of funds or direct access to payment credentials. Instead, the user cryptographically anchors their intent via device-native biometrics into an **immutable Intent Lock**. The agent receives only a **temporary, bounded capability projection**, and every transaction is continuously evaluated by the **PayGuard Security Gateway** before reaching PayPal.

---

## 🏛️ Architecture & Continuous Authorization Flow

```text
                         HUMAN
                           │
                           ▼
                  IDENTITY VERIFICATION (WebAuthn Passkey)
                           │
                           ▼
                      INTENT ENGINE
                           │
                           ▼
                      INTENT LOCK (Cryptographically Anchored)
                           │
                           ▼
                  AGENT CAPABILITY (Bounded, Read-Only Projection)
                           │
                           ▼
                     AGENT SESSION (Sandboxed Runtime)
                           │
                           ▼
                        AI AGENT (Product Search & Selection)
                           │
                           ▼
                    PAYMENT REQUEST
                           │
                           ▼
             ┌─────────────────────────────┐
             │  PAYGUARD SECURITY GATEWAY  │
             │                             │
             │  1. Continuous Identity     │
             │  2. Intent Lock Status      │
             │  3. Capability Integrity    │
             │  4. Session Validity        │
             │  5. Ceiling & Budget Checks │
             │  6. Transaction Quota       │
             │  7. Recipient & Merchant    │
             │  8. Purpose Alignment       │
             │  9. Nonce / Replay Defense  │
             │ 10. Request Freshness (<5m) │
             │ 11. Content Firewall        │
             │ 12. Rate Anomaly Check      │
             │ 13. Intent Drift Score      │
             │ 14. Step-Up Verification    │
             └──────────────┬──────────────┘
                            │
                   ┌────────┼────────┐
                   ▼        ▼        ▼
                 ALLOW    BLOCK    STEP-UP
                   │        │        │
                   │        │        ▼
                   │        │   HUMAN VERIFY
                   │        │        │
                   │        │        ▼
                   │        │    RE-EVALUATE
                   │        │
                   ▼        ▼
            PAYPAL SANDBOX  EVIDENCE VAULT
                   │        (PayPal NOT Called)
                   ▼
            TRANSACTION CAPTURE
```

### The Strict Invariant:
```text
ALLOWED PAYMENT  ──► Policy Gateway: ALLOW ──► PayPal Sandbox: DISPATCHED
BLOCKED PAYMENT  ──► Policy Gateway: BLOCK ──► PayPal API: NOT CALLED
```
There is **zero** direct connection between the AI agent and PayPal.

---

## 🚀 Key Implemented Features

1. **Human Identity & Authorization Layer**:
   - Device-native biometric authentication utilizing WebAuthn / FIDO2 passkeys.
   - Auxiliary anti-replay voice identity challenge-response abstraction.
   - **Zero Raw Biometric Storage**: No fingerprint templates or voice biometric records are stored.

2. **Intent Engine + Verified Intent Lock**:
   - Deterministic natural-language parser converting human prompts into structured financial boundaries.
   - Immutable Intent Lock tokens with strict TTL and nonce binding.
   - Safe replacement lifecycle: Active locks cannot be mutated in place; edits revoke the old token and mint a new one.

3. **Agent Capability & Runtime Sandbox**:
   - Read-only capability projections derived strictly from active Intent Locks.
   - Kill switch mechanism: Immediately severs active agent sessions and burns capabilities.
   - Untrusted external content firewall identifying prompt injections in product catalogs.

4. **Continuous Security Gateway**:
   - 25 deterministic security checkpoints evaluated in strict sequential order.
   - `NonceStore` prevents replay attacks; `RateLimitMonitor` throttles burst velocities.
   - Deterministic Intent Drift Score (0–100) and multi-factor Risk Engine.

5. **PayPal Sandbox Boundary**:
   - `executeAuthorizedPayment()` contract strictly requiring `decision === "ALLOW"` and `paypalEligible === true`.
   - Complete transaction traces for approved payments and blocked attempts.

6. **Adversarial Attack Lab**:
   - Interactive zero-trust test suite featuring 14+ live attack scenarios:
     - Prompt injection & malicious instructions
     - Budget overrun & capability escalation
     - Recipient & merchant substitution
     - Semantic purpose drift
     - Nonce replay & session hijacking
     - Capability tampering & stale requests
   - Real-time policy gate inspection and Evidence Vault traces.

---

## 💻 Tech Stack

- **Framework**: React 18 + TypeScript 5
- **Bundler & Dev Server**: Vite 5
- **Routing**: React Router DOM 6
- **State Management**: Centralized React Context (`AppContext`) with versioned `localStorage` persistence
- **Styling**: PayPal-aligned design system (Deep Navy, PayPal Blue, responsive layout)

---

## 🛠️ Getting Started Locally

### Prerequisites
- Node.js (v18.0.0 or later, v20.x recommended)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/divya5623/payguard-ai-payment-security.git
cd payguard-ai-payment-security

# Install dependencies
npm install

# Copy environment example
cp .env.example .env
```

### Development
```bash
# Start local development server
npm run dev
```
Navigate to `http://localhost:3000` (or the port specified by Vite).

### Production Build
```bash
# Validate TypeScript and bundle for production
npm run build

# Preview production build
npm run preview
```

---

## ⚙️ Environment Variables

PayGuard isolates credentials from the client application. Review `.env.example`:
```env
PAYPAL_CLIENT_ID=your_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_here
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_MODE=SANDBOX
```
*Note: Real secrets should only be maintained in protected backend execution contexts.*

---

## 🧪 Testing & Verification

1. **Shop & Intent Verification**:
   - Specify intent: *"Buy me a college laptop under ₹20,000."*
   - Review and lock intent in Authorizations.
   - Attempt purchasing *College Laptop A* (₹18,999) ➔ **Gateway ALLOW** ➔ PayPal Sandbox.
   - Attempt purchasing *Predator Gaming Laptop* (₹75,000) ➔ **Gateway BLOCK** ➔ PayPal NOT Called.

2. **Attack Lab**:
   - Navigate to `/attack-lab`.
   - Run individual attacks or execute the full test suite.
   - Inspect step-by-step cryptographic checks and evidence intercept tokens.

---

## 📋 Security & Compliance Disclaimers

- **Sandbox Only**: PayGuard executes against PayPal Sandbox. No real financial capital is transferred.
- **Biometric Abstraction**: Passkeys leverage device-native WebAuthn APIs. PayGuard never accesses, reads, or stores raw biometric templates.
- **Bounded Security**: PayGuard enforces human-defined boundaries at the payment perimeter; it does not claim total infallibility against non-financial agent reasoning bugs.

---

## 📄 License

MIT License. Developed for the PayPal AI Agentic Payments Hackathon.
