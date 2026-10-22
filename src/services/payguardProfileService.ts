/**
 * PayGuard Persistent Profile Service
 * Manages 10-Finger Enrollment, Keystore/Local profile persistence,
 * Behavioral Baselines, and Demo PIN rate limiting.
 */

import {
  FingerDefinition,
  FingerPosition,
  FingerProfileItem,
  PayGuardUserProfile,
  BehavioralBaseline,
  ProfileAuthMode,
  BiometricHardwareState,
  DragTelemetryPoint
} from '../types/payguardAuth';
import {
  DEFAULT_DEMO_PIN_HASH,
  DEFAULT_DEMO_PIN,
  hashPin,
  verifyDemoPin,
  PinVerificationResult
} from './payguardSecurityUtils';
import { NativeBiometricBridge } from './nativeBiometricBridge';

export const TEN_FINGER_DEFINITIONS: FingerDefinition[] = [
  { position: 'LEFT_THUMB', name: 'Left Thumb', hand: 'LEFT', fingerNumber: 1, shortName: 'L-Thumb' },
  { position: 'LEFT_INDEX', name: 'Left Index Finger', hand: 'LEFT', fingerNumber: 2, shortName: 'L-Index' },
  { position: 'LEFT_MIDDLE', name: 'Left Middle Finger', hand: 'LEFT', fingerNumber: 3, shortName: 'L-Middle' },
  { position: 'LEFT_RING', name: 'Left Ring Finger', hand: 'LEFT', fingerNumber: 4, shortName: 'L-Ring' },
  { position: 'LEFT_LITTLE', name: 'Left Little Finger', hand: 'LEFT', fingerNumber: 5, shortName: 'L-Little' },
  { position: 'RIGHT_THUMB', name: 'Right Thumb', hand: 'RIGHT', fingerNumber: 6, shortName: 'R-Thumb' },
  { position: 'RIGHT_INDEX', name: 'Right Index Finger', hand: 'RIGHT', fingerNumber: 7, shortName: 'R-Index' },
  { position: 'RIGHT_MIDDLE', name: 'Right Middle Finger', hand: 'RIGHT', fingerNumber: 8, shortName: 'R-Middle' },
  { position: 'RIGHT_RING', name: 'Right Ring Finger', hand: 'RIGHT', fingerNumber: 9, shortName: 'R-Ring' },
  { position: 'RIGHT_LITTLE', name: 'Right Little Finger', hand: 'RIGHT', fingerNumber: 10, shortName: 'R-Little' }
];

const STORAGE_KEY_PROFILE = 'payguard_security_profile_v3';

export const DEFAULT_BEHAVIORAL_BASELINE: BehavioralBaseline = {
  avgDragDurationMs: 420,
  avgInterDigitDelayMs: 650,
  avgDragVelocity: 0.85,
  trajectoryJitterAvg: 0.12,
  dropFailureRate: 0.05,
  sampleCount: 10
};

