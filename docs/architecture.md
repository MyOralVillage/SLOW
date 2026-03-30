# SLOW MVP Architecture (Week 1)

## 1) System shape

- **Backend/CMS:** BookStack (single source of truth)
- **Storage:** MariaDB + BookStack attachment storage
- **Web UI:** Native BookStack interface
- **Android UI:** WebView wrapper around same BookStack instance

This guarantees web and Android parity with no duplicated business logic.

## 2) Logical data model

### User
- `id`
- `name`
- `email`
- `role` (`admin`, `member`, `guest`)
- `profile` fields (country, bio, avatar)

### Resource (BookStack Page)
- `id`
- `title`
- `content` (markdown/html)
- `tags` (key-value, required for filtering)
- `attachments` (documents, images, audio)
- `status` (approved/rejected for moderation flow)

### Comment
- `id`
- `resource_id` (page id)
- `user_id`
- `content`
- `parent_comment_id` (for replies)

## 3) Required tag keys for filter/search

- `country`
- `category`
- `type`

Example:

- `country:Sierra Leone`
- `category:savings`
- `type:document`

## 4) Phase 1 endpoint map (BookStack API)

### Auth
- API token header:
  - `Authorization: Token <token_id>:<token_secret>`

### Resources
- List resources: `GET /api/pages`
- Create resource: `POST /api/pages`
- Update resource: `PUT /api/pages/{id}`
- View resource: `GET /api/pages/{id}`
- Delete/take down (admin): `DELETE /api/pages/{id}`

### Search/Discovery
- Search: `GET /api/search?query=<keyword>`
- Filtering strategy:
  - convention-based query + tag values in page content/tags
  - enforced tag keys in content workflow

### Files
- Upload attachment: `POST /api/attachments`
- Download/view via BookStack attachment links

### Discussion
- Use BookStack comments at page level for discussion thread behavior

### User/Profile
- Use BookStack user profile and role management endpoints/UI where available

## 5) Week 1 deliverables checklist

- [x] BookStack + DB dockerized and bootable
- [x] API smoke test script
- [x] Android WebView shell
- [x] Data model and endpoint mapping

## 6) Deferred to later phases

- Messaging between users
- Notification system
- Recommendation engine
- Advanced certification workflows
