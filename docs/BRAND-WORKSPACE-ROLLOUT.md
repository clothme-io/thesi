# Brand workspaces: implementation and rollout

> Phase 3 update: Merchant-derived staff memberships and passwordless sessions are documented in [MERCHANT-SIGNIN.md](MERCHANT-SIGNIN.md). Earlier owner-only statements below describe the V33/V34 foundation.

## Local implementation status

One Thesi brand account can own a default brand and additional brands. This release supports the same owner acting across those brands. Owner-managed Merchant Hub brand linking is now implemented locally; see [MERCHANT-HUB-LINKING.md](MERCHANT-HUB-LINKING.md). Passwordless Merchant sign-in, delegated staff, vendor-wide reporting and secondary-brand billing setup remain subsequent work. Nothing in this change has been deployed or applied to production.

- V33 in `clothme-db` adds workspaces, memberships, associations on ten tables, default-workspace compatibility triggers and a bounded backfill function. Historical data is not backfilled during the migration.
- V34 requires completed V33 backfill and rejects inconsistent owner or campaign-parent mappings. It validates foreign keys, adds the explicit workspace owner and creation-request key, and makes profiles, favorites and brand/creator conversation uniqueness workspace-specific.
- Default profiles retain their existing unique `user_id`. Secondary profiles have `user_id = NULL` and a unique workspace association; the workspace carries the owner. Legacy profile URLs remain valid; secondary logos have a workspace-specific public URL.
- Root campaign, profile, favorite and inbox writes carry the selected workspace. Campaign files, listings, invitations, accepted snapshots, fees and payouts inherit the campaign's workspace, with explicit brand context checked against the parent. Historical records cannot be moved between brands by updating their workspace IDs.
- Active owner membership and workspace status are checked on every scoped request. Repository queries constrain campaigns, profiles, files, marketplace listings, invitations, favorites, messages, campaign notifications and financial records. User identity remains the actor; ownership checks continue to exclude staff delegation.
- A creator sees distinct conversations for two brands with the same owner. Replies to invitation responses derive the conversation from the campaign's brand, including when the creator has no brand context. Creator-owned CRM and personal message read/delete state remain account-owned.
- Billing cards and invoices remain tied to the legacy default account. Secondary-brand billing endpoints and payment initiation are denied; the charge-context service also prevents implicit use of the legacy payer. This release does not configure or charge a secondary-brand payer.
- The web sidebar lists accessible brands and supports adding a brand. Switching saves a tab-local, user-specific selection and reloads the dashboard to discard mounted state. Profile caches are keyed by user and workspace. JSON, multipart and binary requests retain the selected workspace through token refresh. Invalid/unavailable selection is not silently replaced with the default.

## API and flags

`GET /v1/brand-workspaces` returns active memberships as `{ id, name, role, isDefault, canCreate }` inside the normal API response envelope. `POST /v1/brand-workspaces` accepts `{ name, creationKey }`, where `creationKey` is a client-generated UUID. Creation atomically inserts the workspace, owner membership and empty brand profile. A retried request with the same owner, key and unchanged name returns the same brand; reusing the key with another name is rejected.

| Flag | Default | Purpose |
| --- | --- | --- |
| `BRAND_WORKSPACES_ENABLED` | `false` | Exposes discovery. |
| `BRAND_WORKSPACE_ACCESS_ENABLED` | `false` | Enforces selected/default workspace on brand business routes; requires V34 at startup. |
| `MULTI_BRAND_ENABLED` | `false` | Enables additional-brand creation; requires both flags above. |

`X-Thesi-Workspace-Id` selects a brand on supported business routes. With access enabled, omitting it selects the owner's default brand. Malformed headers, missing/revoked membership, archived workspaces and workspace headers on unsupported or creator routes are rejected. Discovery/creation, personal settings, creator CRM, public images and webhooks do not accept client brand selection. Public workspace logo lookup exposes only the public image of an active workspace.

**This API image requires V33 even with all flags disabled**, because Drizzle projections now include workspace columns. Startup rejects a missing foundation. Enabling access requires V34; do not enable access against V33 alone. After any secondary brand exists, startup refuses to disable discovery or access enforcement. Creation can be paused independently by setting `MULTI_BRAND_ENABLED=false`, while the existing brands remain accessible. Do not treat flags as a substitute for rollout verification.

## Production evidence still required

