# PayGuard Security Architecture & Policy Enclave

## Security Principles

1. **AI Receives Capability, Not Custody**:
   Autonomous models can browse, search, compare, and recommend, but possess zero direct access to financial credentials or balances.

2. **Continuous Authorization**:
   Authorization is not a one-time check at session start. Every payment attempt re-evaluates all 25 policy checkpoints against the active Intent Lock.

3. **Strict Policy Priority Ordering**:
   Earlier failures in the security pipeline immediately terminate evaluation with a `BLOCK` decision. Low risk scores never override unauthorized parameters.

4. **Fail-Closed Execution Boundary**:
   If an Intent Lock, capability, session, or nonce is missing or ambiguous, the gateway defaults to `BLOCK`.

5. **PayPal Boundary Isolation**:
   The function `executeAuthorizedPayment()` enforces that only `decision === "ALLOW"` can trigger PayPal dispatch. For blocked requests, the PayPal API is strictly **NOT CALLED**.

6. **Zero Raw Biometric Storage**:
   Biometric authentication is exclusively performed on-device via WebAuthn/FIDO2. PayGuard processes only cryptographic assertions and signatures.

## Threat Model Summary

- **T-01: Prompt Injection / Untrusted Content**:
  Malicious instruction embedded in product descriptions trying to override limits.  
  *Mitigation*: Content trust classification + immutable Intent Lock boundaries.

- **T-02: Budget & Capability Escalation**:
  Compromised agent attempting to increase spending caps or spend beyond capability.  
  *Mitigation*: Ceiling checks (`amount <= maxAmount` and `amount <= remainingAmount`).

- **T-03: Recipient / Merchant Substitution**:
  Diverting funds to unauthorized third parties.  
  *Mitigation*: Locked recipient/merchant constraints enforced at Policy Gate.

- **T-04: Nonce Replay & Double Spending**:
  Replaying a previously authorized token.  
  *Mitigation*: Single-use nonces stored and burned via `NonceStore`.

- **T-05: Stale Requests**:
  Executing old authorized requests after intent has lapsed.  
  *Mitigation*: Strict 5-minute freshness window (`REQUEST_MAX_AGE_MS`).

- **T-06: Session Hijacking & Kill Switch Bypass**:
  Malicious agent executing actions after user revocation.  
  *Mitigation*: Instant session state revocation terminating all active capabilities.
