# Thesi Regression Testing Playbook

Use this playbook before creator or brand launches, and after every production
update that touches auth, onboarding, CRM, marketplace, billing, inbox, or
settings.

## Test Rules

- Test production-like behavior in a real browser.
- Record every pass and every failure with URL, account, action, expected
  result, actual result, and console errors.
- Stop on the first blocking break, fix it, deploy it, then resume from the
  failed flow.
- Use obvious QA data for live submissions, for example names beginning with
  `QA` and emails at `example.com`.
- Do not use real payment methods or real creator/brand contacts for destructive
  or outbound tests unless the owner explicitly approves that exact action.

## Local Safety Checks

From `thesi-web`:

```bash
npm test
npm run lint
npm run build
```

From `thesi-api`:

```bash
npm test
```

Run focused tests while fixing a regression:

```bash
cd thesi-web
npm test -- BrandDetailContent.test.tsx
npm test -- MarketplaceDetailContent.test.tsx
npm test -- CampaignDetailContent.test.tsx CampaignsPageContent.test.tsx
npm test -- BrandSettingsPaymentMethodsContent.test.tsx DraftCampaignEditForm.accessibility.test.tsx InvoicesPageContent.accessibility.test.tsx
cd ../thesi-api
npm test -- marketplace.service.spec.ts
```

## Automated Coverage Targets

- Marketplace deadline rules:
  `thesi-web/src/lib/marketplace/listings.test.ts` and
  `thesi-api/src/api/marketplace/marketplace.service.spec.ts`.
- Marketplace creator/brand application UI:
  `thesi-web/src/components/marketplace/MarketplaceDetailContent.test.tsx`.
- Brand campaign lifecycle:
  `thesi-web/src/components/brand/campaigns/CampaignDetailContent.test.tsx`
  and
  `thesi-web/src/components/brand/campaigns/CampaignsPageContent.test.tsx`.
- Creator CRM empty related tabs:
  `thesi-web/src/components/creator-crm/BrandDetailContent.test.tsx`.
- Form field accessibility and date updates:
  `thesi-web/src/components/brand/campaigns/DraftCampaignEditForm.accessibility.test.tsx`
  and
  `thesi-web/src/components/creator-crm/InvoicesPageContent.accessibility.test.tsx`.
- Payment setup disabled while offline:
  `thesi-web/src/components/settings/brand/BrandSettingsPaymentMethodsContent.test.tsx`.

When a live RC pass finds a bug, add or extend one of these tests before
deploying the fix.

## Browser And Layout Regression

For live browser RC checks, cover both behavior and layout:

- Use production or a production-like preview URL.
- Use one creator account that already exists; creators should not self-sign-up.
- Use one fake QA brand account created during the run.
- For important pages, check desktop `1440x900` and mobile `390x844`.
- At each viewport, record page URL, primary heading, non-empty body content,
  horizontal overflow, and console errors.
- Required layout pages: public homepage, creator marketplace detail, brand
  marketplace detail, campaign detail, creator CRM brand detail, invoices, and
  settings/security.
- A layout check passes only when the page has meaningful content, no horizontal
  overflow, no incoherent overlapping controls, and no console errors.
- On long authenticated app pages, scroll the main content area and confirm the
  sidebar remains pinned in the viewport while `window.scrollY` stays `0`.

## Creator Release Candidate Flow

1. Public homepage
   - Open `https://get-thesi.com/`.
   - Verify the page title, hero copy, `Creators`, `Brands`, and `Sign in`.
   - Click creator CTAs and verify `/creators`.

2. Creator application
   - Open `/creators/apply`.
   - Verify required fields, country/type/follower selects, radio groups, and
     submit button.
   - Submit empty form and confirm browser validation blocks it.
   - Submit a fake QA application and verify `/creators/success`.

3. Creator sign-in
   - Sign in with an approved creator test account.
   - Verify redirect to `/app/dashboard`.
   - Confirm dashboard header says `Creator dashboard`.

4. Creator navigation smoke test
   - Visit Dashboard, CRM, Invoices, Inbox, Marketplace, Profile, Settings.
   - Visit CRM subroutes: Brands, Pipeline, Jobs, Contracts, Payments, Calendar,
     Tasks, Objects, Data model, Workflows.
   - Each page must show non-empty, useful content and no console errors.

5. Creator CRM
   - Invite a fake QA brand and verify the invite result appears as sent.
   - Open the created CRM brand.
   - Verify Overview, People, Deals, Jobs, Payments, Notes, Files, and Messages
     tabs.
   - Empty tabs must show a useful empty state, never a blank panel.
   - Add a person, save notes, create a deal, move a deal to Won, and verify the
     job/payment follow-on views.

6. Creator marketplace and inbox
   - Open marketplace listings and listing detail pages.
   - Apply only to QA listings, or stop before real application submission.
   - Open inbox, read threads, and send only QA messages when approved.

7. Creator profile and settings
   - Verify profile editing, portfolio sections, social/integration settings,
     notifications, team, payouts, and security pages.
   - Stop before connecting real OAuth, Stripe, payment method, or password
     changes unless explicitly approved.

## Brand Release Candidate Flow

1. Brand sign-up
   - Create a fake QA brand account from `/sign-up`.
   - Complete onboarding if required.
   - Verify brand account lands in the brand workspace.

2. Brand dashboard and navigation
   - Verify dashboard metrics and campaign summaries.
   - Visit Campaigns, Creators, Marketplace, Inbox, Profile, Settings, Billing,
     Payment methods, Payment history, Preferences, Notifications, Security.

3. Campaign flow
   - Create a QA campaign draft.
   - Fill campaign details, deliverables, timeline, platform fee/payment fields,
     and files only if approved.
   - Save draft, edit draft, publish to marketplace if approved, and verify the
     marketplace listing.

4. Creator discovery and invites
   - Open creator directory and creator detail.
   - Favorite/unfavorite a creator.
   - Invite a QA creator to a QA campaign only when approved.

5. Application and payment flow
   - Review QA marketplace applications.
   - Accept/reject QA applications.
   - Stop before real payouts or real payment methods unless explicitly
     approved.

## Report Template

```md
# Thesi RC Test Report

Date:
Environment:
Tester:
Browser:

## Summary

- Result:
- Blocking issues:
- Non-blocking issues:

## Passed Checks

- [PASS] URL/action - observed result.

## Failed Checks

- [FAIL] URL/action - expected vs actual.
- Evidence:
- Console/network errors:
- Severity:
- Fix plan:

## Regression Coverage Added

- Test file:
- Command:
- Result:

## Resume Point

- Account:
- URL:
- Last completed action:
- Next action:
```
