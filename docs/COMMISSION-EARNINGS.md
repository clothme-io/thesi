# Commission earnings: local implementation and rollout

Implemented locally on 2026-09-12. Nothing in this phase deploys a service, applies a migration, charges a customer, creates a creator payout, or changes live Thesi flags.

## What now exists

1. Customer API reconciles attributed order lines against durable commerce orders, captured payments and credit-spend ledger entries. For Stripe payments it retrieves the current PaymentIntent and expanded latest charge directly from Stripe, verifies captured amount/currency, and observes refunds and disputes. Pending orders never generate earnings.
2. Commerce V19 stores a durable delivery obligation for every changed order-line observation. The worker retries failures with bounded exponential backoff. Earlier revisions must be delivered before later revisions for that line. Restarting does not lose undelivered events.
3. Thesi V37 stores immutable event revisions and commission adjustments. The same event delivered twice is acknowledged without a second calculation. Reusing an event identity with different facts or skipping a revision fails. Accepted campaign terms are loaded from Thesi's historical receipt; the sender cannot select a different creator or rate.
4. Creators and brand owners see `/app/commission-earnings` in Thesi when the web flag is enabled. Brand access uses the selected workspace and requires its owner. Creator access uses the authenticated creator ID.
5. Merchant Hub's existing Thesi integration card can show the selected brand's commission totals. Vendor API rechecks active vendor ownership for each request. Thesi requires the current, unrevoked Merchant-to-workspace link and restricts results to that vendor and brand.
6. ClothME admin has `/creator-commission`, linked from its sidebar. It verifies a database-backed, unexpired admin session and the existing `analytics.read` permission. Mock staff are never accepted for this report. Each environment has its own Thesi origin and read-only report key.
7. Commerce earning events include transaction evidence for reconciliation: payment source type, Stripe PaymentIntent IDs, charge IDs, captured cents, refunded cents and captured credit cents. These identifiers are provider references only; buyer identity is not included.

Every view reads the same Thesi ledger. Reports distinguish **under review**, **held**, and **fully reversed** amounts. They expose neither a withdrawable balance nor payment controls. Base content payments remain separate.

The report now also includes confirmed movement sections when the later local ledgers are present:

- `settlementTotals` comes from the latest confirmed settlement result per attributed order line. It separates creator paid, creator recovered, net creator paid, refund offsets and vendor returns.
- `baseTotals` comes from the campaign base funding ledger. Creator reports show creator obligations and released/cancelled base for that creator. Brand, Merchant-linked and operations reports include campaign-level planned deposits, captured deposits and unused-slot refunds for the selected workspace scope.
- These arrays are empty when the funding/settlement migrations are not present, so an earnings-only environment continues to return the estimate report instead of failing.

## Monetary rules

- Eligible sale amount is `unit_amount_cents × quantity × (attributed_quantity / quantity) − attributed_discount`, where attributed discount is already represented by the attributed line net. Tax and shipping are excluded. An unallocated order discount, mismatched totals, currency mismatch, deleted source data or unresolved order state places the estimate on hold.
- Percentage of sale uses that attributed net merchandise amount and the percentage in the creator's accepted snapshot.
- Percentage of platform commission uses the stored payable/paid vendor split's platform fee. The fee is first allocated across all split lines, then reduced to each attributed line portion. Largest remainder allocation preserves the fee total; equal remainders use order-line ID ordering. An absent or inconsistent split holds platform-fee-based earnings instead of estimating a default fee.
- Percentage is represented as integer basis points. Multiply with BigInt, divide by 10,000 and round down once per line. No per-unit rounding or floating-point multiplication.
- Accepted campaigns currently use USD. Other purchase currencies are held, with no automatic currency conversion.
- Accepted free-text eligibility, return windows, and settlement timing cannot safely be treated as executable rules. Even a clean purchase is **under review**, not payable.

## Refunds, cancellation and limitations

The existing commerce code has no complete refund/returns workflow or authoritative mapping from a Stripe order-level refund to individual returned products. This phase observes provider refunds rather than initiating them.

