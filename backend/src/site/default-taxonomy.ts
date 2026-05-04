/**
 * Default library taxonomy (must stay aligned with `web/metadata.js` fallbacks).
 * Replaced in full when an admin saves via PUT /api/site/taxonomy.
 */
export const DEFAULT_SITE_TAXONOMY = {
  countries: [
    "Sierra Leone",
    "Ethiopia",
    "Pakistan",
    "Kenya",
    "Bangladesh",
    "Timor-Leste",
    "Solomon Islands",
  ],
  mainCategories: [
    "Group Loans",
    "Individual Loans",
    "Savings",
    "Payments",
    "Insurance",
    "Savings Groups",
    "Currency",
  ],
  crossCuttingCategories: [
    "Icons",
    "Templates",
    "Frames",
    "Digital",
    "Paper",
    "Documents - Manuals",
    "Documents - Research",
  ],
  productDetails: ["Group", "Individual", "Agent", "Farmer", "Women", "Youth"],
  institutions: ["Harvest Microfinance", "BRAC", "World Vision", "CARE", "UNCDF", "Community NGO"],
  types: ["Icon", "Template", "Frame", "Digital", "Paper", "Document"],
} as const;

export type SiteTaxonomy = {
  countries: string[];
  mainCategories: string[];
  crossCuttingCategories: string[];
  productDetails: string[];
  institutions: string[];
  types: string[];
};
