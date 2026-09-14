# Agreed campaign funding flow

Updated locally on September 13, 2026. Migrations were exercised only in disposable local databases. No production deployment, actual charge, transfer or refund was performed. This document supersedes the earlier selectable payout-handler and proposed-funding plan.

## Rules now implemented

| Campaign | Before launch | While running | At closure |
| --- | --- | --- | --- |
| Commission only | No deposit | Reserve commission from attributed sales before paying the vendor | Sales remain subject to qualification and returns |
| Commission plus optional base | Brand deposits base per creator × creator slots | ClothME holds base; brand records acceptance of each creator’s delivered work and queues that creator’s base release | Refund unused slots to the original payment; keep unresolved accepted-creator obligations held |

ClothME handles payouts. The brand supplies the base deposit and commission through sale proceeds. Selecting the platform-fee commission base changes the calculation basis; it does not authorize ClothME to subsidize the commission. New terms use `affiliate.fundingFlowVersion: 1`. Existing published campaigns and accepted terms cannot switch to the new flow through an edit; historical snapshots are unchanged.

Example: $100 base × 3 slots = $300 deposit. Two creators accept. One creator’s accepted work releases $100. Closing queues a $100 refund for the empty slot and keeps the other creator’s $100 held. Accepting their work later releases that remaining $100.

## Thesi changes

- The commission builder removes the alternative handler/funder choices, fixes base release to brand acceptance of work, and shows the base × slots deposit estimate. Commission-only campaigns show no deposit.
- The campaign details page shows the saved campaign’s deposit requirement and confirmed deposited, held, released and refunded amounts. The owner explicitly confirms the exact total before the saved default payment method is used. Unsaved form edits do not change this confirmation. Save the promoted product before funding; payment terms and product become locked. A funded draft can also be completed to return its unused deposit if it will not launch.
- The owner records which work was accepted, then chooses **Accept work and release** for a specific creator. This queues a transfer; it does not claim instant payment. Missing creator payout setup and provider failures remain visible and retryable.
- Completing a funded campaign atomically closes admissions and queues the unused-slot refund. Accepted obligations remain held, including after closure. Completion is now allowed for the new funding flow even when creators have accepted, while the other accepted terms stay locked.
- `GET /campaign-funding/:id` and owner-only `POST` actions `deposit`, `accept-work`, and `retry` are exposed through authenticated, workspace-scoped Thesi proxies. No provider/service key is sent to a browser.
- Generic billing still rejects implicit charging in a secondary workspace. The new deposit path separately requires the exact campaign workspace owner, a fresh database ownership check, a saved real payment method and exact-amount confirmation.

Thesi V38 creates the base fund, accepted-creator obligations, durable provider operations, and immutable confirmed-money entries. Database triggers enforce funded launch, atomic slot reservation, term/capacity locking once a deposit operation exists, and closure/refund calculation. Funded campaigns cannot be reopened. A pending deposit must be reconciled before closure; it cannot be discarded and charged later without a fund record.

Provider operations persist their arguments before making network calls. Replays use the same Stripe idempotency key. Pending deposits/refunds are polled and are not counted as money moved. Uncertain operations without a known provider ID stop for review after 23 hours rather than risk repeating an expired idempotency key. Transfers use the captured deposit charge and verified creator payout destination. Disputed charges and unrecognized refunds block release.

## Sales funding in Customer API

Commerce V21 adds immutable `creator_sales_reserve` allocations. The vendor-split transaction uses the accepted receipt, product/vendor/brand identity and commission rate to reserve the initial commission and reduce the vendor transfer by exactly that amount. Percentage-of-sale uses merchandise cents; percentage-of-platform-commission uses a deterministic allocation of the authoritative vendor platform fee. Both draw from vendor merchandise proceeds under the agreed brand funding rule.

Only new-version attributed receipts use this path. If reserves are disabled, a vendor payout containing one of these receipts fails safely rather than paying away its commission funding. Retries cannot create another allocation, and an existing transfer with a different amount requires reconciliation. Tax and shipping cannot cover an otherwise unaffordable commission. New-version orders settle allocated discounts using net merchandise for both the platform fee and commission. It also holds invalid currencies, mismatched totals and unsupported commission terms.

A reserve is an internal withheld allocation, not proof that a sale is qualified, not a provider escrow product, and not a paid creator commission. Existing commission reporting continues to distinguish estimates/holds from payment. No automatic commission transfer has been enabled.

## Settlement and recovery added locally

Thesi V39 and Commerce V22 add durable qualification commands, immutable settlement/reversal entries and operator recovery. See [Commission settlement](COMMISSION-SETTLEMENT.md) for exact behavior and remaining provider gates. Brand owners can review a sale, qualify it after the hold period, disqualify it, and reconcile later adjustments. Creators can inspect their own settlement without approving transfers. Base deposit authentication, verified provider-outcome recovery, terminally failed refund retry and evidenced cancellation of unresolved obligations are available through authenticated controls.

The local walkthrough uses Docker PostgreSQL, real funding/settlement services and a simulated provider. See [Local payments demo](LOCAL-PAYMENTS-DEMO.md). It does not validate live Stripe behavior, full cross-service authentication, platform liquidity or automatic dispute resolution.

## Rollout order and controls

1. Review and back up production separately. Apply Thesi migrations through V39 and Commerce through V22 in dev first; this work applied migrations only to disposable local databases.
2. Deploy compatible Customer API reserve code before admitting new-version sales. Configure attribution, earnings and verified refund reconciliation, then enable `THESI_SALES_RESERVE_ENABLED` in staging. It defaults to false and requires earnings reconciliation. Historical receipts remain on the old path.
3. Deploy Thesi API/web with `CAMPAIGN_FUNDING_ENABLED=false`. Enabling requires workspace enforcement, V39 and a real Stripe configuration. No local fallback payer is allowed. Keep this off in live Thesi until the provider tests and operational recovery gates pass.
4. Enable funding in staging and test creation → draft → deposit → publish → accepted creators → work acceptance → release → completion → unused-slot refund. Test commission only independently; its deposit must remain zero.
5. Live flags/migrations/deployment require a separate rollout decision. Disabling the funding worker pauses money operations; it does not erase existing obligations. Do not drop tables or remove reserve code while accepted new-version receipts remain valid.

## Local verification

- Thesi API and Customer API builds; API unit suites; web unit/component checks and production build.
- Disposable PGlite migrations and real repository/service integration: `scripts/test-creator-attribution.mjs <pglite-module> --funding --sales-reserve --settlement`.
- Base tests include launch blocking, exact amount, uncertain charge replay, term locking, duplicate acceptance, accepted-work release, unfilled-slot refund, unresolved funds retained after closure and subsequent release, immutable ledger and no reopening.
- Sales tests include disabled-reserve payout blocking, exact vendor deduction, idempotent replay and conflicting accepted terms held for reconciliation.
- Provider gateway tests verify amount/currency/customer/destination, captured source charge, pending state, refund/dispute holds and stable idempotency keys. No test moves real money.
