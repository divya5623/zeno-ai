package com.payguard.android

import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

/**
 * BiometricAuthManager
 * 
 * Implements AndroidX BiometricPrompt with cryptographic binding.
 * Enforces Android OS security model:
 * 1. Authentication happens inside OS system UI dialog.
 * 2. Unlocks Android Keystore Cipher upon biometric match.
 * 3. Does NOT inspect raw biometric data or claim finger identification.
 */
class BiometricAuthManager(
    private val keystoreSecurityManager: KeystoreSecurityManager
) {

    fun showBiometricPrompt(
        activity: FragmentActivity,
        title: String,
        subtitle: String,
        onSuccess: (BiometricPrompt.CryptoObject?) -> Unit,
        onError: (String, String) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)

        val authenticationCallback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                onSuccess(result.cryptoObject)
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                val code = when (errorCode) {
                    BiometricPrompt.ERROR_USER_CANCELED,
                    BiometricPrompt.ERROR_NEGATIVE_BUTTON -> "USER_CANCELED"
                    BiometricPrompt.ERROR_LOCKOUT -> "LOCKOUT"
                    BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> "PERMANENT_LOCKOUT"
                    BiometricPrompt.ERROR_NO_BIOMETRICS -> "NONE_ENROLLED"
                    BiometricPrompt.ERROR_HW_NOT_PRESENT,
                    BiometricPrompt.ERROR_HW_UNAVAILABLE -> "NO_HARDWARE"
                    else -> "BIOMETRIC_ERROR_$errorCode"
                }
                onError(code, errString.toString())
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                // Individual fingerprint attempt didn't match
                onError("ATTEMPT_FAILED", "Biometric not recognized. Please try again.")
            }
        }

        val biometricPrompt = BiometricPrompt(activity, executor, authenticationCallback)

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setDescription("Confirm your identity with device biometric authentication")
            .setNegativeButtonText("Cancel")
            .setConfirmationRequired(true)
            .build()

        // Bind with Keystore Cipher cryptoObject for cryptographic attestation
        val cipher = keystoreSecurityManager.getInitializedCipher()
        if (cipher != null) {
            biometricPrompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
        } else {
            biometricPrompt.authenticate(promptInfo)
        }
    }
}
