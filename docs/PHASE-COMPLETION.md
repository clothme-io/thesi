# Original phase completion register

This register retains the original Phase 0–12 numbering. Implementation approval covers the remaining work. A phase is not complete merely because a local mock or an individual component passes. Production and real-money activation remain separate from local implementation. Stripe configuration is incomplete and provider tests are deferred by the user.

| Phase | Scope | Current gate |
| --- | --- | --- |
| 0 | Production readiness | Local migration and backup/restore rehearsal complete for changed DBs; live version inventory, managed dev/prod backup evidence and production rollback rehearsal pending |
| 1 | Brand workspaces | Owner-managed foundation implemented locally; Merchant-derived access completed with Phase 3 |
| 2 | Migration and isolation | Local schema/backfill/isolation tests and local representative migration rehearsal complete; workspace payer administration and managed dev/prod migration evidence pending |
| 3 | Merchant signup, linking, sign-in | Implementation and local acceptance complete; dev HTTPS/pilot activation remains a Phase 11 gate |
| 4 | Campaign products | Local implementation and acceptance complete: multiple products, variant eligibility, trusted prices and frozen/new agreements; dev activation remains Phase 11 |
| 5 | Commission rules | Approved defaults, audited risk/credit holds, owner batches, automatic scheduled batches and combined-balance policy are implemented locally; live provider/dev gates remain Phase 11 |
| 6 | Creator links/mobile | Durable handoff, native routes, reopen/paste continuation, association endpoints, optional provider routing and Docker browser order demo implemented. Android debug link opening, login-screen navigation, restart persistence and cancellation verified. Full native authenticated purchase, iOS and real HTTPS/store/deferred-delivery acceptance remain open |
| 7 | Cart/order attribution | Quantity-level checkout attribution implemented with attributed line-quantity mapping into sales reserve and earnings events |
| 8 | Ledger/events | Local implementation complete: durable reconciliation, credit/dispute holds, transaction-linked delivery evidence and guarded operations monitoring |
| 9 | Reports | Local implementation complete: reports separate estimates, confirmed commission movement and base-payment funding totals |
| 10 | Settlement | Local implementation complete: individual settlements, owner-run batch statements, opt-in automatic scheduled batches, combined-balance minimum policy, per-line idempotency and reportable outcomes verified; actual provider/dev pilot gates remain Phase 11 |
| 11 | Pilot/release | Phase 11 runbook and local readiness audit complete; local DB migration and backup/restore rehearsal complete; dev deployment/testing pending |
| 12 | External stores | Separate optional phase; external order/refund attribution not implemented |

## Phase 3 local acceptance — verified 2026-09-13

- [x] Merchant owner creates a new Thesi identity/workspace without inventing a password.
- [x] An existing email cannot silently link or convert a creator account; require authenticated brand-account consent.
- [x] Merchant owners connect and open two distinct catalog brands, preserving existing agreements and payer identity.
- [x] Thesi sign-in offers Continue with Merchant Hub with browser-bound, expiring, single-use authorization.
- [x] Every Merchant session records its external actor and connection; refreshed sessions preserve provenance.
- [x] Disabled Merchant owners/staff, removed brand assignments, revoked links and revoked sessions cannot continue accessing linked workspaces.
- [x] Staff use their own actor identity, explicit Merchant grants and selected brand scope; financial and connection administration remain owner-only.
- [x] Existing standalone Thesi login and onboarding continue working.
- [x] Missing brand details are requested without silently discarding onboarding requirements.
- [x] Exercise actual local HTTP guards and browser flows, including replay, conflicts, two brands, revocation, retries and cross-brand denial.
- [x] Record tests and any externally blocked gates; do not mark the full phase complete without evidence.


Evidence: Thesi API 34 suites / 256 tests; vendor-api 28 suites / 125 tests; Thesi web 28 suites / 112 tests; both frontend TypeScript checks and both API builds. V35 linking, V34 multi-brand isolation, V40 embedded PostgreSQL identity tests, connected Nest + Docker PostgreSQL HTTP tests, and the actual Thesi/Merchant browser handoff and onboarding passed. The HTTP journey verifies existing-account password proof, preservation of campaign/workspace identity, real staff campaign creation, real-actor audit, cross-brand denial, viewer downgrade and financial denial.

See [MERCHANT-SIGNIN.md](MERCHANT-SIGNIN.md) for exact scope, test commands and activation gates. The browser fixture seeds an existing Merchant session using a genuine locally issued vendor JWT; Merchant password entry and production identity services are not claimed as browser-tested. No production data, external email or real payment was used.

