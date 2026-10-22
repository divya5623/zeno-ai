package com.payguard.android

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.biometric.BiometricManager
import androidx.fragment.app.FragmentActivity
import org.json.JSONObject

/**
 * PayGuardBiometricBridge
 * 
 * Android JavascriptInterface bridge bridging Native AndroidX BiometricPrompt
 * and Android Keystore to the PayGuard React frontend.
 * 
 * ARCHITECTURAL INTEGRITY NOTICE:
 * Android's standard biometric stack (BiometricPrompt / BiometricManager) explicitly
 * isolates biometric templates within the Trusted Execution Environment (TEE) / Secure Enclave.
 * The application layer is NEVER provided raw fingerprint images or templates, nor does the OS
 * distinguish which of the user's 10 fingers was touched.
 */
class PayGuardBiometricBridge(
    private val activity: FragmentActivity,
    private val webView: WebView,
    private val biometricAuthManager: BiometricAuthManager,
    private val keystoreSecurityManager: KeystoreSecurityManager
) {

    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun isBiometricAvailable(): Boolean {
        val biometricManager = BiometricManager.from(activity)
        val canAuthenticate = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        )
        return canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS
    }

    @JavascriptInterface
    fun authenticate(title: String, subtitle: String, callbackName: String) {
        mainHandler.post {
            biometricAuthManager.showBiometricPrompt(
                activity = activity,
                title = title,
                subtitle = subtitle,
                onSuccess = { cryptoObject ->
                    // Sign cryptographic challenge using Keystore-backed cipher
                    val signature = keystoreSecurityManager.signPayload("PAYGUARD_AUTH_ASSERTION_${System.currentTimeMillis()}")
                    val resultJson = JSONObject().apply {
                        put("success", true)
                        put("platform", "ANDROID_NATIVE")
                        put("isSimulated", false)
                        put("hardwareAvailable", true)
                        put("signature", signature)
                        put("timestamp", java.time.Instant.now().toString())
                    }
                    dispatchToFrontend(callbackName, resultJson)
                },
                onError = { errorCode, errString ->
                    val resultJson = JSONObject().apply {
                        put("success", false)
                        put("errorCode", errorCode)
                        put("errorMessage", errString)
                        put("platform", "ANDROID_NATIVE")
                        put("isSimulated", false)
                        put("hardwareAvailable", isBiometricAvailable())
                        put("timestamp", java.time.Instant.now().toString())
                    }
                    dispatchToFrontend(callbackName, resultJson)
                }
            )
        }
    }

    @JavascriptInterface
    fun openBiometricSettings() {
        mainHandler.post {
            try {
                // Open Android OS biometric enrollment settings
                val intent = Intent(Settings.ACTION_BIOMETRIC_ENROLL).apply {
                    putExtra(
                        Settings.EXTRA_BIOMETRIC_AUTHENTICATORS_ALLOWED,
                        BiometricManager.Authenticators.BIOMETRIC_STRONG
                    )
                }
                activity.startActivity(intent)
            } catch (e: Exception) {
                // Fallback to general security settings if specific intent is unsupported
                val fallbackIntent = Intent(Settings.ACTION_SECURITY_SETTINGS)
                activity.startActivity(fallbackIntent)
            }
        }
    }

    @JavascriptInterface
    fun getKeystoreSignature(challenge: String): String {
        return keystoreSecurityManager.signPayload(challenge)
    }

    private fun dispatchToFrontend(callbackName: String, json: JSONObject) {
        val script = "if (window.__payguardBiometricCallbacks && window.__payguardBiometricCallbacks['$callbackName']) { " +
                "window.__payguardBiometricCallbacks['$callbackName']($json); }"
        webView.evaluateJavascript(script, null)
    }
}
