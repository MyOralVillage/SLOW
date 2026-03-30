package com.slow.library

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class BookStackApiClient(
    private val baseUrl: String,
    private val tokenId: String,
    private val tokenSecret: String,
) {
    data class CreateResourceRequest(
        val title: String,
        val description: String,
        val bookId: Int,
        val country: String,
        val category: String,
        val type: String,
        val selectedFilename: String?,
    )

    data class ApiResult(
        val success: Boolean,
        val message: String,
    )

    fun createResourcePage(request: CreateResourceRequest): ApiResult {
        val endpoint = "${baseUrl.trimEnd('/')}/api/pages"
        val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("Authorization", "Token $tokenId:$tokenSecret")
            setRequestProperty("Content-Type", "application/json")
            connectTimeout = 15000
            readTimeout = 20000
        }

        val htmlDescription = buildHtmlDescription(request)
        val payload = JSONObject()
            .put("name", request.title)
            .put("book_id", request.bookId)
            .put("html", htmlDescription)
            .put(
                "tags",
                JSONArray()
                    .put(JSONObject().put("name", "country").put("value", request.country))
                    .put(JSONObject().put("name", "category").put("value", request.category))
                    .put(JSONObject().put("name", "type").put("value", request.type))
            )

        OutputStreamWriter(conn.outputStream).use { writer ->
            writer.write(payload.toString())
        }

        val statusCode = conn.responseCode
        val isSuccess = statusCode in 200..299
        val stream = if (isSuccess) conn.inputStream else conn.errorStream
        val responseBody = stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty()

        return if (isSuccess) {
            ApiResult(success = true, message = "Uploaded to BookStack successfully.")
        } else {
            ApiResult(
                success = false,
                message = "BookStack API failed ($statusCode): ${responseBody.take(220)}",
            )
        }
    }

    private fun buildHtmlDescription(request: CreateResourceRequest): String {
        val safeDescription = request.description.replace("\n", "<br/>")
        val fileLine = request.selectedFilename?.let {
            "<p><strong>Selected file:</strong> $it (attachment upload pending)</p>"
        }.orEmpty()

        return """
            <p>$safeDescription</p>
            <p><strong>Country:</strong> ${request.country}</p>
            <p><strong>Category:</strong> ${request.category}</p>
            <p><strong>Type:</strong> ${request.type}</p>
            $fileLine
        """.trimIndent()
    }
}
