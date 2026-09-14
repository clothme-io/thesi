# Local payments walkthrough

Open http://127.0.0.1:3011/local-payments. The page is explicitly labeled simulated money. PostgreSQL runs in Docker; the demo API and Thesi web run as local Node processes. It does not use production credentials or contact Stripe.

## Start

Prerequisites: Node/npm, installed dependencies in `thesi-api`, `thesi-web` and sibling `customer-api`, sibling `clothme-db` migrations, and a working Docker engine. On this Mac, Colima profile/context `thesi-demo` / `colima-thesi-demo` supplies Docker because current Docker Desktop requires a newer macOS.

```sh
colima start --profile thesi-demo --cpu 4 --memory 6 --disk 30 --vm-type vz
DOCKER_CONTEXT=colima-thesi-demo bash scripts/local-payments/start.sh
```

If the Compose plugin is not discovered, set `COMPOSE_BIN=/usr/local/opt/docker-compose/bin/docker-compose`. The script builds both APIs, starts the disposable database, then the adapter and web. Ports: PostgreSQL 5844, API 5011, web 3011, all on loopback. Do not start another copy while these ports are occupied. Ctrl-C stops the script's web/API processes; Docker remains available for inspection.

The PostgreSQL data directory is tmpfs. Container recreation discards only this demonstration's data. Restarting the adapter reuses existing fixture state and does not undo completed payouts. The `demo` database password in Compose is a public local fixture, never a deployment credential.

## Walkthrough

1. Review and confirm the $300 base deposit ($100 × 3 creators), then publish.
2. Simulate two creator acceptances. Record acceptance of Ada's work and release $100.
3. Close the campaign: the empty slot refunds $100 and Ben's unresolved $100 remains held. Ben's work can still be accepted afterward.
4. In the sales section, review the $500 merchandise sale. Enter an approval reason and qualify its $50 commission. No commission deposit is required.
5. Simulate a $100 merchandise refund. Reconcile once to reverse $10 from the creator, then again to apply the recovered $10 to that customer refund.
6. Inspect operation history. On a fresh unpaid fixture, “Lose next transfer response” exercises idempotent retry; “Toggle payment dispute” demonstrates a settlement hold.

The September 13 browser check completed steps 1–5 and verified the mobile layout. The open database therefore displays results, rather than a fresh unpaid campaign.

## Isolation and coverage

`THESI_LOCAL_PAYMENTS_DEMO=true` is required for the walkthrough and its proxy; the default page/proxy return 404. The startup script sets backend URLs explicitly to the local adapter. Never set this flag in a deployed environment.

The adapter seeds fictitious users, a linked merchant brand, campaigns, accepted terms, attribution and one captured sale. It invokes compiled application funding, settlement, reserve and earnings services with Docker PostgreSQL and a persistent fake provider. It intentionally supplies demo authentication and direct internal dispatch. It is not the full deployed Nest/JWT/Commerce HTTP system, a real checkout, a live product destination, or Stripe test-mode validation.

The “Open campaign” and “Open earnings” links reuse parts of the actual Thesi UI, but this focused adapter implements only payment walkthrough endpoints; unrelated app features are outside this local harness. Use the real services and test account configuration for the following dev stage.

## Validation record

- Thesi API: 32 suites, 243 tests across the full run and corrected focused rerun; API build passed.
- Customer API: 81 suites, 194 tests; API build passed.
- Web: 26 suites, 104 tests; funding component rerun after polling change passed, type check and production build passed. Existing image/lint warnings remain.
- Disposable SQL/service integration: attribution, base funding, operator cancellation, net discounts, reserves, settlement, replay and partial-refund recovery passed.
- Chrome: deposit, launch, accepted-work release, commission qualification, refund reversal/offset, closure balances and mobile overflow checked against Docker PostgreSQL.
