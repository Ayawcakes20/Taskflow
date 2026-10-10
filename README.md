# Taskflow — Task Management System

Taskflow is a responsive browser-only task-management workspace for organizing day-to-day work, tracking deadlines, and seeing what is moving. The interface is a React/Vite application; the API is Node.js/Express with MongoDB/Mongoose persistence.

## Features

- Registration and sign-in by email or username, bcrypt password hashing, JWT-backed HTTP-only sessions, protected pages, and User/Admin roles.
- Task create, view, edit, delete, one-or-many-user assignment, reversible status changes, activity history, animated completion control, search, combined filters, sorting, and server-side pagination. The assignment picker includes Select All Members.
- Optional task checklists with add/edit/check/reorder/delete, current completion progress, and status synchronization; task comments with author/timestamps and owner-checked editing/deletion; and current-page bulk complete/priority/assignment/delete actions.
- Optional task reference images with local preview, replace/remove controls, browser-side compression, bounded MongoDB storage, and task-row thumbnails.
- Dashboard statistics, status and priority breakdowns, completion trend, upcoming deadlines, recent tasks, and activity.
- Due-date calendar, reports, read/unread notifications, user profile and preferences, saved Light/Dark/System themes, and password change.
- Admin user management, account disable/delete controls, organization analytics, and system activity logs.
- Responsive browser layouts, keyboard-accessible controls, accessible dialogs, loading/empty/error states, toasts, and reduced-motion support.

The application contains no React Native/Expo/mobile-app code, no TypeScript/TSX frontend, and no emoji icons.

## Technology stack

- **Frontend:** React, Vite, JavaScript/JSX, React Router, Axios, Tailwind CSS, Motion React, Lucide React.
- **Backend:** Node.js, Express, Mongoose/MongoDB, JWT, bcrypt, dotenv, cors, Helmet, Zod.
- **Workspace:** pnpm 11.25.0; Node.js 24.x.

## Architecture and folder structure

```text
frontend/
  public/manus-routes.json
  src/
    assets/
    components/{common,layout,dashboard,tasks,notifications,users}/
    pages/{auth,dashboard,tasks,calendar,reports,users,profile,settings}/
    services/       # API client and feature API modules
    context/        # auth, theme, and toast state
    hooks/
    utils/
    App.jsx
    main.jsx
    index.css
  vite.config.js
backend/
  config/db.js
  controllers/
  middleware/
  models/{User,Task,Notification,ActivityLog}.js
  routes/
  utils/
  tests/
  server.js
  .env.example
```

Vite serves the browser app on port 3000 in development and proxies `/api` requests to Express on port 5000. Browser code uses a relative API URL. Vercel uses separate frontend/backend projects and a same-origin frontend `/api` rewrite. Express exports its app for Functions and retains a listener for direct local execution. Combined non-Vercel hosting is opt-in with `SERVE_FRONTEND=true`. See [DEPLOYMENT.md](DEPLOYMENT.md) for exact configuration and API compatibility notes.

MongoDB is the system of record. User and task references use Mongoose ObjectIds. New tasks store canonical `assignedUsers` references while retaining `assignedUser` for legacy documents/clients; reads and visibility checks handle both. Completion timestamps are cleared when a task is reopened. Dashboard completion trends are derived from tasks currently marked Completed, not an immutable event list. API query results are visibility-scoped; standard users see tasks they created or were assigned, while Admin can review the entire workspace. Authentication secrets and MongoDB credentials are never included in the frontend bundle.

## Requirements

- Node.js 24.x.
- pnpm 11.25.0 (`corepack enable` then `corepack prepare pnpm@11.25.0 --activate`, if needed).
- A reachable MongoDB Community Server or MongoDB Atlas database.

## Installation

From the project root:

```sh
pnpm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` with a real JWT secret and MongoDB URI. The local MongoDB default is:

```text
MONGO_URI=mongodb://127.0.0.1:27017/task_management
```

Generate a local secret with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the output into `JWT_SECRET` in `backend/.env`; do not commit that file or share its value. For an ordinary local HTTP setup, set:

```text
SESSION_COOKIE_SAME_SITE=lax
SESSION_COOKIE_SECURE=false
CLIENT_ORIGIN=http://localhost:3000
```

The backend example uses `SameSite=Lax` and non-Secure cookies for local HTTP. The same-origin Vercel setup requires `SameSite=Lax; Secure` on HTTPS. Production startup rejects disabled Secure cookies and missing required configuration.

## MongoDB setup

### Local MongoDB Community Server

Install and start MongoDB Community Server for your operating system, then confirm it is listening on `127.0.0.1:27017`. For a manual data directory on installations that provide `mongod`:

