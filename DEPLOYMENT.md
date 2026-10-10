# Taskflow deployment configuration

Target: two Vercel Hobby projects from Ayawcakes20/Taskflow, Node.js 24.x,
pnpm 11.25.0, and MongoDB Atlas M0. Browser traffic uses the frontend's `/api`
rewrite. No resources have been created or deployed by this implementation.

## Exact project settings

| Setting | Frontend | Backend |
| --- | --- | --- |
| Repository | Ayawcakes20/Taskflow | Ayawcakes20/Taskflow |
| Root Directory | `frontend` | `backend` |
| Framework | Vite | Express |
| Node.js | 24.x | 24.x |
| Package manager | pnpm 11.25.0 via Corepack | Same |
| Install command | `corepack pnpm install --frozen-lockfile` | Same |
| Build command | `corepack pnpm build` | Leave Express default; do not use `pnpm start` |
| Output Directory | `dist` | Leave default; no `dist` override |
| Include source files outside Root Directory | Enabled | Enabled |
| Fluid Compute | Not applicable to static frontend | Enabled in `backend/vercel.json` |
| Production branch, after approval | `main` | `main` |
| Function region | Not applicable | Select the available region nearest the actual Atlas cluster |

Do not deploy from a parent folder named `taskflow-project`: Root Directories
are relative to the Git repository containing `package.json`, `pnpm-lock.yaml`,
`frontend/`, and `backend/`. Outside-root inclusion is essential because backend
code imports `frontend/src/utils/workspaceDates.js` and both projects use root
workspace metadata. Inspect the backend function bundle before promotion.

The repository pins Node in all three package manifests and `.node-version`.
The Dockerfile matches Node 24 and explicitly opts into combined hosting.
Corepack must honor the root `packageManager`; do not allow a fallback pnpm
version or regenerate the lockfile on Vercel. No new npm dependencies were added.

## Environment variables

Set these in Vercel's protected environment-variable UI. Never paste real values
into tracked templates, build commands, logs, screenshots, or frontend `VITE_*`
variables. No change to the existing `backend/.env` is required.

| Project | Variable | Required value/purpose |
| --- | --- | --- |
| Both | `ENABLE_EXPERIMENTAL_COREPACK` | `1`, to use the pinned package manager |
| Frontend | `VITE_API_URL` | `/api` |
| Frontend | `BACKEND_API_ORIGIN` | Actual backend origin, e.g. `https://YOUR_BACKEND_PROJECT.vercel.app`; no trailing slash, path, credentials, or query |
| Backend | `NODE_ENV` | `production` |
| Backend | `MONGO_URI` | Actual Atlas connection URI, stored only as a backend secret |
| Backend | `MONGO_DB_NAME` | `taskflow` for Production; `taskflow_test` for Preview/integration |
| Backend | `JWT_SECRET` | Strong independently generated secret, at least 32 characters |
| Backend | `CLIENT_ORIGIN` | Exact frontend HTTPS origin(s), comma-separated; no paths, trailing slashes, empty entries, or wildcards |
| Backend | `SESSION_COOKIE_SECURE` | `true`; false is rejected in production |
| Backend | `SESSION_COOKIE_SAME_SITE` | `lax` |
| Backend | `SESSION_COOKIE_NAME` | `taskflow_session` (optional default); use a distinct Preview cookie name |

`VERCEL` is supplied by Vercel. Do not set `SERVE_FRONTEND` on Vercel.
`PORT` and `API_PROXY_TARGET` are local listener/proxy settings, not production
routing configuration. Admin seed credentials are not needed at runtime.

Use Preview-specific database credentials with access only to `taskflow_test`,
and a separate Preview JWT secret. Configure Preview `BACKEND_API_ORIGIN` to
the corresponding isolated backend, never accidentally to Production.
Trusted preview frontend origins must be explicitly listed; no broad wildcard
for all `vercel.app` or Manus domains is permitted.

## Routing and security

`frontend/vercel.mjs` exports programmatic Vercel configuration without an extra
dependency. It validates `BACKEND_API_ORIGIN` and fails configuration loading if
the origin is missing or malformed. Its rewrites, in order, are:

1. `/api` to the backend `/api`.
2. `/api/:path*` to the backend `/api/:path*`.
3. Other SPA routes to `/index.html` (normal static assets remain framework-served).

