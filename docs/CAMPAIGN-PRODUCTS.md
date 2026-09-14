# Campaign products — Phase 4

Local implementation and acceptance verified on 2026-09-13. Production activation remains a Phase 11 gate. Stripe configuration and real payment tests remain deferred.

## Brand and creator behavior

1. Select the Thesi workspace connected to the appropriate Merchant brand. Merchant remains the source of brand ownership, product identity, stock and current prices.
2. Choose **Commission**. **Products to promote** appears above campaign basics. Select up to ten products and one or more eligible variants for each. The optional base payment remains separate; commission-only campaigns require no deposit.
3. Eligible products belong to that linked brand and active vendor, are published and active, and have available, active, positive-stock variants with positive prices. Pre-orders are excluded. The selector shows color, size and listed price. All selected variants must use the commission currency (currently USD).
4. Drafts may be incomplete. Saving selected products reads their trusted details again from Merchant; publishing requires a product and checks availability. Browser input contains product and variant IDs only. Catalog outages preserve the visible selection and block unverified saves.
5. Publication or base funding freezes product and variant selections and their recorded prices. Accepted snapshots, marketplace details and direct commission invitation terms contain all selected products and variants. Recorded prices describe the agreement; checkout uses current prices and commission uses verified sale facts.
6. To change frozen terms, duplicate the campaign into a **new campaign/agreement**. It keeps selected product/variant IDs, rechecks current eligibility and prices on save, and requires fresh creator acceptance. There is no in-place amendment or automatic migration of old creator agreements.
7. Creators can obtain a separate personal link for each accepted product. Product titles identify the links. Receipts carry that product’s eligible variant IDs; checkout and the commission ledger reject unrelated variants.

## Contracts and compatibility

- `GET /v1/campaigns/products?offset=0` uses the authenticated workspace and its active Merchant link. Vendor API’s `POST /v1/internal/thesi/catalog` uses a dedicated server credential and returns only promotion-safe product fields and eligible variants. Results hydrate twenty products per page.
- Campaign POST/PUT accepts `merchantProducts: [{productId, variantIds?}]`, with at most ten unique products and at most 200 distinct UUID variant IDs per product. Omitted variant IDs select all currently eligible variants. Explicit empty variant lists are rejected. An empty product list clears an unfunded draft selection.
- Server-owned `payment.promotedProducts` stores identity, title, description, image, demo URL, verification time and selected `{id,color,size,priceCents,currency}` variants. `payment.promotedProduct` remains the first-product compatibility alias. DTO validation rejects either field from the browser; the web serializer strips both.
- Legacy `merchantProductId` requests and existing single-product agreements remain supported. Their receipts stay version 1 and retain the original product-level eligibility. They are not silently converted into variant agreements.
- New array-backed agreements issue version 2 receipts with `eligibleVariantIds`. Customer API validates the version and variant set, attaches attribution only to matching product/brand/vendor/person/variant order lines, and includes the purchased variant in commission events. Thesi verifies it against the immutable acceptance snapshot.
- Thesi migration **V41** adds the nullable product ID to tracking links and separate unique indexes for old single-product and new per-product links. Existing public link URLs remain valid. No commerce migration is required for v2 because order lines already store variant IDs and receipt snapshots are JSONB.
- Draft writes verify all selected Merchant links under shared locks; published writes lock the campaign row and compare the complete product snapshots. Catalog requests happen before that transaction and do not reserve inventory across services.

## Demo pages

`/product-preview/demo` remains a fictional sample. `/product-preview/{brandId}/{productId}` resolves a current public catalog projection of title, description, image and brand name. Both are clearly labeled demos and do not offer purchasing or track commission. Personal creator links use the separate `/r/...` handoff. Actual installed-device behavior, universal/deferred links and a web purchasing fallback remain Phase 6 work.

## Safe activation order

