# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep JSON model classes
-keepclassmembers class com.slow.library.OimBackendClient$* { *; }
-keepclassmembers class com.slow.library.BookStackApiClient$* { *; }
