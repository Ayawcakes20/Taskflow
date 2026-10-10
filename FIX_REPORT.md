# Taskflow functional fixes

Implemented all ten requested fixes without redesigning authentication or landing pages. Production secrets were unchanged; nothing was pushed or deployed.

## Fixes

1. Registration and password changes reject passwords above bcrypt's 72 UTF-8 byte limit.
2. User schema and new JWTs include a private sessionVersion. Password changes increment it and issue a fresh cookie; other tokens are rejected. Missing legacy versions are treated as 0. No migration is required, and user API JSON omits the counter.
3. New and edited mentions, including @everyone, resolve only active creators, assignees (including legacy assignment), or Admins.
4. Task due-date validation rejects impossible calendar dates while supporting leap days, clearing, and existing timestamp input.
5. Frontend/backend overdue, today, upcoming deadlines, reminders, calendar Today, dashboard date headers, and completion grouping use Asia/Manila consistently. Date-only storage is preserved.
6. Task search resets to page 1 and ignores delayed obsolete results.
7. Kanban retrieves all API pages rather than only the first 100 tasks.
8. Notifications have previous/next pagination, reset on filter changes, and clamp pages after read-state changes.
9. Reports count currently completed visible tasks once by their latest completion date, including tasks created Completed. Reopened tasks are excluded. Legacy completed tasks without completedAt use updatedAt. Summaries remain all-time/current-state; the trend covers 30 Manila days. API response shapes are unchanged.
10. Settings prevent overlapping preference requests (including same-event-loop clicks), send only the changed notification key, and roll back failed saves.

## Validation

Final pnpm check passed: 31 backend tests, 6 frontend DOM interaction tests, 0 failures, and a successful production Vite build. All backend JavaScript syntax checks also passed. Frontend tests use jsdom and mocked Axios responses; controller regressions use in-memory model mocks. Live MongoDB persistence and authenticated browser smoke testing remain unverified because local MongoDB is unavailable. Motion emitted non-fatal animation warnings in DOM tests.

## Compatibility and remaining issues

- Password changes invalidate other sessions intentionally. Previously accepted passwords above 72 UTF-8 bytes cannot be newly registered or set; existing login handling is preserved.
- Sessions lacking sessionVersion continue to work until a password change. Deploy all backend instances with the version check when deploying later.
- Deadline/trend day boundaries now follow Manila regardless of the browser or server timezone. Report totals can differ from  former activity-event counts.
- Previously normalized invalid dates cannot be automatically recovered. Previously sent mention notifications are not purged.
- Existing report data without completedAt uses updatedAt as an approximation.
- Out-of-scope audit findings remain: Docker port mismatch, Windows root dev script portability, tablet auth overflow, public landing-page gap, suspected long-text overflow, and the Bootstrap/Material UI requirement gap. Landing/login/signup design is unchanged.

## Modified or added files

- [backend/models/User.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/models/User.js)
- [backend/controllers/authController.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/controllers/authController.js)
- [backend/middleware/authMiddleware.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/middleware/authMiddleware.js)
- [backend/utils/validation.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/utils/validation.js)
- [backend/controllers/taskController.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/controllers/taskController.js)
- [backend/controllers/dashboardController.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/controllers/dashboardController.js)
- [backend/controllers/reportController.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/controllers/reportController.js)
- [backend/utils/dashboardState.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/utils/dashboardState.js)
- [backend/utils/notifications.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/utils/notifications.js)
- [backend/tests/auth-regression.test.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/tests/auth-regression.test.js)
- [backend/tests/dates-reports-regression.test.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/tests/dates-reports-regression.test.js)
- [backend/tests/mentions-regression.test.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/tests/mentions-regression.test.js)
- [backend/tests/preferences-regression.test.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/tests/preferences-regression.test.js)
- [backend/tests/core.test.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/backend/tests/core.test.js)
- [frontend/src/utils/workspaceDates.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/src/utils/workspaceDates.js)
- [frontend/src/utils/format.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/src/utils/format.js)
- [frontend/src/utils/taskDates.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/src/utils/taskDates.js)
- [frontend/src/utils/dashboardState.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/src/utils/dashboardState.js)
- [frontend/src/services/taskService.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/src/services/taskService.js)
- [frontend/src/pages/dashboard/DashboardPage.jsx](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/src/pages/dashboard/DashboardPage.jsx)
- [frontend/src/pages/calendar/CalendarPage.jsx](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/src/pages/calendar/CalendarPage.jsx)
- [frontend/src/pages/reports/ReportsPage.jsx](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/src/pages/reports/ReportsPage.jsx)
- [frontend/src/pages/tasks/TasksPage.jsx](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/src/pages/tasks/TasksPage.jsx)
- [frontend/src/pages/kanban/KanbanPage.jsx](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/src/pages/kanban/KanbanPage.jsx)
- [frontend/src/pages/notifications/NotificationsPage.jsx](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/src/pages/notifications/NotificationsPage.jsx)
- [frontend/src/pages/settings/SettingsPage.jsx](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/src/pages/settings/SettingsPage.jsx)
- [frontend/tests/functional.test.js](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/tests/functional.test.js)
- [frontend/package.json](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/frontend/package.json)
- [package.json](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/package.json)
- [pnpm-lock.yaml](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/pnpm-lock.yaml)
- [README.md](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/README.md)
- [FIX_REPORT.md](C:/Users/Paulo/Desktop/taskflow-project/taskflowwebproj/FIX_REPORT.md)

Generated frontend/dist build output is excluded from the source-file inventory.