export class PayGuardProfileService {
  /**
   * Initializes or loads the persistent PayGuard user profile.
   */
  public static async getProfile(): Promise<PayGuardUserProfile> {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_PROFILE) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PayGuardUserProfile;
        // Verify structure integrity
        if (parsed.profileId && parsed.fingerProfiles) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse PayGuard profile from storage, reinitializing');
      }
    }

    // Initialize fresh default profile
    const defaultProfile = await this.createInitialProfile();
    this.saveProfile(defaultProfile);
    return defaultProfile;
  }

  /**
   * Creates fresh initial profile structure.
   */
  public static async createInitialProfile(
    mode: ProfileAuthMode = 'SIMULATION'
  ): Promise<PayGuardUserProfile> {
    const hardwareState = await NativeBiometricBridge.checkHardwareAvailability();
    const fingerProfiles: Record<FingerPosition, FingerProfileItem> = {} as any;

    TEN_FINGER_DEFINITIONS.forEach((f) => {
      fingerProfiles[f.position] = {
        position: f.position,
        name: f.name,
        hand: f.hand,
        status: mode === 'SIMULATION' ? 'SIMULATED_ENROLLED' : 'NOT_ENROLLED',
        simulationSampleId: mode === 'SIMULATION' ? `SIM-${f.position.replace('_', '-')}-8821` : undefined,
        notes: mode === 'SIMULATION' 
          ? 'Simulated hackathon test fingerprint profile (Not genuine biometric data)'
          : 'Pending OS-managed biometric setup'
      };
    });

    return {
      profileId: `pg_usr_${Math.random().toString(36).substring(2, 9)}`,
      setupCompleted: mode === 'SIMULATION',
      biometricMode: mode,
      biometricHardware: hardwareState,
      osBiometricEnrolled: hardwareState === 'AVAILABLE',
      fingerProfiles,
      demoPinHash: DEFAULT_DEMO_PIN_HASH,
      failedPinAttempts: 0,
      lockoutUntil: null,
      behavioralBaseline: { ...DEFAULT_BEHAVIORAL_BASELINE },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Saves profile to persistent storage.
   */
  public static saveProfile(profile: PayGuardUserProfile): void {
    profile.updatedAt = new Date().toISOString();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    }
  }

  /**
   * Updates enrollment status of a specific finger.
   */
  public static async updateFingerStatus(
    position: FingerPosition,
    status: 'SIMULATED_ENROLLED' | 'OS_BIOMETRIC_LINKED' | 'NOT_ENROLLED',
    notes?: string
  ): Promise<PayGuardUserProfile> {
    const profile = await this.getProfile();
    const target = profile.fingerProfiles[position];
    if (target) {
      target.status = status;
      target.lastTestedAt = new Date().toISOString();
      if (notes) target.notes = notes;
      if (status === 'SIMULATED_ENROLLED' && !target.simulationSampleId) {
        target.simulationSampleId = `SIM-${position.replace('_', '-')}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    // Check if setup complete (all 10 have status)
    const allEnrolled = Object.values(profile.fingerProfiles).every(f => f.status !== 'NOT_ENROLLED');
    profile.setupCompleted = allEnrolled;

    this.saveProfile(profile);
    return profile;
  }

  /**
   * Bulk enrolls all 10 fingers in simulation or OS-linked mode.
   */
  public static async enrollAllFingers(
    mode: ProfileAuthMode
  ): Promise<PayGuardUserProfile> {
    const profile = await this.getProfile();
    profile.biometricMode = mode;
    profile.setupCompleted = true;

    TEN_FINGER_DEFINITIONS.forEach(f => {
      profile.fingerProfiles[f.position] = {
        position: f.position,
        name: f.name,
        hand: f.hand,
        status: mode === 'SIMULATION' ? 'SIMULATED_ENROLLED' : 'OS_BIOMETRIC_LINKED',
        enrolledAt: new Date().toISOString(),
        simulationSampleId: mode === 'SIMULATION' ? `SIM-${f.position.replace('_', '-')}-DEMO` : undefined,
        notes: mode === 'SIMULATION'
          ? 'Simulated sample finger profile (for UI & hackathon testing only)'
          : 'Operating-system biometric identity confirmed via platform authenticator'
      };
    });

    this.saveProfile(profile);
    return profile;
  }

  /**
   * Verifies the entered PIN against the profile's hash with rate limiting & lockout.
   */
  public static async verifyPin(enteredPin: string): Promise<PinVerificationResult> {
    const profile = await this.getProfile();
    const { result, newFailedAttempts, newLockoutUntil } = await verifyDemoPin(
      enteredPin,
      profile.demoPinHash,
      profile.failedPinAttempts,
      profile.lockoutUntil
    );

    profile.failedPinAttempts = newFailedAttempts;
    profile.lockoutUntil = newLockoutUntil;
    this.saveProfile(profile);

    return result;
  }

  /**
   * Resets failed PIN lockout manually (for demo/judge testing).
   */
  public static async resetLockout(): Promise<PayGuardUserProfile> {
    const profile = await this.getProfile();
    profile.failedPinAttempts = 0;
    profile.lockoutUntil = null;
    this.saveProfile(profile);
    return profile;
  }

  /**
   * Updates behavioral baseline with newly gathered legitimate payment session telemetry.
   */
  public static async updateBehavioralBaseline(
    points: DragTelemetryPoint[],
    dropFailures: number
  ): Promise<PayGuardUserProfile> {
    const profile = await this.getProfile();
    if (!points || points.length === 0) return profile;

    const sessionAvgDuration = points.reduce((acc, p) => acc + p.durationMs, 0) / points.length;
    const sessionAvgDelay = points.reduce((acc, p) => acc + p.interDigitDelayMs, 0) / points.length;
    const sessionAvgVelocity = points.reduce((acc, p) => acc + p.velocity, 0) / points.length;
    const sessionFailureRate = dropFailures / (points.length + dropFailures);

    const b = profile.behavioralBaseline;
    const n = b.sampleCount;

    // Moving average update
    b.avgDragDurationMs = Math.round((b.avgDragDurationMs * n + sessionAvgDuration) / (n + 1));
    b.avgInterDigitDelayMs = Math.round((b.avgInterDigitDelayMs * n + sessionAvgDelay) / (n + 1));
    b.avgDragVelocity = Number(((b.avgDragVelocity * n + sessionAvgVelocity) / (n + 1)).toFixed(2));
    b.dropFailureRate = Number(((b.dropFailureRate * n + sessionFailureRate) / (n + 1)).toFixed(3));
    b.sampleCount += 1;

    this.saveProfile(profile);
    return profile;
  }

  /**
   * Securely deletes profile data from local storage and resets.
   */
  public static async deleteProfile(): Promise<PayGuardUserProfile> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_PROFILE);
    }
    const fresh = await this.createInitialProfile('SIMULATION');
    fresh.setupCompleted = false;
    // Mark fingers as not enrolled
    TEN_FINGER_DEFINITIONS.forEach(f => {
      fresh.fingerProfiles[f.position].status = 'NOT_ENROLLED';
      fresh.fingerProfiles[f.position].simulationSampleId = undefined;
    });
    this.saveProfile(fresh);
    return fresh;
  }
}
