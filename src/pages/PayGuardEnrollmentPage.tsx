import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PayGuardProfileService,
  TEN_FINGER_DEFINITIONS
} from '../services/payguardProfileService';
import { NativeBiometricBridge, BiometricAuthResult } from '../services/nativeBiometricBridge';
import {
  PayGuardUserProfile,
  FingerPosition,
  ProfileAuthMode,
  BiometricHardwareState
} from '../types/payguardAuth';

export const PayGuardEnrollmentPage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PayGuardUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHand, setSelectedHand] = useState<'ALL' | 'LEFT' | 'RIGHT'>('ALL');
  const [activeMode, setActiveMode] = useState<ProfileAuthMode>('SIMULATION');
  const [testingBiometrics, setTestingBiometrics] = useState(false);
  const [bioTestResult, setBioTestResult] = useState<BiometricAuthResult | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [settingsGuidance, setSettingsGuidance] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const p = await PayGuardProfileService.getProfile();
    setProfile(p);
    setActiveMode(p.biometricMode);
    setLoading(false);
  };

  const handleModeChange = async (mode: ProfileAuthMode) => {
    setActiveMode(mode);
    if (!profile) return;
    const updated = await PayGuardProfileService.enrollAllFingers(mode);
    setProfile({ ...updated });
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  const handleTestBiometrics = async () => {
    setTestingBiometrics(true);
    setBioTestResult(null);
    try {
      const res = await NativeBiometricBridge.authenticateBiometrics(
        'Verify your device biometric profile for PayGuard',
        activeMode
      );
      setBioTestResult(res);
      if (res.success && profile) {
        // Mark active fingers as linked
        const updated = await PayGuardProfileService.enrollAllFingers(activeMode);
        setProfile({ ...updated });
      }
    } finally {
      setTestingBiometrics(false);
    }
  };

  const handleOpenSettings = () => {
    const info = NativeBiometricBridge.openDeviceBiometricSettings();
    setSettingsGuidance(info.details);
  };

  const toggleIndividualFinger = async (pos: FingerPosition) => {
    if (!profile) return;
    const currentStatus = profile.fingerProfiles[pos]?.status;
    const nextStatus = currentStatus === 'NOT_ENROLLED'
      ? (activeMode === 'REAL_BIOMETRIC' ? 'OS_BIOMETRIC_LINKED' : 'SIMULATED_ENROLLED')
      : 'NOT_ENROLLED';

    const updated = await PayGuardProfileService.updateFingerStatus(pos, nextStatus);
    setProfile({ ...updated });
  };

  if (loading || !profile) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
        Loading PayGuard security profile...
      </div>
    );
  }

  const enrolledCount = Object.values(profile.fingerProfiles).filter(
    (f) => f.status !== 'NOT_ENROLLED'
  ).length;

  const filteredFingers = TEN_FINGER_DEFINITIONS.filter(
    (f) => selectedHand === 'ALL' || f.hand === selectedHand
  );

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Top Banner / Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/payguard-auth')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#00457C',
            fontWeight: 600,
            fontSize: '0.9rem',
            padding: '0.4rem 0.8rem',
            backgroundColor: '#EBF5FB',
            borderRadius: '6px'
          }}
        >
          ← Go to Drag & Pay Auth
        </button>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '0.25rem 0.6rem',
            borderRadius: '999px',
            backgroundColor: profile.setupCompleted ? '#ECFDF5' : '#FFFBEB',
            color: profile.setupCompleted ? '#059669' : '#D97706',
            border: `1px solid ${profile.setupCompleted ? '#A7F3D0' : '#FDE68A'}`
          }}
        >
          {profile.setupCompleted ? 'PROFILE ACTIVE & ENROLLED' : 'SETUP INCOMPLETE'}
        </span>
      </div>

      {/* Main Header */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '2rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          marginBottom: '1.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#00457C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: '1.3rem'
            }}
          >
            🖐️
          </div>
          <div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0A192F', margin: 0 }}>
              Set Up Your PayGuard Security Profile
            </h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748B' }}>
              Multi-finger profile baseline with genuine operating-system biometric integration
            </p>
          </div>
        </div>

        {/* Honest Architectural Disclosure Callout */}
        <div
          style={{
            marginTop: '1.25rem',
            padding: '1rem 1.25rem',
            backgroundColor: '#F8FAFC',
            borderRadius: '10px',
            borderLeft: '4px solid #0079C1',
            fontSize: '0.85rem',
            color: '#334155',
            lineHeight: 1.55
          }}
        >
          <div style={{ fontWeight: 700, color: '#00457C', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>ℹ️</span> Honest Biometric Architecture & API Limitations
          </div>
          <p style={{ margin: 0 }}>
            Standard operating system APIs (AndroidX <code>BiometricPrompt</code> and WebAuthn) never expose raw fingerprint images, biometric templates, or individual finger identities to apps. They return only a cryptographic attestation of identity. 
            PayGuard <strong>never pretends a touchscreen captured a fingerprint</strong>, separating genuine OS biometric checks from simulated demonstration profiles.
          </p>
        </div>

        {/* Mode Selector */}
        <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>
            Authentication Mode:
          </div>
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#F1F5F9',
              padding: '0.25rem',
              borderRadius: '8px'
            }}
          >
            <button
              onClick={() => handleModeChange('SIMULATION')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: activeMode === 'SIMULATION' ? '#00457C' : 'transparent',
                color: activeMode === 'SIMULATION' ? '#FFFFFF' : '#475569',
                transition: 'all 0.2s'
              }}
            >
              🧪 Simulation Mode (10 Sample Finger Profiles)
            </button>
            <button
              onClick={() => handleModeChange('REAL_BIOMETRIC')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: activeMode === 'REAL_BIOMETRIC' ? '#00457C' : 'transparent',
                color: activeMode === 'REAL_BIOMETRIC' ? '#FFFFFF' : '#475569',
                transition: 'all 0.2s'
              }}
            >
              🔒 Genuine OS Biometric Mode
            </button>
          </div>
        </div>

        {/* Hardware Status & Test Bar */}
        <div
          style={{
            marginTop: '1.25rem',
            padding: '1rem',
            backgroundColor: '#F8FAFC',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Device Biometric Hardware Capability
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0A192F', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: profile.biometricHardware === 'AVAILABLE' ? '#10B981' : '#F59E0B'
              }} />
              {profile.biometricHardware === 'AVAILABLE'
                ? 'Hardware Biometric Sensor Available (WebAuthn / Android Bridge)'
                : `Hardware State: ${profile.biometricHardware}`}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleOpenSettings}
              style={{
                padding: '0.5rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#00457C',
                backgroundColor: '#EBF5FB',
                border: '1px solid #CBD5E1',
                borderRadius: '6px'
              }}
            >
              ⚙️ Biometric Settings
            </button>
            <button
              onClick={handleTestBiometrics}
              disabled={testingBiometrics}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#FFFFFF',
                backgroundColor: '#0079C1',
                borderRadius: '6px',
                boxShadow: '0 2px 6px rgba(0, 121, 193, 0.3)'
              }}
            >
              {testingBiometrics ? 'Prompting OS...' : '🔑 Test System Biometric'}
            </button>
          </div>
        </div>

        {/* Biometric Settings Guidance Popup */}
        {settingsGuidance && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.85rem 1rem',
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#1E40AF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div><strong>Device Guidance:</strong> {settingsGuidance}</div>
            <button
              onClick={() => setSettingsGuidance(null)}
              style={{ fontWeight: 700, color: '#1E40AF', padding: '0.2rem 0.5rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Biometric Test Result Notification */}
        {bioTestResult && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              backgroundColor: bioTestResult.success ? '#ECFDF5' : '#FEF2F2',
              color: bioTestResult.success ? '#065F46' : '#991B1B',
              border: `1px solid ${bioTestResult.success ? '#A7F3D0' : '#FECACA'}`
            }}
          >
            <strong>{bioTestResult.success ? '✓ Biometric Verified:' : '✗ Biometric Check Not Passed:'}</strong>{' '}
            {bioTestResult.success
              ? `Cryptographic assertion validated via ${bioTestResult.platform} (${bioTestResult.isSimulated ? 'Simulated' : 'Hardware-backed'}).`
              : (bioTestResult.errorMessage || 'Authentication failed or dismissed.')}
          </div>
        )}

        {saveSuccessNotice && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              borderRadius: '6px',
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            ✓ Profile saved persistently to local secure store!
          </div>
        )}
      </div>

      {/* 10 Fingers Enrollment Dashboard */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '1.75rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0A192F', margin: 0 }}>
              Ten Finger Positions ({enrolledCount} of 10 Configured)
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '0.2rem' }}>
              Click any finger card to toggle individual enrollment status
            </div>
          </div>

          {/* Hand Filter */}
          <div style={{ display: 'flex', gap: '0.3rem', backgroundColor: '#F1F5F9', padding: '0.2rem', borderRadius: '6px' }}>
            {(['ALL', 'LEFT', 'RIGHT'] as const).map((hand) => (
              <button
                key={hand}
                onClick={() => setSelectedHand(hand)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: selectedHand === hand ? '#00457C' : 'transparent',
                  color: selectedHand === hand ? '#FFFFFF' : '#475569'
                }}
              >
                {hand === 'ALL' ? 'Both Hands' : `${hand} Hand`}
              </button>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: `${(enrolledCount / 10) * 100}%`,
              height: '100%',
              backgroundColor: '#0079C1',
              transition: 'width 0.3s ease'
            }}
          />
        </div>

        {/* 10 Finger Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1rem'
          }}
        >
          {filteredFingers.map((f) => {
            const item = profile.fingerProfiles[f.position];
            const isEnrolled = item?.status !== 'NOT_ENROLLED';
            const isSimulated = item?.status === 'SIMULATED_ENROLLED';

            return (
              <div
                key={f.position}
                onClick={() => toggleIndividualFinger(f.position)}
                style={{
                  border: `2px solid ${isEnrolled ? (isSimulated ? '#93C5FD' : '#A7F3D0') : '#E2E8F0'}`,
                  backgroundColor: isEnrolled ? (isSimulated ? '#F8FAFC' : '#F0FDF4') : '#FFFFFF',
                  borderRadius: '12px',
                  padding: '1.1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: isEnrolled ? '#00457C' : '#E2E8F0',
                        color: isEnrolled ? '#FFFFFF' : '#64748B',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {f.fingerNumber}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A' }}>
                      {f.name}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '999px',
                      backgroundColor: isEnrolled ? (isSimulated ? '#DBEAFE' : '#DCFCE7') : '#F1F5F9',
                      color: isEnrolled ? (isSimulated ? '#1E40AF' : '#166534') : '#64748B'
                    }}
                  >
                    {isEnrolled ? (isSimulated ? 'SIMULATED' : 'OS LINKED') : 'PENDING'}
                  </span>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '0.5rem' }}>
                  {item?.notes || 'Tap to configure status'}
                </div>

                {item?.simulationSampleId && (
                  <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#0079C1', backgroundColor: '#EBF5FB', padding: '0.2rem 0.4rem', borderRadius: '4px', display: 'inline-block' }}>
                    ID: {item.simulationSampleId}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Controls */}
        <div style={{ marginTop: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => handleModeChange(activeMode)}
            style={{
              padding: '0.7rem 1.5rem',
              backgroundColor: '#00457C',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.9rem',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 69, 124, 0.25)'
            }}
          >
            ✓ Save & Activate 10-Finger Profile
          </button>

          <button
            onClick={() => navigate('/payguard-auth')}
            style={{
              padding: '0.7rem 1.5rem',
              backgroundColor: '#0079C1',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.9rem',
              borderRadius: '8px'
            }}
          >
            Launch Drag-To-Center Payment Demo →
          </button>
        </div>
      </div>
    </div>
  );
};
