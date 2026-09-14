# Merchant Hub ↔ Thesi brand linking

## Implemented locally

A Merchant vendor owner can connect each Merchant brand to a Thesi brand they control. The implementation spans `fashion-merchants-hub`, `vendor-api`, `thesi-api`, `thesi-web` and the Thesi V35 migration in `clothme-db`. Nothing has been deployed; no live database migration, account link, message or payment was executed by this work.

Merchant Hub remains the authority for the vendor and its catalog brand IDs. Thesi remains the authority for its account, workspace ownership and active memberships. Neither system infers an account connection from matching email addresses. The link is an explicit mapping between the two brands, not a merge of user records or a transfer of payment authority.

One vendor can connect several Merchant brands, including to several workspaces owned by the same Thesi account. An active Merchant brand can connect to only one Thesi workspace; an active workspace can connect to only one Merchant brand. The active Merchant brand uniqueness is global across vendors, so transferring a catalog brand cannot silently give a new vendor another vendor's Thesi connection. Transfers and relinking require disconnection and renewed consent.

## Owner experience

1. In Merchant Hub, select the Merchant brand and open **Settings → Integrations → Thesi**. Only the vendor owner can manage the connection. Staff see an owner-only explanation and are also rejected by the API.
2. Choose **Connect Thesi account**. Merchant Hub generates a browser-bound verifier and state, and vendor-api checks the current vendor is active and owns the selected catalog brand.
3. Thesi opens its connection screen. The owner can sign in to an existing Thesi brand account or create a new one using the normal Thesi authentication service. Creator accounts are not converted. Passwords and Thesi access/refresh tokens never pass through Merchant Hub or vendor-api.
4. Thesi shows the Merchant account and brand. The owner explicitly chooses a Thesi brand; the default brand is not preselected. If multi-brand creation is enabled, the owner can create another Thesi brand here. Required temporary-password changes must be completed before approving a link.
5. Choose **Continue to Merchant Hub review**. This approves a short-lived grant; it does not yet create a connection.
6. Back in Merchant Hub, review the exact Merchant brand, Thesi brand and Thesi account email. **Confirm connection** rechecks current Merchant ownership, validates the browser proof and atomically creates the mapping and audit event in Thesi. A lost completion response can be retried with the same grant while it remains valid; it cannot create duplicate links.
7. **Open Thesi** opens the connected workspace after verifying the connection and the signed-in Thesi owner. An existing Thesi session is reused. If none exists, Thesi sign-in is required. Normal Thesi onboarding still applies to dashboard access.
8. Disconnect from the Merchant integration card or **Thesi → Settings → Merchant Hub**. Disconnection preserves both accounts, workspaces, campaigns, accepted terms and financial records. It revokes the mapping and invalidates outstanding approvals/launches for the brands.

Abandoned requests expire after ten minutes. Browser cancel removes the local verifier; the server request expires normally. Starting another flow in the same Merchant browser tab replaces that tab's pending request. A request in another tab has its own verifier. If sign-out, onboarding, account switching or storage clearing loses the pending flow, restart from Merchant Hub rather than guessing a mapping.

## V35 authentication boundary and the V40 extension

This increment links brands and provides a verified route into the connected workspace. It does **not** mint a Thesi session from a Merchant token. This is deliberate: existing Thesi access tokens and refresh tokens do not carry a Merchant connection/session provenance that can be revoked when a Merchant owner is suspended, signs out or disconnects.

The V40 extension now implements passwordless **Continue with Merchant Hub**, external identities, revocable sessions, refreshed session provenance and staff permissions. See [Merchant-controlled sign-in](MERCHANT-SIGNIN.md) for the current Phase 3 journey, verification boundaries and activation gates. The V35 workflow above remains the fallback when SSO is disabled.

## Trust and data flow

