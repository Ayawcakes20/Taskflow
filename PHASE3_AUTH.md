# Taskflow Phase 3 — email verification and password recovery

> **Defense-day temporary rollback:** registration now creates the user and issues the normal JWT cookie immediately, without email. All registration-code and password-recovery endpoints are disabled with HTTP 503. Forgot Password displays a temporary-unavailability message. Existing login, logout, settings password changes and protected modules remain unchanged. Both frontend and backend need the approved rollback deployment; no SMTP variable changes are required. The Phase 3 implementation details below are retained for later re-enablement, not the active registration flow.

Defense-day validation: full check passed **74 backend + 50 frontend tests (124 total)** and the production build. A subsequently added focused signup-page-to-dashboard regression also passed, giving **125 passing checks, zero failures** across the validated cases. No application changes were made after the full check. The opt-in Atlas integration script was updated and syntax-checked, not run. Existing SMTP diagnostic work was preserved; it is not needed by direct registration. No environment, schema, cookie-policy, database-connection, deployment-configuration or task-module files changed.

Exact rollback files:
- `backend/controllers/authController.js` — restores validated direct creation through the normal bcrypt hook and existing JWT cookie.
- `backend/routes/authRoutes.js` — removes mandatory OTP routing and fails closed on all six code/recovery endpoints, including old grants. Existing credential limits in server.js remain.
- `frontend/src/context/AuthContext.jsx` — restores authenticated user state after registration and cancels stale verification.
- `frontend/src/pages/auth/RegisterPage.jsx` — redirects directly to the dashboard.
- `frontend/src/pages/auth/ForgotPasswordPage.jsx` — uses the existing branded auth layout for the unavailability message, with no recovery form or requests.
- `frontend/src/App.jsx` — redirects stale registration-verification URLs to registration.
- `backend/tests/registration-rollback.test.js` (new) — real model hashing with mocked persistence, cookie/JWT verification, login/logout, duplicates, validation and disabled reset grants.
- `backend/tests/otp-regression.test.js` — updates the active registration expectation while retaining dormant OTP/security/SMTP regression coverage.
- `frontend/tests/functional.test.js` — direct registration, persistence, actual dashboard redirect and disabled-recovery checks.
- `backend/scripts/integration-check.js` — aligns the isolated script with direct registration; production isolation is retained.
- `frontend/tests/ui-fixture-server.mjs` — aligns the local-only mock responses with the rollback.
- `PHASE3_AUTH.md` — records the temporary state and validation.

**Deployment after approval:** deploy the matching backend and frontend rollback versions together. An OTP-era frontend expects a challenge, while this backend again returns `{ user }` and HTTP 201, so a version mismatch can disrupt signup. SMTP configuration is irrelevant to direct registration; do not change or delete secrets. Existing accounts/sessions remain compatible. Production registration is not verified until these versions are deployed. No commit, push, merge or deployment was performed for the rollback.

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

Email delivery now uses Nodemailer with Gmail SMTP, replacing the Resend adapter only. Each email uses an awaited, non-pooled TLS connection to `smtp.gmail.com:465`, with five-second connection/greeting timeouts and a ten-second socket inactivity timeout. These are per-stage limits, not a single overall deadline. There are no background retry queues. SMTP acceptance is checked before success; it is not a guarantee of inbox placement. SMTP has no Resend-style idempotency key; the adapter does not retry automatically, while existing OTP controls prevent code replay.

Registration delivery errors return failure. Recovery delivery errors invalidate the code but retain the same conditional public acknowledgement to avoid revealing account existence; that response is **not** a claim that email was sent. Missing or malformed SMTP configuration returns 503 before account lookup for both flows. Login and existing sessions do not depend on email configuration. Failure logs contain only a fixed message, an allowlisted category (authentication, timeout, connection, DNS, recipient, message or SMTP) and an optional numeric SMTP status. Raw errors/server replies, credentials, addresses and OTPs are not logged; Nodemailer debug logging is disabled.

Required **backend-only** additions:

| Variable | Value to configure manually |
|---|---|
| `SMTP_USER` | The complete Gmail sender address, such as your project Gmail account |
| `SMTP_APP_PASSWORD` | A Google-generated 16-character App Password; never your normal Google password |

Google's grouped copy/paste spaces in App Passwords are removed by the adapter. The sender name is Taskflow and its address is always `SMTP_USER`; no separate sender-domain variable is needed. `RESEND_API_KEY` and `OTP_EMAIL_FROM` are no longer read. Existing secret values were not modified or removed by this change.

