# Allocated refunds and campaign payout terms

Local implementation, September 12, 2026. No migration, deployment, refund, customer charge or creator payout has been executed.

## Current campaign funding decision

The earlier handler/funding proposals have been superseded by the approved [campaign funding flow](./CAMPAIGN-FUNDING.md): ClothME handles payouts, commission comes from qualifying sales without an upfront deposit, and an optional base requires a brand deposit of base × creator slots. Brand acceptance releases the creator’s base; unused slots are refunded at closure. Existing accepted snapshots retain their original terms.

Thesi V38 implements base funds/releases/refunds locally. Commerce V21 withholds sales commission before vendor payout. Both are default-off. Automatic commission settlement and reserve reversal/reconciliation remain subsequent work; see the linked document for precise limits and rollout gates.

## Refund allocation

Commerce V20 adds an immutable `creator_refund_allocation` table. Customer API exposes an operations-only `POST /v1/internal/creator-refund-allocations` endpoint behind its existing `X-Admin-Key` guard and the new default-off `THESI_REFUND_ALLOCATION_ENABLED` flag. Enabling it requires earnings reconciliation, Stripe verification credentials, a strong operations key and V20. The migration is a local file only.

The endpoint **records an allocation of an existing refund**. It never asks Stripe to issue a refund. The operations caller must authenticate authorized staff and supply the staff identity and reason; the key must never be exposed to a browser. A dedicated admin allocation screen and its staff workflow are not yet implemented.

Example request body (illustrative IDs):

```json
{
  "orderId": "10000000-1111-4111-8111-111111111111",
  "refundId": "re_example",
  "actorId": "authenticated-operations-staff-id",
  "reason": "Verified return of one product",
  "lines": [{
    "orderLineId": "20000000-1111-4111-8111-111111111111",
    "quantity": 1,
    "netCents": 2000,
    "taxCents": 100,
    "shippingCents": 0
  }]
}
```

The service retrieves the refund from Stripe and requires a successful payment-intent refund. It checks that the refund belongs to the captured payment of this order and uses the order currency. Allocation component amounts must equal the verified refund amount exactly. It then locks the order and checks every line's ownership, currency and cumulative limits across prior allocations. Merchandise refund limits exclude discounts; tax and shipping have separate limits. Quantities cannot exceed those purchased. Zero quantity is permitted for monetary adjustments such as a partial price refund; allocated money must still be positive and within its component cap.

An exact retry is acknowledged once; a conflicting reuse fails. Allocations cannot be updated or deleted. Incorrect allocations therefore require a separately designed audited correction flow; do not change them directly in SQL. Browser input and provider metadata alone are not accepted as authoritative line allocation.

## Effect on commission

The worker rechecks successful provider refunds, then matches them to recorded allocations. It emits cumulative `refundedNetCents` alongside the original immutable merchandise amount. Older events without this field remain compatible and mean zero allocated merchandise refunds.

Thesi recalculates percentage-of-sale commission from remaining merchandise cents using the accepted rate and integer rounding. Example: original merchandise $500 at 10% gives a $50 estimate; a matched $100 merchandise refund produces a $40 estimate and an immutable −$10 adjustment. Refunding only tax or shipping does not reduce a merchandise-based commission. A fully refunded merchandise line reverses its sale-based commission even if other order lines remain purchased. Unaffected lines retain their calculation.

If any successful refund lacks a complete matching allocation, the existing order-level reconciliation hold remains. Pending refunds, incomplete provider history, disputes and mismatched totals still hold estimates. The cumulative refunded merchandise amount cannot decrease in later Thesi revisions. Once allocations exist, Customer API refuses to run earnings reconciliation with allocation processing disabled, preventing a downgrade from dropping prior deductions.

For percentage-of-platform-fee commission, an affected line stays held until its actual fee reversal can be established. This phase does not invent a proportional platform-fee refund. A fully refunded order still reverses all its commission estimates. Mixed-credit refund issuance/recrediting is not implemented; this endpoint only allocates verified Stripe refunds.

## Rollout and remaining work

1. Review/apply Commerce V20 after V19 in a separately approved staging environment. Deploy Thesi's compatible event reader before enabling the Customer API allocation flag. Defaults remain off.
2. Exercise allocation limits, exact retry/conflict, pending refunds, a refund on an unattributed line, and split refunds spanning multiple lines. Reconcile outbox and ledger amounts.
3. Add the authenticated operations allocation/correction workflow, line-level platform-fee reversals and authoritative credit returns.
4. Agree and record funding approval, reserves and settlement rules separately from the campaign proposal. ClothME-funded/shared proposals require approval by an authorized ClothME party; brand-funded proposals require the brand's approved funding arrangement.
5. Build payout qualification and settlement only against approved, funded obligations, with independent retries and reconciliation. The agreed flow uses ClothME handling and brand funding. Optional base obligations remain separate from commissions.

Production remains unchanged. No report balance is currently withdrawable.

## Local verification

- Thesi API build passed. The full API suite exposed two obsolete mandatory-base expectations; after correcting those expectations, the affected campaign service and commission math suites passed (36 tests). The other 219 tests passed in the full run.
- Customer API build and its full 194-test suite passed.
- Thesi web: 102 tests and TypeScript checking passed; the production build used localhost-only API placeholders.
- The disposable PostgreSQL integration passed with commission-only terms, including actual allocation SQL, duplicate/conflict handling, quantity/component caps, immutable allocations, remaining-merchandise calculation, event retry and full reversal. Stripe responses were fixtures; no real provider or database was contacted.
- No migration has been applied outside disposable databases. Configuration defaults remain disabled, and the allocation endpoint has no deployed admin workflow yet.
