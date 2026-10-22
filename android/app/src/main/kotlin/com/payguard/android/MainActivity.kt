package com.payguard.android

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.fragment.app.FragmentActivity

/**
 * MainActivity
 * 
 * Hosts the PayGuard React application inside a hardened WebView,
 * registering the PayGuardBiometricBridge to provide native AndroidX BiometricPrompt
 * and hardware Keystore capabilities to the web interface.
 */
class MainActivity : FragmentActivity() {

    private lateinit var webView: WebView
    private lateinit var keystoreManager: KeystoreSecurityManager
    private lateinit var biometricAuthManager: BiometricAuthManager
    private lateinit var bridge: PayGuardBiometricBridge

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_main)
        webView = findViewById(R.id.payguard_webview)

        // Initialize Native Security Subsystems
        keystoreManager = KeystoreSecurityManager()
        biometricAuthManager = BiometricAuthManager(keystoreManager)
        bridge = PayGuardBiometricBridge(this, webView, biometricAuthManager, keystoreManager)

        // Configure WebView security
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        // Inject the JavascriptInterface
        webView.addJavascriptInterface(bridge, "PayGuardAndroidBridge")

        webView.webViewClient = WebViewClient()

        // Load the local React frontend build or development server
        webView.loadUrl("file:///android_asset/dist/index.html")
    }
}