Keep existing `MONGO_URI`, `MONGO_DB_NAME`, `JWT_SECRET`, trusted origins and all JWT cookie settings. Frontend values remain `VITE_API_URL=/api` and the existing `BACKEND_API_ORIGIN`. Backend/.env.example contains placeholders only; backend/.env was not modified.

Manual setup:

1. Use a project Gmail account that you control. Enable Google 2-Step Verification, then create an App Password labelled Taskflow. App Passwords may be unavailable for organization-managed accounts, Advanced Protection or certain security-key configurations. See [Google App Password help](https://support.google.com/accounts/answer/185833).
2. Enter `SMTP_USER` and `SMTP_APP_PASSWORD` directly into the backend project's intended Vercel environment and, if needed, your ignored local backend/.env. Do not share, print, paste into frontend variables or commit the password. This implementation did not edit those secret settings.
3. Gmail can send to multiple users without a purchased custom domain. Its sending limits, spam controls and Google security checks still apply; Gmail may block SMTP from an unfamiliar server/cloud location. Check the sender's account security alerts and availability of App Passwords instead of disabling TLS or 2-Step Verification. See [Nodemailer Gmail guidance](https://nodemailer.com/guides/using-gmail).
4. After approval, redeploy the backend with the updated manifest/lockfile and variables. **This delivery-only change requires no frontend redeployment.** Preserve the existing frontend `/api` rewrite, backend origin, JWT cookies and database settings. Stale Resend variables can be removed manually once migration is verified; they are ignored by the adapter.
5. Verify existing User email/username unique indexes and the database user's permission to create the dedicated collection/TTL index. No production DDL was run here.
6. The original Phase 3 endpoint/UI additions require both deployments if not already live. This subsequent SMTP migration changes neither the endpoint contract nor the frontend, so only the backend needs updating. Use a preview with an approved origin first; do not change routing or cookie architecture.
7. In preview, explicitly use `taskflow_test` and disposable accounts whose inboxes you control. Check receipt/spam, expiration, incorrect attempts, resend, one-use registration, cookie persistence, recovery, old-session rejection and new-password login. Clean up only owned fixture records after confirming the database name. Then approve production rollout and a controlled real-email smoke test.

Real Gmail delivery, inbox placement and Vercel SMTP connectivity were not tested during this migration. Do not claim production Gmail OTP works from mocked tests. Sending latency is not constant-time; public recovery messages and error categories do not disclose account eligibility. The practical limits above do not replace Gmail quotas or guarantee delivery. After approval, test actual registration and recovery with disposable accounts/inboxes you control, retaining the existing isolated-database rules.

## Validation

- Complete `corepack pnpm check`: **64 backend + 50 frontend = 114 passing checks, zero failures**, production build passed. All original 91 checks remain green. Focused OTP checks also passed before the final suite.
- Seventeen new backend regressions cover hash-only storage, no premature account/session, single-use and concurrent consumption, five attempts, expiry, resend/cooldown/hourly limits, duplicate checks, email failure, non-enumerating recovery acknowledgement, grant replay/expiry, session invalidation, prehashed User creation, existing login/logout and production store prefixes.
- Six new frontend regressions cover no authentication at registration issuance, verification authentication, numeric/paste-friendly input, expiry/cooldown, recovery flow/confirmation/redirect, recovery errors and metadata-only reload. Existing protected-route, JWT persistence/recovery and module regressions remain green.
- Focused browser fixture: registration-code, recovery-email, recovery-code and new-password screens at **375/768/1440px**; all 12 settled measurements had `scrollWidth === viewport width`. No captured runtime errors. These checks use in-memory responses, not real JWT/database/email integration.
- Full-suite informational output included reduced-motion notice and a local Vite HMR port collision; the tests and production build still passed. No production WebSocket or backend change was made for these test notices.
- Production browser output contains no fixture route/account markers or backend email-key identifiers. The fixture still refuses production/Vercel execution.
- Opt-in `backend/scripts/integration-check.js` was updated for the new registration contract and isolated mocked email delivery, plus exact fixture cleanup. It passed syntax validation but **was not executed against Atlas during this phase**.
- Diff whitespace check passed. No files are staged.

Evidence (outside Git): `C:/Users/Paulo/.codex/visualizations/2026/10/10/01a1262a-48ad-7fc3-98db-97073ad3454b/taskflow-ui-phase3/`, including `responsive.json` and `verification-mobile.png`.

## Files changed

- Backend: `controllers/authController.js`, new `controllers/otpController.js`, `middleware/authRateLimits.js`, `models/User.js`, `routes/authRoutes.js`, `utils/validation.js`, new `utils/otpStore.js`, `utils/otpService.js`, `utils/otpEmail.js`, `.env.example`.
- Backend checks: new `tests/otp-regression.test.js`, `scripts/integration-check.js`.
- Frontend: `src/App.jsx`, `src/context/AuthContext.jsx`, `src/index.css`, `src/pages/auth/LoginPage.jsx`, `RegisterPage.jsx`, new `VerifyRegistrationPage.jsx`, `ForgotPasswordPage.jsx`, new `src/components/common/EmailVerification.jsx`.
- Frontend checks: `tests/functional.test.js`, `tests/ui-fixture-server.mjs`.
- Documentation: `PHASE3_AUTH.md`.

The original Phase 3 implementation did not modify manifests/lockfiles. The SMTP migration adds only pinned Nodemailer to backend/package.json and pnpm-lock.yaml. Database connection settings, API client, Vercel configuration, task-management source and production secrets remain unchanged.

## Gmail SMTP migration

Changed only six files: `backend/utils/otpEmail.js`, `backend/package.json`, `pnpm-lock.yaml`, `backend/tests/otp-regression.test.js`, `backend/.env.example`, and this guide. The `emailDelivery` interface, email templates, OTP service/store/controllers, expiration, resend cooldowns, attempts, hashing and one-use consumption remain unchanged. No frontend, schema, session or public API changes.

The Resend-specific delivery test was replaced with four mocked SMTP tests covering missing/malformed configuration, successful registration/recovery messages, secure transport options, safe diagnostics for authentication/timeouts/network/DNS failures and recipient rejection. Tests never open real SMTP connections or send real email.

Migration validation: **67 backend tests passed, zero failures**; adapter/server syntax checks and production frontend build passed. Frozen offline pnpm installation confirmed the manifest/lockfile match. The generated frontend bundle has no SMTP variable names, Nodemailer or SMTP host markers. Only the six intended files are modified, and nothing is staged. Real Gmail/Vercel delivery was not attempted; no secrets, accounts or records were changed and no commit, push or deployment occurred.

## Registration 503 investigation

Confirmed deployment mismatch from the Vercel API: the main backend domain `taskflow-backend-liart-zeta.vercel.app` resolves to production deployment `dpl_6nGs81XSyzaEETJYJ4bQge1YA2s7`, built from `84ff415f9c090d3ceff74d8d568af7d45f079e41` (`Implement email OTP verification and password recovery`). That commit still contains the Resend adapter. Both local main and GitHub main contain `f9700f09b0fe547791ed5deb0cc6454cdec1e0d2` (`Switch OTP email delivery to Gmail SMTP`). The deployment source is `redeploy`: redeploying an old snapshot does not add code from a later Git commit. SMTP variables have no effect on the Resend implementation in the served snapshot.

This mismatch is confirmed; the exact exception responsible for the observed 503 is not. Vercel runtime logs returned HTTP 403 and no authenticated CLI fallback was available. No real registration request or email was generated to diagnose production. A 3.3-second request does not identify credentials, a network restriction or an SMTP timeout.

### Current registration path and 503 sources

1. `server.js` applies the origin policy and database readiness before the authentication route. An unavailable connection produces a direct 503 with the MongoDB-specific response and Retry-After; it is not the observed generic response. The configured MongoDB connection/selection deadline is 3.5 seconds, which by itself is not proof of a database fault.
2. Existing credential and OTP-request limits use MongoDB counters in production. Counter/index/store failure throws ApiError(503); exceeding a limit produces 429 instead.
3. Registration validation produces 400; existing duplicate accounts produce 409. `otpService.issue` checks email configuration before user lookup or password hashing. Missing or malformed email configuration throws 503. For the served old artifact, these are Resend settings; for the Gmail artifact, they are SMTP settings.
4. The new pending registration holds a bcrypt hash; `codeDigest` throws 503 if the existing JWT secret is unavailable or too short. Pending collection/index/query failures normally propagate as 500, not explicit 503. Cooldown/request-count rejection produces 429.
5. Delivery failures become 503 for registration: SMTP authentication, DNS, TLS/socket/connection, timeout, recipient rejection, or unexpected transport setup errors. Failed delivery invalidates the challenge. Recovery retains its existing conditional acknowledgement to prevent enumeration.
6. Production `errorMiddleware` intentionally converts every 5xx error to the generic public message and logs only status. SMTP send failures already had a private category log, but **configuration validation ran before the SMTP catch and had no diagnostic**. That confirmed observability defect is now fixed. No public error payload or frontend change is needed.

### Targeted local changes

- `backend/utils/otpEmail.js`: invalid configuration now logs only presence/format booleans. SMTP errors additionally log allowlisted stage/timeout type, operation phase and elapsed milliseconds. Raw errors, server replies, addresses, credentials, passwords and codes are never logged. Certificate validation, OTP security and all timeouts remain unchanged.
- `backend/tests/otp-regression.test.js`: configuration checks now assert the diagnostic flags; three added checks reproduce pre-issuance configuration failure with the generic production response, distinguish timeout types, and prevent provider-controlled fields from entering logs. Existing recipient tests account for the extra safe fields.
- This report documents the trace and production steps. No other application files, environment values, schemas or routes changed.

Nodemailer 10.1.0's connectionTimeout is the whole setup deadline (including DNS/TCP/TLS/greeting), not separate five-second budgets; this was verified in the installed transport implementation. It is conservative relative to the library defaults. Keep it unchanged until actual Gmail logs demonstrate a setup timeout near the limit. Do not extend it based on this old Resend deployment or disable TLS checks. See [Nodemailer SMTP settings](https://nodemailer.com/smtp).

### Safe production procedure, after approval

1. In the backend Vercel project's Deployments list, choose the deployment for **GitHub main commit f9700f0 or a later approved commit that includes the Gmail adapter**. Verify the source SHA, backend root directory and Nodemailer dependency. Do not click Redeploy on 84ff415 again. Confirm the deployment assigned to the main backend domain actually uses the intended SHA. No deployment was performed during this investigation.
2. In that backend project's Production environment, verify the two SMTP variable names and format locally in Vercel. Check an email address plus a Google-generated App Password, rather than a normal Google password. Do not copy values into logs, screenshots or this report. The adapter removes copied grouping whitespace. No environment change is yet proven necessary.
3. After the approved diagnostics are deployed, use an isolated preview/test database (`taskflow_test`) and a disposable account/inbox you control. Find the single request in Vercel Runtime Logs and inspect all function console entries for that request, rather than only the final generic status line. Do not enable Nodemailer debug/logger output.
4. `configuration`: use the presence/format booleans to locate the missing/malformed variable or wrong environment scope. This means SMTP was never attempted; it is not evidence Gmail rejected credentials.
5. `authentication` plus SMTP 535: inspect Google App Password availability, 2-Step Verification and sender security alerts. This is authentication rejection; a saved variable alone does not prove it is valid. A sender/recipient/message category with a numeric 4xx/5xx status indicates SMTP/provider refusal, not automatically a credential fault.
6. `dns`, `connection`, TLS stage, or `timeout` with CONNECT/GREETING/UPGRADE/SOCKET type: inspect runtime/network/Google security behavior. Vercel permits SMTP except port 25; this adapter uses TLS port 465. Do not infer that Vercel blocks Gmail from an unclassified 503. See [Vercel SMTP support](https://vercel.com/kb/guide/serverless-functions-and-smtp).
7. `smtp` with `transport_setup`: investigate the installed runtime/dependency rather than changing credentials. If the final generic 503 has no SMTP/configuration diagnostic, check the deployed artifact, shared rate-limit store and JWT configuration first. Correlate request/deployment IDs; avoid dumping environment variables or documents.
8. Share only the category, phase, allowlisted stage/timeout type, numeric SMTP status and elapsed milliseconds if further diagnosis is needed. Do not share recipient/sender addresses, full provider replies, OTPs or secrets. Production Gmail delivery is not verified by the local mocked checks.

Investigation validation: **70 backend tests passed, zero failures on the final run**, including three new diagnostic regressions; production frontend build and adapter syntax check passed. The initial run had one unrelated existing localhost test fail with Node fetch `bad port` after random ephemeral-port allocation; it passed on rerun without a code change. Only the adapter, its test file and this documentation are modified. Nothing is staged, committed, pushed or deployed, and no real email or database writes were performed.
