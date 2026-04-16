package com.slow.library

/**
 * Dropdown values aligned with web/metadata.js — keep in sync.
 */
object UploadFieldOptions {
    val COUNTRIES = listOf(
        "Sierra Leone", "Ethiopia", "Pakistan", "Kenya",
        "Bangladesh", "East Timor", "Solomon Islands"
    )
    val CATEGORIES = listOf(
        "Group Loans", "Individual Loans", "Savings", "Payments",
        "Insurance", "Savings Groups",
        "Icons", "Templates", "Frames", "Digital", "Paper",
        "Documents - Manuals", "Documents - Research"
    )
    val TYPES = listOf("Icon", "Template", "Frame", "Digital", "Paper", "Document")
    val PRODUCT_DETAILS = listOf("Group", "Individual", "Agent", "Farmer", "Women", "Youth")
    val INSTITUTIONS = listOf(
        "Harvest Microfinance", "BRAC", "World Vision", "CARE", "UNCDF", "Community NGO"
    )
}
