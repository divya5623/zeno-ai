import {
  UserIdentity,
  RegisteredPasskey,
  VoiceProfile,
  RiskLevel,
  HumanVerificationEvidence,
  IdentitySecuritySettings
} from '../types';

export const initialIdentitySettings: IdentitySecuritySettings = {
  requirePasskeyForHighRisk: true,
  requireVoiceVerification: false,
  requireFreshIntentConfirmation: true,
  highRiskThreshold: 15000 // ₹15,000 threshold
};

export const initialRegisteredPasskey: RegisteredPasskey = {
  id: "pk_init_881",
  credentialId: "cred_dev_enclave_8819",
  deviceName: "MacBook Pro / Touch ID (Enclave)",
  deviceType: "platform",
  createdAt: "2026-10-01T09:00:00Z",
  lastUsedAt: "2026-10-08T18:30:00Z",
  transports: ["internal"],
  isBackupEligible: true
};

export const initialVoiceProfile: VoiceProfile = {
  profileId: "vp_alex_vance_01",
  enrolledAt: "2026-10-02T14:15:00Z",
  phrasePattern: "PayGuard authorizes bounded payments",
  voiceSampleHash: "sha256_d892ba7c61f2",
  verifiedCount: 4
};

export const initialUserIdentity: UserIdentity = {
  userId: "usr_pg_88219",
  displayName: "Alex Vance",
  email: "alex.vance@payguard.secure",
  identityStatus: "VERIFIED",
  passkeyStatus: "REGISTERED",
  voiceEnrollmentStatus: "ENROLLED",
  deviceTrustStatus: "TRUSTED",
  createdAt: "2026-09-15T08:00:00Z",
  lastAuthenticatedAt: new Date().toISOString(),
  registeredPasskeys: [initialRegisteredPasskey],
  voiceProfile: initialVoiceProfile,
  securitySettings: initialIdentitySettings
};

export const identityService = {
  getInitialIdentity(): UserIdentity {
    return { ...initialUserIdentity };
  },

  /**
   * Determine transaction risk level based on amount, merchant, and user settings
   */
  calculateRiskLevel(
    amount: number,
    settings: IdentitySecuritySettings,
    maxBudget: number
  ): RiskLevel {
    if (amount > maxBudget) {
      return "CRITICAL"; // Exceeds budget
    }
    if (amount >= settings.highRiskThreshold || amount > maxBudget * 0.75) {
      return "HIGH";
    }
    if (amount >= 5000) {
      return "MEDIUM";
    }
    return "LOW";
  },

  /**
   * Check if human step-up authentication is required for this transaction
   */
  isHumanAuthRequired(
    riskLevel: RiskLevel,
    settings: IdentitySecuritySettings
  ): boolean {
    if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
      return settings.requirePasskeyForHighRisk;
    }
    return false;
  },

  /**
   * Create verification evidence for an authenticated action
   */
  createVerificationEvidence(
    method: "PASSKEY" | "VOICE" | "MULTI_FACTOR" | "NONE",
    riskLevel: RiskLevel,
    credentialId?: string,
    challenge?: string
  ): HumanVerificationEvidence {
    return {
      identityVerified: method !== "NONE",
      authenticationMethod: method,
      passkeyVerified: method === "PASSKEY" || method === "MULTI_FACTOR",
      voiceVerified: method === "VOICE" || method === "MULTI_FACTOR",
      credentialId,
      challenge,
      timestamp: new Date().toISOString(),
      riskLevel,
      deviceTrusted: true,
      verifiedBy: "PayGuard Identity Layer"
    };
  }
};
