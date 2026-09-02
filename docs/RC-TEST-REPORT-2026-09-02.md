# Thesi RC Test Report

Date: 2026-09-02  
Environment: Production, `https://get-thesi.com`  
Tester: Codex live browser pass  
Creator test account: `pikhane@gmail.com`

## Summary

- Status: Production RC retest complete for the fixed scope.
- Current blocker: none.
- Marketplace deadline fix has been deployed and verified in production.
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
- [PASS] Marketplace deadline fix verified after deploy: expired creator
  listing URL no longer exposes Apply, and creator marketplace browse showed no
  expired listings.
- [PASS] Creator Security page loaded with no console errors.
- [PASS] Creator forced password-change flow was manually tested by the owner
  during first sign-in with the creator account.
- [PASS] Creator sign-out landed on `/sign-in`.
- [PASS] Fake brand account created:
  `qa.brand.owner.1788376149527@example.com`.
- [PASS] Brand onboarding welcome page loaded.
- [PASS] Empty brand onboarding question submit was blocked with
  `Please select an option to continue.`
- [PASS] Brand onboarding questions completed and redirected to brand
  dashboard.
- [PASS] Brand route smoke loaded with no console errors: Dashboard, Campaigns,
  Creators, Marketplace, Inbox, Brand profile, Settings.
- [PASS] Brand settings subroutes loaded with no console errors: Billing,
  Payment methods, Payment history, Preferences, Notifications, Security.
- [PASS] Brand campaign form loaded with expected basics, brief, creator
  criteria, compensation, marketplace visibility, upload, and invite controls.
- [PASS] QA campaign draft saved and remained visible in campaign list:
  `QA Marketplace Campaign 1788376438665`.
- [PASS] QA campaign published successfully and campaign detail showed Active.
- [PASS] Public marketplace campaign appeared in brand marketplace with Product
  Campaigns and `$250.00` compensation.
- [PASS] Invite-only campaign published successfully:
  `QA Invite Only Campaign 1788376953195`.
- [PASS] Invite-only campaign remained hidden from the marketplace list while
  the public campaign stayed visible.
- [PASS] Invite creators drawer opened for invite-only campaign; with zero
  matching creators, Send invites was disabled and no outbound invite was sent.
- [PASS] Brand sign-out landed on `/sign-in` after exact sidebar button click.
- [PASS] Creator marketplace showed the public QA listing and hid the
  invite-only QA campaign.
- [PASS] Creator marketplace detail showed the correct brand, payout, brief,
  deliverables, criteria, timeline, applicant count, `Add to CRM`, and `Apply`.
- [PASS] Empty creator marketplace application submit did not submit and stayed
  in the modal.
- [PASS] Creator submitted QA application with `Add to CRM on apply` enabled.
- [PASS] Creator listing detail changed to `Pending`, removed the Apply button,
  showed `View in pipeline`, and incremented applicants to `1`.
- [PASS] Creator pipeline contained the marketplace application record for
  `QA Marketplace Campaign 1788376438665`.
- [PASS] Brand marketplace detail showed `Applicants (1)`,
  `pikhane@gmail.com`, the submitted pitch, and `Accept` / `Reject`.
- [PASS] Brand accepted the QA application; status changed to `Accepted`, and
  decision buttons disappeared.
- [PASS] Creator listing detail showed `Accepted` after brand approval and did
  not show an Apply button.
- [PASS] Invite-only campaign converted to marketplace via
  `Post to marketplace`; it appeared in the marketplace list.
- [PASS] Converted invite-only campaign was unpublished again and returned to
  `Private invite only`.
- [PASS] Brand creator directory loaded with empty-state copy and no console
  errors.
- [PASS] Responsive layout smoke passed for brand marketplace detail at
  desktop `1440x900` and mobile `390x844`: nonblank, no horizontal overflow,
  no console errors.
- [PASS] Responsive layout smoke passed for brand campaign detail at desktop
  `1440x900` and mobile `390x844`: nonblank, no horizontal overflow, no
  console errors.
- [PASS] Local sidebar scroll regression verified after shell fix: on long
  campaign forms, `.app-content` scrolls while `.app-sidebar` stays pinned at
  viewport top and `window.scrollY` remains `0`.
- [PASS] Production sidebar retest verified after deploy: `.app-sidebar` is
  `position: fixed`, remains at viewport `top: 0` after scrolling, and main
  content starts at `256px`.
