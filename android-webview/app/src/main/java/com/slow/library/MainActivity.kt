package com.slow.library

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.bottomnavigation.BottomNavigationView
import java.net.URLEncoder

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var bottomNav: BottomNavigationView
    private lateinit var btnFilterCountry: MaterialButton
    private lateinit var btnFilterCategory: MaterialButton
    private lateinit var btnFilterType: MaterialButton
    private lateinit var baseUrl: String

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.web_view)
        bottomNav = findViewById(R.id.bottom_nav)
        btnFilterCountry = findViewById(R.id.btn_filter_country)
        btnFilterCategory = findViewById(R.id.btn_filter_category)
        btnFilterType = findViewById(R.id.btn_filter_type)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        baseUrl = getString(R.string.bookstack_base_url).trimEnd('/')
        loadPath("$baseUrl/")

        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_home -> loadPath("$baseUrl/")
                R.id.nav_resources -> loadPath("$baseUrl/search")
                R.id.nav_upload -> {
                    startActivity(Intent(this, UploadActivity::class.java))
                    true
                }
                R.id.nav_profile -> loadPath("$baseUrl/settings/profile")
                else -> false
            }
        }

        btnFilterCountry.setOnClickListener { loadSearch("country:\"Sierra Leone\"") }
        btnFilterCategory.setOnClickListener { loadSearch("category:savings") }
        btnFilterType.setOnClickListener { loadSearch("type:document") }
    }

    private fun loadPath(url: String): Boolean {
        webView.loadUrl(url)
        return true
    }

    private fun loadSearch(query: String): Boolean {
        val encoded = URLEncoder.encode(query, Charsets.UTF_8.name())
        return loadPath("$baseUrl/search?term=$encoded")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