The next implementation phase is **Phase 6: creator links and mobile purchase destinations**. Phases 0, 2 and 11 still have environment/release gates; Phases 6–10 and optional Phase 12 retain the unfinished requirements in the table above. Completing local Phases 3–5 does not mark those phases complete.

Phase 6 progress and precise acceptance limits are recorded in [CREATOR-LINK-PHASE-6.md](CREATOR-LINK-PHASE-6.md). The local purchase fallback is an unpaid demonstration, not a production checkout. Reopening/pasting after installation is the tested fallback; provider-assisted automatic recovery still requires real store-delivery validation.

## Phase 7 local acceptance — verified 2026-09-14

- Checkout attribution writes the accepted `attributedQuantity` to `commerce.order_line_creator_attribution`, defaulting to full line quantity when absent.
- Sales reserve and hold checks now use attributed merchandise net for percentage-of-sale terms and proportional platform-fee allocation for percentage-of-platform-commission terms.
- Earnings event payloads now carry attributed `netSaleCents`, attributed `platformFeeCents`, and attributed refund deltas.
- Partial refunds and mixed-credit/allocator evidence remain limited to documented holds, with attributed refunds never exceeding attributed line proceeds in the emitted fact model.
- Commerce build passed with the phase-7 changes; relevant attribution and commission specs pass locally.

## Phase 8 local acceptance — verified 2026-09-14

- Commerce earning events now carry provider transaction evidence alongside the monetary facts: source type, Stripe PaymentIntent IDs, charge IDs, captured cents, refunded cents and credit-funded cents. Thesi's strict event DTO accepts this field over the real HTTP ingestion path.
- Credit-funded sales, split captures, disputes, pending refunds, incomplete refund histories and allocation gaps remain explicit hold reasons. Risk holds remain append-only and cannot clear payment, credit, refund or dispute holds.
- Customer API exposes a server-only `POST /v1/internal/creator-settlements/operations` snapshot behind the dedicated settlement service key. It reports pending/ready outbox events, highest retry count, settlement operation states, latest hold reasons, refund-allocation gaps and current risk holds without shopper identity.
- Transaction-linked settlement still rechecks the captured Stripe charge before transfers and records immutable provider operation entries; the operations snapshot makes pending/review states visible for recovery.
- Customer API build passed. Focused commission risk and earning-facts specs passed on the bundled Node runtime because the system Node 16/Jest combination could not resolve `ts-jest`.

## Phase 9 local acceptance — verified 2026-09-14

- The commission earnings report now returns estimate totals, confirmed settlement movement and base funding totals as separate sections, rather than presenting estimates as withdrawable money.
- Confirmed commission totals are derived from the latest confirmed settlement result per order line: creator paid, creator recovered, net paid, refund offsets and vendor returns.
- Base totals are derived from the V38 funding ledger: planned deposits, captured deposits, unused-slot refunds, creator obligations, released base and cancelled-obligation refunds. Creator reports show creator obligation/release totals; brand and operations reports include campaign fund totals.
- The report remains tolerant when V38/V39 are absent: earnings-only environments keep returning estimates with empty confirmed/base arrays.
- Thesi API build passed. Thesi web lint passed with existing warnings, and the production build passed when Turbopack was allowed to spawn its worker process outside the sandbox.


## Phase 10 local acceptance — verified 2026-09-14

- Settlement batches now use Thesi V42 statement tables: one owner-created batch record and one immutable line item per order line, each with its own durable request ID.
- Batch preview checks the selected brand workspace owner, scans the latest under-review attributed lines, reuses the existing line settlement preview, confirms review date, source holds, disqualification state, open operations, creator payout readiness and minimum-payout policy, then reports ready and blocked lines.
- Running a batch requires a recorded review reason and reuses the existing per-line `qualify` decision path. It does not create a second payout flow; every ready item still writes a normal settlement request and operation.
- Combined-balance policy is implemented behind `COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED`: below-minimum ready lines can qualify only when the same creator/currency group reaches the accepted minimum. Thesi sends a server-derived combined proof; Commerce rejects proofs that do not cover the line and threshold.
- Automatic scheduled settlement is implemented behind `COMMISSION_SETTLEMENT_AUTO_ENABLED`: a guarded timer scans active workspaces with under-review lines, previews ready lines, and creates scheduled batch statements using the same per-line settlement path.
- Non-ready selected items are skipped with a recorded reason. Failed items remain visible on the batch statement for replay/review through the existing line-level controls.
- The brand owner commission earnings page now includes a batch settlement section with ready totals, blocked reasons and last-batch outcomes. Creators and non-owner brand members do not receive the control.
- Thesi API build passed, focused commission/settlement/env tests passed, Customer API build and focused commerce tests passed, Thesi web lint passed with existing warnings, and the production web build passed when Turbopack was allowed to spawn its worker process outside the sandbox.


