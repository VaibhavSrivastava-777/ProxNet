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
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    @Volatile var fcmToken: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState);

        // Initialize Firebase and fetch FCM Token
        fetchFCMToken()

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
                // Return false so WebView handles the URL loading internally
                return false
            }

            // Fallback override for older Android API levels
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
            fcmToken = task.result
            android.util.Log.d("ProxNetAndroid", "FCM token loaded: $fcmToken")
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
    }
}