```sh
mkdir -p "$HOME/.local/share/taskflow-mongodb"
mongod --dbpath "$HOME/.local/share/taskflow-mongodb" --bind_ip 127.0.0.1 --port 27017
```

MongoDB creates the `task_management` database and the Users, Tasks, Notifications, and ActivityLogs collections when the application writes its first records.

### MongoDB Atlas

Create a database user, permit connections from the host where Taskflow runs, and place the Atlas connection string in `MONGO_URI` in the backend environment. Use a protected environment/secret manager for shared or public deployments. Do not include a real URI in Git, browser variables, screenshots, or support requests.

A managed SQL database is not substituted for MongoDB. A public/hosted instance needs an externally reachable MongoDB URI; `127.0.0.1` refers to the application container itself.

## Environment variables

| Variable | Purpose | Example/default |
| --- | --- | --- |
| `PORT` | Express listener port | `5000` locally; hosting may set this |
| `MONGO_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/task_management` |
| `MONGO_DB_NAME` | Database name | `task_management` |
| `JWT_SECRET` | JWT signing secret, at least 32 characters | Generate a unique random value |
| `CLIENT_ORIGIN` | Allowed browser origins (comma-separated) | `http://localhost:3000` |
| `SESSION_COOKIE_NAME` | Session cookie name | `taskflow_session` |
| `SESSION_COOKIE_SAME_SITE` | Cookie SameSite behavior | `lax` with the same-origin proxy |
| `SESSION_COOKIE_SECURE` | Secure-cookie flag | `false` locally; `true` for production HTTPS |
| `VITE_API_URL` | Browser API base path | `/api` |
| `BACKEND_API_ORIGIN` | Frontend Vercel configuration only | Exact backend HTTPS origin, without `/api` or a trailing slash |
| `SERVE_FRONTEND` | Optional combined non-Vercel hosting | `true` to serve `frontend/dist`; off by default |

For a local frontend served separately without the Vite proxy, set `VITE_API_URL=http://localhost:5000/api`. Keep `VITE_API_URL=/api` when using the Vite proxy or managed Preview; a `localhost` URL in a hosted browser points to the viewer's own device. The root, frontend, and backend `.env.example` files contain safe templates only. Files named `.env` are ignored by Git.

## Running the application

Start MongoDB first. Then run from the project root:

```sh
pnpm dev
```

Vite is available at `http://localhost:3000`; the Express API is available at `http://localhost:5000/api`. The liveness endpoint is `http://localhost:5000/api/health`, also available through Vite. Its database field reports connection state, not a live ping. Database-dependent requests await connection readiness and return a recoverable 503 on failure.

For separate terminals, use:

```sh
pnpm --dir frontend dev
```

```sh
pnpm --dir backend dev
```

Build and run the production server locally:

```sh
pnpm build
NODE_ENV=production SERVE_FRONTEND=true PORT=5000 pnpm start
```

This optional combined production mode requires HTTPS through a reverse proxy, exact trusted HTTPS origins, and all required production variables. For local HTTP testing use development mode. The Vercel backend serves API routes only; see [DEPLOYMENT.md](DEPLOYMENT.md).

## First Admin account

Registration creates a standard User account. To create or promote an Admin deliberately, start MongoDB and set the following variables in a protected local shell or secret manager, then run the one-time seed command. No default Admin credential is shipped.

```sh
read -r -p 'Admin email: ' ADMIN_EMAIL
read -r -p 'Admin username [admin]: ' ADMIN_USERNAME
read -r -p 'Admin first name [Workspace]: ' ADMIN_FIRST_NAME
read -r -p 'Admin last name [Administrator]: ' ADMIN_LAST_NAME
read -r -s -p 'Admin password (8+ characters): ' ADMIN_PASSWORD
printf '\n'
export ADMIN_EMAIL ADMIN_USERNAME ADMIN_FIRST_NAME ADMIN_LAST_NAME ADMIN_PASSWORD
pnpm seed:admin
unset ADMIN_EMAIL ADMIN_USERNAME ADMIN_FIRST_NAME ADMIN_LAST_NAME ADMIN_PASSWORD
```

The seed script hashes the password with bcrypt and promotes the matching account if it already exists. Use a unique password and never put real credentials into source control.

## API documentation

