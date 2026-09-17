# Stripe payments rollout

Status: implementation scaffolding is present; keep live money movement disabled until Stripe test-mode evidence is complete.

## Recommended platform

Use Stripe Connect Express as Thesi's first payment platform.

- Brands pay the Thesi platform account.
- Creators onboard with Stripe Express connected accounts.
- Thesi owns the campaign funding, commission, refund and settlement ledgers.
- Stripe handles payment collection, Connect verification, transfers, payouts and tax-reporting support.

Use separate charges and transfers for campaign base deposits, creator base releases and commission settlement. This keeps Thesi in control of review windows, refund holds, multi-creator payouts and immutable ledger records.

## Keys to add

Add these to `thesi-api` first:

```sh
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PLATFORM_ACCOUNT_ID=acct_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

For settlement, the existing dedicated settlement keys are still required:

```sh
COMMERCE_SETTLEMENT_API_URL=https://...
COMMERCE_SETTLEMENT_SERVICE_KEY=...
SETTLEMENT_PLATFORM_ACCOUNT_ID=$STRIPE_PLATFORM_ACCOUNT_ID
SETTLEMENT_OPERATOR_USER_IDS=...
```

Add this to `thesi-web` only after creator onboarding should be visible:

```sh
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_CREATOR_PAYOUTS_ENABLED=true
```

Do not enable creator payout setup in the web app before the API has a real Stripe secret key, webhook secret and platform account id.

## Webhook endpoint

Point Stripe test-mode webhooks at:

```text
POST /v1/stripe/webhooks
```

Subscribe at minimum to:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `account.updated`
- `transfer.created`
- `transfer.updated`
- `transfer.reversed`

`STRIPE_WEBHOOK_SECRET` is required before enabling campaign funding or commission settlement. Local unsigned webhook payloads are accepted only while money-movement flags remain off.

## Enablement order

1. Add Stripe test keys and webhook secret to dev.
2. Deploy API with `CAMPAIGN_FUNDING_ENABLED=false` and `COMMISSION_SETTLEMENT_ENABLED=false`.
3. Enable `NEXT_PUBLIC_CREATOR_PAYOUTS_ENABLED=true` in dev web.
4. Test creator Stripe Express onboarding from creator settings.
5. Add a brand Stripe payment method through brand billing settings.
6. Enable `CAMPAIGN_FUNDING_ENABLED=true` in dev.
7. Test a base-plus-commission campaign deposit, release and unused-slot refund.
8. Keep `COMMISSION_SETTLEMENT_ENABLED=false` until Customer API settlement wiring and Stripe platform-account checks pass.
9. Enable `COMMISSION_SETTLEMENT_ENABLED=true` in dev and test manual line settlement.
10. Enable `COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED=true` only after manual settlement passes.
11. Enable `COMMISSION_SETTLEMENT_AUTO_ENABLED=true` only after manual and combined-balance evidence passes.

## Required dev tests

Use Stripe test mode only.

- Creator starts onboarding, returns to Thesi and status changes from `not_started` to `pending` or `complete`.
- Creator cannot receive payouts until Stripe reports `details_submitted=true` and `payouts_enabled=true`.
- Brand adds a real test card payment method and sets it as default.
- Base deposit succeeds and records a provider payment intent and charge.
- Authentication-required or declined card leaves the deposit operation pending/retryable, not double-charged.
- Work acceptance creates one transfer from the captured deposit charge to the creator account.
- Completing a funded campaign refunds unused slots to the original payment intent.
- Webhook replay is idempotent.
- `transfer.reversed` or failed payment webhook marks the local operation failed/held.
- Commission settlement refuses to start if `SETTLEMENT_PLATFORM_ACCOUNT_ID` differs from `STRIPE_PLATFORM_ACCOUNT_ID`.

## Production gate

Production approval requires:

- Dev workflow URLs and deployed image tags.
- Stripe test-mode evidence for creator onboarding, brand funding, transfer, refund, failure and webhook replay.
- Current backup/restore evidence for affected databases.
- A rollback plan that disables flags in this order:
  1. `COMMISSION_SETTLEMENT_AUTO_ENABLED=false`
  2. `COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED=false`
  3. `COMMISSION_SETTLEMENT_ENABLED=false`
  4. `CAMPAIGN_FUNDING_ENABLED=false`
  5. `NEXT_PUBLIC_CREATOR_PAYOUTS_ENABLED=false`

Do not turn on production money movement from the same change that first adds live Stripe keys.
