/**
 * PayGuard: Ten-Finger Profile & Drag-To-Center Authentication Types
 * Designed for PayPal AI Hackathon
 */

export type FingerPosition =
  | 'LEFT_THUMB'
  | 'LEFT_INDEX'
  | 'LEFT_MIDDLE'
  | 'LEFT_RING'
  | 'LEFT_LITTLE'
  | 'RIGHT_THUMB'
  | 'RIGHT_INDEX'
  | 'RIGHT_MIDDLE'
  | 'RIGHT_RING'
  | 'RIGHT_LITTLE';

export interface FingerDefinition {
  position: FingerPosition;
  name: string;
  hand: 'LEFT' | 'RIGHT';
  fingerNumber: number; // 1 to 10
  shortName: string;
}

export type FingerEnrollmentStatus = 
  | 'NOT_ENROLLED'
  | 'SIMULATED_ENROLLED'
  | 'OS_BIOMETRIC_LINKED';

export interface FingerProfileItem {
  position: FingerPosition;
  name: string;
  hand: 'LEFT' | 'RIGHT';
  status: FingerEnrollmentStatus;
  enrolledAt?: string;
  lastTestedAt?: string;
  simulationSampleId?: string;
  notes?: string;
}

export type BiometricHardwareState =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'NO_HARDWARE'
  | 'NOT_ENROLLED'
  | 'UNKNOWN';

export type ProfileAuthMode = 'REAL_BIOMETRIC' | 'SIMULATION';

export interface BehavioralBaseline {
  avgDragDurationMs: number;
  avgInterDigitDelayMs: number;
  avgDragVelocity: number;
  trajectoryJitterAvg: number;
  dropFailureRate: number;
  sampleCount: number;
}

export interface PayGuardUserProfile {
  profileId: string;
  setupCompleted: boolean;
  biometricMode: ProfileAuthMode;
  biometricHardware: BiometricHardwareState;
  osBiometricEnrolled: boolean;
  fingerProfiles: Record<FingerPosition, FingerProfileItem>;
  demoPinHash: string; // SHA-256 salted hash of demo PIN (default '234656')
  failedPinAttempts: number;
  lockoutUntil: number | null; // epoch ms if locked out
  behavioralBaseline: BehavioralBaseline;
  createdAt: string;
  updatedAt: string;
}

export interface DragTelemetryPoint {
  digit: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  distancePx: number;
  velocity: number; // px/ms
  angleDeg: number;
  interDigitDelayMs: number;
  droppedInside: boolean;
  contactAreaMm2?: number;
  touchPressure?: number;
  estimatedFinger?: string;
  estimatedConfidence?: number;
}

export interface DragSessionTelemetry {
  sessionId: string;
  points: DragTelemetryPoint[];
  dropFailuresCount: number;
  totalDurationMs: number;
  enteredDigitsCount: number;
}

export type RiskDecision = 'ALLOW' | 'STEP_UP_CHALLENGE' | 'BLOCK';
export type RiskLevelGrade = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskFactor {
  factor: string;
  scoreImpact: number; // positive increases risk, negative decreases
  description: string;
  status: 'SAFE' | 'WARNING' | 'ALERT';
}

export interface RiskEvaluationResult {
  decision: RiskDecision;
  riskLevel: RiskLevelGrade;
  riskScore: number; // 0 to 100
  anomalyScore: number; // 0 to 100
  pinValid: boolean;
  biometricSuccess: boolean;
  biometricMode: ProfileAuthMode;
  hardwareState: BiometricHardwareState;
  explanation: string;
  factors: RiskFactor[];
  metrics: {
    avgDragDurationMs: number;
    avgInterDigitDelayMs: number;
    dragVelocityAvg: number;
    droppedFailures: number;
  };
  paypalEligible: boolean;
  evaluatedAt: string;
}

export interface DemoPaymentOrder {
  orderId: string;
  merchantName: string;
  merchantId: string;
  itemDescription: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  createdAt: string;
}

export interface PayPalExecutionResult {
  success: boolean;
  orderId: string;
  captureId?: string;
  status: 'COMPLETED' | 'FAILED' | 'OFFLINE_DEMO_APPROVED';
  mode: 'SANDBOX' | 'OFFLINE_DEMO';
  amount: number;
  currency: string;
  timestamp: string;
  message: string;
}