- Only provider refund records with `status=succeeded` count toward reversals. Pending refunds hold estimates; failed/cancelled refunds do not reverse them. Incomplete histories (more than 100 refund records for a charge) require reconciliation.
- A verified refund of the entire captured order amount reverses the line's commission estimate to zero and appends a negative adjustment. Earlier history remains intact.
- A partial refund holds all attributed lines in that order. It does **not** guess which product was returned or proportionally deduct a refund from unrelated creators. Exact partial-refund allocation is still a required follow-up before settlement.
- A Stripe refund in a mixed credit/Stripe order is not treated as a full order refund unless it covers the full captured total. Returning credits is not implemented by this phase. Cancelled/refunded order status without matching verified refund evidence remains held.
- Disputed charges are held. Automated dispute-resolution release is not implemented.
- Pending cancelled orders have no earnings to reverse. Completed/expired campaigns or disconnected brands do not erase a previously attributed purchase; historical reporting and ingestion use the accepted receipt at the original purchase time.
- A provider/API outage does not fabricate a new observation or clear an existing balance. The last recorded calculation remains visible. Report dates are calculation dates, not a claim of real-time payment freshness.
- No payout, commission reserve, payer liability, tax, currency conversion, base-payment obligation, or merchant-fee collection logic is added.

## Delivery and operations

`CommissionDeliveryService` starts only with `THESI_EARNINGS_ENABLED=true`. It checks for Commerce V19 before starting. It scans ten attributed, non-pending orders per tick and advances through order UUIDs, resetting at the end. Ticks run every 60 seconds; long ticks do not overlap in a process. A PostgreSQL session advisory lock serializes workers across instances. The lock is released when the session closes after a crash.

The worker then attempts up to fifty ready events. Failure keeps the event and schedules another attempt, capped at one hour. HTTP calls have timeouts and reject redirects. There is no maximum-attempt discard. A conflicting or invalid event blocks later revisions for its line while other lines can continue. Logs identify the order or event needing reconciliation without printing service keys or buyer identities.

This is polling-based reconciliation, not a webhook latency guarantee. Scanning is intentionally modest for a disabled pilot; a production-volume cursor/lease queue, backlog alerting and verification-freshness monitoring are prerequisites to wider rollout. Pausing delivery preserves queued events, but reports stop receiving new facts. Do not use a paused/stale report to authorize payouts.

Useful read-only operational checks after a separately approved migration/activation:

```sql
SELECT count(*) AS pending, min(created_at) AS oldest_pending,
       max(attempts) AS highest_attempts
FROM commerce.creator_earning_outbox WHERE delivered_at IS NULL;

SELECT order_line_id, revision, attempts, next_attempt_at
FROM commerce.creator_earning_outbox
WHERE delivered_at IS NULL ORDER BY created_at LIMIT 100;
```

The internal Thesi operations report is read-only and returns scoped aggregate amounts, confirmed movement, base funding totals and a bounded latest-line preview. It excludes shopper identity. Totals cover the entire scope rather than just the latest 100 lines. Reporting and ingestion keys are separate; neither is sent to a browser.

Customer API also exposes `POST /v1/internal/creator-settlements/operations` behind `X-Thesi-Settlement-Key`. The response summarizes pending and ready outbox events, oldest pending delivery, highest retry count, settlement operation states, current earning hold reasons, refund allocation gaps and active risk holds. It is an operational health snapshot, not an approval to settle money; operators still need the line-level settlement/recovery controls and provider evidence for any action.

## Configuration and deployment order (not executed)

1. Review and apply `clothme-db/databases/commerce/sql/V19__commission_event_delivery.sql` and `databases/thesi/sql/V37__commission_earnings.sql` **after** their V18/V36 prerequisites, first to disposable/staging databases. Thesi V37 is append-only and rejects UPDATE/DELETE on events.
2. Deploy compatible service code with flags false. Existing Thesi product/link/workspace migration and rollout requirements still apply.
3. Provision separate server-only keys:
   - Thesi: `EARNINGS_SERVICE_KEY`, `EARNINGS_REPORT_SERVICE_KEY` (at least 32 characters, different values).
   - Customer API: `THESI_EARNINGS_SERVICE_KEY` matches only Thesi's ingestion key; fixed `THESI_API_URL`; Stripe credentials for that same commerce environment. Real Stripe verification is required; the fake checkout gateway cannot generate verified earnings.
   - ClothME admin: `THESI_EARNINGS_DEV_API_URL`, `THESI_EARNINGS_DEV_REPORT_KEY`, `THESI_EARNINGS_DEV_ENABLED`; equivalent `STAGING` and `PROD` keys. Never point a development commerce database at a live Thesi ledger.
