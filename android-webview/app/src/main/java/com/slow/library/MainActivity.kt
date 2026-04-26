package com.slow.library

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.webkit.CookieManager
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.bottomnavigation.BottomNavigationView

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var bottomNav: BottomNavigationView
    private lateinit var progressBar: ProgressBar
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var errorView: LinearLayout
    private lateinit var errorMessage: TextView

    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var frontendUrl = ""

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
            fileChooserCallback?.onReceiveValue(uris.toTypedArray())
            fileChooserCallback = null
        }

    private val fileChooserAnyLauncher =
        registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            fileChooserCallback?.onReceiveValue(uris.toTypedArray())
            fileChooserCallback = null
        }

    private fun navigateTo(hash: String, mode: String? = null) {
        val safeHash = hash.replace("'", "")
        val safeMode = mode?.replace("'", "")
        val js =
            if (safeMode != null) {
                "window.location.hash='$safeHash';window.setTimeout(function(){try{document.querySelector('[data-route=\"$safeMode\"]')?.click();}catch(e){}},120);"
            } else {
                "window.location.hash='$safeHash';"
            }
        webView.evaluateJavascript(js, null)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        frontendUrl = getString(R.string.frontend_url).trimEnd('/')
        webView = findViewById(R.id.web_view)
        bottomNav = findViewById(R.id.bottom_nav)
        progressBar = findViewById(R.id.progress_bar)
        swipeRefresh = findViewById(R.id.swipe_refresh)
        errorView = findViewById(R.id.error_view)
        errorMessage = findViewById(R.id.error_message)

        setupWebView()
        setupBottomNav()
        setupSwipeRefresh()
        setupErrorView()

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            val deep = intent?.data?.toString()
            if (!deep.isNullOrBlank() && deep.startsWith(frontendUrl)) {
                webView.loadUrl(deep)
            } else {
                webView.loadUrl("$frontendUrl/")
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
            builtInZoomControls = false
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(false)
            userAgentString = "${userAgentString} SLOWAndroidWebView/1.0"
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
                errorView.visibility = View.GONE
                webView.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                syncBottomNavToUrl(url)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                    showError(getString(R.string.error_network))
                }
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith(frontendUrl)) {
                    return false
                }
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                if (newProgress >= 100) {
                    progressBar.visibility = View.GONE
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = callback

                val acceptTypes = params?.acceptTypes ?: emptyArray()
                val mimeType = acceptTypes.firstOrNull()?.takeIf { it.isNotBlank() } ?: "*/*"

                try {
                    if (mimeType.startsWith("image/")) {
                        fileChooserLauncher.launch("image/*")
                    } else {
                        fileChooserAnyLauncher.launch(arrayOf(mimeType))
                    }
                } catch (e: Exception) {
                    try {
                        fileChooserAnyLauncher.launch(arrayOf("*/*"))
                    } catch (e2: Exception) {
                        fileChooserCallback?.onReceiveValue(null)
                        fileChooserCallback = null
                        return false
                    }
                }
                return true
            }
        }

        webView.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            try {
                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    val filename = URLUtil.guessFileName(url, contentDisposition, mimeType)
                    setTitle(filename)
                    setDescription(getString(R.string.download_description))
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
                    val cookie = CookieManager.getInstance().getCookie(url)
                    if (!cookie.isNullOrBlank()) {
                        addRequestHeader("Cookie", cookie)
                    }
                }
                val dm = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
            } catch (_: Exception) {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            }
        }
    }

    private fun setupBottomNav() {
        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_home -> navigateTo("home")
                R.id.nav_resources -> navigateTo("resources")
                R.id.nav_community -> navigateTo("community")
                R.id.nav_forums -> {
                    navigateTo("community")
                    webView.evaluateJavascript(
                        "window.setTimeout(function(){try{document.getElementById('forum-thread-form')?.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){}},250);",
                        null
                    )
                }
                R.id.nav_messages -> navigateTo("messages")
                R.id.nav_notifications -> navigateTo("notifications")
                R.id.nav_profile -> navigateTo("profile")
                else -> return@setOnItemSelectedListener false
            }
            true
        }
    }

    private fun syncBottomNavToUrl(url: String?) {
        val hash = url?.substringAfter("#", "home") ?: "home"
        val itemId = when {
            hash.startsWith("messages") -> R.id.nav_messages
            hash.startsWith("notifications") -> R.id.nav_notifications
            hash.startsWith("profile") -> R.id.nav_profile
            hash.startsWith("community") -> R.id.nav_community
            hash.startsWith("resources") -> R.id.nav_resources
            else -> R.id.nav_home
        }
        bottomNav.menu.findItem(itemId)?.isChecked = true
    }

    private fun setupSwipeRefresh() {
        swipeRefresh.setColorSchemeColors(0xFF1B5E20.toInt())
        swipeRefresh.setOnRefreshListener {
            errorView.visibility = View.GONE
            webView.visibility = View.VISIBLE
            webView.reload()
        }
    }

    private fun setupErrorView() {
        findViewById<View>(R.id.btn_retry).setOnClickListener {
            errorView.visibility = View.GONE
            webView.visibility = View.VISIBLE
            webView.reload()
        }
    }

    private fun showError(message: String) {
        errorMessage.text = message
        errorView.visibility = View.VISIBLE
        webView.visibility = View.GONE
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    @Deprecated("Deprecated in API but still needed for WebView back")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }
}
