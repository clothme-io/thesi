# Thesi

UGC business platform for the ClothME Creator Community.

- **thesi-web** — Next.js 15 frontend
- **thesi-api** — NestJS 11 backend

## Quick start (Docker)

```bash
cd thesi
cp thesi-api/.env.example thesi-api/.env
cp thesi-web/.env.example thesi-web/.env.local
docker compose up --build
```

| Service    | URL                        |
|------------|----------------------------|
| Web        | http://localhost:3010      |
| API        | http://localhost:5010/v1   |
| Swagger    | http://localhost:5010/v1/api |
| Postgres   | localhost:5433             |

## Local development (without Docker)

### API

```bash
cd thesi-api
cp .env.example .env

# Start Postgres only (from thesi/ root)
cd .. && docker compose up postgres -d && cd thesi-api

npm run db:migrate
npm run start:dev
```

**Important:** When running the API or migrations on your machine, `.env` must use `localhost:5433`. The hostname `postgres` only works inside Docker Compose.


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

## Database

Uses shared PostgreSQL / TimescaleDB (Option A) with `thesi_*` tables in a dedicated schema namespace.

## Phase 1 (current)

- [x] Project scaffolding
- [x] Creators landing, apply, and success pages (ported from clothme-client)
- [x] Creator applications API + BFF proxy
- [x] Docker Compose local stack
- [ ] Database migrations on shared TimescaleDB (deferred — schema strategy TBD)

## Phase 2 (UI — in progress)

- [x] Sign-in and sign-up pages
- [x] Onboarding flow UI (change password → founder welcome → questionnaire)
- [x] App shell with collapsible sidebar + dashboard placeholder
- [x] Auth context with **dev mode** (no database required)
- [ ] Backend auth API (wired when migrations are ready)

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

