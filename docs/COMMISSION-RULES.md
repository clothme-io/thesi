# Phase 5 — commission qualification rules

Implemented locally using the defaults approved on 2026-09-13. No production change or real payment has been made. Stripe configuration and real provider acceptance remain deferred.

## Accepted terms

New commission campaigns created with `COMMISSION_RULES_ENABLED=true` carry a versioned `payment.hybrid.affiliate.rules` object. Defaults are a 30-day sale review, eligibility after review and approval, no minimum individual transfer, no extra creator payout fee, and review holds for credit-funded sales and suspected self-referrals/fraud.

The campaign editor exposes review days (0–365), payout eligibility cadence (after approval, next Monday UTC, or next month start UTC), and minimum individual commission transfer in USD. Weekly/monthly dates are calculated at or after the review period; they never shorten it. These dates govern earliest approval eligibility. The optional scheduled settlement runner uses those eligibility dates when deciding whether a line can enter an automatic batch. The only supported creator fee is zero; arbitrary fee deductions are rejected.

A positive minimum blocks smaller **individual transfers** unless `COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED=true` and the same creator/currency group of otherwise-ready lines reaches the accepted threshold. The batch workflow still sends each ready order line through the existing per-line settlement request and provider operation; the combined balance only satisfies the minimum-payout gate.

The rules are displayed in campaign/creator payment details, direct invitation text and settlement previews. The accepted snapshot and receipt retain the same rules. Published or funded rules cannot change, and old clients cannot erase them by omitting the field. Existing agreements without structured rules remain legacy agreements, using their previous settlement configuration. Duplicating into a new campaign creates a fresh agreement with visible defaults and fresh acceptance.

## Enforcement and compatibility

Rules-bearing agreements use **receipt version 3** with eligible variant IDs and the frozen commission rules. Versions 1 and 2 remain supported. Consumers reject rules smuggled into an older receipt version, missing v3 rules and unsupported fees. Older deployed consumers reject v3 rather than silently ignoring its restrictions.

Customer settlement calculates eligibility from the accepted rules, checks current source holds and the exact source revision, and checks the minimum before creating a transfer operation. No new creator fee is subtracted. Legacy agreements retain `SETTLEMENT_MINIMUM_DAYS` behavior. Existing durable transfer/recovery idempotency still applies.

Credit captures are reconciled against the actual spend ledger. Credit-funded sales now carry `credit_funding_requires_review`; multiple captured payments carry `split_capture_requires_review`. This aligns the estimate with the existing funded settlement restrictions. A stale query referencing nonexistent `ledger_entry.deleted_at` was corrected and is covered by an actual SQL credit-capture test.

## Risk review

Commerce **V23** adds append-only `creator_risk_review` history with request ID, line, actor, evidence/reason, status and monotonic sequence. A review uses the same per-line lock as settlement. Duplicate requests do not create another review; altered request reuse or a stale source revision is rejected.

A workspace owner can flag suspected self-referral or fraud from the settlement panel. Only an explicitly configured ClothME settlement operator (`SETTLEMENT_OPERATOR_USER_IDS`) may clear a flag. Thesi derives the actor and receipt from the authenticated sale context; browser input cannot choose them. The internal Commerce route uses the existing dedicated settlement service key.

Risk flags become authoritative earning-event holds and block new settlement and pending transfer retries. Clearing a risk flag with evidence does not clear a credit, refund, dispute or payment-source hold. Holding an already-paid sale does not silently reverse a transfer; reviewed disqualification/reconciliation remains explicit and audited.

This is an audited process for **suspected** self-referrals, not automatic cross-platform identity detection. Thesi creator identity and Commerce buyer identity are different systems; matching them based on unverified email or browser-supplied IDs would be unsafe. Operators must record the evidence they reviewed. There is no claim that unflagged sales have passed an automated fraud model.

The approved credit policy is to hold until verified. This phase does not invent cash backing for promotional credit or allow a risk-clear action to authorize it. Credit return/funding verification workflows remain Phase 8 work. Real provider fees, balances and payouts remain Phase 11 acceptance gates.

## Activation order

1. Rehearse Commerce V23 in dev. Retain all existing attribution, earnings, reserve and settlement migration prerequisites, including Thesi V41 for variant-scoped products.
2. Deploy Customer API with v3 parsing, rule enforcement and risk controls before enabling rules-bearing Thesi campaigns. Configure `THESI_COMMISSION_RULES_ENABLED=true` alongside earnings reconciliation. Startup checks V23; unresolved risk holds prevent disabling enforcement.
3. Enable the existing settlement service only in a configured test-provider environment when testing actual transfers. Risk API access currently shares the settlement feature gate. Local tests simulate provider responses.
4. Deploy Thesi with `COMMISSION_RULES_ENABLED=false`. This flag requires multi-product campaigns. Enable it in dev only once the compatible consumer is ready. Build Thesi web with `NEXT_PUBLIC_COMMISSION_RULES_ENABLED=true` and the Phase 4 product flags.
5. Pausing new Thesi rules must retain compatible readers and settlement enforcement. V3 sales are held when Commerce rules are paused. Do not downgrade consumers or remove immutable risk history.
6. Run the Phase 11 dev/pilot gates before production. Local success does not authorize deployment or money movement.

## Verification

- Thesi API: 275 tests across 35 suites; Customer API: 214 tests across 83 suites; Thesi web: 121 tests across 31 suites. Builds and Thesi web TypeScript checks pass.
- Rule math: 30-day defaults, UTC weekly/monthly boundaries, year rollover, invalid dates/policies, unsupported fee rejection.
- Security and UI: brands can flag but cannot clear risk; recorded reasons are required; server derives actor/receipt; a below-minimum transfer fails before the provider call.
- Actual disposable PostgreSQL: v3 receipt through checkout and earnings, verified credit capture hold, risk hold/clear/replay/history immutability, blocked approval, uncertain-transfer retry and refund recovery.
- Docker + real Nest/Merchant repositories + visible Chrome: new campaign defaults, edited 45-day weekly policy saved through the API, optional base disabled, duplicate campaign preserves the configured rules.

```sh
node scripts/test-creator-attribution.mjs /path/to/pglite/dist/index.js --rules --earnings
node scripts/test-creator-attribution.mjs /path/to/pglite/dist/index.js --rules --sales-reserve --settlement
node scripts/merchant-demo-web.mjs thesi --products --rules
node scripts/test-merchant-login-http.mjs --products --product-browser --rules
```

The credit check is a transaction rolled back in the disposable database. Settlement fixtures simulate provider evidence and an aged sale; they do not establish live Stripe readiness. The connected browser uses genuine locally issued session fixtures; unrelated dashboard integrations are not enabled in the test adapter.

Phase 10 has added owner-run settlement batches, opt-in automatic scheduled batches and opt-in combined-balance thresholds locally. They remain disabled by default and require Phase 11 provider/release gates before production activation.
