package com.slow.library

import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.textfield.TextInputEditText
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

class UploadActivity : AppCompatActivity() {
    private lateinit var inputTitle: TextInputEditText
    private lateinit var inputDescription: TextInputEditText
    private lateinit var dropdownCountry: AutoCompleteTextView
    private lateinit var dropdownCategory: AutoCompleteTextView
    private lateinit var dropdownType: AutoCompleteTextView
    private lateinit var txtSelectedFile: TextView
    private lateinit var txtTagsPreview: TextView
    private lateinit var btnPickFile: MaterialButton
    private lateinit var btnSubmit: MaterialButton

    private var selectedFileUri: Uri? = null
    private var selectedFilename: String? = null

    private val pickFileLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            selectedFileUri = uri
            selectedFilename = uri?.let { resolveFileName(it) }
            txtSelectedFile.text = if (selectedFilename != null) {
                getString(R.string.selected_file_value, selectedFilename)
            } else {
                getString(R.string.selected_file_none)
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_upload)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = getString(R.string.nav_upload)

        bindViews()
        setupDropdowns()
        setupListeners()
        updateTagsPreview()
    }

    private fun bindViews() {
        inputTitle = findViewById(R.id.input_title)
        inputDescription = findViewById(R.id.input_description)
        dropdownCountry = findViewById(R.id.dropdown_country)
        dropdownCategory = findViewById(R.id.dropdown_category)
        dropdownType = findViewById(R.id.dropdown_type)
        txtSelectedFile = findViewById(R.id.txt_selected_file)
        txtTagsPreview = findViewById(R.id.txt_tags_preview)
        btnPickFile = findViewById(R.id.btn_pick_file)
        btnSubmit = findViewById(R.id.btn_submit_resource)
    }

    private fun setupDropdowns() {
        bindDropdown(
            dropdownCountry,
            listOf("Sierra Leone", "Liberia", "Ghana", "Nigeria"),
        )
        bindDropdown(
            dropdownCategory,
            listOf("savings", "business", "literacy", "health"),
        )
        bindDropdown(
            dropdownType,
            listOf("icon", "template", "document", "audio"),
        )

        dropdownCountry.setText("Sierra Leone", false)
        dropdownCategory.setText("savings", false)
        dropdownType.setText("document", false)
    }

    private fun bindDropdown(view: AutoCompleteTextView, values: List<String>) {
        val adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, values)
        view.setAdapter(adapter)
    }

    private fun setupListeners() {
        btnPickFile.setOnClickListener { pickFileLauncher.launch("*/*") }

        dropdownCountry.setOnItemClickListener { _, _, _, _ -> updateTagsPreview() }
        dropdownCategory.setOnItemClickListener { _, _, _, _ -> updateTagsPreview() }
        dropdownType.setOnItemClickListener { _, _, _, _ -> updateTagsPreview() }

        btnSubmit.setOnClickListener { submitResource() }
    }

    private fun updateTagsPreview() {
        val country = dropdownCountry.text?.toString()?.trim().orEmpty()
        val category = dropdownCategory.text?.toString()?.trim().orEmpty()
        val type = dropdownType.text?.toString()?.trim().orEmpty()
        val preview = "country:$country, category:$category, type:$type"
        txtTagsPreview.text = getString(R.string.tags_preview_value, preview)
    }

    private fun submitResource() {
        val title = inputTitle.text?.toString()?.trim().orEmpty()
        val description = inputDescription.text?.toString()?.trim().orEmpty()
        val country = dropdownCountry.text?.toString()?.trim().orEmpty()
        val category = dropdownCategory.text?.toString()?.trim().orEmpty()
        val type = dropdownType.text?.toString()?.trim().orEmpty()

        if (title.isEmpty() || description.isEmpty() || country.isEmpty() || category.isEmpty() || type.isEmpty()) {
            Snackbar.make(btnSubmit, R.string.upload_validation_error, Snackbar.LENGTH_LONG).show()
            return
        }

        saveSubmissionLocally(title, description, country, category, type, selectedFilename)
        btnSubmit.isEnabled = false

        val apiBaseUrl = getString(R.string.bookstack_base_url)
        val tokenId = getString(R.string.bookstack_api_token_id)
        val tokenSecret = getString(R.string.bookstack_api_token_secret)
        val defaultBookId = getString(R.string.bookstack_default_book_id).toIntOrNull() ?: 1

        if (tokenId.isBlank() || tokenSecret.isBlank()) {
            btnSubmit.isEnabled = true
            Snackbar.make(btnSubmit, R.string.upload_mock_saved, Snackbar.LENGTH_LONG).show()
            return
        }

        thread {
            val result = try {
                BookStackApiClient(
                    baseUrl = apiBaseUrl,
                    tokenId = tokenId,
                    tokenSecret = tokenSecret,
                ).createResourcePage(
                    BookStackApiClient.CreateResourceRequest(
                        title = title,
                        description = description,
                        bookId = defaultBookId,
                        country = country,
                        category = category,
                        type = type,
                        selectedFilename = selectedFilename,
                    )
                )
            } catch (err: Exception) {
                BookStackApiClient.ApiResult(
                    success = false,
                    message = "Upload failed: ${err.message ?: "Unknown error"}",
                )
            }

            runOnUiThread {
                btnSubmit.isEnabled = true
                val msg = if (result.success) result.message else "${getString(R.string.upload_mock_saved)} ${result.message}"
                Snackbar.make(btnSubmit, msg, Snackbar.LENGTH_LONG).show()
            }
        }
    }

    private fun saveSubmissionLocally(
        title: String,
        description: String,
        country: String,
        category: String,
        type: String,
        filename: String?,
    ) {
        val now = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
        val payload = """
            time=$now
            title=$title
            description=$description
            country=$country
            category=$category
            type=$type
            filename=${filename ?: "none"}
        """.trimIndent()
        getSharedPreferences("slow_uploads", MODE_PRIVATE)
            .edit()
            .putString("latest_submission", payload)
            .apply()
    }

    private fun resolveFileName(uri: Uri): String {
        var name = "unknown-file"
        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIndex >= 0 && cursor.moveToFirst()) {
                name = cursor.getString(nameIndex)
            }
        }
        return name
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }
}
