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
```

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