4. Enable Thesi `COMMISSION_EARNINGS_ENABLED=true` with workspace access enforcement. Enable Customer API `THESI_EARNINGS_ENABLED=true` only for the matching test environment. New-link creation can remain paused independently; historical reconciliation must continue after campaign expiry.
5. Enable UI flags for the pilot: Thesi `NEXT_PUBLIC_COMMISSION_EARNINGS_ENABLED=true`, Merchant Hub `NEXT_PUBLIC_THESI_EARNINGS_ENABLED=true` (existing linking flag still required), admin's environment-specific enabled flag. Public flags need a web rebuild.
6. Test a captured sale, duplicate delivery, partial refund, full refund, service outage/recovery, different creators and workspaces, Merchant disconnect and unauthorized admin sessions. Reconcile the source outbox and destination ledger before any live activation.
7. Production rollout requires separate approval. Do not enable settlement based on completing this phase.

## Validation

The disposable PostgreSQL harness exercises real compiled services, migrations, SQL queries, outbox delivery and reports. Stripe responses are local fixtures; no Stripe account or production database is contacted:

```sh
node scripts/test-creator-attribution.mjs /path/to/@electric-sql/pglite/dist/index.js --earnings
```

Additional tests cover integer rounding, platform-fee allocation, malformed financial DTOs and separated read/write service keys. API and web suites/build checks should be run using the repository's installed dependencies.

## Next implementation work

1. Build authoritative line-level returns/refund allocation, including tax/shipping treatment, quantity limits, mixed-credit refunds and idempotent refund source records. Update accepted eligibility rules where necessary; never silently rewrite existing accepted terms.
2. Replace review-only estimates with explicit qualification/release rules, approval/audit transitions, reconciliation monitoring and fraud/dispute controls. Preserve this immutable event history.
3. Implement base-payment obligations separately using accepted content milestones and owner-approved payer/funding configuration per workspace.
4. Add independently retryable commission settlement, funding/reserves, payout reconciliation and reversal handling. Reporting must continue to separate estimated, held, payable and paid amounts.
5. Complete staging end-to-end checks and a production pilot plan before applying migrations or enabling live flags.

### Checks completed locally

- Thesi API: full suite passed (211 tests at that run), then the added service-key/DTO suite passed (5 tests); commission payment wording regression suite also passed (16 tests).
- Customer API: full suite passed (194 tests). The final refund-status change compiled and was covered by the disposable database flow.
- Vendor API: build passed; Merchant integration service tests passed (6 tests).
- Thesi web: full suite passed (100 tests), type-check and production build passed using localhost-only placeholder APIs. The built report was inspected at desktop and 390px mobile widths with local fixtures and all external browser requests blocked.
- Merchant Hub and ClothME admin: TypeScript checks passed. Their real authenticated browser flows were not exercised against deployed services.
- Disposable PostgreSQL: verified source-to-outbox-to-ledger-to-report flow, retry after delivery failure, duplicate/conflicting/out-of-order events, fee allocation including unattributed lines, account/workspace isolation, pending/partial refund holds, full-refund reversal, immutable history and reporting after disconnect.
- Diff whitespace checks passed across the affected repositories.

No real Stripe, database, Merchant or production API was contacted by these checks. Admin dependencies were installed from the existing lockfile for local type-checking; package manifests and lockfiles were not changed.


### Approved clarification: optional base payment

Commission campaigns support commission only or commission plus an explicitly enabled fixed base. An absent/disabled base creates no fixed-payment obligation, content-payment trigger or estimated fee on a fixed payout. Existing accepted terms remain unchanged. Future base obligations and funding must be created only when the accepted snapshot explicitly enables a base; commission settlement proceeds independently. Exact refund allocation and funded settlement remain subsequent implementation work; this clarification does not enable production or payouts.

### Allocated refunds and proposed payout terms — next local phase

[REFUNDS-AND-PAYOUT-TERMS.md](./REFUNDS-AND-PAYOUT-TERMS.md) describes the default-off Commerce V20 allocation endpoint, cumulative merchandise refund deductions and campaign payout/funding proposals. These extend the earlier blanket partial-refund hold when verified allocations are available. Payout handler defaults to ClothME; funding depends on campaign terms and still requires separate approval. Settlement remains unavailable.

### Approved funding flow — current update

The proposed payer/funder choices above are superseded by [CAMPAIGN-FUNDING.md](./CAMPAIGN-FUNDING.md). Local Thesi V38 adds optional-base deposits, accepted-work release and unused-slot refunds. Commerce V21 adds sales commission withholding before vendor payout. Automatic commission settlement remains pending; neither reserves nor estimates imply a completed creator payment.