The build-time backend origin is public routing metadata, not a credential.
Browser requests and authenticated image URLs remain relative to the frontend
origin. Host-only JWT cookies require no Domain attribute. Keep HttpOnly,
Secure and SameSite=Lax. Avoid direct cross-site browser API URLs.

The backend default-exports Express for Vercel; direct `node server.js` still
starts the local listener. Serving frontend/dist is disabled by default and
always disabled on Vercel. Local Vite proxying is unchanged; `pnpm dev` now
works on Windows without a POSIX-only inline PORT assignment.

Production CORS accepts only configured origins. Untrusted Origin headers get
403, and origin-less cookie-authenticated mutations are rejected. Origin-less
bearer clients remain supported. Responses containing API data are no-store;
unexpected production errors expose neither stacks nor internal error details.
Verify Vercel actually preserves Origin, Cookie and Set-Cookie across the
external rewrite. Backend preview protection must allow the proxy to reach it;
a Vercel login/protection page is distinct from application JWT authentication.

## MongoDB connection and rate-limit requirements

Database-dependent requests await a cached in-progress connection. Warm
connections are reused, with maxPoolSize=5, minPoolSize=0, maxIdleTimeMS=60000,
and 3500ms connect/selection/queue timeouts. Failed attempts return controlled
503 responses and can retry on the next request. No detached retry timers or
per-request disconnects exist. `/api/health` is liveness, not a live DB ping.
Logout remains possible during a database outage.

Production requires an explicit MongoDB URI and database name. Automatic
Mongoose index creation is disabled in production; retain the existing indexes
already established for users/tasks/notifications/activity logs.

Only one new collection is required: **`auth_rate_limits`**.

- MongoDB automatically supplies the unique `_id` index.
- The application lazily creates the one additional index:
  `{ expiresAt: 1 }`, name `auth_rate_limits_expiry`, `expireAfterSeconds: 0`.
- Each document stores a bucket-prefixed hashed client key, `hits`, and
  `expiresAt`. Raw client IPs are not stored.
- Atomic update pipelines preserve first-request 15-minute windows across
  instances. TTL deletion is asynchronous; expiration is also checked during
  updates, so an expired record cannot incorrectly keep blocking a client.
- Credentials retain 80 requests/15 minutes; session checks/logout retain
  600 requests/15 minutes. Store failures fail closed for authentication.
- Local development keeps the existing in-memory store. Only offline logout
  bypasses the shared store so users can clear their cookies during an outage.

No existing application schemas are changed. The backend database user needs
read/write and index-creation permission within its own database; Atlas's
database-scoped readWrite role ordinarily provides these operations.

Atlas roles, network rules, region and capacity still need dashboard review.
Do not open `0.0.0.0/0` automatically. Hobby does not supply paid Static IPs;
restricting Atlas exclusively to a local developer IP will not permit Vercel.
If internet-wide network access is considered, explicitly approve that risk,
use a restricted database user and a strong password, keep TLS, and monitor.
Strict fixed-IP requirements may require a different hosting/network plan.

## Image API compatibility and payload bounds

Stored images and existing schemas remain unchanged. JSON `imageUrl`,
`imageThumbnail`, and inline `profileImage` values now contain authenticated
relative image URLs rather than base64 bodies. External profile image URLs
remain unchanged. This response-format change is intentional and documented.

New protected GET endpoints:

- `/api/tasks/:id/image?variant=full` or `variant=thumbnail`: existing task
  participant/Admin visibility applies.
- `/api/users/:id/image`: active directory avatars, own/Admin avatars, and
  historical avatars associated with tasks the requester may view.

Images are private/no-store binary PNG/JPEG/WebP responses, capped at 1 MiB.
No local uploads or disk persistence are introduced. Frontend editors omit
unchanged hosted image URLs from update payloads, preserve base64 upload
validation, and still support replacement/removal. Other API clients should
also omit unchanged hosted image fields rather than submitting these URLs as
new uploads. Do not store the returned URLs in MongoDB instead of image data.

JSON responses exceeding 4 MiB return a small 413 error, below Vercel's 4.5 MB
request/response ceiling. Exceptionally large non-image responses may need
narrower filters/pages; this guard does not silently truncate records or remove
Kanban pages. Existing 2 MB JSON request and image upload limits remain intact.
M0's 0.5 GB storage remains a limit despite smaller network responses.

## Validation and safe rollout

