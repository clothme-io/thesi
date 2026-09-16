# Creator links and checkout attribution

For the current durable login/install continuation, association configuration, Docker browser demo and native acceptance status, see [Phase 6](CREATOR-LINK-PHASE-6.md). The original increment below describes the legacy 15-minute handoff, which remains supported.

Implemented locally following approval of the product-selection phase. All activation flags default off. Migration files were added but not applied to any production/staging database. No deployment, payment, real customer checkout, commission payout or outgoing notification was performed.

## What this increment does

1. A creator accepts a Base + Commission campaign containing a verified Merchant product. Thesi uses the actual acceptance snapshot, not product/creator IDs submitted by a browser.
2. The creator selects **Get my creator link** on the accepted campaign’s product commission block (marketplace listing, or the accepted invite in Inbox for direct invitations). The API requires that the signed-in creator owns the acceptance snapshot. Repeated requests return the same random public URL.
3. Public `/r/{code}` shows the current eligible product. Loading, crawler previews and Next.js prefetches do not create a click. PostHog initialization is excluded from this public-link route.
4. The shopper explicitly prepares an app link. Thesi creates a random, hashed handoff grant and returns `clothme://creator-link/{grant}`. The page then presents **Open ClothME**. The handoff must be redeemed within 15 minutes of its original server click time.
5. ClothME captures the handoff, persists it locally for login continuation, removes it from the active route and asks the signed-in shopper to continue. It waits for login/onboarding navigation to finish before resuming. Customer API resolves the JWT account and owned shopping person; body fields cannot nominate a shopper or creator.
6. Customer API exchanges the grant with Thesi over a dedicated authenticated server connection. Thesi binds it to a stable HMAC pseudonym of account + person. A second shopper cannot redeem the same grant. Retrying for the same shopper preserves the original click time and expiry. Customer API stores the touchpoint and opens the actual existing ClothME product screen.
7. Checkout loads unexpired touchpoints only for that account, person and cart products, then revalidates them with Thesi. It passes server-returned attribution receipts internally to the order repository; there are no attribution fields in the checkout DTO.
8. The order repository writes attribution in the same PostgreSQL transaction as order placement. An order line must match the receipt's product, Merchant brand and vendor. An attribution insert failure rolls back order/cart changes. Unrelated lines receive no attribution.

The resulting order remains **pending**. This increment creates neither a payment record nor an earnings ledger entry. Existing payment initialization still follows the existing checkout flow; the attribution integration itself does not call a payment provider.

## Attribution policy used

- Product-specific, most recent successfully claimed click, ordered by Thesi's original server click time. A delayed retry of an older grant cannot replace a newer touchpoint.
- The window comes from the accepted affiliate terms and starts when the shopper explicitly prepares the app link. Claiming/retrying does not restart the window.
- New links/clicks require an active campaign within its start/end dates and an active Merchant/workspace mapping. Product publication, Merchant ownership and availability are checked through the existing product service at preview, click, claim and checkout validation.
- A previously claimed click may remain usable after the campaign ends, through its originally agreed attribution window. Ending a campaign stops new clicks. Explicit tracking-link revocation, Merchant unlinking, an inactive workspace or unavailable product prevents further validation.
- Only the newest touchpoint is retained per account/person/product. If that touchpoint is revoked, attribution is removed for new checkout; there is no fallback to an older creator.
- Order attribution is a historical snapshot. Later unlinking does not erase already recorded order-line attribution.
- A verified upstream 404 (expired/revoked/unavailable receipt) removes that receipt from the new checkout. Network errors, credential failures and paused upstream verification block checkout with a retry message when a live touchpoint requires checking, rather than silently dropping attribution.
- Shopper identity is separate from Thesi creator identity. Self-referral/fraud detection, shared devices and cross-account identity resolution are not implemented here and must be settled before monetary rewards activate.

Catalog checks and Thesi receipt validation happen before the commerce transaction. This is not a distributed inventory reservation or atomic transaction across services. Actual stock checks and paid-sale qualification remain commerce responsibilities. The receipt used is the latest touchpoint observed during checkout verification.

## Data and endpoints

**Thesi migration V36** adds `creator_tracking_link` and `creator_click_grant`. Links reference accepted snapshots, and raw handoff grants are never stored. A public share code is intentionally retrievable and is not a login credential. It contains no creator, brand or product identity in its URL. Grant expiry is stored server-side; buyer binding is a pseudonym, not a shopper email or raw account ID.

Thesi API:

