package `in`.proxnet.app

import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
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

        // Check if app was launched via notification click containing redirect URL
        val redirectUrl = intent?.getStringExtra("url")
        if (!redirectUrl.isNullOrEmpty()) {
            webView.loadUrl("https://www.proxnet.in$redirectUrl")
        } else {
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

        // Set WebViewClient to handle page navigation within the WebView
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url != null) {
                    view?.loadUrl(url)
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
