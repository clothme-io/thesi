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

Deploy API support before the web option. The checked-in Drizzle definitions use
JSONB, so no column change is included. The sibling `clothme-db` migrations were
not present in this workspace: check any SQL constraints on payment model values
before deploying. No existing campaign data is rewritten.

A later release needs a verified sales source, attribution rules, an earnings
ledger with refund adjustments, and multiple independently retryable settlements
per creator/campaign before commission payouts can be enabled. Define the fee
policy for variable earnings as part of that release.