- `GET /v1/creator-tracking/links`: authenticated creator's accepted product campaigns (up to 200). Disabled returns an empty disabled result without reading new tables.
- `POST /v1/creator-tracking/links` with `campaignId`: issue/retrieve the authenticated creator's link. Requires an eligible owned acceptance snapshot.
- `GET /v1/creator-tracking/preview/:code`: public product-only preview; no click mutation.
- `POST /v1/creator-tracking/click` with public `code`: explicit handoff creation.
- `POST /v1/internal/creator-attribution/claim` with `code,buyerKey`: shared-key authenticated shopper binding.
- `POST /v1/internal/creator-attribution/validate` with `receiptId,buyerKey`: shared-key authenticated receipt verification.

**Commerce migration V18** adds `creator_touchpoint` and `order_line_creator_attribution`. No existing order-line/payment columns change. A receipt contains version, receipt/link/acceptance/campaign/workspace/product/brand/vendor/creator IDs, original click/expiry timestamps, and accepted base/commission terms. These snapshots are not earnings amounts. Customer-facing claim responses return only product/brand IDs and expiry.

Customer API:

- `POST /v1/customer/creator-attribution/claim` with `{code}`, existing shopper JWT and optional `X-Person-Id`. Person ownership is resolved server-side.
- Existing checkout DTO and mobile checkout request shape remain unchanged. Checkout reads trusted attribution from the server, not URL fields or client-supplied receipt JSON.

The new order attribution table is intentionally separate from existing graph/order-feed projections. Creator/brand/ClothME earnings dashboards and event publication need to consume it in the next phase.

## Configuration and ordered staging rollout

1. Complete all earlier workspace/backfill/V35 Merchant linking and product gates in `BRAND-WORKSPACE-ROLLOUT.md`, `MERCHANT-HUB-LINKING.md` and `CAMPAIGN-PRODUCTS.md`. Only Thesi is currently live; do not activate live Thesi against an unavailable Merchant/customer platform.
2. Apply **Thesi V36** and **commerce V18** through separately reviewed database-specific migration jobs in staging. New APIs fail activation if their migration is missing. Migration files are additive, but foreign keys deliberately retain attribution history; assess account/order deletion workflows before rollout.
3. Create a dedicated attribution service key (32+ characters), separate from Merchant linking and catalog keys. Configure `ATTRIBUTION_SERVICE_KEY` on Thesi and matching `THESI_ATTRIBUTION_SERVICE_KEY` on Customer API. Never expose it in web/mobile env variables.
4. Customer API also requires `THESI_API_URL` as a fixed origin (no `/v1`; HTTPS in production) and a separate stable `THESI_ATTRIBUTION_BUYER_KEY` of at least 32 characters. This HMAC key determines shopper binding. Do not rotate it while receipts are live without an explicit key-version migration.
5. Keep Thesi `CREATOR_TRACKING_ENABLED=false`, `CREATOR_LINKS_ENABLED=false` and Customer API `THESI_ATTRIBUTION_ENABLED=false` during deployment. Enable staging customer verification and Thesi tracking together after migrations/configuration, then enable Thesi `CREATOR_LINKS_ENABLED` for new link issuance and handoffs. Thesi tracking requires the existing campaign product flag and Merchant prerequisites.
6. Build Thesi web with `NEXT_PUBLIC_CREATOR_TRACKING_ENABLED=true` to expose the creator navigation/control. Build ClothME mobile with `EXPO_PUBLIC_THESI_ATTRIBUTION_ENABLED=true` to enable handoff capture/resume. All new public env values are booleans only.
7. Exercise real staged HTTP services, JWT guards and service keys on an iOS/Android device: installed app, logged-out/login/signup continuation, profile changes, cancellation, retries, expired handoffs, multi-product checkout, Merchant unlinking, paused/completed campaigns and failed checkout transactions. Confirm the original product demo remains explicitly untracked.
8. Do not publish this as universal/deferred-install linking. This increment supports the installed app's existing `clothme` scheme and routes provider-delivered `creator-link` payloads. App-store fallbacks, verified universal-link hosting and deferred attribution through a fresh install still require separate setup/device validation. The public page states that the app is required and offers no web checkout.
9. Pause **new entry** server-side with Thesi `CREATOR_LINKS_ENABLED=false`; optionally hide web controls/mobile capture too. Leave `CREATOR_TRACKING_ENABLED` and Customer API validation enabled for existing handoffs/touchpoints. Turning off Thesi verification returns a retryable service-unavailable response to Customer API, not an expired receipt. Customer API refuses startup with its attribution flag off while unexpired shopper touchpoints exist. Do not downgrade to older checkout code that would discard live attribution.
10. Before broad exposure, configure ingress rate limits and request-body/path redaction for click/handoff routes, establish bounded retention/cleanup for expired unclaimed grants/touchpoints, and exercise real PostgreSQL concurrency and service outages. No background retention job, click analytics dashboard or creator/admin link-revocation UI is included in this increment. Merchant unlinking remains the supported user-facing revocation mechanism; the tracking-link schema also supports server-side revocation.