## Phase 11 local readiness — verified 2026-09-14

- Added the dev rollout and production-readiness runbook in [PHASE-11-DEV-ROLLOUT.md](PHASE-11-DEV-ROLLOUT.md). It records the allowed dev deployment order, required evidence, feature-flag activation sequence, rollback steps and production gates.
- Added `scripts/phase11-readiness-audit.mjs`, which checks sibling repositories, required Thesi/Commerce migrations, automatic settlement flags, scheduler implementation, Commerce combined-proof validation, dev health workflow gates, clothme-db Flyway workflow gates and the current prod rollout block. The audit passed 31 checks locally.
- Rehearsed local Flyway migrations against Docker Postgres only: core v30, catalog v36, commerce v24 and thesi v42 all applied successfully. No dev/prod database was touched.
- Rehearsed local backup/restore for changed databases using Docker `pg_dump`/`pg_restore`: restored thesi to latest Flyway version 42 and commerce to latest Flyway version 24. Dumps were written to `/tmp/clothme-phase11-backups/` for local evidence only.
- Confirmed the shared-environment rule: clothme-db migrations for dev/prod must run through GitHub Actions/Argo, never from a laptop.
- Release-style local checks passed after the Phase 11 work: Thesi API 35 suites / 283 tests plus build; Thesi web 36 test files / 134 tests, lint with existing warnings, and production build; Customer API 83 suites / 220 tests plus build; Vendor API 28 suites / 125 tests plus build.

## Phase 4 local acceptance — verified 2026-09-13

- [x] Select up to ten products from the current linked Merchant brand, with explicit eligible variants.
- [x] Project trusted color, size and listed prices; exclude unavailable/zero-stock variants and reject foreign variants.
- [x] Preserve every product in campaign, marketplace, invitation terms and accepted snapshots.
- [x] Freeze published/funded selections and prices. Duplicate into a new campaign for changed terms and fresh acceptance; in-place amendments are not supported.
- [x] Issue a separately identified personal creator link per accepted product.
- [x] Carry eligible variants in version 2 receipts and enforce them in Customer checkout and Thesi commission ingestion.
- [x] Keep old single-product links and version 1 receipts compatible across V41.
- [x] Verify actual connected HTTP/catalog repositories on Docker and save/duplicate in the visible Thesi browser UI.

Evidence: Thesi API 263 tests, Vendor API 125, Customer API 199, Thesi web 118; API builds and web TypeScript pass. Disposable PostgreSQL tests cover marketplace/acceptance persistence, legacy V41 upgrade, multi-product links, variant isolation, commission accounting and refund reversals. The connected HTTP/browser test uses local fixture identities and actual Merchant catalog data; payment provider responses remain simulated in the earnings test. No production rollout or real payment was performed.

See [CAMPAIGN-PRODUCTS.md](CAMPAIGN-PRODUCTS.md) for contracts, test commands, precise test limits and activation order. Quantity-level attribution, installed-device links and production release are still their own phase gates.

## Phase 5 local acceptance — verified 2026-09-13

- [x] Approved 30-day review, approval-based eligibility, zero minimum, no extra creator payout fee; credit and suspected self-referral holds.
- [x] Configure review days, UTC eligibility cadence and individual-transfer minimum on new campaigns.
- [x] Freeze rules in accepted terms, preserve legacy contracts, and display rules to brands and creators.
- [x] Version 3 receipts carry rules and variant eligibility; old receipt versions remain supported.
- [x] Enforce review dates, source holds and minimums before individual transfers.
- [x] Audited risk flags, operator-only clearance and immutable/idempotent review history; no bypass of credit/refund holds.
- [x] Actual credit ledger reconciliation test, SQL/service settlement tests, and connected Docker/browser creation and duplication checks.

Evidence: 275 Thesi API tests, 214 Customer API tests and 121 web tests from Phase 5, followed by Phase 10 focused builds/tests for automatic batches and combined-balance policy. See [COMMISSION-RULES.md](COMMISSION-RULES.md) for test commands and scope. Fraud controls review suspected activity; automatic cross-system identity detection is not claimed. Credit backing/returns and provider acceptance remain later release gates. No production deployment, migration or money movement occurred.
