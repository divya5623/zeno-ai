/**
 * PayGuard Native Biometric Bridge & WebAuthn Interface
 * 
 * ARCHITECTURAL INTEGRITY NOTICE:
 * Neither Android (AndroidX BiometricPrompt) nor the Web Authentication API (WebAuthn)
 * expose raw fingerprint images, min-templates, or the identity of which specific finger
 * touched the sensor. This bridge enforces honest verification without fabricating biometric data.
 */

import { BiometricHardwareState, ProfileAuthMode } from '../types/payguardAuth';

// Interface that an Android WebView native bridge would inject
declare global {
  interface Window {
    PayGuardAndroidBridge?: {
      isBiometricAvailable: () => boolean;
      authenticate: (title: string, subtitle: string, callbackName: string) => void;
      openBiometricSettings: () => void;
      getKeystoreSignature: (challenge: string) => string;
    };
    __payguardBiometricCallbacks?: Record<string, (result: BiometricAuthResult) => void>;
  }
}

export interface BiometricAuthResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  isSimulated: boolean;
  platform: 'ANDROID_NATIVE' | 'WEBAUTHN_BROWSER' | 'SIMULATION';
  timestamp: string;
  hardwareAvailable: boolean;
}

// Test / Mock override hook for automated testing
let testOverrideState: {
  forcedSuccess?: boolean;
  forcedHardwareState?: BiometricHardwareState;
  forcedCancellation?: boolean;
} | null = null;

export function setTestBiometricOverride(override: {
  forcedSuccess?: boolean;
  forcedHardwareState?: BiometricHardwareState;
  forcedCancellation?: boolean;
} | null) {
  testOverrideState = override;
}

