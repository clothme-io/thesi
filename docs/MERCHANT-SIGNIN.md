# Phase 3: Merchant-controlled Thesi access

Merchant Hub is the authority for its vendor, brand assignments and staff permissions. Thesi retains its own users, workspaces, campaign history and payment records. V40 adds external identities and revocable sessions; it does not merge accounts by email or copy Merchant passwords.

## Owner journey

1. Open Thesi from Merchant Hub's integration card, or choose **Continue with Merchant Hub** on Thesi's sign-in page.
2. Thesi stores a random browser verifier and starts a ten-minute request. Merchant Hub preserves that request across its login and onboarding redirects.
3. Select a Merchant brand and authorize the handoff. Vendor API derives the actor from its verified JWT and checks current catalog ownership. Thesi independently verifies that identity through the dedicated internal identity endpoint.
4. Review the Merchant account, brand and access. New owners receive a passwordless Thesi account and one initial workspace. Existing Merchant identities reopen their linked Thesi account. Matching email alone never grants access: an existing Thesi brand account must authenticate before approving a new identity link. Creator accounts cannot be converted.
5. For an unconnected brand, create a workspace or select an existing owned workspace. Adopting a workspace with existing local staff requires an explicit checkbox to replace that access with Merchant-managed grants. This preserves the workspace, campaigns and financial history and records an audit event.
6. Thesi consumes the one-use proof and issues a session scoped to that connection. New users complete the existing welcome and brand questionnaire. Refreshes and onboarding responses retain Merchant session provenance.
7. To open a second brand, select it in Merchant Hub and authorize its Thesi workspace. The same owner can own both workspaces; each Merchant session is scoped to one selected brand.

The existing V35 two-sided owner linking flow remains available independently when SSO is disabled. Its implementation is described in `MERCHANT-HUB-LINKING.md`.

## Staff and revocation

- Merchant staff must be active, assigned to the selected catalog brand, and explicitly granted `thesi:read`. That grants viewer access. Adding `thesi:write` grants campaign management. These scopes are not silently added to existing presets.
- Staff have their own Thesi user and external identity. Workspace context records their real actor; legacy campaign repositories receive the owning brand's resource identity. An immutable audit records the start of authorized staff mutations. It is an attempt log, not proof that every mutation succeeded.
- Viewers cannot mutate campaigns. Campaign managers can perform permitted campaign, invitation, creator-directory and inbox operations. They cannot administer brand settings, connections, cards, billing, campaign funds or settlement. Server enforcement is authoritative; frontend controls also limit financial and editing actions.
- Each Merchant JWT request and refresh verifies the active local session, identity, membership, workspace and connection, then checks current Merchant authority. Suspension, removed assignments or grants, and disconnection fail closed. Merchant outages return an unavailable error rather than granting stale access.
- Sessions have an eight-hour absolute lifetime. Access-token refresh does not extend that lifetime. Merchant logout revokes the actor's delegated Thesi sessions; Thesi logout requests revocation of its current session. Browser logout clears local credentials even if the network revocation request fails; such requests are not an offline revocation guarantee.
- Disconnecting invalidates pending link/login approvals as well as the connection. Existing campaigns, accepted agreements, sale receipts and ledger records are retained.

## Local verification

The automated HTTP test creates and removes uniquely named temporary Thesi and Catalog databases on the Docker demo Postgres server at `127.0.0.1:5844`. It uses actual Nest controllers, strict validation, JWT guards, identity services and PostgreSQL repositories. Payment, storage and email calls are prohibited. The browser test uses the actual two frontend applications; its existing Merchant session is seeded with a token issued by the real vendor token service. It verifies the logged-out redirect and authorization continuation; it does not claim to test entering a Merchant password or a production identity provider.

From this repository, with the APIs built and the local Docker Postgres demo running:

```sh
node scripts/test-merchant-login.mjs /path/to/@electric-sql/pglite/dist/index.js
node scripts/test-merchant-login-http.mjs
```

For the visible browser journey, start these in two terminals, then run the browser test. The preview launcher supplies only localhost URLs and uses a separate `.next-merchant-identity` cache:

```sh
node scripts/merchant-demo-web.mjs thesi
node scripts/merchant-demo-web.mjs merchant
node scripts/test-merchant-login-http.mjs --browser
```

The browser harness currently uses the bundled desktop Playwright and installed macOS Chrome. It blocks non-local browser requests. Its temporary API servers shut down when the test finishes; the preview pages alone are not a persistent seeded environment.

## Activation gates

No production migration, rollout or real payment is part of this verification. Apply Thesi V40 transactionally through the normal migration process after a representative migration/restore rehearsal. Deploy both APIs with SSO disabled, then configure:

- Thesi: `MERCHANT_SSO_ENABLED`, `MERCHANT_IDENTITY_SERVICE_KEY`, the fixed `MERCHANT_API_URL`, and existing workspace/multi-brand/linking prerequisites.
- Vendor API: `THESI_SSO_ENABLED`, matching `THESI_IDENTITY_SERVICE_KEY`, fixed `THESI_API_URL`, and linking prerequisites.
- Frontends: `NEXT_PUBLIC_MERCHANT_SSO_ENABLED` in Thesi and `NEXT_PUBLIC_THESI_SSO_ENABLED` in Merchant Hub. Both default off.

Use a distinct identity credential, separate from catalog/linking keys. Enable in dev first and verify HTTPS browser behavior, service connectivity, staff revocation and the existing live Thesi login before a pilot. Disabling SSO must deny existing delegated sessions; do not remove V40 data as a feature rollback. Stripe configuration and real provider tests remain deferred and belong to the payments/release gates, not this local sign-in verification.