All endpoints use JSON unless noted. Authenticated browser requests use the HTTP-only session cookie; send a Bearer JWT only for non-browser clients. Protected endpoints return a user-safe `401`/`403`; API errors do not expose stack traces.

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Register first/last name, username, email, password, and confirmation |
| `POST` | `/api/auth/login` | Public | Sign in with `identifier` (email or username) and password |
| `POST` | `/api/auth/logout` | Public | Clear the session cookie |
| `GET` | `/api/auth/me` | User | Return the current authenticated user |
| `PUT` | `/api/auth/password` | User | Verify current password and change it |
| `GET` | `/api/users/assignees` | User | List active users available for assignment |
| `GET` | `/api/users` | Admin | Search/filter/paginate users with `q`, `role`, `isActive`, `page`, and `limit` |
| `GET` | `/api/users/:id` | Self/Admin | View a user profile and task/activity summary |
| `PUT` | `/api/users/:id` | Self/Admin | Update profile; Admin may also change role/status |
| `DELETE` | `/api/users/:id` | Admin | Delete a user (not the currently signed-in Admin) |
| `PUT` | `/api/users/me/preferences` | User | Save theme and notification preferences |
| `GET` | `/api/tasks` | User | Search/filter/sort/page visible tasks |
| `GET` | `/api/tasks/:id` | User | View a task and its activity history |
| `POST` | `/api/tasks` | User | Create a task |
| `PUT` | `/api/tasks/:id` | User | Update task fields or status |
| `POST` | `/api/tasks/bulk` | User | Apply `complete`, `priority`, `assign`, or `delete` to 1–100 visible task IDs; returns updated tasks or deleted IDs |
| `POST` | `/api/tasks/:id/comments` | Task creator/assignee/Admin | Add a comment; notifies other task participants using the existing updates preference |
| `PUT` | `/api/tasks/:id/comments/:commentId` | Comment owner/Admin | Edit a comment; other users cannot edit another user's comment |
| `DELETE` | `/api/tasks/:id/comments/:commentId` | Comment owner/Admin | Delete a comment |
| `DELETE` | `/api/tasks/:id` | Owner/assignee/Admin | Delete a visible task |
| `GET` | `/api/notifications` | User | List notifications and unread count |
| `PUT` | `/api/notifications/:id/read` | Owner | Mark one notification read |
| `PUT` | `/api/notifications/read-all` | User | Mark all own notifications read |
| `GET` | `/api/activity` | User/Admin | Own/target activity; Admin sees system-wide activity |
| `GET` | `/api/dashboard` | User | Statistics, breakdowns, trend, upcoming deadlines, recent work/activity |
| `GET` | `/api/reports` | User | Completion rate, status/priority/category, overdue/completed counts, 30-day trend |
| `GET` | `/api/health` | Public | API and MongoDB readiness status |

Task list query fields include `q` (title, description, category, assignee name/username/email), `status`, `priority`, `category`, `assignedUser`, `dueDate` (`today`, `week`, `overdue`, or `none`), `dueFrom`, `dueTo`, `sortBy` (`dueDate`, `createdAt`, `updatedAt`, `priority`, `status`, `title`), `order` (`asc` or `desc`), `page`, and `limit` (maximum 100). Filters combine. Defaults are page 1 and 10 tasks per page.

Task enums: status `Pending`, `In Progress`, `Completed`; priority `Low`, `Medium`, `High`. Task data includes title, description, priority, status, category, `assignedUsers` (with the legacy `assignedUser` compatibility field), creator, due date, `completedAt`, created date, and updated date. Optional `subtasks` contain a title and completion flag; the server advances Pending to In Progress when a partial checklist first has completed work, marks a task Completed when every subtask is complete, and reopens a Completed task to In Progress when a subtask is unchecked. An empty checklist leaves the manually selected task status alone. Optional `comments` are timestamped task subdocuments with a user reference and bounded text; list responses omit comment bodies, while task details populate author name/avatar.

`POST /api/tasks` and `PUT /api/tasks/:id` accept an optional `assignedUsers` array of up to 250 active user IDs (an empty array clears all assignees); the legacy scalar `assignedUser` remains supported. Bulk assignment accepts the same 250-member maximum, matching `/api/users/assignees`. They also accept optional `imageUrl` and `imageThumbnail` JPEG data URIs. The browser accepts JPEG/PNG/WebP source images up to 12 MB, downscales/compresses the full image to at most 1 MB and a thumbnail to at most 120 KB, and the backend checks the base64, MIME signature, and decoded-size bounds again. Both images are stored in MongoDB; task-list/dashboard responses return the thumbnail, while task details return the full image. This uses no separate image-hosting service.

Create/update also accept a `subtasks` array of at most 100 `{ _id?, title, completed }` entries; title length is 1–200 characters. Comment content is trimmed and limited to 5,000 characters; one task can contain up to 500 comments. Bulk request bodies are discriminated by `action`, include 1–100 unique visible `taskIds`, and use `priority` or `assignedUsers` for the corresponding action. Bulk UI state is not optimistically committed: the client waits for the API result and reloads visible tasks after errors to reconcile any concurrent database change. Current-page Select All does not select items on other server-paginated pages.

