package com.slow.library

import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.ListView
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray

class SavedUploadsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_saved)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = getString(R.string.nav_saved)

        val listView = findViewById<ListView>(R.id.list_saved_uploads)
        val raw =
            getSharedPreferences("slow_uploads", MODE_PRIVATE)
                .getString("upload_history_json", "[]") ?: "[]"
        val lines = mutableListOf<String>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val title = o.optString("title", "Untitled")
                val time = o.optString("time", "")
                val country = o.optString("country", "")
                lines.add("$title — $country — $time")
            }
        } catch (_: Exception) {
            lines.add(getString(R.string.saved_uploads_parse_error))
        }
        if (lines.isEmpty()) {
            lines.add(getString(R.string.saved_uploads_empty))
        }
        listView.adapter =
            ArrayAdapter(this, android.R.layout.simple_list_item_1, lines)
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }
}
