# Thesi

UGC business platform for the ClothME Creator Community.

- **thesi-web** — Next.js 15 frontend
- **thesi-api** — NestJS 11 backend

## Quick start (Docker)

**Requires clothme-db Postgres running first:**

```bash
cd ../clothme-db
docker compose up -d postgres
./scripts/migrate.sh thesi

cd ../thesi
cp thesi-api/.env.example thesi-api/.env
cp thesi-web/.env.example thesi-web/.env.local
docker compose up --build
```

### Production images (local smoke test)

Same DB prerequisite, then:

```bash
cd thesi
docker compose -f docker-compose.prod.yml up --build
```

| Service    | URL                        |
|------------|----------------------------|
| Web        | http://localhost:3010      |
| API        | http://localhost:5010/v1   |
| Health     | http://localhost:5010/v1/health |
| Swagger    | http://localhost:5010/v1/api |
| Postgres   | localhost:5434 (clothme-db, DB `thesi`) |

## Local development (without Docker)

### API

```bash
cd thesi-api
cp .env.example .env

# Start clothme-db Postgres and migrate thesi database
cd ../../clothme-db && docker compose up -d postgres && ./scripts/migrate.sh thesi
cd ../thesi/thesi-api

npm run start:dev
```

**Important:** `.env` must use `localhost:5434` (clothme-db). Migrations run from `clothme-db`, not from Thesi.


### Web

```bash
cd thesi-web
cp .env.example .env.local
npm run dev
```

## Platform fee

Campaign platform fee = **min($250, 2% of total brand-to-creator payout)**.

Implemented in `thesi-api/src/shared/platform-fee/platform-fee.util.ts`.

## Email

Supports **Resend** (primary) and **AWS SES** (fallback). If neither is configured, emails are logged to the console in development.

| Variable           | Purpose              |
|--------------------|----------------------|
| `RESEND_API_KEY`   | Resend API key       |
| `AWS_SES_REGION`   | SES region           |
| `AWS_ACCESS_KEY_ID`| AWS credentials      |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `EMAIL_FROM`       | Sender address       |

## Database (Flyway)

**All migrations live in [`clothme-db`](../clothme-db/databases/thesi/).** Thesi does not run its own Flyway.

| Command | Purpose |
|---------|---------|
| `cd ../clothme-db && ./scripts/migrate.sh thesi` | Apply pending migrations |
| `./scripts/db-migrate.sh` | Shortcut (delegates to clothme-db) |
| `./scripts/db-info.sh` | Show migration status |

Add new SQL under `clothme-db/databases/thesi/sql/` as `V{n}__description.sql`. Keep `thesi-api` Drizzle schemas in sync (ORM only).

## Phase 1 (current)

- [x] Project scaffolding
- [x] Creators landing, apply, and success pages (ported from clothme-client)
- [x] Creator applications API + BFF proxy
- [x] Docker Compose local stack (API + web; DB via clothme-db)
- [x] Database `thesi` in clothme-db
- [ ] Additional schema migrations (via clothme-db)

## Phase 2 (UI — in progress)

- [x] Sign-in and sign-up pages
- [x] Onboarding flow UI (change password → founder welcome → questionnaire)
- [x] App shell with collapsible sidebar + dashboard placeholder
- [x] Auth context with **dev mode** (no database required)
- [x] Backend auth API (`thesi_users`, JWT, refresh tokens, onboarding)
- [x] Flyway baseline in clothme-db (`thesi` database)
- [x] Admin creator-application approve → user invite with temp password
- [x] Creator and brand profiles integrated through the API (`V2`)
- [x] Creator and brand workspace settings integrated through the API (`V3`)

### Auth API endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/auth/signup` | Brand self-serve registration |
| `POST /v1/auth/signin` | Sign in |
| `POST /v1/auth/refresh` | Rotate access token |
| `POST /v1/auth/change-password` | First-login / password change (JWT required) |
| `POST /v1/onboarding/welcome` | Advance welcome step (JWT required) |
| `POST /v1/onboarding/questions` | Persist onboarding answers (JWT required) |
| `GET /v1/creator-applications` | List applications (admin key) |
| `PATCH /v1/creator-applications/:id/approve` | Approve + create creator account (admin key) |
| `GET /v1/profile` | Read the authenticated creator or brand profile |
| `PUT /v1/profile/creator` | Save the authenticated creator profile |
| `PUT /v1/profile/brand` | Save the authenticated brand profile |
| `GET /v1/settings` | Read settings for the authenticated account role |
| `PUT /v1/settings/creator` | Save creator notification and workspace settings |
| `PUT /v1/settings/brand` | Save brand notification and workspace settings |

Admin requests require header `X-Admin-Api-Key` (set `ADMIN_API_KEY` in `thesi-api/.env`).

### Preview auth UI without database

```bash
cd thesi-web
# NEXT_PUBLIC_AUTH_DEV_MODE=true is set in .env.local
npm run dev
```

1. Open http://localhost:3000/sign-in
2. Use any email + password to sign in
3. Use password `temp123` to simulate a first-login temporary password (forces change-password step)
4. Complete onboarding → lands on `/app/dashboard`

Turn off dev mode when connecting to the real API:

```
NEXT_PUBLIC_AUTH_DEV_MODE=false
```

