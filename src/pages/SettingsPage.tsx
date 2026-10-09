import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PayPalMark, ShieldCheckIcon, LockIcon } from '../components/common/Icons';
import { VoiceChallenge } from '../services/voiceIdentityService';

export const SettingsPage: React.FC = () => {
  const {
    user,
    userIdentity,
    updateUser,
    resetDemoData,
    paypalConnectionStatus,
    togglePayPalConnection,
    updateBudgetLimit,
    authorization,
    showToast,
    registerDevicePasskey,
    removeDevicePasskey,
    enrollVoiceIdentity,
    removeVoiceIdentity,
    updateIdentitySettings,
    verifyDevicePasskey,
    getNewVoiceChallenge,
    verifyVoiceChallenge
  } = useApp();

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [defaultLimit, setDefaultLimit] = useState(authorization?.maxAmount || 20000);
  const [defaultTxns, setDefaultTxns] = useState(authorization?.transactionLimit || 1);
  const [defaultExpiry, setDefaultExpiry] = useState(30);

  const [sessionTimeoutMins, setSessionTimeoutMins] = useState(15);
  const [isTogglingPayPal, setIsTogglingPayPal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isRegisteringDevice, setIsRegisteringDevice] = useState(false);
  const [isVerifyingPasskey, setIsVerifyingPasskey] = useState(false);

  // Voice Modals State
  const [showVoiceEnrollModal, setShowVoiceEnrollModal] = useState(false);
  const [enrollPhrase, setEnrollPhrase] = useState('PayGuard authorizes bounded payments');
  const [isEnrollingVoice, setIsEnrollingVoice] = useState(false);

  const [showVoiceChallengeModal, setShowVoiceChallengeModal] = useState(false);
  const [activeVoiceChallenge, setActiveVoiceChallenge] = useState<VoiceChallenge | null>(null);
  const [spokenVoiceInput, setSpokenVoiceInput] = useState('');
  const [isVerifyingVoice, setIsVerifyingVoice] = useState(false);
  const [voiceChallengeFeedback, setVoiceChallengeFeedback] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser(name, email);
    if (authorization && defaultLimit !== authorization.maxAmount) {
      updateBudgetLimit(defaultLimit);
    }
    showToast('Preferences and profile saved successfully.');
  };

  const handleTogglePayPal = async () => {
    setIsTogglingPayPal(true);
    setTimeout(async () => {
      await togglePayPalConnection();
      setIsTogglingPayPal(false);
    }, 400);
  };

  const handleRegisterPasskey = async () => {
    setIsRegisteringDevice(true);
    try {
      await registerDevicePasskey();
    } finally {
      setIsRegisteringDevice(false);
    }
  };

  const handleTestPasskey = async () => {
    setIsVerifyingPasskey(true);
    try {
      await verifyDevicePasskey();
    } finally {
      setIsVerifyingPasskey(false);
    }
  };

  const handleStartVoiceEnrollment = () => {
    setShowVoiceEnrollModal(true);
  };

  const handleConfirmVoiceEnrollment = async () => {
    setIsEnrollingVoice(true);
    try {
      await enrollVoiceIdentity(enrollPhrase);
      setShowVoiceEnrollModal(false);
    } finally {
      setIsEnrollingVoice(false);
    }
  };

  const handleStartVoiceChallenge = () => {
    const challenge = getNewVoiceChallenge();
    setActiveVoiceChallenge(challenge);
    setSpokenVoiceInput(challenge.phrase); // Pre-fill with matching phrase for demo convenience
    setVoiceChallengeFeedback(null);
    setShowVoiceChallengeModal(true);
  };

  const handleTestVoiceSubmit = async (simulateMismatch: boolean = false) => {
    if (!activeVoiceChallenge) return;
    setIsVerifyingVoice(true);
    try {
      const inputToTest = simulateMismatch ? "Authorize payment 9999" : spokenVoiceInput;
      const res = await verifyVoiceChallenge(activeVoiceChallenge, inputToTest);
      setVoiceChallengeFeedback(res.message);
      if (res.success) {
        setTimeout(() => setShowVoiceChallengeModal(false), 1800);
      }
    } finally {
      setIsVerifyingVoice(false);
    }
  };

  const handleConfirmReset = () => {
    resetDemoData();
    setShowResetConfirm(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '850px' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--paypal-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Human Identity & Enclave Bounds
          </span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--navy-dark)', letterSpacing: '-0.02em' }}>
          Settings
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
          Manage your verified human identity, device biometrics, auxiliary voice authorization, policy defaults, and PayPal Sandbox link.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {/* Section 1: User Identity Card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                  User Identity Profile
                </h2>
                <span className={userIdentity.identityStatus === 'VERIFIED' ? "badge badge-approved" : "badge badge-neutral"}>
                  {userIdentity.identityStatus === 'VERIFIED' ? "✓ Identity Verified" : "Unverified"}
                </span>
                <span className={userIdentity.deviceTrustStatus === 'TRUSTED' ? "badge badge-paypal" : "badge badge-neutral"}>
                  {userIdentity.deviceTrustStatus === 'TRUSTED' ? "🛡 Trusted Device" : "Untrusted Device"}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Human authority anchor. AI agents receive capability, but cannot impersonate this identity.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)'
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)'
                }}
                required
              />
            </div>
          </div>
        </div>

        {/* Section 2: Device Biometrics & Passkeys */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <LockIcon size={18} color="var(--paypal-blue)" />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                Device Biometrics & Passkeys (WebAuthn / FIDO2)
              </h2>
            </div>
            <span className={userIdentity.passkeyStatus === 'REGISTERED' ? "badge badge-approved" : "badge badge-neutral"}>
              {userIdentity.passkeyStatus === 'REGISTERED' ? `${userIdentity.registeredPasskeys.length} Registered` : 'Not Registered'}
            </span>
          </div>

          {/* Privacy & Security Disclosure Notice */}
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              color: '#1E3A8A',
              marginBottom: '1.25rem',
              lineHeight: 1.45
            }}
          >
            <strong>Biometric Privacy Invariant:</strong> PayGuard uses device-native biometric authentication via WebAuthn/FIDO2. <em>Your raw fingerprint or biometric template never leaves your device.</em> PayGuard only receives cryptographic assertions signed by your device enclave.
          </div>

          {/* Registered Devices List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {userIdentity.registeredPasskeys.map((pk) => (
              <div
                key={pk.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.85rem 1rem',
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                    💻 {pk.deviceName}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    Credential ID: <span className="mono">{pk.credentialId}</span> • Type: {pk.deviceType}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    Registered: {new Date(pk.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => removeDevicePasskey(pk.id)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #FECACA',
                      color: '#B91C1C',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleRegisterPasskey}
              disabled={isRegisteringDevice}
              style={{
                padding: '0.55rem 1.15rem',
                backgroundColor: 'var(--paypal-blue)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {isRegisteringDevice ? 'Registering Device...' : '+ Register this Device'}
            </button>

            <button
              type="button"
              onClick={handleTestPasskey}
              disabled={isVerifyingPasskey || userIdentity.registeredPasskeys.length === 0}
              style={{
                padding: '0.55rem 1.15rem',
                backgroundColor: '#FFFFFF',
                color: 'var(--navy-dark)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isVerifyingPasskey ? 'Verifying...' : '⚡ Test Device Passkey'}
            </button>
          </div>
        </div>

        {/* Section 3: Voice Identity Layer */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>🎙️</span>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                Voice Identity (Auxiliary Signal)
              </h2>
            </div>
            <span className={userIdentity.voiceEnrollmentStatus === 'ENROLLED' ? "badge badge-approved" : "badge badge-neutral"}>
              {userIdentity.voiceEnrollmentStatus === 'ENROLLED' ? "✓ Voice Enrolled" : "Not Enrolled"}
            </span>
          </div>

          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#FEF3C7',
              border: '1px solid #FCD34D',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              color: '#92400E',
              marginBottom: '1.25rem',
              lineHeight: 1.45
            }}
          >
            <strong>Voice Multi-Signal Notice:</strong> Voice is an auxiliary authorization signal. Voice alone does NOT guarantee identity. PayGuard enforces dynamic one-time challenge codes (e.g., <em>"Authorize payment 4821"</em>) to neutralize acoustic audio replay attacks.
          </div>

          {userIdentity.voiceProfile && (
            <div style={{ padding: '0.85rem 1rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                Enrolled Acoustic Profile: <span className="mono">{userIdentity.voiceProfile.profileId}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Enrolled Phrase: "{userIdentity.voiceProfile.phrasePattern}"
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                Verified Count: {userIdentity.voiceProfile.verifiedCount} • Enrolled: {new Date(userIdentity.voiceProfile.enrolledAt).toLocaleDateString()}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleStartVoiceEnrollment}
              style={{
                padding: '0.55rem 1.15rem',
                backgroundColor: 'var(--navy-dark)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {userIdentity.voiceEnrollmentStatus === 'ENROLLED' ? 'Re-Enroll Voice Profile' : '+ Enroll Voice Profile'}
            </button>

            {userIdentity.voiceEnrollmentStatus === 'ENROLLED' && (
              <>
                <button
                  type="button"
                  onClick={handleStartVoiceChallenge}
                  style={{
                    padding: '0.55rem 1.15rem',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--navy-dark)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Test Voice Challenge
                </button>

                <button
                  type="button"
                  onClick={removeVoiceIdentity}
                  style={{
                    padding: '0.55rem 1.15rem',
                    backgroundColor: '#FFFFFF',
                    color: '#B91C1C',
                    border: '1px solid #FECACA',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Remove Voice Profile
                </button>
              </>
            )}
          </div>
        </div>

        {/* Section 4: High-Risk Step-Up Policy Settings */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ShieldCheckIcon size={18} color="var(--paypal-blue)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
              Step-Up Policy & Risk Controls
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-dark)' }}>Require Passkey for High-Risk Payments</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mandate device biometric authentication when payment &gt; ₹{userIdentity.securitySettings.highRiskThreshold.toLocaleString('en-IN')}</div>
              </div>
              <button
                type="button"
                onClick={() => updateIdentitySettings({ requirePasskeyForHighRisk: !userIdentity.securitySettings.requirePasskeyForHighRisk })}
                className={userIdentity.securitySettings.requirePasskeyForHighRisk ? "badge badge-approved" : "badge badge-neutral"}
                style={{ cursor: 'pointer' }}
              >
                {userIdentity.securitySettings.requirePasskeyForHighRisk ? '✓ Mandatory' : '○ Disabled'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-dark)' }}>Require Voice Verification for Critical Payments</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Enforce dynamic voice challenge on sensitive peer transfers</div>
              </div>
              <button
                type="button"
                onClick={() => updateIdentitySettings({ requireVoiceVerification: !userIdentity.securitySettings.requireVoiceVerification })}
                className={userIdentity.securitySettings.requireVoiceVerification ? "badge badge-approved" : "badge badge-neutral"}
                style={{ cursor: 'pointer' }}
              >
                {userIdentity.securitySettings.requireVoiceVerification ? '✓ Active' : '○ Optional'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--navy-dark)' }}>Session Timeout</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Zero-trust timeout on dormant AI agent sessions</div>
              </div>
              <select
                value={sessionTimeoutMins}
                onChange={(e) => {
                  setSessionTimeoutMins(Number(e.target.value));
                  showToast(`Session timeout set to ${e.target.value} minutes.`);
                }}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-strong)',
                  fontSize: '0.8rem',
                  backgroundColor: '#FFFFFF'
                }}
              >
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 5: AI Authority Defaults */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <ShieldCheckIcon size={18} color="var(--paypal-blue)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
              AI Authority Defaults
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                Default Spending Limit (₹)
              </label>
              <input
                type="number"
                value={defaultLimit}
                onChange={(e) => setDefaultLimit(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)'
                }}
                step={500}
                min={500}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                Default Transaction Limit
              </label>
              <input
                type="number"
                value={defaultTxns}
                onChange={(e) => setDefaultTxns(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)'
                }}
                min={1}
                max={5}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy-dark)', marginBottom: '0.4rem' }}>
                Default Expiry (Minutes)
              </label>
              <input
                type="number"
                value={defaultExpiry}
                onChange={(e) => setDefaultExpiry(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)'
                }}
                min={5}
                max={120}
              />
            </div>
          </div>
        </div>

        {/* Section 6: PayPal Gateway Connection */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <PayPalMark size={20} />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
              PayPal Gateway Connection
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.85rem 1rem',
                backgroundColor: paypalConnectionStatus.connected ? 'var(--paypal-light)' : '#F1F5F9',
                borderRadius: 'var(--radius-sm)',
                border: paypalConnectionStatus.connected ? '1px solid #BAE6FD' : '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: paypalConnectionStatus.connected ? 'var(--paypal-blue)' : 'var(--text-muted)' }}>
                  {paypalConnectionStatus.connected ? 'PayPal Sandbox Environment (Demo Connected)' : 'PayPal Sandbox (Disconnected)'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Account: {user.paypalAccountEmail}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={paypalConnectionStatus.connected ? "badge badge-approved" : "badge badge-neutral"}>
                  {paypalConnectionStatus.connected ? "● Connected" : "○ Disconnected"}
                </span>

                <button
                  type="button"
                  onClick={handleTogglePayPal}
                  disabled={isTogglingPayPal}
                  style={{
                    padding: '0.45rem 0.9rem',
                    backgroundColor: paypalConnectionStatus.connected ? '#FEE2E2' : 'var(--paypal-blue)',
                    color: paypalConnectionStatus.connected ? '#B91C1C' : '#FFFFFF',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    border: paypalConnectionStatus.connected ? '1px solid #FECACA' : 'none',
                    cursor: 'pointer'
                  }}
                >
                  {isTogglingPayPal ? 'Updating...' : paypalConnectionStatus.connected ? 'Disconnect Gateway' : 'Connect PayPal'}
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              PayGuard operates in compliance with PayPal AI Hackathon guidelines. Live transaction dispatch routes to the PayPal Sandbox gateway.
            </p>
          </div>
        </div>

        {/* Section 7: Demo Reset */}
        <div
          style={{
            backgroundColor: '#FFF8F8',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#991B1B' }}>
              Demo State Management
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#7F1D1D' }}>
              Clear browser localStorage and reset all identities, passkeys, authorizations, transactions, and security logs to default state.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Reset Demo Data
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: 'var(--paypal-blue)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '0.9rem',
              boxShadow: '0 2px 8px rgba(0, 69, 124, 0.3)',
              cursor: 'pointer'
            }}
          >
            Save Settings
          </button>
        </div>
      </form>

      {/* Voice Enrollment Modal */}
      {showVoiceEnrollModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 25, 47, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem'
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '500px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🎙️</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                Enroll Voice Identity Profile
              </h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Speak or submit the baseline authorization phrase. Your acoustic features will be enrolled in the PayGuard identity enclave simulator.
            </p>

            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                Enrollment Phrase:
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--paypal-blue)' }}>
                "{enrollPhrase}"
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowVoiceEnrollModal(false)}
                style={{
                  padding: '0.65rem 1.25rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoiceEnrollment}
                disabled={isEnrollingVoice}
                style={{
                  padding: '0.65rem 1.5rem',
                  backgroundColor: 'var(--paypal-blue)',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {isEnrollingVoice ? 'Processing Audio...' : 'Complete Voice Enrollment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Challenge & Verification Modal */}
      {showVoiceChallengeModal && activeVoiceChallenge && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 25, 47, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem'
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '520px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🛡️</span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                Dynamic Voice Challenge (Anti-Replay)
              </h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              To prevent audio replay attacks, speak the dynamic one-time challenge phrase shown below. The code expires in 2 minutes.
            </p>

            <div style={{ padding: '1.25rem', backgroundColor: '#EFF6FF', borderRadius: 'var(--radius-sm)', border: '1.5px solid #3B82F6', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Required Dynamic Phrase:
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
                "{activeVoiceChallenge.phrase}"
              </div>
              <div style={{ fontSize: '0.75rem', color: '#3B82F6', marginTop: '0.35rem' }}>
                Dynamic Nonce: <span className="mono">{activeVoiceChallenge.code}</span>
              </div>
            </div>

            {voiceChallengeFeedback && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: voiceChallengeFeedback.includes('verified') ? '#ECFDF5' : '#FEF2F2',
                  border: voiceChallengeFeedback.includes('verified') ? '1px solid #A7F3D0' : '1px solid #FECACA',
                  fontSize: '0.8rem',
                  color: voiceChallengeFeedback.includes('verified') ? '#065F46' : '#991B1B',
                  fontWeight: 600
                }}
              >
                {voiceChallengeFeedback}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleTestVoiceSubmit(true)}
                disabled={isVerifyingVoice}
                style={{
                  padding: '0.55rem 0.95rem',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Test with expired/mismatched audio code to demonstrate replay defense"
              >
                Simulate Replay Attack ⚠
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowVoiceChallengeModal(false)}
                  style={{
                    padding: '0.65rem 1rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleTestVoiceSubmit(false)}
                  disabled={isVerifyingVoice}
                  style={{
                    padding: '0.65rem 1.4rem',
                    backgroundColor: 'var(--paypal-blue)',
                    color: '#FFFFFF',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {isVerifyingVoice ? 'Verifying...' : 'Verify Challenge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 25, 47, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem'
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '460px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#991B1B' }}>
              Reset All Demo Data?
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              This will restore all identities, device passkeys, authorizations, mock transactions, and security event history back to initial factory values. Are you sure?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                style={{
                  padding: '0.65rem 1.25rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                style={{
                  padding: '0.65rem 1.5rem',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Yes, Reset Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
