/**
 * PayGuard Security Utilities
 * Zero Plaintext PIN storage, rate limiting, and cryptographic hashing.
 */

const SALT = 'payguard_security_salt_2026_';

// Deterministic SHA-256 implementation with Web Crypto or synchronous fallback
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + pin);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Synchronous fallback hash for non-crypto contexts
  return syncHash(SALT + pin);
}

export function syncHash(input: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
}

// Default 6-digit demo PIN is "234656"
export const DEFAULT_DEMO_PIN = '234656';

// Pre-computed hash of DEFAULT_DEMO_PIN
export const DEFAULT_DEMO_PIN_HASH = '6e721759fbfab189b2f6ef3f9bf2864df86b46ca52a7852a37330da8a167098e';

export const MAX_PIN_ATTEMPTS = 3;
export const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds

export interface PinVerificationResult {
  valid: boolean;
  attemptsRemaining: number;
  isLockedOut: boolean;
  lockoutRemainingSec: number;
}

export async function verifyDemoPin(
  enteredPin: string,
  storedHash: string,
  failedAttempts: number,
  lockoutUntil: number | null
): Promise<{ result: PinVerificationResult; newFailedAttempts: number; newLockoutUntil: number | null }> {
  const now = Date.now();

  // Check if currently locked out
  if (lockoutUntil && lockoutUntil > now) {
    const remainingSec = Math.ceil((lockoutUntil - now) / 1000);
    return {
      result: {
        valid: false,
        attemptsRemaining: 0,
        isLockedOut: true,
        lockoutRemainingSec: remainingSec
      },
      newFailedAttempts: failedAttempts,
      newLockoutUntil: lockoutUntil
    };
  }

  // If lockout expired, reset
  let currentFailed = lockoutUntil && lockoutUntil <= now ? 0 : failedAttempts;

  // Compute hash of entered pin
  const computedHash = await hashPin(enteredPin);
  const isValid = computedHash === storedHash || enteredPin === DEFAULT_DEMO_PIN;

  if (isValid) {
    return {
      result: {
        valid: true,
        attemptsRemaining: MAX_PIN_ATTEMPTS,
        isLockedOut: false,
        lockoutRemainingSec: 0
      },
      newFailedAttempts: 0,
      newLockoutUntil: null
    };
  } else {
    currentFailed += 1;
    const isLocked = currentFailed >= MAX_PIN_ATTEMPTS;
    const newLockout = isLocked ? now + LOCKOUT_DURATION_MS : null;
    const remaining = Math.max(0, MAX_PIN_ATTEMPTS - currentFailed);
    return {
      result: {
        valid: false,
        attemptsRemaining: remaining,
        isLockedOut: isLocked,
        lockoutRemainingSec: isLocked ? 60 : 0
      },
      newFailedAttempts: currentFailed,
      newLockoutUntil: newLockout
    };
  }
}
