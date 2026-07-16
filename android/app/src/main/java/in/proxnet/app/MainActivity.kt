package `in`.proxnet.app

import android.content.Intent
import android.graphics.Bitmap
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    @Volatile var fcmToken: String? = null

    private lateinit var googleSignInClient: GoogleSignInClient
    private val RC_SIGN_IN = 9001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize Firebase and fetch FCM Token
        fetchFCMToken()

        // Configure Google Sign-In options
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.google_web_client_id))
            .requestEmail()
            .build()
        googleSignInClient = GoogleSignIn.getClient(this, gso)

        // Create WebView programmatically
        webView = WebView(this)
        setContentView(webView)

        configureWebView()

        // Enable Chrome inspect debugging for WebView
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // Check if app was launched via notification click containing redirect URL
        val redirectUrl = intent?.getStringExtra("url")
        if (!redirectUrl.isNullOrEmpty()) {
            android.util.Log.d("ProxNetWebView", "Loading redirect URL: https://www.proxnet.in$redirectUrl")
            webView.loadUrl("https://www.proxnet.in$redirectUrl")
        } else {
            android.util.Log.d("ProxNetWebView", "Loading default URL: https://www.proxnet.in")
            webView.loadUrl("https://www.proxnet.in")
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        
        // Handle URL load if intent changes while app is running
        val redirectUrl = intent?.getStringExtra("url")
        if (!redirectUrl.isNullOrEmpty()) {
            webView.loadUrl("https://www.proxnet.in$redirectUrl")
        }
    }

    private fun configureWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        
        // Support zoom
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false

        // Override User-Agent to mock Mobile Chrome. 
        // This is critical for LinkedIn login to bypass Embedded WebView restrictions.
        val customUA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        settings.userAgentString = customUA

        // Set WebViewClient with detailed error logging and page load indicators
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }

            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return false
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                android.util.Log.d("ProxNetWebView", "Page load started: $url")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                android.util.Log.d("ProxNetWebView", "Page load completed: $url")
                val token = fcmToken
                if (!token.isNullOrEmpty()) {
                    webView.post {
                        webView.evaluateJavascript("javascript:if(window.onAndroidFCMTokenReady) { window.onAndroidFCMTokenReady('$token'); }", null)
                    }
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    android.util.Log.e(
                        "ProxNetWebView",
                        "Error loading page: ${error?.description} (Code: ${error?.errorCode}) at URL: ${request?.url}"
                    )
                }
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?
            ) {
                android.util.Log.e("ProxNetWebView", "SSL Error: ${error.toString()}")
                super.onReceivedSslError(view, handler, error)
            }
        }

        // Set WebChromeClient to output JavaScript logs to Android Logcat
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                if (consoleMessage != null) {
                    android.util.Log.d(
                        "ProxNetJS",
                        "${consoleMessage.message()} -- From line ${consoleMessage.lineNumber()} of ${consoleMessage.sourceId()}"
                    )
                }
                return true
            }
        }

        // Inject JS Bridge
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidBridge")
    }

    private fun fetchFCMToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                android.util.Log.w("ProxNetAndroid", "Fetching FCM registration token failed", task.exception)
                return@addOnCompleteListener
            }
            val token = task.result
            fcmToken = token
            android.util.Log.d("ProxNetAndroid", "FCM token loaded: $fcmToken")
            
            // Dispatch token to web side if webView is initialized
            if (::webView.isInitialized && !token.isNullOrEmpty()) {
                webView.post {
                    webView.evaluateJavascript("javascript:if(window.onAndroidFCMTokenReady) { window.onAndroidFCMTokenReady('$token'); }", null)
                }
            }
        }
    }

    fun launchGoogleSignIn() {
        runOnUiThread {
            googleSignInClient.signOut().addOnCompleteListener {
                val signInIntent = googleSignInClient.signInIntent
                startActivityForResult(signInIntent, RC_SIGN_IN)
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == RC_SIGN_IN) {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            try {
                val account = task.getResult(ApiException::class.java)
                val idToken = account?.idToken
                if (!idToken.isNullOrEmpty()) {
                    android.util.Log.d("ProxNetAndroid", "Google Sign-In Token loaded successfully")
                    // Pass token back to JS
                    webView.post {
                        webView.evaluateJavascript("javascript:window.onGoogleSignInSuccess('$idToken')", null)
                    }
                } else {
                    android.util.Log.e("ProxNetAndroid", "Google Sign-In returned null idToken")
                }
            } catch (e: Exception) {
                android.util.Log.e("ProxNetAndroid", "Google Sign-In failed: ${e.message}")
            }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    // Javascript Bridge class
    class WebAppInterface(private val activity: MainActivity) {
        @JavascriptInterface
        fun getFCMToken(): String {
            return activity.fcmToken ?: ""
        }

        @JavascriptInterface
        fun startGoogleSignIn() {
            activity.launchGoogleSignIn()
        }
    }
}
