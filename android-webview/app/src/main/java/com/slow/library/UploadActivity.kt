package com.slow.library

import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.text.Editable
import android.text.TextWatcher
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.snackbar.Snackbar
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

class UploadActivity : AppCompatActivity() {
    private lateinit var layoutTitle: TextInputLayout
    private lateinit var layoutDescription: TextInputLayout
    private lateinit var inputTitle: TextInputEditText
    private lateinit var inputDescription: TextInputEditText
    private lateinit var dropdownCountry: AutoCompleteTextView
    private lateinit var dropdownCategory: AutoCompleteTextView
    private lateinit var dropdownType: AutoCompleteTextView
    private lateinit var dropdownProductDetail: AutoCompleteTextView
    private lateinit var inputCrossCutting: TextInputEditText
    private lateinit var inputInstitution: TextInputEditText
    private lateinit var inputKeywords: TextInputEditText
    private lateinit var txtSelectedFile: TextView
    private lateinit var txtTagsPreview: TextView
    private lateinit var btnPickFile: MaterialButton
    private lateinit var btnSubmit: MaterialButton

    private var selectedFileUri: Uri? = null
    private var selectedFilename: String? = null

    private val previewWatcher =
        object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}

            override fun afterTextChanged(s: Editable?) {
                updateTagsPreview()
            }
        }

    private val pickFileLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            selectedFileUri = uri
            selectedFilename = uri?.let { resolveFileName(it) }
            txtSelectedFile.text = if (selectedFilename != null) {
                getString(R.string.selected_file_value, selectedFilename)
            } else {
                getString(R.string.selected_file_none)
            }
            updateTagsPreview()
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
        layoutTitle = findViewById(R.id.layout_title)
        layoutDescription = findViewById(R.id.layout_description)
        inputTitle = findViewById(R.id.input_title)
        inputDescription = findViewById(R.id.input_description)
        dropdownCountry = findViewById(R.id.dropdown_country)
        dropdownCategory = findViewById(R.id.dropdown_category)
        dropdownType = findViewById(R.id.dropdown_type)
        dropdownProductDetail = findViewById(R.id.dropdown_product_detail)
        inputCrossCutting = findViewById(R.id.input_cross_cutting)
        inputInstitution = findViewById(R.id.input_institution)
        inputKeywords = findViewById(R.id.input_keywords)
        txtSelectedFile = findViewById(R.id.txt_selected_file)
        txtTagsPreview = findViewById(R.id.txt_tags_preview)
        btnPickFile = findViewById(R.id.btn_pick_file)
        btnSubmit = findViewById(R.id.btn_submit_resource)
    }

    private fun setupDropdowns() {
        bindDropdown(dropdownCountry, UploadFieldOptions.COUNTRIES)
        bindDropdown(dropdownCategory, UploadFieldOptions.CATEGORIES)
        bindDropdown(dropdownType, UploadFieldOptions.TYPES)
        bindDropdown(dropdownProductDetail, UploadFieldOptions.PRODUCT_DETAILS)

        dropdownCountry.setText(UploadFieldOptions.COUNTRIES.first(), false)
        dropdownCategory.setText(UploadFieldOptions.CATEGORIES.first(), false)
        dropdownType.setText("document", false)
        dropdownProductDetail.setText("", false)
    }

    private fun bindDropdown(view: AutoCompleteTextView, values: List<String>) {
        val adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, values)
        view.setAdapter(adapter)
    }

    private fun setupListeners() {
        btnPickFile.setOnClickListener { pickFileLauncher.launch("*/*") }

        listOf(dropdownCountry, dropdownCategory, dropdownType, dropdownProductDetail).forEach { v ->
            v.setOnItemClickListener { _, _, _, _ -> updateTagsPreview() }
        }
        inputTitle.addTextChangedListener(previewWatcher)
        inputDescription.addTextChangedListener(previewWatcher)
        inputCrossCutting.addTextChangedListener(previewWatcher)
        inputInstitution.addTextChangedListener(previewWatcher)
        inputKeywords.addTextChangedListener(previewWatcher)

        btnSubmit.setOnClickListener { submitResource() }
    }

    private fun updateTagsPreview() {
        val country = dropdownCountry.text?.toString()?.trim().orEmpty()
        val category = dropdownCategory.text?.toString()?.trim().orEmpty()
        val type = dropdownType.text?.toString()?.trim().orEmpty()
        val product = dropdownProductDetail.text?.toString()?.trim().orEmpty()
        val cross = inputCrossCutting.text?.toString()?.trim().orEmpty()
        val institution = inputInstitution.text?.toString()?.trim().orEmpty()
        val keywords = inputKeywords.text?.toString()?.trim().orEmpty()
        val file = selectedFilename ?: "(none)"

        val lines =
            listOf(
                "country: $country",
                "category: $category",
                "type: $type",
                "product_detail: ${product.ifEmpty { "—" }}",
                "cross_cutting: ${cross.ifEmpty { "—" }}",
                "institution: ${institution.ifEmpty { "—" }}",
                "keywords: ${keywords.ifEmpty { "—" }}",
                "file: $file",
                "",
                "Search-style query:",
                buildSearchQuery(country, category, type, product, cross, institution, keywords),
            )
        txtTagsPreview.text = lines.joinToString("\n")
    }

    private fun buildSearchQuery(
        country: String,
        category: String,
        type: String,
        product: String,
        cross: String,
        institution: String,
        keywords: String,
    ): String {
        val parts = mutableListOf<String>()
        if (country.isNotEmpty()) parts.add("country:\"$country\"")
        if (category.isNotEmpty()) parts.add("category:$category")
        if (type.isNotEmpty()) parts.add("type:$type")
        if (product.isNotEmpty()) parts.add("product_detail:$product")
        if (cross.isNotEmpty()) parts.add("cross_cutting:$cross")
        if (institution.isNotEmpty()) parts.add("institution:$institution")
        if (keywords.isNotEmpty()) parts.add(keywords)
        return parts.joinToString(" ").ifEmpty { "(add metadata to build query)" }
    }

    private fun clearFieldErrors() {
        layoutTitle.error = null
        layoutDescription.error = null
    }

    private fun submitResource() {
        clearFieldErrors()

        val title = inputTitle.text?.toString()?.trim().orEmpty()
        val description = inputDescription.text?.toString()?.trim().orEmpty()
        val country = dropdownCountry.text?.toString()?.trim().orEmpty()
        val category = dropdownCategory.text?.toString()?.trim().orEmpty()
        val type = dropdownType.text?.toString()?.trim().orEmpty()
        val productDetail = dropdownProductDetail.text?.toString()?.trim().orEmpty()
        val crossCutting = inputCrossCutting.text?.toString()?.trim().orEmpty()
        val institution = inputInstitution.text?.toString()?.trim().orEmpty()
        val keywords = inputKeywords.text?.toString()?.trim().orEmpty()

        var ok = true
        if (title.isEmpty()) {
            layoutTitle.error = getString(R.string.upload_error_title)
            ok = false
        }
        if (description.length < 10) {
            layoutDescription.error = getString(R.string.upload_error_description)
            ok = false
        }
        if (country.isEmpty() || country !in UploadFieldOptions.COUNTRIES) {
            Snackbar.make(btnSubmit, R.string.upload_error_country, Snackbar.LENGTH_LONG).show()
            ok = false
        }
        if (category.isEmpty() || category !in UploadFieldOptions.CATEGORIES) {
            Snackbar.make(btnSubmit, R.string.upload_error_category, Snackbar.LENGTH_LONG).show()
            ok = false
        }
        if (type.isEmpty() || type !in UploadFieldOptions.TYPES) {
            Snackbar.make(btnSubmit, R.string.upload_error_type, Snackbar.LENGTH_LONG).show()
            ok = false
        }
        if (selectedFileUri == null) {
            Snackbar.make(btnSubmit, R.string.upload_error_file, Snackbar.LENGTH_LONG).show()
            ok = false
        }
        if (productDetail.isNotEmpty() && productDetail !in UploadFieldOptions.PRODUCT_DETAILS) {
            Snackbar.make(btnSubmit, R.string.upload_error_product_detail, Snackbar.LENGTH_LONG).show()
            ok = false
        }
        if (!ok) return

        saveSubmissionLocally(
            title,
            description,
            country,
            category,
            type,
            productDetail,
            crossCutting,
            institution,
            keywords,
            selectedFilename,
        )
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
            val result =
                try {
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
                            productDetail = productDetail.ifEmpty { null },
                            crossCutting = crossCutting.ifEmpty { null },
                            institution = institution.ifEmpty { null },
                            keywords = keywords.ifEmpty { null },
                        ),
                    )
                } catch (err: Exception) {
                    BookStackApiClient.ApiResult(
                        success = false,
                        message = "Upload failed: ${err.message ?: "Unknown error"}",
                    )
                }

            runOnUiThread {
                btnSubmit.isEnabled = true
                val msg =
                    if (result.success) {
                        result.message
                    } else {
                        "${getString(R.string.upload_mock_saved)} ${result.message}"
                    }
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
        productDetail: String,
        crossCutting: String,
        institution: String,
        keywords: String,
        filename: String?,
    ) {
        val now = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
        val payload =
            """
            time=$now
            title=$title
            description=$description
            country=$country
            category=$category
            type=$type
            product_detail=$productDetail
            cross_cutting=$crossCutting
            institution=$institution
            keywords=$keywords
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
