# SLOW (Salone OIM Library)

How to run this project locally.

## Backend (BookStack)

1. Copy the environment template and edit `.env`:

```bash
cp .env.example .env
```

Set at least: `APP_URL`, `APP_KEY`, database vars, and (for API tests) `BOOKSTACK_API_TOKEN_ID` / `BOOKSTACK_API_TOKEN_SECRET`.

2. Start BookStack and MariaDB:

```bash
docker compose up -d
```

3. Open the app in a browser (default compose port is **6875**):

`http://localhost:6875`

## API smoke test (optional)

```bash
chmod +x scripts/api_smoke_test.sh
./scripts/api_smoke_test.sh
```

Requires a filled `.env` with valid API tokens.

## Web UI (`web/`)

```bash
cd web
python3 -m http.server 8080
```

Open `http://localhost:8080`.

To talk to BookStack from the browser (upload, browse, search API), set `config` in `web/app.js` (`apiBaseUrl`, `apiTokenId`, `apiTokenSecret`, `defaultBookId`).

## Android app (`android-webview/`)

1. Open the `android-webview` folder in Android Studio.
2. In `android-webview/app/src/main/res/values/strings.xml`, set:
   - `bookstack_base_url` — URL your device/emulator can reach (e.g. emulator: `http://10.0.2.2:6875`).
   - Optional: `bookstack_api_token_id` and `bookstack_api_token_secret` for native upload/API calls.
3. Run the **app** configuration on a device or emulator.