Record actual API/web image digests, Argo revision, successful Flyway history, aggregate inventory, recent Thesi backup object and a successful isolated restore. Local image pins and `/ready` are insufficient; `/ready` verifies database connectivity. No live evidence has been collected here.

The local infrastructure changes add Thesi to the backup list and its manifest validator. Release and PR workflows now run API/web tests and production builds. These checks do not deploy migrations or prove backup restoration.

`scripts/audit-brand-workspaces.mjs` uses a repeatable-read, read-only transaction with a 30-second statement timeout and explicitly supplied `DATABASE_URL`. It does not source environment files, expose connection strings or account names, run migrations or repair mappings. It understands pre-foundation, V33 and V34 ownership, including secondary profiles, and compares child workspaces to campaign parents. Reconcile counts and financial totals against the agreed snapshot; ongoing writes can change totals between inventories. Its missing membership count includes revoked owners, which may be intentional and must be reviewed rather than automatically repaired.

## Ordered rollout gates

1. Review and deploy the backup coverage change through GitHub/Argo. Demonstrate a successful Thesi backup and isolated restore before altering the live database.
2. Rehearse API/web, V33, bounded backfill and V34 on full PostgreSQL/Flyway using a representative sanitized restore. Measure DDL lock time, index build time and batch cost. Embedded PostgreSQL tests are functional evidence, not production concurrency/locking evidence.
3. Prepare a reviewed **Thesi-scoped migration job targeting V33 only**. The currently checked-in cluster migration job targets all databases; do not release an image containing both migrations through an unrestricted migrate-to-latest job. V34 deliberately fails before backfill. This deployment job configuration remains a release prerequisite.
4. Apply V33 through that approved job. It has a five-second lock timeout. On timeout, investigate and retry through the normal job; do not bypass controls. Keep the existing application serving default-brand traffic.
5. Run a separately controlled bounded backfill job. Call `SELECT * FROM thesi.backfill_brand_workspaces(100)` once per transaction, with job timeouts and inspection between batches. Each call updates at most 100 rows per entity plus up to 100 brand defaults. Repeat until an audit proves completion; a zero batch alone is insufficient because `SKIP LOCKED` can skip busy records. Do not run this from API startup or a laptop against production.
6. Reconcile missing associations, invalid owners, parent/child conflicts, memberships and financial totals. Resolve ambiguous mappings explicitly. V34 also checks owner/parent consistency before changing constraints.
7. Apply V34 separately after reconciliation. It uses a five-second lock timeout and a 60-second statement timeout. It validates constraints and creates **ordinary transactional indexes**, which can block writes. A representative staging rehearsal must establish whether this fits the maintenance window. If it does not, split index/validation operations into a reviewed low-lock sequence before production use; do not simply remove the timeouts.
8. Deploy the workspace-aware API and web with discovery/access enabled and creation disabled in a controlled environment first. Verify default-brand reads/writes, registration, profile/logo, publication, invitations, creator responses, account billing and personal settings. After staging approval, the corresponding production rollout must finish across **all API and web replicas** before creation is enabled. Old clients without a selection continue using the default brand.
9. Verify two-brand creation/switching, same-creator conversations, independent profiles/favorites, unauthorized selection, revoked/archived access and denial of secondary-brand charging in staging. Only then consider a separately approved controlled production activation of `MULTI_BRAND_ENABLED`. These flags are environment-wide, not a per-vendor allowlist; add an explicit cohort mechanism if limited production enrollment is required.
10. Monitor errors, isolation failures, backfill/audit discrepancies and financial behavior against the release snapshot. Stop new-brand creation on an unexplained failure while retaining workspace access enforcement.

## Recovery boundaries

After V33 and before secondary-brand creation, retaining the additive schema while reverting an application is preferable to dropping schema or restoring the whole database. Rehearse the exact old image against the current migration state; V34 changes uniqueness and is not a blanket promise of compatibility with every old writer.

After secondary brands exist, **do not revert to a user-only API**, disable access enforcement or run old application replicas alongside the new release. The new startup guard cannot protect an old binary that lacks it. Recover with a known workspace-compatible image and creation disabled. Database restore is disaster recovery with an explicit data-loss window, not ordinary application rollback.

## Local verification

Build `thesi-api`, then run:

```sh
node scripts/test-brand-workspaces.mjs /path/to/@electric-sql/pglite/dist/index.js
node scripts/test-multi-brand.mjs /path/to/@electric-sql/pglite/dist/index.js
```

