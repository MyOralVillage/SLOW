package com.slow.library

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.DataOutputStream
import java.io.InputStream
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class OimBackendClient(
    private val baseUrl: String,
    private val apiKey: String = "",
    private val sessionToken: String = "",
) {
    data class CreateResourceRequest(
        val title: String,
        val description: String,
        val country: String,
        val category: String,
        val type: String,
        val selectedFilename: String?,
        val productDetail: String? = null,
        val crossCutting: String? = null,
        val institution: String? = null,
        val keywords: String? = null,
    )

    data class ApiResult(
        val success: Boolean,
        val message: String,
    )

    data class CreateResult(
        val success: Boolean,
        val message: String,
        val id: String? = null,
    )

    private fun applyAuth(conn: HttpURLConnection) {
        if (sessionToken.isNotBlank()) {
            conn.setRequestProperty("Authorization", "Bearer $sessionToken")
        } else if (apiKey.isNotBlank()) {
            conn.setRequestProperty("X-API-Key", apiKey)
        }
    }

    fun createResource(request: CreateResourceRequest): CreateResult {
        val endpoint = "${baseUrl.trimEnd('/')}/resources"
        val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            connectTimeout = 15000
            readTimeout = 20000
        }
        applyAuth(conn)

        val kwArray = JSONArray()
        request.keywords?.trim()?.takeIf { it.isNotEmpty() }?.split(Regex("[,\\s]+"))?.forEach { kwArray.put(it.trim()) }

        val payload = JSONObject()
            .put("title", request.title)
            .put("description", request.description)
            .put("country", request.country)
            .put("category", request.category)
            .put("type", request.type)
            .put("productDetail", request.productDetail ?: JSONObject.NULL)
            .put("crossCuttingCategory", request.crossCutting ?: JSONObject.NULL)
            .put("institution", request.institution ?: JSONObject.NULL)
            .put("keywords", kwArray)
            .put("originalFilename", request.selectedFilename ?: JSONObject.NULL)

        OutputStreamWriter(conn.outputStream).use { writer ->
            writer.write(payload.toString())
        }

        val status = conn.responseCode
        val ok = status in 200..299
        val stream = if (ok) conn.inputStream else conn.errorStream
        val body = stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty()

        return if (!ok) {
            CreateResult(false, "Create failed ($status): ${body.take(220)}", null)
        } else {
            val id = parseId(body)
            CreateResult(true, "Resource created.", id)
        }
    }

    fun uploadResourceFile(
        resourceId: String,
        inputStream: InputStream,
        fileName: String,
        mimeType: String,
    ): ApiResult {
        val boundary = "----SLOW${System.currentTimeMillis()}"
        val endpoint = "${baseUrl.trimEnd('/')}/resources/$resourceId/file"
        val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            connectTimeout = 20000
            readTimeout = 120000
        }
        applyAuth(conn)

        DataOutputStream(conn.outputStream).use { out ->
            writeMultipartFile(out, boundary, "file", fileName, mimeType, inputStream)
            out.writeBytes("--$boundary--\r\n")
        }

        val status = conn.responseCode
        val ok = status in 200..299
        val stream = if (ok) conn.inputStream else conn.errorStream
        val body = stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty()

        return if (ok) {
            ApiResult(true, "Upload complete.")
        } else {
            ApiResult(false, "Upload failed ($status): ${body.take(220)}")
        }
    }

    private fun writeMultipartFile(
        out: DataOutputStream,
        boundary: String,
        fieldName: String,
        filename: String,
        mimeType: String,
        stream: InputStream,
    ) {
        val safeName = filename.replace("\"", "")
        out.writeBytes("--$boundary\r\n")
        out.writeBytes("Content-Disposition: form-data; name=\"$fieldName\"; filename=\"$safeName\"\r\n")
        out.writeBytes("Content-Type: $mimeType\r\n\r\n")
        stream.copyTo(out)
        out.writeBytes("\r\n")
    }

    private fun parseId(body: String): String? =
        try {
            val root = JSONObject(body)
            when {
                root.has("id") && !root.isNull("id") -> root.getString("id")
                root.has("data") -> {
                    val d = root.get("data")
                    if (d is JSONObject && d.has("id") && !d.isNull("id")) d.getString("id") else null
                }
                else -> null
            }
        } catch (_: Exception) {
            null
        }
}
