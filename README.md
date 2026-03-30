# SLOW (Salone OIM Library) - Week 1 Bootstrap

This repository contains a practical Week 1 setup for the SLOW MVP:

- BookStack backend running in Docker
- API integration and validation scripts
- Architecture and API design notes
- Android WebView app with navigation + quick filter routing

## 1) Start Backend (BookStack + MariaDB)

1. Copy env template:

```bash
cp .env.example .env
```

2. Set values in `.env`:

- `APP_URL` (example: `http://localhost:6875`)
- `BOOKSTACK_API_TOKEN_ID`
- `BOOKSTACK_API_TOKEN_SECRET`

3. Start services:

```bash
docker compose up -d
```

4. Open BookStack in browser:

`http://localhost:6875`

## 2) Test API

Run:

```bash
chmod +x scripts/api_smoke_test.sh
./scripts/api_smoke_test.sh
```

Validation checks:

- API health and token auth
- List resources (pages)
- Search endpoint behavior
- Tag-based search query strategy (`country`, `category`, `type`)

## 3) Android WebView App (MVP Skeleton)

Project path: `android-webview/`

### Configure

Set the BookStack URL in `android-webview/app/src/main/res/values/strings.xml`:

- `bookstack_base_url` = your reachable URL from Android emulator/device

Examples:

- Android emulator to local machine: `http://10.0.2.2:6875`
- Physical device (same LAN): `http://<your-computer-ip>:6875`

### Run

Open `android-webview/` in Android Studio and run the `app` module.

Current screens:

- Home/Web container
- Profile shortcut
- Resource list shortcut
- Quick filter actions:
  - Country (`Sierra Leone`)
  - Category (`savings`)
  - Type (`document`)

These route to BookStack URLs from a bottom navigation bar.

## 4) Week 1 Output Mapping

- Backend running: `docker-compose.yml`
- API tested: `scripts/api_smoke_test.sh`
- API validation logic: `scripts/bookstack_api_validate.py`
- Data/API design: `docs/architecture.md`
- Resource/content structure plan: `docs/resource_content_structure.md`
- Android app routing: `android-webview/`

## 5) Logged Work -> Delivered Artifacts

- **BookStack setup**
  - `docker-compose.yml`
  - `.env.example`
- **Resource/content structure implementation planning**
  - `docs/resource_content_structure.md`
- **BookStack API integration (pages + search)**
  - `scripts/bookstack_api_validate.py`
  - `scripts/api_smoke_test.sh`
- **Android resource navigation flow validation**
  - `android-webview/app/src/main/java/com/slow/library/MainActivity.kt`
  - `android-webview/app/src/main/res/layout/activity_main.xml`
- **Tag-based filtering strategy implementation**
  - Quick filter routes in Android app
  - Search composition in API validator

## 6) Next (Week 2)

- Seed tags/categories conventions (`country`, `category`, `type`)
- Create admin moderation pages/process
- Add resource upload and edit flows validation
- Add filtered search UI shortcuts for Android
