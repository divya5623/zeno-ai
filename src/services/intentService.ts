import { IntentLock, IntentParsingResult, HumanVerificationEvidence, AgentCapability } from "../types";
import { parseIntent, generateIntentLockFromParsed, createAgentCapability, detectIntentDrift } from "./intentEngine";

const STORAGE_KEY = "payguard_active_intent_lock_v2";

export class IntentService {
  /**
   * Parse a natural-language prompt into structured intent.
   */
  static parse(prompt: string): IntentParsingResult {
    return parseIntent(prompt);
  }

  /**
   * Mints and persists a new IntentLock.
   * If an active lock exists, it must be explicitly revoked first or replaced.
   */
  static mintIntentLock(
    parsed: IntentParsingResult,
    userId: string,
    humanVerification?: HumanVerificationEvidence
  ): IntentLock {
    const lock = generateIntentLockFromParsed(parsed, userId, humanVerification);
    this.saveLock(lock);
    return lock;
  }

  /**
   * Retrieve active intent lock from persistent storage.
   */
  static getActiveLock(): IntentLock | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      const lock: IntentLock = JSON.parse(data);
      // Check expiration
      if (new Date(lock.expiresAt).getTime() <= Date.now()) {
        lock.status = "EXPIRED";
        this.saveLock(lock);
        return lock;
      }
      return lock;
    } catch (e) {
      console.error("Failed to load IntentLock from localStorage", e);
      return null;
    }
  }

  /**
   * Saves lock to localStorage.
   */
  static saveLock(lock: IntentLock): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lock));
    } catch (e) {
      console.error("Failed to save IntentLock", e);
    }
  }

  /**
   * Revokes the current active lock and returns the revoked copy.
   */
  static revokeLock(lockId: string): IntentLock | null {
    const current = this.getActiveLock();
    if (current && current.id === lockId) {
      current.status = "REVOKED";
      this.saveLock(current);
      return current;
    }
    return null;
  }

  /**
   * Modifies an active lock by safely REVOKING the existing one and minting a fresh one.
   * Enforces immutability: Active locks can NEVER be edited in place.
   */
  static safeReplaceLock(
    oldLockId: string,
    updatedParsed: IntentParsingResult,
    userId: string,
    humanVerification?: HumanVerificationEvidence
  ): { oldLockRevoked: boolean; newLock: IntentLock } {
    this.revokeLock(oldLockId);
    const newLock = this.mintIntentLock(updatedParsed, userId, humanVerification);
    return {
      oldLockRevoked: true,
      newLock
    };
  }

  /**
   * Produce the isolated AgentCapability projection.
   */
  static getAgentCapability(lock: IntentLock): AgentCapability {
    return createAgentCapability(lock);
  }

  /**
   * Clear stored lock
   */
  static clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export { parseIntent, generateIntentLockFromParsed, createAgentCapability, detectIntentDrift };
