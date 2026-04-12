# SLOW (Salone OIM Library)

How to run this project locally.

## Backend (OIM visual resource API)

The current MVP is built around:
- visual/icon resource uploads stored in **PostgreSQL** + **local disk**
- lightweight sign-in with database-backed sessions
- basic admin user listing for `admin`, `member`, and `guest`

### Run Postgres + backend (Docker Compose)

If you have Docker available:

```bash
export OIM_API_KEY=change-me
export OIM_ADMIN_EMAILS=brett@example.com
docker compose up -d postgres oim_backend
```

The API runs at `http://127.0.0.1:3001/api`.

### Run backend locally (without Docker)

1. Start Postgres (via Docker or your own installation).
2. In `backend/`:

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Set `ADMIN_EMAILS` in `backend/.env` to whichever emails should sign in as admins.

## Web UI (sign in + icon uploads + admin)

1. Create `web/config.local.json`:

```bash
cp web/config.local.json.example web/config.local.json
```

Set:
- `backendBaseUrl` (default `http://127.0.0.1:3001/api`)

2. Start the web server:

```bash
python3 web/server.py
```

3. Open `http://127.0.0.1:8080`

4. Sign in with any email.
If the email matches `ADMIN_EMAILS`, the app exposes the admin page.

## Main API endpoints

- `POST /api/auth/sign-in`
- `GET /api/auth/session`
- `POST /api/auth/sign-out`
- `GET /api/users` (admin only)
- `POST /api/resources/upload`
- `GET /api/resources`
- `GET /api/resources/search`
- `GET /api/resources/:id`
- `GET /api/resources/:id/file`

## Deployment / sharing

For fast testing this week:

1. Run backend on a reachable host or tunnel:

```bash
ngrok http 3001
```

2. Update `web/config.local.json` so `backendBaseUrl` points to the shared backend URL plus `/api`.

3. Serve `web/` from any static host or from:

```bash
python3 web/server.py
```

If you need a quick all-local demo, running the backend on `3001` and the web server on `8080` is enough.

## Legacy API smoke test (optional)

```bash
chmod +x scripts/oim_backend_smoke_test.sh
BASE_URL=http://127.0.0.1:3001/api API_KEY=change-me ./scripts/oim_backend_smoke_test.sh
```

---

## Legacy backend (BookStack) (optional)

If you still want to run BookStack (not required for uploads anymore):

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

## BookStack smoke test (optional)

```bash
chmod +x scripts/api_smoke_test.sh
./scripts/api_smoke_test.sh
```

## Android app (`android-webview/`)

1. Open the `android-webview` folder in Android Studio.
2. In `android-webview/app/src/main/res/values/strings.xml`, set:
   - `bookstack_base_url` — URL your device/emulator can reach (e.g. emulator: `http://10.0.2.2:6875`).
   - Optional: `bookstack_api_token_id` and `bookstack_api_token_secret` for native upload/API calls.
3. Run the **app** configuration on a device or emulator.
