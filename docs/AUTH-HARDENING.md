# Auth hardening status

The current auth flow is intended for controlled real-user testing, not an
unrestricted public launch.

## Deferred public-launch work

- Move access and refresh tokens from browser storage to secure, HttpOnly,
  SameSite cookies.
- Add rate limiting and abuse controls to sign-up, sign-in, refresh, password,
  creator-application, and admin approval endpoints.
- Add email verification and account recovery before opening self-service
  registration broadly.
- Complete a broader security review covering session revocation, audit logs,
  secret rotation, CORS policy, CSP, and operational alerting.

These items are intentionally outside the minimal controlled-testing hardening
work and must be revisited before public launch.

## Required dev verification before production

Run this flow against `https://dv-app.get-thesi.com`:

1. Register a brand, sign in, and complete onboarding.
2. Submit a creator application.
3. Approve it with the admin API.
4. Sign in with the creator invitation, change the temporary password, and
   complete creator onboarding.
5. Confirm `/v1/health` and `/v1/ready` are healthy and that an expired access
   token refreshes without losing the session.

Do not approve the production release issue until this dev flow passes. Use the
existing issue-approval release workflow for production promotion.
