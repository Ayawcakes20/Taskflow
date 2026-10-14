# Taskflow Phase 3 — email verification and password recovery

Implemented locally on `main`. No Phase 3 commit, push, merge or deployment was performed. No production MongoDB records, credentials or environment files were touched. No real email was sent. Existing password-only login, JWT cookies, session persistence, API rewrites, task modules and Phase 2 UI remain in place.

## Registration

`POST /api/auth/register` validates the existing registration fields and checks duplicate email/username. It now returns **202** with `{ challengeId, emailHint, expiresAt, resendAt }`, without creating a user or setting a session cookie. This intentional response change is required by the approved verification flow; old frontend registration clients need the updated frontend.

Temporary registration data contains a bcrypt cost-12 password hash, never plaintext password or confirmation. `POST /api/auth/register/verify` accepts `{ challengeId, code }`, atomically consumes the issued code, checks duplicates again, creates the normal User document and returns **201** with the existing `{ user }` response and JWT cookie. Existing email/username unique indexes arbitrate simultaneous creation from different pending challenges. No `emailVerified` field or migration is needed; pre-existing accounts retain access.

`POST /api/auth/register/resend` accepts `{ challengeId }`. It rotates the challenge and code after the cooldown. Pending registrations do not reserve usernames indefinitely. A failed delivery or failed account creation may require starting registration again; it never grants access without verification. Login remains available if the account was saved but the verification response was lost.

## Recovery

- `POST /api/auth/forgot-password` accepts `{ email }` and returns a conditional acknowledgement with challenge metadata for eligible, unknown and disabled accounts. Only active eligible accounts receive email.
- `POST /api/auth/forgot-password/resend` accepts `{ challengeId }`.
- `POST /api/auth/forgot-password/verify` accepts `{ challengeId, code }`. Successful atomic code consumption returns a random, single-use reset token with a five-minute lifetime. It grants no normal session.
- `POST /api/auth/reset-password` accepts `{ challengeId, resetToken, newPassword, confirmPassword }`. Existing password validation and cost-12 bcrypt apply. The reset atomically updates the active user and increments `sessionVersion`. An intervening password change makes the older recovery request unusable. Legacy missing session versions are supported.

After recovery, the browser returns to `/login` with a success message. Previous cookies/bearer JWTs are rejected; recovery never logs the user in automatically. Tokens and passwords stay in component memory. Only challenge metadata is stored in sessionStorage so the code screen can survive refresh. Refreshing the new-password step requires starting recovery again.

## Controls and storage

- Cryptographically random six-digit codes, five-minute code expiry, five incorrect guesses per issued code, 60-second resend cooldown, six sends per purpose/address per hour.
- Additional request limits: 10 code requests and 30 verification/reset requests per IP per 15 minutes. Existing credential (80) and session-check (600) limits remain unchanged. Production OTP limits reuse the Mongo-backed `auth_rate_limits` store, using separate prefixes.
- Codes are stored as purpose/challenge-bound HMAC digests using the existing strong backend JWT secret; random reset tokens are stored as SHA-256 digests. No codes, keys or provider response details are logged.
- New native MongoDB collection: **`auth_otp_challenges`**. Its built-in unique `_id` is derived from purpose/email and arbitrates concurrent issuance. New TTL index: **`auth_otp_expiry`**, `{ expiresAt: 1 }`, `expireAfterSeconds: 0`. It is lazily created on OTP requests, with cached pending index creation.
- Records remain for up to one hour to enforce request limits, then TTL removes them asynchronously. Actual code/grant expiry is checked atomically in queries, independently of TTL cleanup. Completed registration payloads are explicitly removed. There are no background timers or new production schema fields.
- Existing User hashing hook accepts a private server-only `$locals.passwordPrehashed` flag for already-hashed pending registrations, preventing double hashing. It is never accepted from an API payload. Normal password saves still use the original bcrypt hook.
- Multiple-document account creation/reset is deliberately fail-closed rather than transactional: if a database operation fails after consumption, request a fresh code. No code or reset grant becomes replayable.

## Email setup and deployment preparation

Use Resend's existing HTTP API through native Node fetch; no SDK or dependency changes are needed. Calls are awaited, have a ten-second timeout and use an idempotency key. Registration delivery errors return failure. Recovery provider errors invalidate the code but retain the same conditional public acknowledgement to avoid revealing account existence; that response is **not** a claim that email was sent. Missing email configuration returns 503 before account lookup for both flows. Login and existing sessions do not depend on email configuration.

Required **backend-only** additions:

| Variable | Value to configure manually |
|---|---|
| `RESEND_API_KEY` | A sending key for your Resend account; do not share or commit it |
| `OTP_EMAIL_FROM` | `Taskflow <verify@your-verified-domain.example>` replaced with your verified sender |

