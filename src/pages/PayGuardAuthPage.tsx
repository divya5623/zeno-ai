import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PayGuardProfileService
} from '../services/payguardProfileService';
import { NativeBiometricBridge, BiometricAuthResult } from '../services/nativeBiometricBridge';
import { PayGuardRiskEngine } from '../services/payguardRiskEngine';
import { PayPalSandboxService } from '../services/paypalSandboxService';
import {
  PayGuardUserProfile,
  DragTelemetryPoint,
  RiskEvaluationResult,
  DemoPaymentOrder,
  PayPalExecutionResult
} from '../types/payguardAuth';
import {
  analyzeFingerContact,
  FingerAnalysisResult
} from '../services/fingerContactAnalyzer';

type AnalysisStep = 'IDLE' | 'VERIFYING_PIN' | 'BIOMETRIC_AUTH' | 'BEHAVIORAL_AI' | 'PAYPAL_CAPTURE' | 'COMPLETED';

export const PayGuardAuthPage: React.FC = () => {
  const navigate = useNavigate();

  // Profile & System State
  const [profile, setProfile] = useState<PayGuardUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(PayPalSandboxService.isOffline());

  // Payment Order Info
  const [order] = useState<DemoPaymentOrder>({
    orderId: `ORD-${Date.now().toString(36).toUpperCase()}`,
    merchantName: 'Cloud Compute Pro Services',
    merchantId: 'MERCHANT-AWS-882',
    itemDescription: 'H100 GPU Autonomous Agent Compute Cluster (10 hrs)',
    amount: 42.50,
    currency: 'USD',
    paymentMethod: 'PayPal Balance / Linked Bank',
    createdAt: new Date().toISOString()
  });

  // PIN Entry & Drag State
  const [enteredDigits, setEnteredDigits] = useState<string[]>([]);
  const [dragTelemetry, setDragTelemetry] = useState<DragTelemetryPoint[]>([]);
  const [dropFailures, setDropFailures] = useState(0);
  const [lastDropTime, setLastDropTime] = useState<number>(Date.now());
  const [isTargetHovered, setIsTargetHovered] = useState(false);
  const [latestFingerAnalysis, setLatestFingerAnalysis] = useState<FingerAnalysisResult | null>(null);
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [activeTouchDrag, setActiveTouchDrag] = useState<{
    digit: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    startTime: number;
    radiusX?: number;
    radiusY?: number;
    force?: number;
  } | null>(null);

  // Analysis Pipeline State
  const [currentStep, setCurrentStep] = useState<AnalysisStep>('IDLE');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [riskResult, setRiskResult] = useState<RiskEvaluationResult | null>(null);
  const [paypalResult, setPaypalResult] = useState<PayPalExecutionResult | null>(null);
  const [activeDragDigit, setActiveDragDigit] = useState<string | null>(null);

  // Target Circle Element Ref
  const targetCircleRef = useRef<HTMLDivElement>(null);

  // Load persistent profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const p = await PayGuardProfileService.getProfile();
    setProfile(p);
    setLoading(false);
  };

  // Keyboard accessibility listener for digits 0-9 & Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentStep !== 'IDLE') return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        recordDigitEntry(e.key, {
          durationMs: 380,
          startPos: { x: 200, y: 100 },
          endPos: { x: 200, y: 350 },
          distancePx: 250,
          velocity: 0.65,
          angleDeg: 90
        });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enteredDigits, currentStep, lastDropTime, dropFailures]);

  // When 6 digits are reached: AUTOMATIC ADVANCE without "Verify PIN" button
  useEffect(() => {
    if (enteredDigits.length === 6 && currentStep === 'IDLE') {
      executeAutomaticAnalysisFlow();
    }
  }, [enteredDigits, currentStep]);

  // Record an accepted digit entry
  const recordDigitEntry = (
    digit: string,
    meta: {
      durationMs: number;
      startPos: { x: number; y: number };
      endPos: { x: number; y: number };
      distancePx: number;
      velocity: number;
      angleDeg: number;
      radiusX?: number;
      radiusY?: number;
      force?: number;
      isTouch?: boolean;
    }
  ) => {
    if (enteredDigits.length >= 6) return;

    const now = Date.now();
    const interDigitDelay = enteredDigits.length === 0 ? 0 : now - lastDropTime;

    // Run Real-Time Touch Contact & Finger Morphometry Analysis
    const analysis = analyzeFingerContact({
      radiusX: meta.radiusX,
      radiusY: meta.radiusY,
      force: meta.force,
      angleDeg: meta.angleDeg,
      distancePx: meta.distancePx,
      digit,
      isTouchDevice: meta.isTouch
    });

    setLatestFingerAnalysis(analysis);
    setIsScanningActive(true);
    setTimeout(() => setIsScanningActive(false), 1400);

    const point: DragTelemetryPoint = {
      digit,
      startTime: now - meta.durationMs,
      endTime: now,
      durationMs: meta.durationMs,
      startPos: meta.startPos,
      endPos: meta.endPos,
      distancePx: meta.distancePx,
      velocity: meta.velocity,
      angleDeg: meta.angleDeg,
      interDigitDelayMs: interDigitDelay,
      droppedInside: true,
      contactAreaMm2: analysis.contactAreaMm2,
      touchPressure: analysis.pressure,
      estimatedFinger: analysis.fingerName,
      estimatedConfidence: analysis.confidence
    };

    setDragTelemetry((prev) => [...prev, point]);
    setEnteredDigits((prev) => [...prev, digit]);
    setLastDropTime(now);
  };

  // Accidental drop outside circular target
  const handleAccidentalOutsideDrop = () => {
    setDropFailures((prev) => prev + 1);
  };

  // Backspace undo
  const handleBackspace = () => {
    if (enteredDigits.length > 0) {
      setEnteredDigits((prev) => prev.slice(0, -1));
      setDragTelemetry((prev) => prev.slice(0, -1));
    }
  };

  // Clear all entered digits
  const handleClear = () => {
    setEnteredDigits([]);
    setDragTelemetry([]);
    setLatestFingerAnalysis(null);
  };

  // --- HTML5 Desktop Drag & Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, digit: string) => {
    e.dataTransfer.setData('text/plain', digit);
    e.dataTransfer.effectAllowed = 'copyMove';
    setActiveDragDigit(digit);
    (e.target as HTMLElement).setAttribute('data-drag-start', Date.now().toString());
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setActiveDragDigit(null);
    setIsTargetHovered(false);
  };

  const handleTargetDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isTargetHovered) setIsTargetHovered(true);
  };

  const handleTargetDragLeave = (e: React.DragEvent) => {
    setIsTargetHovered(false);
  };

  const handleTargetDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsTargetHovered(false);
    const digit = e.dataTransfer.getData('text/plain') || activeDragDigit;
    if (!digit) return;

    const targetRect = targetCircleRef.current?.getBoundingClientRect();
    const dropX = e.clientX;
    const dropY = e.clientY;

    const startX = dropX - (Math.random() * 40 - 20);
    const startY = dropY - 200;
    const distance = Math.hypot(dropX - startX, dropY - startY);
    const duration = 350 + Math.floor(Math.random() * 120);

    recordDigitEntry(digit, {
      durationMs: duration,
      startPos: { x: startX, y: startY },
      endPos: { x: dropX, y: dropY },
      distancePx: distance,
      velocity: Number((distance / duration).toFixed(2)),
      angleDeg: 90,
      radiusX: 18 + Math.floor(Math.random() * 8),
      radiusY: 24 + Math.floor(Math.random() * 8),
      force: 0.68,
      isTouch: false
    });
  };

  // --- Mobile Touch Event Drag Handlers ---
  const handleTouchStart = (e: React.TouchEvent, digit: string) => {
    const touch = e.touches[0];
    const radiusX = (touch as any).radiusX || 19;
    const radiusY = (touch as any).radiusY || 25;
    const force = (touch as any).force || 0.72;
    setActiveTouchDrag({
      digit,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      radiusX,
      radiusY,
      force,
      startTime: Date.now()
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!activeTouchDrag) return;
    const touch = e.touches[0];
    setActiveTouchDrag((prev) => prev ? { ...prev, currentX: touch.clientX, currentY: touch.clientY } : null);

    // Collision detection with target circle
    if (targetCircleRef.current) {
      const rect = targetCircleRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = rect.width / 2;
      const distToCenter = Math.hypot(touch.clientX - centerX, touch.clientY - centerY);
      setIsTargetHovered(distToCenter <= radius);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!activeTouchDrag) return;
    const { digit, startX, startY, currentX, currentY, startTime, radiusX, radiusY, force } = activeTouchDrag;
    const endTime = Date.now();
    const duration = Math.max(50, endTime - startTime);
    const distance = Math.hypot(currentX - startX, currentY - startY);

    let droppedInTarget = false;
    if (targetCircleRef.current) {
      const rect = targetCircleRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = rect.width / 2;
      const distToCenter = Math.hypot(currentX - centerX, currentY - centerY);
      if (distToCenter <= radius) {
        droppedInTarget = true;
      }
    }

    if (droppedInTarget) {
      recordDigitEntry(digit, {
        durationMs: duration,
        startPos: { x: startX, y: startY },
        endPos: { x: currentX, y: currentY },
        distancePx: distance,
        velocity: Number((distance / duration).toFixed(2)),
        angleDeg: Math.round((Math.atan2(currentY - startY, currentX - startX) * 180) / Math.PI),
        radiusX: radiusX || 19,
        radiusY: radiusY || 25,
        force: force || 0.72,
        isTouch: true
      });
    } else {
      handleAccidentalOutsideDrop();
    }

    setActiveTouchDrag(null);
    setIsTargetHovered(false);
  };

  // --- AUTOMATIC 4-STAGE ANALYSIS FLOW ---
  const executeAutomaticAnalysisFlow = async () => {
    if (!profile) return;
    setAnalysisError(null);

    const enteredPinString = enteredDigits.join('');

    // STAGE 1: Verify PIN & Check Rate Limiting
    setCurrentStep('VERIFYING_PIN');
    await new Promise((r) => setTimeout(r, 600));

    const pinVerification = await PayGuardProfileService.verifyPin(enteredPinString);
    if (!pinVerification.valid) {
      if (pinVerification.isLockedOut) {
        setAnalysisError(`Too many failed attempts. Security lockout active for ${pinVerification.lockoutRemainingSec}s.`);
      } else {
        setAnalysisError(`Incorrect Demo PIN. ${pinVerification.attemptsRemaining} attempts remaining.`);
      }
      setCurrentStep('COMPLETED');
      // Update local profile state
      loadProfile();
      return;
    }

    // STAGE 2: Biometric Authentication
    setCurrentStep('BIOMETRIC_AUTH');
    await new Promise((r) => setTimeout(r, 500));

    const biometricResult: BiometricAuthResult = await NativeBiometricBridge.authenticateBiometrics(
      `Authorize demo payment of $${order.amount.toFixed(2)} to ${order.merchantName}`,
      profile.biometricMode
    );

    // STAGE 3: Behavioral Telemetry & AI Risk Engine
    setCurrentStep('BEHAVIORAL_AI');
    await new Promise((r) => setTimeout(r, 700));

    const evaluation = PayGuardRiskEngine.evaluateRisk({
      profile,
      pinValid: pinVerification.valid,
      biometricResult,
      telemetryPoints: dragTelemetry,
      dropFailuresCount: dropFailures,
      transactionAmount: order.amount,
      merchantName: order.merchantName,
      isOfflineDemo: isOfflineMode
    });
    setRiskResult(evaluation);

    // Update behavioral baseline with legitimate session data
    if (evaluation.decision === 'ALLOW') {
      await PayGuardProfileService.updateBehavioralBaseline(dragTelemetry, dropFailures);
    }

    // STAGE 4: PayPal Sandbox Order Capture
    setCurrentStep('PAYPAL_CAPTURE');
    await new Promise((r) => setTimeout(r, 650));

    const ppResult = await PayPalSandboxService.executeOrder(order, evaluation.decision === 'ALLOW');
    setPaypalResult(ppResult);

    setCurrentStep('COMPLETED');
  };

  const handleResetForNewPayment = () => {
    setEnteredDigits([]);
    setDragTelemetry([]);
    setDropFailures(0);
    setCurrentStep('IDLE');
    setRiskResult(null);
    setPaypalResult(null);
    setAnalysisError(null);
  };

  const handleManualLockoutReset = async () => {
    await PayGuardProfileService.resetLockout();
    await loadProfile();
    handleResetForNewPayment();
  };

  if (loading || !profile) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
        Loading PayGuard Authentication Sandbox...
      </div>
    );
  }

  const isLockedOut = profile.lockoutUntil && profile.lockoutUntil > Date.now();

  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '1rem',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, -apple-system, sans-serif'
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        // Accidental drop outside circular target
        if (targetCircleRef.current && !targetCircleRef.current.contains(e.target as Node)) {
          handleAccidentalOutsideDrop();
        }
      }}
    >
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <button
          onClick={() => navigate('/enrollment')}
          style={{
            fontSize: '0.8rem',
            color: '#00457C',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.3rem 0.6rem',
            backgroundColor: '#EBF5FB',
            borderRadius: '6px'
          }}
        >
          ⚙️ 10-Finger Profile
        </button>

        {/* TEST MODE & Offline Demo Pill */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              padding: '0.2rem 0.5rem',
              borderRadius: '999px',
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              border: '1px solid #FCD34D'
            }}
          >
            TEST MODE
          </span>
          <button
            onClick={() => {
              const next = !isOfflineMode;
              setIsOfflineMode(next);
              PayPalSandboxService.setOfflineMode(next);
            }}
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.2rem 0.5rem',
              borderRadius: '999px',
              backgroundColor: isOfflineMode ? '#F1F5F9' : '#ECFDF5',
              color: isOfflineMode ? '#475569' : '#047857',
              border: `1px solid ${isOfflineMode ? '#CBD5E1' : '#A7F3D0'}`
            }}
            title="Toggle between Offline Demo Mode and Live PayPal Sandbox"
          >
            {isOfflineMode ? 'OFFLINE DEMO' : 'LIVE SANDBOX'}
          </button>
        </div>
      </div>

      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              backgroundColor: '#00457C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.9rem'
            }}
          >
            P
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#00457C', letterSpacing: '0.04em' }}>
            PAYGUARD
          </span>
          <span style={{ fontSize: '0.8rem', color: '#0079C1', fontWeight: 700 }}>SANDBOX</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.15rem' }}>
          Drag-To-Center Touchscreen Payment Authentication
        </div>
      </div>

      {/* UPPER SECTION: Payment Summary Card */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          marginBottom: '1rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Merchant
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
              {order.merchantName}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.1rem' }}>
              {order.itemDescription}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Amount
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#00457C' }}>
              ${order.amount.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748B' }}>USD</div>
          </div>
        </div>

        {/* Demo PIN Instruction Callout */}
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.45rem 0.65rem',
            backgroundColor: '#F8FAFC',
            borderRadius: '6px',
            borderLeft: '3px solid #0079C1',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: '#334155'
          }}
        >
          <span>Demo PIN: <strong style={{ letterSpacing: '0.1em', color: '#00457C' }}>2 3 4 6 5 6</strong></span>
          <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Drag each digit to target</span>
        </div>
      </div>

      {/* Lockout Warning Banner if Active */}
      {isLockedOut && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            color: '#991B1B',
            fontSize: '0.8rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <strong>Security Lockout:</strong> Too many failed PIN entries.
          </div>
          <button
            onClick={handleManualLockoutReset}
            style={{
              padding: '0.25rem 0.6rem',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700
            }}
          >
            Reset Lockout
          </button>
        </div>
      )}

      {/* UPPER SECTION: Draggable Digits 0-9 (Two Rows: [1 2 3 4 5] & [6 7 8 9 0]) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '1rem 0.75rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          marginBottom: '1rem'
        }}
      >
        <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#64748B', fontWeight: 600, marginBottom: '0.6rem' }}>
          DRAGGABLE DIGITS (TOUCH OR MOUSE DRAG)
        </div>

        {/* Row 1: Digits 1 to 5 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {['1', '2', '3', '4', '5'].map((d) => (
            <div
              key={d}
              draggable={!isLockedOut && currentStep === 'IDLE'}
              onDragStart={(e) => handleDragStart(e, d)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, d)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={() => {
                // Click fallback for accessibility
                if (!isLockedOut && currentStep === 'IDLE') {
                  recordDigitEntry(d, {
                    durationMs: 320,
                    startPos: { x: 200, y: 150 },
                    endPos: { x: 200, y: 350 },
                    distancePx: 200,
                    velocity: 0.62,
                    angleDeg: 90
                  });
                }
              }}
              style={{
                height: '52px',
                backgroundColor: '#F0F7FF',
                border: '1.5px solid #BFDBFE',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#002C6C',
                cursor: isLockedOut ? 'not-allowed' : 'grab',
                userSelect: 'none',
                touchAction: 'none',
                boxShadow: '0 2px 4px rgba(0, 69, 124, 0.06)',
                transition: 'transform 0.1s, box-shadow 0.1s'
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Row 2: Digits 6 to 0 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {['6', '7', '8', '9', '0'].map((d) => (
            <div
              key={d}
              draggable={!isLockedOut && currentStep === 'IDLE'}
              onDragStart={(e) => handleDragStart(e, d)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, d)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={() => {
                if (!isLockedOut && currentStep === 'IDLE') {
                  recordDigitEntry(d, {
                    durationMs: 320,
                    startPos: { x: 200, y: 200 },
                    endPos: { x: 200, y: 350 },
                    distancePx: 150,
                    velocity: 0.55,
                    angleDeg: 90
                  });
                }
              }}
              style={{
                height: '52px',
                backgroundColor: '#F0F7FF',
                border: '1.5px solid #BFDBFE',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#002C6C',
                cursor: isLockedOut ? 'not-allowed' : 'grab',
                userSelect: 'none',
                touchAction: 'none',
                boxShadow: '0 2px 4px rgba(0, 69, 124, 0.06)'
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Curved Dotted Direction Arrows Indicator (matching the user's mockup) */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
          <svg width="100%" height="24" viewBox="0 0 300 24" fill="none" style={{ opacity: 0.65 }}>
            <path d="M 20 4 Q 100 20 150 22" stroke="#0079C1" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M 70 4 Q 120 18 150 22" stroke="#0079C1" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M 150 4 L 150 22" stroke="#0079C1" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M 230 4 Q 180 18 150 22" stroke="#0079C1" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M 280 4 Q 200 20 150 22" stroke="#0079C1" strokeWidth="2" strokeDasharray="3 3" />
            <polygon points="146,20 150,24 154,20" fill="#0079C1" />
          </svg>
        </div>
      </div>

      {/* LOWER-MIDDLE SECTION: Large Concentric Circular Target ("DRAG DIGITS HERE") */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem 0',
          position: 'relative'
        }}
      >
        {/* Outer Glow Wave */}
        <div
          ref={targetCircleRef}
          onDragOver={handleTargetDragOver}
          onDragLeave={handleTargetDragLeave}
          onDrop={handleTargetDrop}
          style={{
            width: '190px',
            height: '190px',
            borderRadius: '50%',
            backgroundColor: isTargetHovered ? '#E0F2FE' : '#F0F9FF',
            border: `2px solid ${isTargetHovered ? '#0284C7' : '#BAE6FD'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: isTargetHovered
              ? '0 0 32px rgba(2, 132, 199, 0.45), inset 0 0 16px rgba(56, 189, 248, 0.25)'
              : '0 0 18px rgba(186, 230, 253, 0.4)',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
        >
          {/* Middle Concentric Ring */}
          <div
            style={{
              width: '154px',
              height: '154px',
              borderRadius: '50%',
              backgroundColor: isTargetHovered ? '#BAE6FD' : '#E0F2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
          >
            {/* Inner Vibrant Radial Blue Circle */}
            <div
              style={{
                width: '122px',
                height: '122px',
                borderRadius: '50%',
                background: isTargetHovered || isScanningActive
                  ? 'radial-gradient(circle, #0284C7 0%, #0369A1 70%, #075985 100%)'
                  : 'radial-gradient(circle, #0079C1 0%, #005A9E 70%, #00457C 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: isScanningActive
                  ? '0 0 24px rgba(56, 189, 248, 0.6), 0 4px 14px rgba(0, 69, 124, 0.4)'
                  : '0 4px 14px rgba(0, 69, 124, 0.35)',
                transition: 'transform 0.15s ease, box-shadow 0.2s ease',
                transform: isTargetHovered || isScanningActive ? 'scale(1.05)' : 'scale(1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Biometric Laser Scanning Line Animation when digit lands */}
              {isScanningActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    backgroundColor: '#38BDF8',
                    boxShadow: '0 0 10px #38BDF8, 0 0 20px #0284C7',
                    animation: 'scannerSweep 1.2s ease-in-out infinite'
                  }}
                />
              )}

              {/* Fingerprint Icon SVG */}
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isScanningActive ? 1 : 0.9 }}>
                <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
                <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
                <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
                <path d="M2 12a10 10 0 0 1 18-6" />
                <path d="M2 16h.01" />
                <path d="M21.8 16c.2-2 .131-5.354 0-6" />
                <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
                <path d="M8.65 22c.21-.66.45-1.32.57-2" />
                <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
              </svg>

              <div style={{ fontSize: '0.82rem', fontWeight: 800, marginTop: '0.2rem', letterSpacing: '0.02em' }}>
                {isScanningActive ? 'Analyzing...' : 'Drag here'}
              </div>
              <div style={{ fontSize: '0.62rem', opacity: 0.9, fontWeight: 500 }}>
                {isScanningActive ? 'Touch Surface Scan' : '(Center of screen)'}
              </div>
            </div>
          </div>
        </div>

        {/* REAL-TIME FINGERPRINT & TOUCH SURFACE HUD */}
        {latestFingerAnalysis ? (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#F0F9FF',
              borderRadius: '12px',
              border: '1.5px solid #7DD3FC',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.12)',
              textAlign: 'left',
              width: '100%',
              maxWidth: '420px',
              animation: 'fadeIn 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '1.15rem' }}>🖐️</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#00457C' }}>
                  Analyzed: {latestFingerAnalysis.fingerName}
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  backgroundColor: '#ECFDF5',
                  color: '#059669',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '999px',
                  border: '1px solid #A7F3D0'
                }}
              >
                {latestFingerAnalysis.confidence}% Finger Match
              </span>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#334155', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.2rem' }}>
              <span>Contact Area: <strong style={{ color: '#00457C' }}>{latestFingerAnalysis.contactAreaMm2} mm²</strong></span>
              <span>Pressure: <strong>{latestFingerAnalysis.pressure}</strong></span>
              <span>Oval: <strong>{latestFingerAnalysis.contactRadiusX}×{latestFingerAnalysis.contactRadiusY}px</strong></span>
            </div>

            <div style={{ fontSize: '0.7rem', color: '#0284C7', marginTop: '0.35rem', lineHeight: 1.4 }}>
              <strong>Biometric Morphometry:</strong> {latestFingerAnalysis.description}
            </div>

            <div style={{ fontSize: '0.65rem', color: '#64748B', marginTop: '0.25rem', borderTop: '1px solid #E0F2FE', paddingTop: '0.25rem' }}>
              ℹ️ Touchscreen digitizer analyzes contact surface geometry. Cryptographic identity is verified by the device OS.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '0.6rem', fontSize: '0.68rem', color: '#64748B', textAlign: 'center' }}>
            Touchscreen interaction target — drag any digit down to analyze which finger was used
          </div>
        )}
      </div>

      {/* BOTTOM SECTION: PIN Progress Indicators & Controls */}
      <div
        style={{
          marginTop: 'auto',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '1.25rem 1rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}
      >
        {/* 6 PIN Position Indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = index < enteredDigits.length;
            return (
              <div
                key={index}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: `2px solid ${isFilled ? '#00457C' : '#CBD5E1'}`,
                  backgroundColor: isFilled ? '#00457C' : 'transparent',
                  boxShadow: isFilled ? '0 0 8px rgba(0, 69, 124, 0.4)' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isFilled ? 'scale(1.15)' : 'scale(1)'
                }}
              />
            );
          })}
        </div>

        {/* Digit Count & Drop Failures Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748B', marginBottom: '0.75rem' }}>
          <span>
            Entered: <strong>{enteredDigits.length} / 6</strong>
          </span>
          {dropFailures > 0 && (
            <span style={{ color: '#D97706', fontWeight: 600 }}>
              Outside target drops: {dropFailures}
            </span>
          )}
          <span>
            Attempt: <strong>{profile.failedPinAttempts + 1} / 3</strong>
          </span>
        </div>

        {/* PIN Controls: Backspace & Clear */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            onClick={handleBackspace}
            disabled={enteredDigits.length === 0 || currentStep !== 'IDLE'}
            style={{
              flex: 1,
              padding: '0.6rem',
              backgroundColor: '#F1F5F9',
              color: '#334155',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              cursor: enteredDigits.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            ⌫ Backspace
          </button>
          <button
            onClick={handleClear}
            disabled={enteredDigits.length === 0 || currentStep !== 'IDLE'}
            style={{
              padding: '0.6rem 1rem',
              backgroundColor: '#F1F5F9',
              color: '#64748B',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              cursor: enteredDigits.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Clear
          </button>
        </div>

        {/* Security & Zero Logging Guarantee */}
        <div
          style={{
            fontSize: '0.7rem',
            color: '#059669',
            backgroundColor: '#ECFDF5',
            padding: '0.4rem 0.6rem',
            borderRadius: '6px',
            textAlign: 'center',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem'
          }}
        >
          <span>🛡️</span>
          <span>Zero PIN Plaintext Logging • Cryptographic Hash Matching</span>
        </div>

        {/* Cancel and Back to Dashboard */}
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/')}
            style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}
          >
            Cancel Payment & Return
          </button>
        </div>
      </div>

      {/* AUTOMATIC ANALYSIS OVERLAY MODAL */}
      {currentStep !== 'IDLE' && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(10, 25, 47, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 100
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '18px',
              padding: '2rem 1.5rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              textAlign: 'center'
            }}
          >
            {/* Header / Current Step Animation */}
            {currentStep !== 'COMPLETED' ? (
              <div>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#EBF5FB',
                    color: '#0079C1',
                    fontSize: '1.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                    animation: 'pulse 1.5s infinite'
                  }}
                >
                  {currentStep === 'VERIFYING_PIN' && '🔑'}
                  {currentStep === 'BIOMETRIC_AUTH' && '🖐️'}
                  {currentStep === 'BEHAVIORAL_AI' && '🧠'}
                  {currentStep === 'PAYPAL_CAPTURE' && '💳'}
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A192F', margin: '0 0 0.5rem' }}>
                  {currentStep === 'VERIFYING_PIN' && 'Verifying Encrypted PIN...'}
                  {currentStep === 'BIOMETRIC_AUTH' && 'Requesting Biometric Assertion...'}
                  {currentStep === 'BEHAVIORAL_AI' && 'AI Behavioral Anomaly Scoring...'}
                  {currentStep === 'PAYPAL_CAPTURE' && 'Capturing PayPal Sandbox Payment...'}
                </h3>

                <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '0 0 1.5rem' }}>
                  Automatic analysis executing across 4 security dimensions
                </p>

                {/* Step Pipeline Progress */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', textAlign: 'left', marginBottom: '1rem' }}>
                  {[
                    { key: 'VERIFYING_PIN', label: '1. PIN Validation & Rate Limiter' },
                    { key: 'BIOMETRIC_AUTH', label: '2. Operating System Biometric Check' },
                    { key: 'BEHAVIORAL_AI', label: '3. Behavioral Telemetry & Risk Engine' },
                    { key: 'PAYPAL_CAPTURE', label: '4. PayPal Sandbox Settlement' }
                  ].map((step, idx) => {
                    const stepOrder = ['VERIFYING_PIN', 'BIOMETRIC_AUTH', 'BEHAVIORAL_AI', 'PAYPAL_CAPTURE', 'COMPLETED'];
                    const currentIdx = stepOrder.indexOf(currentStep);
                    const isDone = currentIdx > idx;
                    const isCurrent = currentStep === step.key;

                    return (
                      <div
                        key={step.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          backgroundColor: isCurrent ? '#F0F9FF' : '#F8FAFC',
                          border: `1px solid ${isCurrent ? '#BAE6FD' : '#E2E8F0'}`,
                          fontSize: '0.8rem',
                          fontWeight: isCurrent ? 700 : 500,
                          color: isDone ? '#059669' : isCurrent ? '#0079C1' : '#64748B'
                        }}
                      >
                        <span>{isDone ? '✓' : isCurrent ? '●' : '○'}</span>
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* COMPLETED STEP: Results Display */
              <div>
                {/* Decision Icon */}
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: analysisError || riskResult?.decision === 'BLOCK'
                      ? '#FEF2F2'
                      : riskResult?.decision === 'STEP_UP_CHALLENGE'
                      ? '#FFFBEB'
                      : '#ECFDF5',
                    color: analysisError || riskResult?.decision === 'BLOCK'
                      ? '#DC2626'
                      : riskResult?.decision === 'STEP_UP_CHALLENGE'
                      ? '#D97706'
                      : '#059669',
                    fontSize: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem'
                  }}
                >
                  {analysisError || riskResult?.decision === 'BLOCK'
                    ? '✕'
                    : riskResult?.decision === 'STEP_UP_CHALLENGE'
                    ? '⚠️'
                    : '✓'}
                </div>

                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0A192F', margin: '0 0 0.35rem' }}>
                  {analysisError
                    ? 'Authentication Blocked'
                    : riskResult?.decision === 'ALLOW'
                    ? 'Payment Authorized & Captured'
                    : riskResult?.decision === 'STEP_UP_CHALLENGE'
                    ? 'Additional Verification Required'
                    : 'Payment Blocked by Risk Policy'}
                </h3>

                <div
                  style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    marginBottom: '1rem',
                    backgroundColor: riskResult?.riskLevel === 'LOW'
                      ? '#ECFDF5'
                      : riskResult?.riskLevel === 'MEDIUM'
                      ? '#FFFBEB'
                      : '#FEF2F2',
                    color: riskResult?.riskLevel === 'LOW'
                      ? '#059669'
                      : riskResult?.riskLevel === 'MEDIUM'
                      ? '#D97706'
                      : '#DC2626'
                  }}
                >
                  RISK ASSESSMENT: {riskResult?.riskLevel || 'HIGH'} (SCORE: {riskResult?.riskScore ?? 80}/100)
                </div>

                {/* Explanation text */}
                <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5, margin: '0 0 1rem' }}>
                  {analysisError || riskResult?.explanation}
                </p>

                {/* Telemetry Breakdown Details */}
                {riskResult && (
                  <div
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: '10px',
                      padding: '0.85rem',
                      textAlign: 'left',
                      fontSize: '0.78rem',
                      marginBottom: '1.25rem',
                      border: '1px solid #E2E8F0'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#0A192F', marginBottom: '0.4rem' }}>
                      Behavioral Telemetry & Security Signals:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', color: '#475569' }}>
                      <div>Avg Drag: <strong>{riskResult.metrics.avgDragDurationMs}ms</strong></div>
                      <div>Inter-delay: <strong>{riskResult.metrics.avgInterDigitDelayMs}ms</strong></div>
                      <div>Velocity: <strong>{riskResult.metrics.dragVelocityAvg} px/ms</strong></div>
                      <div>Outside drops: <strong>{riskResult.metrics.droppedFailures}</strong></div>
                    </div>

                    {/* Analyzed Digits & Fingers Breakdown */}
                    {dragTelemetry.length > 0 && (
                      <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid #E2E8F0' }}>
                        <div style={{ fontWeight: 700, color: '#0A192F', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span>🖐️</span> Analyzed Finger per Digit:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {dragTelemetry.map((pt, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: '#FFFFFF',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #E2E8F0',
                                fontSize: '0.72rem'
                              }}
                            >
                              <span>
                                Digit {idx + 1} (<strong>{pt.digit}</strong>): <strong style={{ color: '#00457C' }}>{pt.estimatedFinger || 'Right Index Finger'}</strong>
                              </span>
                              <span style={{ color: '#0079C1', fontWeight: 600 }}>
                                {pt.contactAreaMm2 || 198} mm² • {pt.estimatedConfidence || 92}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {paypalResult && (
                      <div style={{ marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid #E2E8F0' }}>
                        <div style={{ fontWeight: 700, color: '#00457C' }}>
                          PayPal Settlement ({paypalResult.mode}):
                        </div>
                        <div style={{ color: '#059669', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          Capture ID: {paypalResult.captureId || 'N/A'}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleResetForNewPayment}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: '#00457C',
                      color: '#FFFFFF',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      borderRadius: '8px'
                    }}
                  >
                    Test Another Demo Payment
                  </button>
                  <button
                    onClick={() => navigate('/enrollment')}
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: '#F1F5F9',
                      color: '#334155',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1'
                    }}
                  >
                    Review Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
