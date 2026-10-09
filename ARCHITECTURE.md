# PayGuard System Architecture

## Component Breakdown

### 1. Identity & Biometrics Layer (`src/services/passkeyService.ts`, `identityService.ts`)
- Manages registration and authentication of device-native passkeys using WebAuthn.
- Issues `HumanVerificationEvidence` tokens containing cryptographic assertion metadata.
- Evaluates risk-based step-up authentication triggers.

### 2. Intent Engine (`src/services/intentEngine.ts`, `intentService.ts`)
- `parseIntent()`: Extracts action, purpose, category, spending ceiling, transaction limit, and TTL.
- `generateIntentLockFromParsed()`: Mints immutable `IntentLock` tokens.
- `detectIntentDrift()`: Computes multi-attribute semantic drift score (0–100).

### 3. Agent Capability & Runtime Layer (`src/services/agentService.ts`)
- `issueCapability()`: Derives read-only capability projection from an active Intent Lock.
- `validateCapability()` & `consumeCapability()`: Tracks cumulative spending and burns quotas safely.
- Sandboxed agent shopping simulator with prompt injection inspection.

### 4. Continuous Security Gateway (`src/services/securityGateway.ts`)
- `evaluatePaymentRequestGateway()`: Evaluates 25 deterministic checks in sequential order.
- `NonceStore`: Replay protection ledger.
- `RateLimitMonitor`: 30-second sliding window velocity tracking.
- `executeAuthorizedPayment()`: Strict execution boundary before PayPal.

### 5. Application State (`src/context/AppContext.tsx`)
- Central React Context managing identity, intent locks, capabilities, agent sessions, transactions, and attack results.
- Versioned storage persistence with synchronization across views.

### 6. Presentation Layer
- **Dashboard (`DashboardPage.tsx`)**: Gateway health, budget overview, Trust Matrix.
- **Shop (`ShopPage.tsx`)**: AI shopping flow with prompt input, candidate cards, and PayPal review.
- **Authorizations (`AuthorizationsPage.tsx`)**: Two-step intent specification and review wizard.
- **Attack Lab (`AttackLabPage.tsx`)**: 14+ live adversarial scenarios.
- **Security Center (`SecurityCenterPage.tsx`)**: Continuous authorization live enclave status.
- **Transactions (`TransactionsPage.tsx`)**: Auditable ledger with continuous authorization traces.