## Verification performed locally

### Phase 6 Android association preparation — 2026-09-13

Thesi web now serves `/.well-known/assetlinks.json` as uncached JSON. By default it returns an empty association list. Enable it only with server-side `CLOTHME_ANDROID_APP_LINKS_ENABLED=true` and `CLOTHME_ANDROID_SIGNING_SHA256` containing one or more comma-separated, colon-delimited SHA-256 certificate fingerprints. The package is fixed to the existing `io.patheos.clothme` application ID. Missing or malformed configuration publishes no association. Multiple fingerprints support signing-certificate rotation.

The user authorized a disposable Android signing identity. `scripts/test-android-link-certificate.mjs` generated a one-day PKCS12 identity, verified its certificate signature, supplied its fingerprint only to an isolated invocation of the actual route handler, verified JSON/package/fingerprint/disabled behavior, and deleted its temporary directory in `finally`. No private key or temporary fingerprint was saved in release configuration. Three unit tests also cover disabled defaults, malformed fingerprints and rotation normalization.

This is server configuration verification, **not Android domain verification or a signed app/device test**. The real app must declare the matching HTTPS host/path, and the HTTPS host must serve the fingerprint of the certificate signing that installed build. For Play-distributed builds, obtain the app-signing fingerprint from Play Console; a disposable certificate cannot substitute for it. Store URLs remain unconfigured. Installed cold/warm routing, login/install continuation and the remaining Phase 6 acceptance checks are still pending.

Run the disposable check with `node scripts/test-android-link-certificate.mjs`; set `THESI_TEST_KEYTOOL` to the local JDK keytool path if needed. It never installs an application or changes a deployed association.

- Thesi API build and 200 unit tests passed; an additional independent new-link pause test was then added.
- Customer API build and its 188-test suite passed; two additional safe-pause/migration tests were then added and the 9-test attribution suite passed.
- Thesi web production build and 100 tests passed. The built public creator-link page was exercised in headless Chrome with an isolated fixture API: GET created zero clicks, the explicit button created one handoff, the returned app destination was validated, and desktop/mobile layouts had no horizontal overflow.
- `scripts/test-creator-attribution.mjs` executes actual compiled Thesi/customer services and the order repository against separate disposable PGlite databases with Thesi V1–V36 and commerce V1–V18. Only pgcrypto extension declarations are omitted because PGlite has built-in UUID generation. Network calls are bridged directly to the real Thesi service in-process; Merchant product data is a fixture. It covers accepted-creator authorization, stable links, no GET click, buyer-bound replay, fixed windows, expiry, campaign completion, person/product/vendor/brand isolation, last-touch ordering, transactional order attribution/rollback and revocation. No production credentials, real payment provider or external checkout is used.
- `scripts/test-mobile-creator-link.mjs` executes the actual mobile pending-link store with in-memory native storage: code validation, expiry, future timestamps, repeated capture without renewal and clearing passed.
- Full mobile TypeScript checking remains blocked by existing repository errors: missing `react-native-toastify-expo` / `vexo-analytics`, older route typings and existing component/type mismatches. The compiler reported no errors in the new creator-link screen, pending store or resume hook. This is not an iOS/Android build or device test; those remain release gates.

The disposable SQL/mobile scripts are local checks and are not automatically wired into CI's sibling-repository checkout.

## Next implementation phase

Ingest verified paid-order and order-line events into Thesi with idempotent delivery/replay, then process cancellations, refunds and partial refunds. Calculate commission from accepted percentage-of-sale or percentage-of-platform-commission terms using actual authoritative amounts; do not use click counts or pending order totals as sales. Add the earnings/adjustment ledger and consistent creator, Merchant brand and ClothME reporting. Base-payment obligations and independently retryable settlement remain subsequent work, including payer authority, funding, reconciliation and fraud/self-referral rules. Merchant passwordless SSO and delegated staff authority remain separately scoped from the implemented account-linking flow.

## Commission reporting follow-up

The next local phase now adds captured-payment reconciliation, durable event delivery, immutable commission calculations and creator/brand/Merchant/ClothME reporting. See [COMMISSION-EARNINGS.md](./COMMISSION-EARNINGS.md) for the implemented behavior and rollout requirements. Partial refunds are explicitly held pending authoritative line allocation; payouts remain disabled. V19/V37 are migration files only until separately applied.
