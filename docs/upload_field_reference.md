# Upload field reference (Android + Web parity)

Required fields (same on both clients):

| Field | Type | BookStack tags |
| --- | --- | --- |
| Title | text | page `name` |
| Short description | text | page HTML body |
| Country | dropdown | `country` |
| Category | dropdown | `category` |
| Type | dropdown | `type` (`icon`, `template`, `document`, `audio`) |
| File | picker | attachment (after page create) |

Optional metadata (search filters; sent as tags when non-empty):

| Field | Type | Tag name |
| --- | --- | --- |
| Product detail | dropdown | `product_detail` |
| Cross-cutting category | text | `cross_cutting` |
| Institution / NGO | text | `institution` |
| Keywords | text | `keywords` |

Option lists for dropdowns are defined in:

- Web: `web/metadata.js` (`window.SLOW_UPLOAD_OPTIONS`)
- Android: `UploadFieldOptions.kt`