- The browser talks to authenticated vendor-api routes at `/v1/brands/:brandId/thesi`. Owner-only guards are backed by a current vendor status lookup and a vendor-scoped catalog brand lookup on **every** status/start/review/complete/revoke request. Body-supplied vendor IDs and brand display names are not accepted as authority.
- vendor-api calls a fixed `/v1/internal/merchant-links/*` path on the configured Thesi API origin. It uses a separate server-only credential, a ten-second timeout, JSON envelopes and rejects redirects. A browser is never given this credential. Neither application shares its normal JWT signing key.
- Thesi's internal routes use a dedicated timing-safe credential guard and are unavailable while linking is disabled. Thesi's public linking routes use its normal JWT guard, and approval/completion recheck current account role, password-change requirement, workspace status, owner identity and active owner membership.
- The intent code and approval grant are random 256-bit values stored only as SHA-256 hashes. The PKCE-style verifier stays in Merchant tab storage; only its SHA-256 challenge is sent during start. The approved grant is bound to the originating vendor, brand and challenge. Review and completion require the original verifier and current Merchant ownership.
- Return locations are fixed server-configured origins and paths, not arbitrary client `redirect_uri` values. Codes travel in URL fragments, are removed from the address immediately by the page, and are sent to the APIs in POST bodies. Callback pages declare `no-referrer` and `noindex`; third-party tracking does not initialize on the full-page callbacks. Avoid introducing tracking or request-body logging on these routes.
- The link and completion audit event are committed in a single Thesi database transaction. Merchant Hub does not maintain a second mutable copy of link state. Its status view reads the authoritative mapping through vendor-api.

The dedicated service credential is a trust boundary: possession permits trusted vendor assertions to Thesi. Store it in the existing secret-management mechanism, restrict the internal route at the network ingress where feasible, and rotate it as a coordinated server configuration change. Production transport must use HTTPS. No credential was generated, read from production, or installed by this change.

## V35 database objects

| Object | Purpose |
| --- | --- |
| `thesi.merchant_brand_link` | Stable link ID; verified Merchant vendor/brand IDs and names at consent; Thesi workspace and approving owner; creation and revocation history. Partial unique indexes prevent two active mappings on either side. |
| `thesi.merchant_link_intent` | Hashed one-time codes, browser challenge/state, action, expiry, approving workspace/user, linked record and consumption state. |
| `thesi.merchant_link_event` | Transactional `started`, `approved`, `linked`, `opened` and `revoked` audit events. Raw codes, verifiers, passwords and access tokens are excluded. |

V35 is additive and creates no links automatically. V33/backfill/V34 prerequisites remain unchanged. Names on link rows are consent-time snapshots; connection status reads the current Thesi workspace name. Product synchronization and automatic brand metadata synchronization are not part of this increment. Catalog/Thesi ownership transfers are not silently reconciled.

Intent expiry is enforced during every use. There is currently no cleanup scheduler. Define a retention policy before broad rollout: audit rows reference intents, so deleting intents alone will be rejected by foreign keys. Export/archive audit evidence before any coordinated retention deletion. Application audit events are append-only by convention; tamper-evident or database-role-enforced audit immutability is subsequent operational hardening.

## Configuration and rollout

| Application | Setting | Default/requirement |
| --- | --- | --- |
| Thesi API | `MERCHANT_LINKING_ENABLED` | `false`; enabling requires workspace discovery/access and V35. |
| Thesi API | `MERCHANT_LINK_SERVICE_KEY` | Dedicated secret of at least 32 characters, server-only. |
| Thesi API | `MERCHANT_HUB_URL` | Exact Merchant origin; fixed callback path is `/app/settings/integrations/thesi`. |
| Thesi API | `THESI_WEB_URL` | Exact Thesi web origin; start path is `/merchant-link`. |
| vendor-api | `THESI_LINKING_ENABLED` | `false`. |
| vendor-api | `THESI_API_URL` | Exact Thesi API origin, without `/v1`; the service supplies its fixed path. |
| vendor-api | `THESI_LINK_SERVICE_KEY` | Same dedicated server secret as Thesi's `MERCHANT_LINK_SERVICE_KEY`. |
| Merchant Hub web | `NEXT_PUBLIC_THESI_LINKING_ENABLED` | `false`; build-time switch for the integration card. This is not authorization. |