## User roles

- **User:** register/sign in; view tasks they created or are assigned; create/edit/delete tasks in their visibility scope; assign active workspace users; comment on visible tasks and edit/delete their own comments; see personal dashboard, calendar, reports, notifications, profile, and preferences.
- **Admin:** User capabilities plus workspace-wide task review, user search/filter/details, user disable/delete, broader analytics, and system-wide activity logs.

Disabling an account prevents future API authentication. Destructive user/task actions require an in-app confirmation.

## Security

- Passwords are bcrypt hashes with cost factor 12; new registration/password-change values are limited to 72 UTF-8 bytes. Passwords and session versions are excluded from API JSON.
- JWTs are signed server-side, expire after seven days, and use an HTTP-only cookie for browser sessions. A private `sessionVersion` counter is included in new JWTs and incremented on password changes; other sessions are invalidated while the changing browser receives a fresh cookie. Existing users/tokens without the counter are treated as version 0, so no migration is required.
- Use `SameSite=None; Secure` for HTTPS Preview/deployment. Local plain HTTP uses the explicit local cookie settings shown above; cookie policy is not inferred from `NODE_ENV` or the internal request scheme.
- API validation uses Zod; task/user visibility and Admin authorization are checked on the server. Authentication routes are rate-limited, JSON request bodies are size-limited, and CORS is restricted to configured local origins and the managed Preview origin domain.
- Store `MONGO_URI` and `JWT_SECRET` only in protected environment configuration. Never commit `.env` files or put server secrets in `VITE_*` variables.

## Testing and checks

Run the available automated checks:

```sh
pnpm check
```

This runs 31 backend unit/regression tests, 6 frontend DOM interaction regressions, and a production Vite build. Frontend tests use a mocked API and do not require MongoDB. For database-backed smoke checks, start MongoDB and both services with `pnpm dev`, then use the browser to register/login, create/edit/delete tasks, assign one, multiple, or all members, replace/remove an image, add/edit/delete/reorder/check subtasks, post/edit/delete comments, and complete/reopen tasks. Confirm date addition/removal changes Upcoming Deadlines and Calendar without a page refresh; checklist changes update status, progress, dashboard counts, trends, and activity; and bulk complete/priority/assignment/deletion update visible state only after server confirmation. Then search/filter/sort/page results, inspect Reports/Notifications, update profile/theme/password, and—using a deliberately seeded Admin—exercise user management, activity, comment moderation, and bulk access rules. Also verify mobile-browser widths, API-failure recovery, and `prefers-reduced-motion`.

The frontend route manifest is served at `/manus-routes.json`; confirm it returns JSON for all application pages rather than SPA fallback HTML.

## Troubleshooting

- **“MongoDB is not available”:** start MongoDB and verify `MONGO_URI`; `127.0.0.1` is the app host itself and cannot refer to an external database.
- **Authentication not configured:** set a unique `JWT_SECRET` of at least 32 characters in the backend environment.
- **Login does not persist in a local HTTP browser:** set local `SESSION_COOKIE_SAME_SITE=lax` and `SESSION_COOKIE_SECURE=false`; for HTTPS Preview, restore `none` and `true`.
- **Duplicate email/username:** choose another value or use the existing account; the API reports a friendly conflict.
- **No Admin page:** normal registration creates a User. Run the deliberate Admin seed command above.
- **Port already in use:** stop the other local process on port 3000/5000, or set the backend `PORT` explicitly. Managed Preview expects the configured frontend port.
- **Preview has no persistent database:** configure a reachable MongoDB instance and protected URI before expecting database-backed sign-up, login, and CRUD.

## Task date and report behavior

Deadline labels keep their existing UTC-midnight storage representation, while today, overdue, upcoming deadlines, calendar Today, and completion-day grouping use Asia/Manila consistently. Impossible calendar dates are rejected. Existing normalized dates cannot be reconstructed automatically.

Reports count currently completed visible tasks once by their latest completedAt timestamp, including tasks created as Completed. Reopened tasks are excluded; legacy completed tasks without completedAt use updatedAt. Summary and distribution counts remain across all current tasks; only the trend covers the last 30 Manila calendar days. The report response shape is unchanged.

Mentions notify only active task creators, assignees (including the legacy assignee field), or Admins. @everyone uses the same visibility scope. Existing notifications are not purged.

Kanban loads every paginated task response. Notifications expose 50 items per page with previous/next controls. Settings prevent overlapping preference writes and submit only the changed notification preference.
