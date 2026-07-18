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
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.provider.ContactsContract
import com.google.android.gms.common.api.Scope
import com.google.android.gms.auth.GoogleAuthUtil

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    @Volatile var fcmToken: String? = null

    private lateinit var googleSignInClient: GoogleSignInClient
    private val RC_SIGN_IN = 9001
    private val RC_CONTACTS_SIGN_IN = 9002

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request runtime notification permission on Android 13+ (TIRAMISU)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }

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
                val url = request?.url?.toString() ?: return false
                return handleExternalIntent(url)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url == null) return false
                return handleExternalIntent(url)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                android.util.Log.d("ProxNetWebView", "Page load started: $url")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                android.util.Log.d("ProxNetWebView", "Page load completed: $url")
                
                // If it's a login or auth redirect page, verify if it got stuck on an error state
                if (url != null && (url.contains("/api/auth/callback") || url.contains("/login"))) {
                    webView.evaluateJavascript(
                        "javascript:(function() {" +
                        "  var text = document.body ? document.body.innerText : '';" +
                        "  if (text.includes('Server Error') || text.includes('Something went wrong') || text.includes('Error 500')) {" +
                        "    console.log('Detected server error on auth page, redirecting...');" +
                        "    window.location.href = '/qa';" +
                        "  }" +
                        "})()", null
                    )
                }

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
                val err = e.message ?: "Google Sign-In failed"
                webView.post {
                    webView.evaluateJavascript("javascript:if(window.onGoogleSignInError){ window.onGoogleSignInError('$err'); }", null)
                }
            }
        } else if (requestCode == RC_CONTACTS_SIGN_IN) {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            try {
                val account = task.getResult(ApiException::class.java)
                val googleAccount = account?.account
                if (googleAccount != null) {
                    fetchGoogleContactsNatively(googleAccount)
                } else {
                    throw Exception("Google account is null")
                }
            } catch (e: Exception) {
                android.util.Log.e("ProxNetAndroid", "Google Contacts Sign-In failed: ${e.message}")
                webView.post {
                    webView.evaluateJavascript("javascript:if(window.onAndroidContactsError){ window.onAndroidContactsError('${e.message}'); }", null)
                }
            }
        }
    }

    private val PERMISSIONS_REQUEST_READ_CONTACTS = 100

    fun requestContactsPermissionAndFetch() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.READ_CONTACTS), PERMISSIONS_REQUEST_READ_CONTACTS)
            } else {
                fetchAndSendContacts()
            }
        } else {
            fetchAndSendContacts()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 101) {
            return
        }
        if (requestCode == PERMISSIONS_REQUEST_READ_CONTACTS) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                fetchAndSendContacts()
            } else {
                webView.post {
                    webView.evaluateJavascript("javascript:if(window.onAndroidContactsError){ window.onAndroidContactsError('Permission denied'); }", null)
                }
            }
        }
    }

    private fun fetchAndSendContacts() {
        Thread {
            try {
                val jsonArray = org.json.JSONArray()
                val resolver = contentResolver
                val cursor = resolver.query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    arrayOf(
                        ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                        ContactsContract.CommonDataKinds.Phone.NUMBER
                    ),
                    null, null,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
                )
                
                cursor?.use {
                    val nameIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                    val numberIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    
                    while (it.moveToNext()) {
                        if (nameIndex >= 0 && numberIndex >= 0) {
                            val name = it.getString(nameIndex) ?: ""
                            val number = it.getString(numberIndex) ?: ""
                            if (name.isNotEmpty() && number.isNotEmpty()) {
                                val obj = org.json.JSONObject()
                                obj.put("name", name)
                                obj.put("phoneOrEmail", number)
                                jsonArray.put(obj)
                            }
                        }
                    }
                }
                
                val jsonArrayString = jsonArray.toString()
                val base64Data = android.util.Base64.encodeToString(
                    jsonArrayString.toByteArray(Charsets.UTF_8),
                    android.util.Base64.NO_WRAP
                )
                webView.post {
                    webView.evaluateJavascript("javascript:if(window.onAndroidContactsReady){ window.onAndroidContactsReady('$base64Data', true); }", null)
                }
            } catch (e: Exception) {
                android.util.Log.e("ProxNetAndroid", "Error querying contacts: ${e.message}")
                webView.post {
                    webView.evaluateJavascript("javascript:if(window.onAndroidContactsError){ window.onAndroidContactsError('${e.message}'); }", null)
                }
            }
        }.start()
    }

    fun launchGoogleContactsSignIn() {
        runOnUiThread {
            val contactsScope = Scope("https://www.googleapis.com/auth/contacts.readonly")
            val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestScopes(contactsScope)
                .build()
            val signInClient = GoogleSignIn.getClient(this, gso)
            signInClient.signOut().addOnCompleteListener {
                val intent = signInClient.signInIntent
                startActivityForResult(intent, RC_CONTACTS_SIGN_IN)
            }
        }
    }

    private fun fetchGoogleContactsNatively(account: android.accounts.Account) {
        Thread {
            try {
                val token = GoogleAuthUtil.getToken(this, account, "oauth2:https://www.googleapis.com/auth/contacts.readonly")
                if (token.isNullOrEmpty()) {
                    throw Exception("Failed to retrieve Google OAuth access token")
                }
                
                val url = java.net.URL("https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=150")
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.setRequestProperty("Accept", "application/json")
                
                if (conn.responseCode == 200) {
                    val response = conn.inputStream.bufferedReader().use { it.readText() }
                    val jsonResponse = org.json.JSONObject(response)
                    val connections = jsonResponse.optJSONArray("connections")
                    val jsonArray = org.json.JSONArray()
                    
                    if (connections != null) {
                        for (i in 0 until connections.length()) {
                            val person = connections.getJSONObject(i)
                            
                            val names = person.optJSONArray("names")
                            val displayName = if (names != null && names.length() > 0) {
                                names.getJSONObject(0).optString("displayName", "Unnamed")
                            } else {
                                "Unnamed"
                            }
                            
                            val emails = person.optJSONArray("emailAddresses")
                            val emailVal = if (emails != null && emails.length() > 0) {
                                emails.getJSONObject(0).optString("value", "")
                            } else {
                                ""
                            }
                            
                            val phones = person.optJSONArray("phoneNumbers")
                            val phoneVal = if (phones != null && phones.length() > 0) {
                                phones.getJSONObject(0).optString("value", "")
                            } else {
                                ""
                            }
                            
                            val contactVal = if (phoneVal.isNotEmpty()) phoneVal else emailVal
                            if (contactVal.isNotEmpty()) {
                                val obj = org.json.JSONObject()
                                obj.put("name", displayName)
                                obj.put("phoneOrEmail", contactVal)
                                jsonArray.put(obj)
                            }
                        }
                    }
                    
                    val jsonArrayString = jsonArray.toString()
                    val base64Data = android.util.Base64.encodeToString(
                        jsonArrayString.toByteArray(Charsets.UTF_8),
                        android.util.Base64.NO_WRAP
                    )
                    webView.post {
                        webView.evaluateJavascript("javascript:if(window.onAndroidContactsReady){ window.onAndroidContactsReady('$base64Data', true); }", null)
                    }
                } else {
                    val errorMsg = conn.errorStream?.bufferedReader()?.use { it.readText() } ?: "HTTP ${conn.responseCode}"
                    throw Exception("Google People API returned: $errorMsg")
                }
            } catch (e: Exception) {
                android.util.Log.e("ProxNetAndroid", "Failed to fetch Google contacts natively: ${e.message}")
                webView.post {
                    webView.evaluateJavascript("javascript:if(window.onAndroidContactsError){ window.onAndroidContactsError('${e.message}'); }", null)
                }
            }
        }.start()
    }

    private fun handleExternalIntent(url: String): Boolean {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            return false
        }
        try {
            val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
            if (intent.resolveActivity(packageManager) != null) {
                startActivity(intent)
                return true
            }
            val uri = android.net.Uri.parse(url)
            val fallbackIntent = Intent(Intent.ACTION_VIEW, uri)
            startActivity(fallbackIntent)
            return true
        } catch (e: Exception) {
            android.util.Log.e("ProxNetAndroid", "Failed to launch external application: ${e.message}")
            return true
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

        @JavascriptInterface
        fun startContactsImport() {
            activity.runOnUiThread {
                activity.requestContactsPermissionAndFetch()
            }
        }

        @JavascriptInterface
        fun startGoogleContactsImport() {
            activity.runOnUiThread {
                activity.launchGoogleContactsSignIn()
            }
        }
    }
}
