# Base + Commission

Campaigns support `payment.model = "commission"`. This release configures and
displays compensation terms; it does not attribute sales, accrue commissions,
or settle them through Stripe.

## API contract

The model reuses the existing JSONB base/affiliate structure:

```json
{
  "model": "commission",
  "hybrid": {
    "base": {
      "enabled": true,
      "amountCents": 20000,
      "currency": "USD",
      "trigger": "content_accepted"
    },
    "affiliate": {
      "enabled": true,
      "commissionType": "percentage_of_sale",
      "commissionPercent": 10.25,
      "currency": "USD",
      "attributionWindowDays": 30,
      "terms": "Net product revenue excluding tax, shipping, and refunds. Monthly settlement after the return period."
    }
  }
}
```

Both components must be enabled. The base is a positive integer number of cents
per creator (maximum 2,147,483,647). The commission rate is greater than zero and
at most 100, with at most two decimal places. Attribution is 1–365 days.
Eligibility, refund, and settlement terms must be supplied; a custom base trigger
also requires its description. Validation applies to draft saves as well as
publishing and fee previews.

The commission basis can be `percentage_of_sale` (eligible attributed sales) or
`percentage_of_platform_commission` (the platform's revenue from those sales).
The latter is distinct from Thesi's campaign service fee. The new model does not
accept fixed-per-sale amounts, milestones, pools, or the legacy duplicate
`flatRateCents`/`royaltyPercent` fields. Existing models retain their behavior.

## Displays and estimates

Creation/editing, campaign summaries/details, marketplace filtering/details,
and accepted payment summaries support the new model. Marketplace-to-CRM deal
values and fee previews include the fixed base only; future commission is unknown.
The existing campaign acceptance snapshot stores the complete payment JSON.

Internal invitation messages include the base, rate, basis, trigger, attribution
window and terms. The Novu invitation payload includes `paymentTerms`; rendering
that field in external emails requires the deployed Novu template to use it.
This repository change does not modify external notification templates.

The existing one-payout-per-creator-per-campaign endpoint rejects this model,
and its UI action is disabled, so a base-only transfer cannot be presented as
full settlement. Automatic campaign activation fee collection remains disabled.

## Deployment and next phase

Deploy API support before the web option. Campaign and listing payment columns
use JSONB in the available `clothme-db` migrations; the commission option itself
does not require a new payment-model column. Disposable SQL tests now store
commission terms using those migrations. The separate multi-brand changes do
require V33/backfill/V34 and the ordered gates in
[BRAND-WORKSPACE-ROLLOUT.md](BRAND-WORKSPACE-ROLLOUT.md); do not deploy this combined
API image using the earlier commission-only rollout assumptions.

A later release needs a verified sales source, attribution rules, an earnings
ledger with refund adjustments, and multiple independently retryable settlements
per creator/campaign before commission payouts can be enabled. Define the fee
policy for variable earnings as part of that release.

Commission terms can now include a server-verified `payment.promotedProduct` snapshot. The browser supplies only `merchantProductId`; public product links currently open an approved demo. See [CAMPAIGN-PRODUCTS.md](CAMPAIGN-PRODUCTS.md).

Creator links now preserve accepted campaign identity into matching pending order lines, behind activation flags. See [CREATOR-ATTRIBUTION.md](CREATOR-ATTRIBUTION.md). Verified sales, earnings and settlements remain future phases.

### Local earnings reporting phase

[Commission earnings](./COMMISSION-EARNINGS.md) now documents the disabled-by-default captured-payment reconciliation and reporting implementation. This extends attribution into review-only commission estimates and refund adjustments. It does not enable base or commission payouts.


### Approved clarification: optional base payment

Commission campaigns support commission only or commission plus an explicitly enabled fixed base. An absent/disabled base creates no fixed-payment obligation, content-payment trigger or estimated fee on a fixed payout. Existing accepted terms remain unchanged. Future base obligations and funding must be created only when the accepted snapshot explicitly enables a base; commission settlement proceeds independently. Exact refund allocation and funded settlement remain subsequent implementation work; this clarification does not enable production or payouts.