Keep existing `MONGO_URI`, `MONGO_DB_NAME`, `JWT_SECRET`, trusted origins and all JWT cookie settings. Frontend values remain `VITE_API_URL=/api` and the existing `BACKEND_API_ORIGIN`. Backend/.env.example contains placeholders only; backend/.env was not modified.

Manual setup:

1. Create/use a free Resend account and an existing domain or university subdomain you control. No paid plan, purchased domain or integration resource was provisioned by this implementation.
2. Add the sender domain and publish the exact DNS records supplied by Resend; wait for verification. Configure SPF/DKIM, and add the recommended DMARC record. See [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).
3. The default `resend.dev` sender is restricted to sending to your Resend account email. It cannot support general student signup/recovery. Without a verified domain, limit testing to that authorized recipient. See [Resend test-sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
4. Configure the two backend variables manually in the intended Vercel environment. The current [free plan](https://resend.com/pricing) allows 3,000 emails/month and 100/day; account limits and delivery quotas still apply.
5. Verify existing User email/username unique indexes and the database user's permission to create the dedicated collection/TTL index. No production DDL was run here.
6. **Both backend and frontend require coordinated redeployment after approval.** Use paired previews with the same-origin API rewrite and approved preview origins first. Keep signup paused during a production version mismatch; normal existing-account login remains compatible. Do not change routing or cookie architecture.
7. In preview, explicitly use `taskflow_test` and disposable accounts whose inboxes you control. Check receipt/spam, expiration, incorrect attempts, resend, one-use registration, cookie persistence, recovery, old-session rejection and new-password login. Clean up only owned fixture records after confirming the database name. Then approve production rollout and a controlled real-email smoke test.

Real delivery, inbox placement and production OTP verification are outstanding. Do not claim production OTP works from mocked tests. The provider/API timing is not constant-time; public recovery messages and error categories do not disclose account eligibility. The practical limits above do not replace provider quotas or guarantee delivery.

## Validation

- Complete `corepack pnpm check`: **64 backend + 50 frontend = 114 passing checks, zero failures**, production build passed. All original 91 checks remain green. Focused OTP checks also passed before the final suite.
- Seventeen new backend regressions cover hash-only storage, no premature account/session, single-use and concurrent consumption, five attempts, expiry, resend/cooldown/hourly limits, duplicate checks, email failure, non-enumerating recovery acknowledgement, grant replay/expiry, session invalidation, prehashed User creation, existing login/logout and production store prefixes.
- Six new frontend regressions cover no authentication at registration issuance, verification authentication, numeric/paste-friendly input, expiry/cooldown, recovery flow/confirmation/redirect, recovery errors and metadata-only reload. Existing protected-route, JWT persistence/recovery and module regressions remain green.
- Focused browser fixture: registration-code, recovery-email, recovery-code and new-password screens at **375/768/1440px**; all 12 settled measurements had `scrollWidth === viewport width`. No captured runtime errors. These checks use in-memory responses, not real JWT/database/email integration.
- Full-suite informational output included reduced-motion notice and a local Vite HMR port collision; the tests and production build still passed. No production WebSocket or backend change was made for these test notices.
- Production browser output contains no fixture route/account markers, Resend endpoint or backend email-key identifiers. The fixture still refuses production/Vercel execution.
- Opt-in `backend/scripts/integration-check.js` was updated for the new registration contract and isolated mocked email delivery, plus exact fixture cleanup. It passed syntax validation but **was not executed against Atlas during this phase**.
- Diff whitespace check passed. No files are staged.

Evidence (outside Git): `C:/Users/Paulo/.codex/visualizations/2026/10/10/01a1262a-48ad-7fc3-98db-97073ad3454b/taskflow-ui-phase3/`, including `responsive.json` and `verification-mobile.png`.

## Files changed

- Backend: `controllers/authController.js`, new `controllers/otpController.js`, `middleware/authRateLimits.js`, `models/User.js`, `routes/authRoutes.js`, `utils/validation.js`, new `utils/otpStore.js`, `utils/otpService.js`, `utils/otpEmail.js`, `.env.example`.
- Backend checks: new `tests/otp-regression.test.js`, `scripts/integration-check.js`.
- Frontend: `src/App.jsx`, `src/context/AuthContext.jsx`, `src/index.css`, `src/pages/auth/LoginPage.jsx`, `RegisterPage.jsx`, new `VerifyRegistrationPage.jsx`, `ForgotPasswordPage.jsx`, new `src/components/common/EmailVerification.jsx`.
- Frontend checks: `tests/functional.test.js`, `tests/ui-fixture-server.mjs`.
- Documentation: `PHASE3_AUTH.md`.

No manifests/lockfiles, database connection settings, API client, Vercel configuration, task-management source or production secrets were changed.
