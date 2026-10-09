import { VoiceProfile } from '../types';

/**
 * Voice Identity Service Abstraction
 * 
 * IMPORTANT SECURITY DISCLOSURE:
 * Voice is used as an auxiliary multi-signal authorization challenge for high-risk payments.
 * Voice alone does NOT guarantee identity and is NOT un-spoofable.
 * In production, this service interfaces with an enterprise speaker-verification provider
 * combined with liveness detection and dynamic challenge phrases.
 */

export interface VoiceChallenge {
  challengeId: string;
  code: string;
  phrase: string;
  issuedAt: string;
  expiresAt: string;
}

export interface VoiceVerificationResult {
  success: boolean;
  score: number;
  isMatch: boolean;
  challengeMatched: boolean;
  error?: string;
  message: string;
  isDemo: boolean;
}

export interface VoiceEnrollmentResult {
  success: boolean;
  profile: VoiceProfile;
  message: string;
  isDemo: boolean;
}

export const voiceIdentityService = {
  /**
   * Generate a fresh dynamic challenge to defend against audio replay attacks.
   * Example: "Authorize payment 4821"
   */
  generateChallenge(): VoiceChallenge {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const now = Date.now();
    return {
      challengeId: `vchal_${now}_${Math.random().toString(36).substring(2, 6)}`,
      code,
      phrase: `Authorize payment ${code}`,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 2 * 60 * 1000).toISOString() // 2 minutes TTL
    };
  },

  /**
   * Enroll a voice profile using a simulated/enclave enrollment model.
   * Isolates the provider so real acoustic feature extraction can be plugged in.
   */
  async enrollVoice(
    samplePhrase: string = "PayGuard authorizes bounded payments"
  ): Promise<VoiceEnrollmentResult> {
    const profileId = `vp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const profile: VoiceProfile = {
      profileId,
      enrolledAt: new Date().toISOString(),
      phrasePattern: samplePhrase,
      voiceSampleHash: `sha256_${Math.random().toString(36).substring(2, 12)}`,
      verifiedCount: 0
    };

    return {
      success: true,
      profile,
      message: "Voice identity enrolled with demo acoustic profile. Dynamic challenge phrases required for authorization.",
      isDemo: true
    };
  },

  /**
   * Verify dynamic challenge phrase.
   * Prevents voice replay attacks: the user must speak or submit the fresh challenge code.
   */
  async verifyVoiceChallenge(
    challenge: VoiceChallenge,
    providedInput: string,
    isEnrolled: boolean
  ): Promise<VoiceVerificationResult> {
    if (!isEnrolled) {
      return {
        success: false,
        score: 0,
        isMatch: false,
        challengeMatched: false,
        error: "VOICE_NOT_ENROLLED",
        message: "No voice profile enrolled on this account. Complete voice enrollment first.",
        isDemo: true
      };
    }

    const now = Date.now();
    const isExpired = now > new Date(challenge.expiresAt).getTime();
    if (isExpired) {
      return {
        success: false,
        score: 0.1,
        isMatch: false,
        challengeMatched: false,
        error: "CHALLENGE_EXPIRED",
        message: "Dynamic voice challenge has expired. Request a fresh challenge.",
        isDemo: true
      };
    }

    // Clean inputs and match code
    const cleanInput = providedInput.trim().toLowerCase();
    const cleanPhrase = challenge.phrase.toLowerCase();
    const hasCode = cleanInput.includes(challenge.code);
    const hasPhrase = cleanInput.includes("authorize") || cleanInput.includes("payment");

    if (!hasCode) {
      return {
        success: false,
        score: 0.22,
        isMatch: false,
        challengeMatched: false,
        error: "REPLAY_OR_CODE_MISMATCH",
        message: `Dynamic challenge mismatch. Expected phrase with code '${challenge.code}', but received non-matching phrase. Replay defense triggered.`,
        isDemo: true
      };
    }

    return {
      success: true,
      score: 0.94,
      isMatch: true,
      challengeMatched: true,
      message: `Voice challenge verified (Confidence: 94%, Code: ${challenge.code} matched).`,
      isDemo: true
    };
  }
};