export class NativeBiometricBridge {
  /**
   * Evaluates device biometric capability.
   * Checks for Android WebView bridge first, then WebAuthn platform authenticator.
   */
  public static async checkHardwareAvailability(): Promise<BiometricHardwareState> {
    if (testOverrideState?.forcedHardwareState) {
      return testOverrideState.forcedHardwareState;
    }

    // 1. Android Native Bridge
    if (typeof window !== 'undefined' && window.PayGuardAndroidBridge?.isBiometricAvailable) {
      try {
        const available = window.PayGuardAndroidBridge.isBiometricAvailable();
        return available ? 'AVAILABLE' : 'NOT_ENROLLED';
      } catch (err) {
        return 'UNAVAILABLE';
      }
    }

    // 2. WebAuthn Platform Authenticator (Windows Hello, macOS TouchID, Android Chrome Fingerprint)
    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return available ? 'AVAILABLE' : 'NO_HARDWARE';
      } catch (e) {
        return 'UNAVAILABLE';
      }
    }

    return 'NO_HARDWARE';
  }

  /**
   * Prompts the operating system for genuine biometric authentication.
   */
  public static async authenticateBiometrics(
    reason: string = 'Authorize PayGuard Payment',
    mode: ProfileAuthMode = 'REAL_BIOMETRIC'
  ): Promise<BiometricAuthResult> {
    const timestamp = new Date().toISOString();

    // Check test overrides for unit tests
    if (testOverrideState) {
      if (testOverrideState.forcedCancellation) {
        return {
          success: false,
          errorCode: 'USER_CANCELED',
          errorMessage: 'User canceled biometric prompt.',
          isSimulated: mode === 'SIMULATION',
          platform: 'SIMULATION',
          timestamp,
          hardwareAvailable: true
        };
      }
      if (testOverrideState.forcedSuccess !== undefined) {
        return {
          success: testOverrideState.forcedSuccess,
          errorCode: testOverrideState.forcedSuccess ? undefined : 'BIOMETRIC_FAILED',
          errorMessage: testOverrideState.forcedSuccess ? undefined : 'Biometric match rejected.',
          isSimulated: mode === 'SIMULATION',
          platform: 'SIMULATION',
          timestamp,
          hardwareAvailable: true
        };
      }
    }

    // If user explicitly chose SIMULATION MODE in setup
    if (mode === 'SIMULATION') {
      return {
        success: true,
        isSimulated: true,
        platform: 'SIMULATION',
        timestamp,
        hardwareAvailable: false
      };
    }

    // 1. Native Android Bridge
    if (typeof window !== 'undefined' && window.PayGuardAndroidBridge?.authenticate) {
      return new Promise<BiometricAuthResult>((resolve) => {
        const cbName = `payguard_bio_${Date.now()}`;
        if (!window.__payguardBiometricCallbacks) {
          window.__payguardBiometricCallbacks = {};
        }
        window.__payguardBiometricCallbacks[cbName] = (res: BiometricAuthResult) => {
          delete window.__payguardBiometricCallbacks?.[cbName];
          resolve(res);
        };
        try {
          window.PayGuardAndroidBridge.authenticate(
            'PayGuard Verification',
            reason,
            cbName
          );
        } catch (err: any) {
          resolve({
            success: false,
            errorCode: 'BRIDGE_ERROR',
            errorMessage: err?.message || 'Native bridge call failed',
            isSimulated: false,
            platform: 'ANDROID_NATIVE',
            timestamp,
            hardwareAvailable: false
          });
        }
      });
    }

    // 2. WebAuthn Platform Authenticator
    if (typeof window !== 'undefined' && window.PublicKeyCredential && navigator.credentials) {
      try {
        const challenge = new Uint8Array(32);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          crypto.getRandomValues(challenge);
        }

        // Request user-verifying assertion
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 60000,
            userVerification: 'required',
            rpId: window.location.hostname || 'localhost'
          }
        }).catch((err: any) => {
          if (err.name === 'NotAllowedError') {
            return { canceled: true };
          }
          throw err;
        });

        if (!assertion || (assertion as any).canceled) {
          return {
            success: false,
            errorCode: 'USER_CANCELED',
            errorMessage: 'Biometric verification was canceled or timed out.',
            isSimulated: false,
            platform: 'WEBAUTHN_BROWSER',
            timestamp,
            hardwareAvailable: true
          };
        }

        return {
          success: true,
          isSimulated: false,
          platform: 'WEBAUTHN_BROWSER',
          timestamp,
          hardwareAvailable: true
        };
      } catch (err: any) {
        // Fallback gracefully if platform authenticator not registered on this origin
        return {
          success: false,
          errorCode: 'HARDWARE_REJECTED',
          errorMessage: err?.message || 'Platform biometric check unsuccessful.',
          isSimulated: false,
          platform: 'WEBAUTHN_BROWSER',
          timestamp,
          hardwareAvailable: true
        };
      }
    }

    // Fallback if neither native nor WebAuthn is supported
    return {
      success: false,
      errorCode: 'NO_BIOMETRIC_HARDWARE',
      errorMessage: 'No hardware biometric sensor detected on this device. Use Simulation Mode for demo testing.',
      isSimulated: false,
      platform: 'WEBAUTHN_BROWSER',
      timestamp,
      hardwareAvailable: false
    };
  }

  /**
   * Guides user to device biometric settings
   */
  public static openDeviceBiometricSettings(): { action: string; details: string } {
    if (typeof window !== 'undefined' && window.PayGuardAndroidBridge?.openBiometricSettings) {
      try {
        window.PayGuardAndroidBridge.openBiometricSettings();
        return {
          action: 'ANDROID_INTENT',
          details: 'Launched Android Settings: ACTION_BIOMETRIC_ENROLL'
        };
      } catch (e) {
        // Fallback
      }
    }

    // Instructions based on OS
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent);
    const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent);
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

    if (isAndroid) {
      return {
        action: 'INSTRUCTIONS',
        details: 'Go to Android Settings > Security & Privacy > Biometrics > Fingerprint to register your fingers.'
      };
    } else if (isWindows) {
      return {
        action: 'INSTRUCTIONS',
        details: 'Go to Windows Settings > Accounts > Sign-in options > Windows Hello (Fingerprint / PIN / Face).'
      };
    } else if (isMac) {
      return {
        action: 'INSTRUCTIONS',
        details: 'Go to macOS System Settings > Touch ID & Password to configure your fingerprint.'
      };
    }

    return {
      action: 'INSTRUCTIONS',
      details: 'Please configure biometric credentials in your operating system security settings.'
    };
  }
}
