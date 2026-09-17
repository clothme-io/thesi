# Phase 11 — dev rollout and production-readiness gates

Status: local/dev-prep workflow. Do not treat this as production approval. Thesi is live, but commission settlement, scheduled settlement and combined-balance payout must stay disabled in production until dev evidence and final approval are complete.

Stripe provider setup, key order, creator onboarding gates and test-mode evidence are tracked in [Stripe payments rollout](./STRIPE-PAYMENTS-ROLLOUT.md).

## Release principle

Schema changes are owned by `clothme-db` and must reach shared environments only through GitHub Actions and Argo. Do not run Flyway, psql DDL, Drizzle push, Prisma migrate or laptop scripts against clothme-dev or clothme-prod. Local Flyway rehearsal is allowed only against local Docker databases.

Application releases go through the existing GitHub workflows:

- `thesi-api/.github/workflows/release.yml` builds/tests/deploys the API to dev, waits for `https://dv.get-thesi.com/v1/ready`, then opens a prod approval issue.
- `thesi-web/.github/workflows/release-web.yml` builds/tests/deploys the web app to dev, waits for `https://dv-app.get-thesi.com/`, then opens a prod approval issue.
- `clothme-db/.github/workflows/release.yml` builds the Flyway image, bumps the dev migrate Job, waits for completion, then opens a prod migration approval issue.

The current app workflows intentionally do not complete production rollout because the `prod-wait-preview` steps still stop at kubeconfig setup. That is a production gate, not a dev blocker.

## Required local evidence before dev

Run these from the local workspace using the bundled Node runtime when needed:

```sh
node scripts/phase11-readiness-audit.mjs
cd thesi-api && npm run build
cd thesi-api && npm test -- src/api/commission-earnings/commission-settlement-security.spec.ts src/api/commission-earnings/commission-security.spec.ts src/api/commission-earnings/settlement-math.spec.ts src/platform/config/env.validation.spec.ts
cd ../thesi-web && npm run lint
cd ../thesi-web && npm run build
cd ../../customer-api && npm run build
cd ../../customer-api && npm test -- src/modules/commerce/application/commission-risk.spec.ts src/modules/commerce/application/earning-facts.spec.ts
```

If Turbopack hangs in the sandbox, rerun the same web build in an environment that can spawn its worker. This is a local execution limitation, not a code change.

## Local database rehearsal

Start local Docker Postgres and migrate only the local databases:

```sh
cd ../clothme-db
docker compose up -d postgres
./scripts/migrate.sh core
./scripts/migrate.sh catalog
./scripts/migrate.sh commerce
./scripts/migrate.sh thesi
```

Optional local backup/restore rehearsal:

```sh
mkdir -p /tmp/clothme-phase11-backups
PGPASSWORD=postgres pg_dump -h localhost -p 5434 -U postgres -Fc thesi > /tmp/clothme-phase11-backups/thesi.dump
createdb -h localhost -p 5434 -U postgres thesi_restore_check
PGPASSWORD=postgres pg_restore -h localhost -p 5434 -U postgres -d thesi_restore_check /tmp/clothme-phase11-backups/thesi.dump
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d thesi_restore_check -c "select count(*) from flyway_schema_history;"
dropdb -h localhost -p 5434 -U postgres thesi_restore_check
```

For dev/prod, use managed database backup tooling and record restore evidence before enabling live money movement. Do not use local connection strings for dev/prod.

## Dev deployment order

1. Deploy `clothme-db` migrations to dev through the `clothme-db` Release workflow. Wait for the dev Flyway Job to complete.
2. Confirm dev app secrets are present but keep new money-movement flags disabled first:
   - `COMMISSION_SETTLEMENT_ENABLED=false` until Stripe/Commerce dev wiring is ready.
   - `COMMISSION_SETTLEMENT_AUTO_ENABLED=false` initially.
   - `COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED=false` initially.
3. Deploy `customer-api` to dev after Commerce build/tests pass and after Commerce migrations complete.
4. Deploy `thesi-api` to dev with reporting/linking/product flags as needed, settlement still off for first boot.
5. Deploy `thesi-web` to dev.
6. Verify baseline health:
   - `https://dv.get-thesi.com/v1/ready` returns 200.
   - `https://dv-app.get-thesi.com/` returns 200.
   - Merchant sign-in/linking still works in dev.
   - Existing non-commission Thesi login/onboarding still works.
7. Enable dev settlement in stages:
   - enable `COMMISSION_SETTLEMENT_ENABLED=true` only after `STRIPE_SECRET_KEY`, `SETTLEMENT_PLATFORM_ACCOUNT_ID`, `COMMERCE_SETTLEMENT_API_URL` and `COMMERCE_SETTLEMENT_SERVICE_KEY` are correct in both APIs.
   - run a manual line settlement in dev using test-provider accounts.
   - enable `COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED=true` and test a creator/currency group that reaches the accepted minimum across multiple lines.
   - enable `COMMISSION_SETTLEMENT_AUTO_ENABLED=true` only after manual and combined-balance tests pass.
8. Record evidence: workflow run URLs, Flyway Job name/image tag, app image tags, health checks, manual settlement result, combined-balance result, scheduled-batch result and rollback tag.

## Dev smoke tests

Use test data only:

- Create/link a Merchant brand to Thesi.
- Create a commission campaign with promoted products and accepted creator terms.
- Generate creator product links and complete a test order through Customer API.
- Confirm earnings appear as estimates first.
- Confirm a manual batch creates one batch statement and one line-level settlement request per ready order line.
- Confirm below-minimum individual lines are blocked when combined balance is disabled.
- Confirm below-minimum lines qualify only when the creator/currency group reaches the minimum and Commerce accepts the combined proof.
- Confirm scheduled settlement creates a scheduled batch only for ready lines.
- Confirm held, refunded, disputed, credit-funded or open-operation lines stay out of scheduled batches.

## Rollback plan

Rollback order for dev if a problem appears:

1. Disable `COMMISSION_SETTLEMENT_AUTO_ENABLED` first.
2. Disable `COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED` if minimum policy is wrong.
3. Disable `COMMISSION_SETTLEMENT_ENABLED` if settlement provider behavior is wrong.
4. Roll back app images through the API/web workflow `rollback` action using the last known good `sha-*` tag.
5. Do not attempt to roll back applied Flyway migrations by editing schema manually. Use forward-fix migrations unless an approved database restore plan is executed by the platform owner.

## Production gate

Production requires separate approval after dev evidence is complete. Before production, collect:

- current production app image tags and DB migration versions;
- verified backup/restore evidence from production-managed backup tooling;
- production secret inventory showing required keys exist without exposing values;
- dev evidence for manual settlement, combined-balance settlement and scheduled settlement;
- final rollback tag and operational owner for disabling flags.

Do not enable automatic settlement or live money movement in production until those items are reviewed and approved.
