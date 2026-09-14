# Commission settlement implementation

Status: implemented and tested locally; disabled by default. No live rollout or money movement. This extends the funding rules in [Campaign funding](CAMPAIGN-FUNDING.md).

## Ownership and money

Merchant Hub remains authoritative for vendor/brand identity. A Thesi workspace owns a linked brand's campaign; an accepted creator snapshot binds campaign, creator, brand, vendor and product to attribution. Browser requests never choose a funding account or creator payout destination.

Commission-only campaigns require no deposit. Commerce withholds commission from attributable merchandise sale proceeds before calculating the vendor transfer. Optional base is separately prepaid by the brand in Thesi, at base per creator multiplied by slots. Commission and content base use distinct ledgers.

For new funding-version orders, allocated discounts reduce merchandise and platform fees. Tax and shipping do not fund an unaffordable commission. Historical receipts retain their previous calculation path. A reserve is an accounting allocation, not a provider escrow product or evidence of payment.

## Sale lifecycle

1. Customer API creates an immutable sales reserve in the vendor-split transaction. Mismatched identity, currency, order totals or insufficient merchandise proceeds block that payout.
2. Earnings observation verifies captured payment and allocated provider refunds, creating immutable source revisions. A reserve alone cannot qualify a sale.
3. The workspace owner can open a sale or batch settlement panel, review accepted terms and enter a reason. When automatic settlement is enabled, the scheduler creates the same batch statement with a configured reason. Qualification requires the configured minimum age (30 days by default), no unresolved source holds, minimum-payout policy satisfaction and an onboarded creator payout account.
4. Thesi persists a request UUID, browser input and frozen Commerce command before sending it. Customer API checks the exact source revision and persists the decision and operation before calling Stripe.
5. Commerce transfers from the verified captured sale charge to the server-resolved creator account. Confirmed entries drive paid totals. Both services verify the same pinned Stripe platform account; different platform accounts block settlement.
6. Later reconciliation recovers overpaid creator commission first, recovers previously returned vendor reserve if needed, allocates reserve to the customer refund, and returns only genuinely unused reserve to the vendor. Each action records an immutable entry. Several reconciliation actions may be required to complete dependent steps.

Example: a $500 merchandise sale at 10% reserves and pays $50. A verified $100 merchandise refund reduces earnings to $40. Reconciliation reverses $10 from the creator, then records $10 applied to the customer refund. It does not also return that $10 to the vendor. The original reserve remains immutable.

## Retries and recovery

- Per-line advisory locks and one outstanding operation serialize money decisions. Reusing a request with changed arguments is rejected.
- A lost provider response remains pending; retry uses the same provider idempotency key. Unknown outcomes older than 23 hours require review, rather than creating another transfer.
- Operators listed in `SETTLEMENT_OPERATOR_USER_IDS` can supply a provider ID. Recovery retrieves and verifies amount, currency, destination/source and exact operation metadata before recording success and an audit entry.
- Base recovery uses equivalent verified evidence. A new refund attempt is allowed only after the known previous refund is verified terminally failed. Authentication-required deposits expose only the verified owner's existing intent and current saved payment method.
- Cancellation of unresolved base obligations is operator-only and requires recorded consent or resolution evidence. Accepted work cannot be cancelled through this action. Cancelled slots remain historically occupied to prevent a second unused-slot refund.

## Code and schema

- Thesi V39: durable settlement requests, funding recovery audit, cancelled obligations and cancellation refunds.
- Thesi V42: owner-run and scheduled settlement batch statements. A batch records the selected workspace, actor, review reason and browser/scheduler input; each item records the order line, a stable per-line settlement request ID, final state, error and result. Batch rows are delete-protected; state/result updates are limited to completion progress.
- Commerce V22: settlement decisions, durable operations, immutable entries and recovery audit; net-discount vendor-split version.
- Thesi: `commission-earnings/commission-settlement.*`, `campaign-funding/*`, earnings page and settlement/funding panels.
- Customer API: `commerce/application/creator-settlement.service.ts`, guarded internal controller, sales reserves and verified earning/refund observation.
- Dedicated internal service key: `X-Thesi-Settlement-Key`, at least 32 characters. The browser never receives it. Existing JWT/workspace authorization protects the Thesi endpoints; creators have read-only access to their own lines.
- Customer API operations: `POST /v1/internal/creator-settlements/operations`, guarded by the same settlement service key, reports event delivery backlog, retry pressure, settlement operation states, latest hold reasons, refund allocation gaps and active risk holds. It intentionally excludes shopper identity and does not create or approve a settlement.


