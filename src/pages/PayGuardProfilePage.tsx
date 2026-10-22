import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PayGuardProfileService,
  TEN_FINGER_DEFINITIONS
} from '../services/payguardProfileService';
import { PayGuardUserProfile } from '../types/payguardAuth';

export const PayGuardProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PayGuardUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const p = await PayGuardProfileService.getProfile();
    setProfile(p);
    setLoading(false);
  };

  const handleResetLockout = async () => {
    const updated = await PayGuardProfileService.resetLockout();
    setProfile({ ...updated });
    showNotice('Security lockout reset successfully.');
  };

  const handleDeleteProfile = async () => {
    if (window.confirm('Are you sure you want to delete your persistent PayGuard profile? Local credentials and baseline telemetry will be permanently wiped.')) {
      const fresh = await PayGuardProfileService.deleteProfile();
      setProfile({ ...fresh });
      showNotice('Profile securely wiped from local storage.');
    }
  };

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  if (loading || !profile) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
        Loading PayGuard security profile...
      </div>
    );
  }

  const isLockedOut = profile.lockoutUntil && profile.lockoutUntil > Date.now();

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header Bar */}
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
        <button
          onClick={() => navigate('/enrollment')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '0.9rem',
            padding: '0.4rem 0.9rem',
            backgroundColor: '#0079C1',
            borderRadius: '6px'
          }}
        >
          Edit 10-Finger Enrollment ⚙️
        </button>
      </div>

      {actionNotice && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: '#ECFDF5',
            color: '#065F46',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: '1px solid #A7F3D0'
          }}
        >
          ✓ {actionNotice}
        </div>
      )}

      {/* Main Profile Info Card */}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0A192F', margin: 0 }}>
              PayGuard Persistent Security Profile
            </h1>
            <div style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '0.2rem' }}>
              Profile ID: <code style={{ color: '#0079C1', fontWeight: 700 }}>{profile.profileId}</code> • Created: {new Date(profile.createdAt).toLocaleDateString()}
            </div>
          </div>

          <span
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 800,
              backgroundColor: profile.setupCompleted ? '#ECFDF5' : '#FFFBEB',
              color: profile.setupCompleted ? '#059669' : '#D97706',
              border: `1px solid ${profile.setupCompleted ? '#A7F3D0' : '#FDE68A'}`
            }}
          >
            {profile.setupCompleted ? 'PROFILE ACTIVE & SURVIVES RESTARTS' : 'ENROLLMENT INCOMPLETE'}
          </span>
        </div>

        {/* Security Parameters Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Authentication Mode
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0A192F', marginTop: '0.25rem' }}>
              {profile.biometricMode === 'SIMULATION' ? '🧪 Simulation Mode' : '🔒 Genuine OS Biometric'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
              {profile.biometricMode === 'SIMULATION' ? '10 sample profiles marked as simulated' : 'OS Platform Authenticator / Android Bridge'}
            </div>
          </div>

          <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Biometric Hardware State
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0A192F', marginTop: '0.25rem' }}>
              {profile.biometricHardware}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
              Evaluated via operating system API
            </div>
          </div>

          <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Demo PIN Security & Lockout
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: isLockedOut ? '#DC2626' : '#059669', marginTop: '0.25rem' }}>
              {isLockedOut ? 'LOCKED OUT' : 'OK (3 Attempts Max)'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
              Failed attempts: {profile.failedPinAttempts} / 3
            </div>
          </div>
        </div>

        {/* Behavioral Baseline Metadata */}
        <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '1.25rem', border: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0A192F', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>📊</span> Learned Behavioral Baseline Telemetry
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 1rem', lineHeight: 1.5 }}>
            Interaction telemetry continuously updates a personalized baseline model without storing biometric images or personal identifiers.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
            <div style={{ backgroundColor: '#FFFFFF', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>Avg Drag Duration</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#00457C', marginTop: '0.2rem' }}>
                {profile.behavioralBaseline.avgDragDurationMs} ms
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>Inter-Digit Delay</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#00457C', marginTop: '0.2rem' }}>
                {profile.behavioralBaseline.avgInterDigitDelayMs} ms
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>Avg Drag Velocity</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#00457C', marginTop: '0.2rem' }}>
                {profile.behavioralBaseline.avgDragVelocity} px/ms
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>Drop Failure Rate</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#00457C', marginTop: '0.2rem' }}>
                {(profile.behavioralBaseline.dropFailureRate * 100).toFixed(1)}%
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>Samples Collected</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#00457C', marginTop: '0.2rem' }}>
                {profile.behavioralBaseline.sampleCount} sessions
              </div>
            </div>
          </div>
        </div>

        {/* 10 Finger Status Summary */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0A192F', marginBottom: '0.75rem' }}>
            Configured Finger Positions (10 Total)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {TEN_FINGER_DEFINITIONS.map((f) => {
              const item = profile.fingerProfiles[f.position];
              const isEnrolled = item?.status !== 'NOT_ENROLLED';
              return (
                <div
                  key={f.position}
                  style={{
                    padding: '0.6rem 0.8rem',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8rem'
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#334155' }}>{f.name}</span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: isEnrolled ? '#059669' : '#64748B'
                    }}
                  >
                    {item?.status || 'PENDING'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Profile Management Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid #E2E8F0', paddingTop: '1.25rem' }}>
          {isLockedOut && (
            <button
              onClick={handleResetLockout}
              style={{
                padding: '0.6rem 1.2rem',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700
              }}
            >
              Reset Security Lockout
            </button>
          )}

          <button
            onClick={() => navigate('/enrollment')}
            style={{
              padding: '0.6rem 1.2rem',
              backgroundColor: '#00457C',
              color: '#FFFFFF',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700
            }}
          >
            Re-enroll Fingerprints / Change Mode
          </button>

          <button
            onClick={handleDeleteProfile}
            style={{
              padding: '0.6rem 1.2rem',
              backgroundColor: '#FFF1F2',
              color: '#E11D48',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              border: '1px solid #FECDD3'
            }}
          >
            🗑️ Securely Delete Local Profile Data
          </button>
        </div>
      </div>
    </div>
  );
};