- [PASS] Creator Settings payouts retest verified in production: payout setup
  shows coming-soon copy, setup action is disabled, and no console errors were
  logged.
- [PASS] Creator Tasks retest verified in production: task completion checkbox
  has an accessible label and a stable test id; no console errors were logged.
- [PASS] Creator Invoices retest verified in production: opening the New
  invoice form exposes stable `id`, `name`, and `data-testid` handles for the
  brand, amount, and due-date controls.
- [PASS] Invoice modal label wiring fixed locally: Brand, Amount, Due date,
  Job, and Description now use explicit `label htmlFor` associations.
- [PASS] Brand campaign footer spacing was verified after deploy by the owner
  on the live campaign form.
- [PASS] Final production product smoke passed in Chrome: homepage,
  `/creators`, `/creators/apply`, creator dashboard, marketplace, marketplace
  detail, settings, invoices, and New invoice modal all rendered nonblank with
  no horizontal overflow and no console errors.

## Failed Checks

- [FIXED] CRM brand detail tabs `Deals`, `Jobs`, and `Payments` rendered blank
  panels for a brand with no related records.
  - Fix: Added explicit empty states and links to Pipeline/Invoices.
  - Regression: `thesi-web/src/components/creator-crm/BrandDetailContent.test.tsx`.

- [FIXED] Marketplace listing showed `Open` and enabled `Apply` after
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
- [FIXED] Invoice New invoice modal fields now have explicit label/control
  associations in addition to stable IDs/names/test IDs.
- [FIXED] Invoice and campaign date fields were difficult to automate
  reliably. Added stable `id`, `name`, and `data-testid` attributes plus
  focused regression tests for invoice and campaign date updates.
- [FIXED] Campaign and invoice form controls lacked stable field
  handles. Added names/test IDs across campaign create/edit and invoice create
  forms; added an accessible task checkbox label.
- [FIXED] Payment setup surfaces now clearly show `Coming soon` and
  disable card/payout setup actions while payment rails are offline.
- [FIXED] Sidebar scrolled away on long app pages. App shell now uses a fixed
  sidebar and offsets main content so long app pages scroll without moving the
  sidebar.
- [P3] Brand creator directory had no creators for the QA brand, so
  favorite/unfavorite and direct matched-creator invite could not be covered
  without seeded creator discovery data.

## Verification Added

- `npm test -- BrandDetailContent.test.tsx`
- `npm test -- MarketplaceDetailContent.test.tsx listings.test.ts`
- `cd thesi-web && npm test`
- `cd thesi-api && npm test`
- `cd thesi-web && npm run lint`
- `cd thesi-web && npm run build`
- `cd thesi-api && npm run build`
- `cd thesi-web && npm test -- MarketplaceDetailContent.test.tsx`
- `cd thesi-web && npm test -- CampaignDetailContent.test.tsx CampaignsPageContent.test.tsx`
- `cd thesi-api && npm test -- marketplace.service.spec.ts`
- `cd thesi-web && npm test -- BrandSettingsPaymentMethodsContent.test.tsx DraftCampaignEditForm.accessibility.test.tsx InvoicesPageContent.accessibility.test.tsx`
- `cd thesi-web && npm test` - 16 files, 40 tests passed after local fixes.
- `cd thesi-web && npm run build` - passed after local fixes.
- `./scripts/qa-regression.sh` - added as the repeatable release gate and
  passed: web tests 40/40, web lint 0 errors / 18 existing warnings, web build
  passed, API tests 122/122.
- `cd thesi-web && npm test -- InvoicesPageContent.accessibility.test.tsx` -
  passed after explicit invoice label wiring.
- `./scripts/qa-web-docker-preview.sh` - added to build and run a local Docker
  web preview before deploy.
- Final Chrome production product smoke: 9 page/form checks, 0 console errors,
  no horizontal overflow on sampled pages.
- Local browser layout check on `/app/campaigns/new`: sidebar top/bottom stayed
  fixed while `.app-content` scrolled to `900px`.

## Resume Point

- Current production URL: `https://get-thesi.com/app/crm/tasks`.
- Last completed action: fixed-scope production retest and regression playbook
  update.
- Next action: use the regression gate and live browser playbook before the
  next release candidate.
