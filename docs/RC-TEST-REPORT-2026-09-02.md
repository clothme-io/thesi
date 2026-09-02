# Thesi RC Test Report

Date: 2026-09-02  
Environment: Production, `https://get-thesi.com`  
Tester: Codex live browser pass  
Creator test account: `pikhane@gmail.com`

## Summary

- Status: Paused for deploy after marketplace deadline fix.
- Current blocker fixed locally: expired marketplace listings could still appear
  open and allow creators to begin applying.
- Previous blocker fixed and verified in production: blank Deals, Jobs, and
  Payments tabs on an empty CRM brand detail.

## Passed Checks

- [PASS] Public homepage loaded with Creators, Brands, Sign in, creator CTA, and
  page content.
- [PASS] `/creators` loaded and Apply Now CTAs worked.
- [PASS] `/creators/apply` loaded all required creator application fields.
- [PASS] Empty creator application submit was blocked by native validation.
- [PASS] Fake QA creator application submitted and reached
  `/creators/success`.
- [PASS] Creator sign-in page loaded after sign-out.
- [PASS] Creator account landed on `Creator dashboard`.
- [PASS] Creator nav smoke routes loaded with no console errors: Dashboard,
  CRM, Invoices, Inbox, Marketplace, Profile, Settings.
- [PASS] CRM subroutes loaded with no console errors: Brands, Pipeline, Jobs,
  Contracts, Payments, Calendar, Tasks, Objects, Data model, Workflows.
- [PASS] Creator brand invite modal opened with Send invites disabled when
  empty.
- [PASS] Fake brand invite enabled Send invites and sent successfully via Novu.
- [PASS] Invited QA brand appeared as a Prospect CRM record.
- [PASS] CRM brand detail Overview, People, Notes, Files, and Messages tabs
  loaded.
- [PASS] Deployed fix verified: empty Deals, Jobs, and Payments tabs now show
  useful empty states.
- [PASS] QA deal created in pipeline and appeared under Contacted.
- [PASS] Dragging QA deal to Won worked after a precise drag gesture.
- [PASS] Won deal created an active job.
- [PASS] Job detail loaded with notes and activity timeline.
- [PASS] Invoices page empty state loaded.
- [PASS] Empty invoice submit was blocked by native validation.
- [PASS] QA invoices were created and visible in Invoices.
- [PASS] Invoice status transitions worked: Unpaid to Invoice Sent to Paid.
- [PASS] CRM Payments reflected invoice state and totals.
- [PASS] Dashboard reflected active job, payment, and recent activity rollups.
- [PASS] Task page empty state and Add task drawer loaded.
- [PASS] QA task was created and tied to the QA brand/job.
- [PASS] Task completion worked and persisted after reload.
- [PASS] Calendar page empty state and Add event drawer loaded.
- [PASS] QA calendar event was created and displayed.
- [PASS] Remaining creator settings routes loaded with no console errors:
  Social, Integrations, Team, Notifications.

## Failed Checks

- [FIXED] CRM brand detail tabs `Deals`, `Jobs`, and `Payments` rendered blank
  panels for a brand with no related records.
  - Fix: Added explicit empty states and links to Pipeline/Invoices.
  - Regression: `thesi-web/src/components/creator-crm/BrandDetailContent.test.tsx`.

- [FIXED LOCALLY] Marketplace listing showed `Open` and enabled `Apply` after
  the application deadline had passed.
  - Evidence: Listing `Browser QA Campaign 2026-08-27` had `Apply by
    2026-08-27` on 2026-09-02, but still showed `OPEN` and `Apply`.
  - Fix: Frontend now computes effective closed status from
    `applicationDeadline`; backend filters expired listings from creator browse
    and rejects expired applications.
  - Regression:
    `thesi-web/src/lib/marketplace/listings.test.ts`,
    `thesi-api/src/api/marketplace/marketplace.service.spec.ts`.

## Non-Blocking Issues

- [P2] Auto-created job from a won deal had blank deadline/deliverables. The
  job was usable, but the table displayed `due` with no date.
- [P2] Some form controls work visually but are weakly accessible to automated
  label queries. Examples: CRM/task labels and task completion checkbox without
  a clear accessible label.
- [P3] Invoice date input did not update through one automation fill method,
  but keyboard/manual interaction changed it. Treat as retest item for real user
  input and Playwright regression coverage.

## Verification Added

- `npm test -- BrandDetailContent.test.tsx`
- `npm test -- MarketplaceDetailContent.test.tsx listings.test.ts`
- `cd thesi-web && npm test`
- `cd thesi-api && npm test`
- `cd thesi-web && npm run lint`
- `cd thesi-web && npm run build`
- `cd thesi-api && npm run build`

## Resume Point

- Deploy current marketplace deadline fix.
- Resume at `https://get-thesi.com/app/marketplace`.
- Expected result after deploy: expired listing should not appear in creator
  browse. Direct URL should show `Closed` / `Applications closed` and no
  `Apply` button.