1. Complete workspace/linking migration gates and rehearse V41 against a restored representative database in dev before production.
2. Deploy the Customer API version 2 receipt parser, variant-aware order attribution and commission delivery **before enabling new multi-product campaigns**. Keep compatible consumer code deployed while v2 receipts or orders exist. Older consumers reject v2 receipts; they must never reinterpret them as unrestricted v1.
3. Deploy Vendor API’s variant projection behind `THESI_PRODUCTS_ENABLED`; configure `THESI_CATALOG_SERVICE_KEY` and matching Thesi `MERCHANT_CATALOG_SERVICE_KEY` server-side. Merchant catalog and identity credentials remain separate.
4. Apply V41, then deploy Thesi with `CAMPAIGN_MULTI_PRODUCTS_ENABLED=false`. The API checks V41 before starting with this flag enabled. Existing product/link flags and linked workspace access are also required.
5. Enable `CAMPAIGN_PRODUCTS_ENABLED` and then `CAMPAIGN_MULTI_PRODUCTS_ENABLED` in dev. Build the Thesi web with `NEXT_PUBLIC_CAMPAIGN_PRODUCTS_ENABLED=true` and `NEXT_PUBLIC_CAMPAIGN_MULTI_PRODUCTS_ENABLED=true`.
6. Verify the connected journey in dev HTTPS and complete the Phase 11 pilot gates before production activation. These local checks are not production release approval.
7. Pause new selections/activation using the multi-product flag while retaining compatible code, V41 and receipt verification. Existing published snapshots remain readable; unchanged draft maintenance is allowed. Do not roll back to handlers that discard the new array or variant identity. Already-issued valid receipts still need verification.

## Local evidence and repeatable checks

API suites: Thesi 263 tests, Vendor 125 tests, Customer 199 tests. Web: 118 tests. All three APIs build and Thesi web TypeScript checks pass.

Run with the installed Node binary and from this repository unless stated otherwise:

```sh
node scripts/test-campaign-products.mjs /path/to/pglite/dist/index.js
node scripts/test-creator-attribution.mjs /path/to/pglite/dist/index.js --multi --earnings
node scripts/test-creator-attribution.mjs /path/to/pglite/dist/index.js --v41 --earnings
node scripts/merchant-demo-web.mjs thesi --products
node scripts/test-merchant-login-http.mjs --products --product-browser
```

The embedded tests use actual compiled repositories and disposable PostgreSQL engines. They verify marketplace/acceptance persistence, frozen selections, separate stable creator links, variant-scoped receipts, wrong-variant rejection, atomic checkout attribution, commission ingestion and refund reversals. Provider responses are simulated; no real Stripe settlement is claimed.

The connected test creates isolated databases on the existing local Docker demo PostgreSQL server (`127.0.0.1:5844`). It runs real Nest controllers/guards and real Merchant product repositories on local ports 5013 and 5031. The visible Chrome journey uses the actual Thesi campaign page on port 3013, selects two products and a variant subset, disables optional base, saves through the API and duplicates the campaign. External browser requests are blocked. The test uses a genuinely issued local Merchant/Thesi session and completes onboarding in the database fixture; it does not retest Merchant password entry.

The HTTP publication-protection fixture sets a campaign active directly in its disposable database to exercise mutation guards without invoking payment collection. It is not evidence of real funded publication. Existing funding tests cover that separate flow.

Local screenshot: `/private/tmp/thesi-phase4/browser/products-selected.png`. No production data, external emails, production migrations or real payments were used.

## Remaining scope

Phase 5 commission policies are now implemented locally; see [COMMISSION-RULES.md](COMMISSION-RULES.md). Phase 6 purchase destinations, Phase 7 quantity-level attribution, later reporting/settlement/release work and optional external-store attribution remain open as recorded in [PHASE-COMPLETION.md](PHASE-COMPLETION.md). Variant eligibility does not implement quantity-level attribution or inventory reservation.