From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm --dir backend test:integration
```

The integration runner reads backend/.env without changing it, overrides the
database name and JWT/cookie settings in its own process, and verifies
`taskflow_test` before writes. It uses unique fixtures and deletes only their
exact usernames/IDs/counter keys. It never drops a database or collection and
does not print credentials or JWT cookies. It requires permission to write
only in taskflow_test. It is explicitly invoked and excluded from automatic
unit-test discovery. If isolated connection or cleanup fails, stop and review.

After code review/approval: verify tests, configure isolated Preview projects,
test cold/concurrent starts, database pool use, deep links, static assets,
rewrites, cookies, 401/429/503 recovery, distributed rate limits, task/image
visibility and 375/768/1440px layouts. Confirm client IP handling through the
real Vercel proxy chain before relying on rate-limit attribution. Inspect
function bundles and logs for missing shared utilities or secret leakage.
Only then request approval for committing/pushing/promoting Production.
Production database checks should remain read-only; mutations belong in Preview.

No WebSocket server, worker daemon, scheduled job or local upload storage was
found. Deadline notifications remain request-generated, with browser polling;
there is no promise of always-running background reminders. Atlas throughput,
storage/connections and Vercel function/transfer usage need monitoring. Free
tiers provide limited capacity, not an uptime guarantee or automated backups.

Official references: [Express](https://vercel.com/docs/frameworks/backend/express),
[programmatic configuration](https://vercel.com/docs/project-configuration/vercel-ts),
[Corepack/builds](https://vercel.com/docs/builds/configure-a-build),
[Hobby](https://vercel.com/docs/plans/hobby),
[Functions limits](https://vercel.com/docs/functions/limitations),
[Atlas M0 limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

## Implementation review record

Validation completed locally on Node 24.11.1 with Corepack/pnpm 11.25.0:

- Frozen workspace installation: passed; lockfile unchanged.
- Backend automated tests: 45 passed, 0 failed.
- Frontend automated tests: 21 passed, 0 failed.
- All 50 previous tests remain included; 16 targeted regression tests were added.
- Frontend production build: passed.
- Isolated Atlas integration: 12 check groups passed, 0 failed in the final run.
  This includes live cookie/JWT APIs, image access, two-instance shared counters,
  counter expiry/concurrency, local Vite proxying, local HTTP login, simulated
  HTTP 503 recovery, and a real failed driver connection followed by Atlas reconnect.
- Only unique fixtures in taskflow_test were written/cleaned; backend/.env was
  fingerprinted before/after each integration run and remained unchanged.
- Changed-file scan found no matches for the actual local URI/JWT credentials;
  nothing is staged and no commit, push, merge or deployment was performed.

Initial runs encountered sandbox loopback restrictions and two test-harness
issues (Mongoose getter restoration and Windows import paths). These were
resolved before the final passing runs. Existing Motion test warnings are
non-failing and outside this deployment change.

Not verified on Vercel: actual configuration evaluation/build image, traced
function bundle, external rewrite/static-file precedence, HTTPS browser cookie
delivery, client-IP attribution, cold starts at scale and database access from
Vercel's egress network. Atlas dashboard permissions/network/capacity were not
changed. BACKEND_API_ORIGIN and the actual frontend trusted origins must be
configured before deployment. No visual responsive browser pass was performed
during this backend/configuration implementation.

Changed/added files (repository-relative):

```text
.node-version
Dockerfile
README.md
DEPLOYMENT.md
package.json
backend/.env.example
backend/package.json
backend/vercel.json
backend/server.js
backend/config/db.js
backend/config/production.js
backend/controllers/authController.js
backend/controllers/taskController.js
backend/controllers/imageController.js
backend/middleware/authRateLimits.js
backend/middleware/databaseReady.js
backend/middleware/errorMiddleware.js
backend/middleware/imageResponses.js
backend/middleware/trustedOrigin.js
backend/routes/taskRoutes.js
backend/routes/userRoutes.js
backend/utils/activity.js
backend/utils/notifications.js
backend/utils/mongoRateLimitStore.js
backend/scripts/integration-check.js
backend/tests/database-connection.test.js
backend/tests/image-responses.test.js
backend/tests/production-security.test.js
frontend/.env.example
frontend/package.json
frontend/deploymentConfig.js
frontend/vercel.mjs
frontend/src/utils/imagePayload.js
frontend/src/pages/tasks/TaskEditorPage.jsx
frontend/src/pages/profile/ProfilePage.jsx
frontend/tests/deployment-config.test.js
frontend/tests/image-payload.test.js
```