URL validation requires HTTPS in production, without credentials, query, fragment or a custom path. HTTP localhost is permitted only in development. Disabling linking stops new linking, launch, discovery and revoke endpoints; it does not delete stored mappings or affect independent Thesi sessions. During an incident, revoke affected mappings while the authenticated endpoint remains available, then disable the feature if appropriate. A revoked mapping cannot be resurrected by replaying a consumed grant.

1. Complete the backup/restore, V33 backfill and V34 workspace rollout gates in `BRAND-WORKSPACE-ROLLOUT.md`. Only Thesi is currently live; do not assume Merchant infrastructure has already been released.
2. Review a Thesi-scoped migration job and rehearse V35 on full PostgreSQL/Flyway. Never send all outstanding migrations to every database merely to enable this feature.
3. Provision the two server configurations and a dedicated secret through the established secret-management/release process. Verify the real Merchant and Thesi origins, CORS policy for Merchant Hub → vendor-api, and routing to the internal Thesi endpoint. No new secret or ingress setting is part of this local change.
4. Deploy code with linking disabled. Apply V35 through the approved migration path. Enable both APIs in staging, then build Merchant Hub with its card enabled.
5. Run a staged browser flow with actual staging accounts and databases: existing-account link, new-account signup, a second brand, wrong Thesi account, creator/staff rejection, expired flow, failed final response, both disconnect paths, and a suspended Merchant account or revoked Thesi owner membership. Confirm callback URLs and analytics/network behavior.
6. Test full PostgreSQL concurrency: two approvals racing for one brand/workspace, completion racing revocation, expiry and response-loss retry. Unique indexes and row locks are exercised functionally in embedded PostgreSQL, but that does not prove production contention/deadlock behavior. An aborted database transaction must be retried through the UI or status checked; the service does not automatically retry arbitrary mutations.
7. Review frontend builds and integration tests, then separately approve a controlled live activation. Flags are environment-wide; add an enrollment allowlist if a limited vendor cohort is required. Production activation was not performed here.

Recovery retains V35 data and disables the new feature or restores a known compatible image. The existing prohibition on rolling back to a user-only Thesi API after secondary brands exist still applies. Disconnecting does not revoke ordinary Thesi login sessions because no delegated Merchant login sessions are issued in this increment.

## Local verification

- Verified locally: 181 Thesi API tests, 105 vendor-api tests and 91 Thesi web tests passed.
- Thesi API and vendor-api builds passed. Both frontend type checks and production builds passed; Merchant Hub used an isolated localhost API placeholder and disabled CMS database access. Existing frontend lint warnings remain.
- `node scripts/test-merchant-links.mjs /path/to/@electric-sql/pglite/dist/index.js` runs V1–V35 in a disposable embedded PostgreSQL database, using the actual compiled Thesi linking service. It checks explicit approval vs completion, wrong owner/vendor/brand/verifier, multiple brands, one-time use, retry, expiry, revocation and audit events. It omits only pgcrypto extension installation because PGlite includes UUID generation.
- `node scripts/test-merchant-hub-link-flow.mjs` transpiles and runs the actual Hub helper in an isolated JavaScript context with mocked transport/storage to test verifier generation, state/vendor/expiry checks and callback reload.
- Callback page consent and Thesi browser state have web unit coverage. The Hub helper test is not a full browser end-to-end test. Full staged cross-domain authentication, cookie/storage policy, CORS, ingress, real PostgreSQL concurrency and deployment remain release gates.

These integration scripts require the sibling repositories and are not automatically included in the existing Thesi CI. No database credentials or live services are used by the scripts. Merchant Hub's local production build is run with CMS database access explicitly disabled; this does not validate Payload's live database configuration.

## Next work

Product attachment and creator attribution can now reference an explicit Merchant-brand ↔ Thesi-workspace mapping. The next campaign integration must still check current Merchant ownership and active link state server-side, verify product eligibility, snapshot accepted product/payment terms, and generate creator-specific tracking links. An active account link is not proof of a sale or authorization to charge a payment method. Sales ingestion, commission accrual/refunds and settlement remain separate phases.

The next product-selection increment is now implemented locally; see [CAMPAIGN-PRODUCTS.md](CAMPAIGN-PRODUCTS.md). The destination is an explicitly marked demo, not a checkout or attribution URL.
