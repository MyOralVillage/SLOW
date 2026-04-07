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

3. In the browser, finish BookStack setup and create at least one **book**. Note its **numeric id** (from the book URL or API).

4. In BookStack: **User profile → API Tokens** → create a token with access to create pages and attachments.

5. Open the main site (default compose port **6875**):

`http://localhost:6875`

## Web UI (uploads to BookStack)

Browsers block cross-origin API calls. This project includes a small **proxy** so uploads work from `http://127.0.0.1:8080`.

1. Copy the web config template and add your token + book id:

```bash
cp web/config.local.json.example web/config.local.json
```

Edit `web/config.local.json`:

- `apiTokenId` / `apiTokenSecret` — from BookStack API tokens  
- `defaultBookId` — id of the book where new pages should be created  
- `useBookStackProxy` — keep `true` when using `web/server.py` below  
- `bookStackPublicUrl` — usually `http://localhost:6875` (used for “open BookStack search” in the UI)

`web/config.local.json` is gitignored so secrets are not committed.

2. From the **repository root**, start the static server **with** the BookStack proxy:

```bash
export BOOKSTACK_URL=http://localhost:6875
python3 web/server.py
```

3. Open **http://127.0.0.1:8080** and use **Submit** — resources should appear in BookStack under the book you configured.

If you only run `python3 -m http.server` inside `web/`, the page loads but **Submit cannot reach BookStack** (CORS). Use `web/server.py` for full uploads.

## API smoke test (optional)

```bash
chmod +x scripts/api_smoke_test.sh
./scripts/api_smoke_test.sh
```

Requires a filled `.env` with valid API tokens.

## Android app (`android-webview/`)

1. Open the `android-webview` folder in Android Studio.
2. In `android-webview/app/src/main/res/values/strings.xml`, set:
   - `bookstack_base_url` — URL your device/emulator can reach (e.g. emulator: `http://10.0.2.2:6875`).
   - Optional: `bookstack_api_token_id` and `bookstack_api_token_secret` for native upload/API calls.
3. Run the **app** configuration on a device or emulator.