The scripts load migrations from the sibling `clothme-db/databases/thesi/sql` repository and use a disposable PGlite database. The only SQL adaptation removes `CREATE EXTENSION pgcrypto` because UUID generation is built in. No production credentials or connection are used. The first test covers V1–V33 historical preservation, backfill and adversarial same-owner read/write boundaries. The second exercises V34 and real two-brand repository operations, idempotent creation, pausing creation, profiles/logos, favorites, creator conversations/replies, campaign child attribution, fee/payout visibility, audits and revoked/archived access.

API tests additionally cover request-context separation, financial guards and configuration gates. Web tests cover user/tab selection, cache separation, selection across token refresh, multipart/binary requests, sidebar discovery and creation retry. These scripts are local checks; the current CI does not fetch the sibling migration repository or run the PGlite integration scripts. CI runs API/web unit tests and builds. Browser end-to-end testing with a full staged API and full PostgreSQL remains a release gate.

## Following implementation phases

1. **Merchant-first account linking — implemented locally:** V35 and both application flows now support owner-controlled brand mappings, explicit consent, one-time codes, conflict handling, revocation and audit history. Follow [MERCHANT-HUB-LINKING.md](MERCHANT-HUB-LINKING.md) for staging/activation gates. Passwordless Merchant sign-in remains a separate external-identity/delegated-session change; current opening uses normal Thesi authentication.
2. **Delegated permissions and payer setup:** decide which Merchant staff may manage which Thesi brands, replace owner-only paths deliberately, provide shared-inbox participation without impersonation, and configure explicit workspace billing authority. The current owner column is not a staff impersonation mechanism.
3. **Campaign product selection — implemented locally:** vendor-api checks current brand ownership, publication and stock. Thesi attaches a server-verified product snapshot to commission terms, displays it above campaign details, and preserves it after publication and in accepted snapshots. The approved destination is a Thesi demo preview, since ClothME has no working public product route yet. See [CAMPAIGN-PRODUCTS.md](CAMPAIGN-PRODUCTS.md) for flags, validation and staging gates.
4. **Creator-specific links and checkout attribution — implemented locally, disabled by default:** Thesi V36 and commerce V18, accepted-creator links, shopper-bound handoffs, mobile continuation and matching order-line snapshots are in place. See [CREATOR-ATTRIBUTION.md](CREATOR-ATTRIBUTION.md) for policy, configuration, validation and the outstanding native/device rollout gates. Pending orders and click grants do not create sales or earnings.
5. **Sales and earnings:** ingest verified, idempotent order/line events from the commerce system; apply the agreed attribution window and commission basis; account for cancellations, refunds and partial refunds. Show consistent totals to creators, brands and ClothME.
6. **Settlement and operations:** separate the base obligation from variable commission, maintain an immutable earnings/adjustment ledger, reconcile events and add independently retryable settlements. Enable actual commission payouts only after settlement rules, payer funding, returns and reconciliation are verified.

The commission option currently configures/displays terms only. The homepage uses the approved base-plus-commission copy. Neither is proof of completed commerce attribution or settlement.

### Commission event and reporting phase — implemented locally, 2026-09-12

See [COMMISSION-EARNINGS.md](./COMMISSION-EARNINGS.md). Added durable commerce-to-Thesi delivery, accepted-term calculations, immutable adjustments, refund holds/full reversals and scoped reports in Thesi, Merchant Hub and ClothME admin. Production and migrations remain unchanged. Next: exact line-level refund allocation and qualification controls, followed by separate base obligations and funded settlement.


### Approved clarification: optional base payment

Commission campaigns support commission only or commission plus an explicitly enabled fixed base. An absent/disabled base creates no fixed-payment obligation, content-payment trigger or estimated fee on a fixed payout. Existing accepted terms remain unchanged. Future base obligations and funding must be created only when the accepted snapshot explicitly enables a base; commission settlement proceeds independently. Exact refund allocation and funded settlement remain subsequent implementation work; this clarification does not enable production or payouts.

### Verified refund allocations and payout/funding proposals — implemented locally

See [REFUNDS-AND-PAYOUT-TERMS.md](./REFUNDS-AND-PAYOUT-TERMS.md). New campaigns designed in the form default to ClothME payout handling, while proposed funding is separately specified by campaign terms. Optional base payment remains independent. Commerce V20 and compatible earnings readers support operations-recorded allocations of successful Stripe refunds. Funded settlement, approval/reserve workflows, direct-payment verification and mixed-credit/platform-fee reversal workflows remain outstanding; production is unchanged.