## Batch settlement statements

The batch endpoint is for workspace owners who have already reviewed the accepted terms for several ready sales. `GET /v1/commission-settlement-batches/preview` returns at most 50 recent under-review lines for the selected workspace, with each line marked ready or blocked. Readiness requires no source/risk holds, no disqualification, elapsed eligibility date, no open settlement operation, remaining earned commission above confirmed net paid commission, minimum-payout policy satisfaction, and a ready creator payout account.

`POST /v1/commission-settlement-batches` accepts a client-generated batch UUID, a required review reason and an optional list of order-line IDs. The service persists the batch before acting. Each item receives its own stable request UUID and then calls the same `qualify` decision used by the single-line settlement panel. That means platform verification, creator payout readiness, source revision checks, Commerce idempotency and provider operation recovery remain in the existing line-level path. A retry using the same batch UUID must present the same browser input.

When `COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED=true`, Thesi groups otherwise-ready lines by creator and currency. A line below its accepted minimum can enter the batch only when that creator/currency group reaches the line's minimum. Thesi sends Commerce a server-derived `combinedPayout` proof containing the group id, total, minimum and covered line ids. Commerce rejects the transfer if that proof does not include the current line, does not match the accepted threshold, or does not reach the minimum.

When `COMMISSION_SETTLEMENT_AUTO_ENABLED=true`, Thesi starts a guarded interval runner. The runner takes a database advisory lock, scans active workspaces that have current under-review commission lines, previews each workspace with the owner context, and creates a scheduled batch only when ready lines exist. The scheduled batch uses `COMMISSION_SETTLEMENT_AUTO_REASON`, is marked with `source: scheduled`, and still creates normal per-line settlement requests and Commerce operations.

The web proxy exposes the batch endpoints through `/api/commission-settlement-batches`, forwarding the selected workspace header and JWT. The commission earnings page shows the panel only to brand owners with fund-management permission. Failed or skipped rows remain visible in the last-batch result; recovery, replay and reconciliation still happen from the individual settlement controls.

## Dev gates and current limits

1. Apply compatible migrations to isolated dev databases; never reuse production connection strings for this demo.
2. Configure attribution, verified earnings/refund reconciliation, sales reserves and the dedicated settlement bridge. Keep live flags off.
3. Use Stripe test keys and real test Connect accounts on the same verified platform. Validate authentication-required/declined deposits, account readiness, actual transfer availability, platform balance/fees, pending/failed refunds, reversals and timeouts.
4. Test real Merchant Hub login/linking, Thesi JWT/workspace authorization and Customer API HTTP guards together. The local adapter directly invokes services and is not evidence of this complete network/authentication path.
5. Review operating procedures before enabling a controlled dev pilot, then decide on a separate live rollout.

Qualification and later reconciliation remain audited settlement decisions. Manual batches are owner-triggered from the commission earnings page. Automatic scheduled batches are opt-in and create the same batch/request/operation records; there is still no automatic refund scheduler in this change. Mixed credit-funded or multiple-capture payments remain held for funded reconciliation. Disputes block further transfers; they are not automatically adjudicated. Provider fees and negative-balance recovery still require test-provider validation and an operating policy. Earning events now keep provider transaction references for reconciliation, but those references are not a substitute for the fresh Stripe checks performed before transfers and recoveries. The refund offset records the commission's contribution to an already verified customer refund; it does not implement the entire vendor-proceeds customer-refund lifecycle. Aggregate earnings remain estimates, with confirmed paid/recovered amounts shown per settlement line.

Verification combines API/web unit tests, disposable SQL/service integration, and a browser walkthrough against Docker PostgreSQL. Simulated-provider success does not establish live payment readiness.

## Phase 5 qualification rules

New agreements can now carry frozen review days, UTC eligibility cadence and an individual-transfer minimum. These override the legacy environment-based timing only for rules-bearing agreements. Creator payout fees remain zero. Audited suspected-risk holds, operator clearance and explicit credit-funding holds are described in [COMMISSION-RULES.md](COMMISSION-RULES.md). Automatic scheduled execution and combined creator-balance thresholds are implemented locally behind disabled-by-default flags; production activation still requires Phase 11 provider and operating gates.
