# Resource & Content Structure Plan (Implemented Scope)

This document captures the concrete structure used to support the logged tasks:

- BookStack setup
- API integration (`pages`, `search`)
- tag-based filtering strategy
- Android navigation flow for resource discovery

## 1) Resource model in BookStack

**Resource unit:** BookStack `Page`

Required fields and conventions:

- `name` (resource title)
- `html` or `markdown` content (resource description + metadata summary)
- Tags (key-value)
  - `country`
  - `category`
  - `type`
  - optional: `status` (`approved`, `draft`, `rejected`)

Attachment usage:

- Upload resource files as page attachments (`pdf`, `image`, `audio`)
- Keep attachment names human-readable and include version/date when needed

## 2) Tag-based filtering strategy

BookStack search is used with structured query composition:

- keyword-only:
  - `query=loan savings`
- keyword + tags:
  - `query=loan country:"Sierra Leone" category:savings type:document`

Guidelines:

- Always include `country`, `category`, and `type` tags for each resource
- Use consistent value casing to avoid fragmented search results
- Keep categories finite and documented (controlled vocabulary)

## 3) API integration implementation

Implemented in:

- `scripts/bookstack_api_validate.py`
- `scripts/api_smoke_test.sh`

Validation coverage:

- Auth with API token
- `GET /api/pages`
- `GET /api/search` keyword query
- `GET /api/search` with composed tag-filter query

## 4) Android navigation flow (WebView MVP)

Android routes users into the same BookStack system:

- Home dashboard
- Resources entry
- Profile/settings
- Quick filters:
  - Sierra Leone resources
  - Savings resources
  - Documents type

This keeps web and Android behavior aligned while avoiding duplicated backend logic.
