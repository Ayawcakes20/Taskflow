# Task Management System — Outcome Tracker

## 1. Browser-only JavaScript/JSX app and product design

- Build a full-stack Task Management WEB APPLICATION. This is WEB ONLY. There is NO mobile application. Responsive browser support is required, but this remains a React web application.
- Use React, Vite, JavaScript, JSX, React Router, Axios, Tailwind CSS, Motion / Motion React, and Lucide React or another professional icon library.
- The frontend MUST use JavaScript and JSX. Use `.js` and `.jsx`. DO NOT use `.ts`, `.tsx`, TypeScript, TypeScript interfaces/types/generics, React Native, Expo, Flutter, Android code, iOS code, mobile-app navigation, or React Native components.
- The final frontend must be a pure React + Vite + JavaScript + JSX application.
- The interface should feel Professional, Modern, Minimal, Premium, Clean, Fast, Responsive, Interactive, Practical, and Human-designed. It should look like a real productivity application, not a generic AI-generated website, beginner CRUD project, basic Bootstrap dashboard, default React template, generic admin dashboard, school project template, vibe-coded website, or collection of random cards.
- Take general inspiration from modern productivity software such as Linear, Notion, Asana, ClickUp, Jira, Trello, and Monday.com. Do NOT copy their interfaces.
- Use clean typography, strong hierarchy, consistent spacing, subtle borders/shadows, professional icons, restrained color palette, clean cards, data-dense layouts where appropriate, and smooth interactions. Avoid excessive gradients, glassmorphism, shadows, rounded cards, neon colors, huge headings/empty spaces, random decorative elements/colors, excessive animation/blur/floating objects, and generic AI-generated text.
- ABSOLUTELY NO EMOJIS anywhere in the application. Do not use Unicode symbols as fake icons. Use one consistent professional icon style.
- Status colors must remain consistent throughout the entire application; use consistent primary/success/warning/danger/neutral semantics. Use task priority text labels and optional professional icons, not color alone.
- Create a carefully designed dark mode with proper contrast, readable text, visible borders, appropriate backgrounds and inputs, and consistent status colors.

## 2. Application shell, dashboard, and browser routes

- Create a professional desktop-first SaaS layout with a Sidebar + Main Content. Sidebar navigation: Dashboard, Tasks, Calendar, Reports, Notifications, Profile, Settings. Admin navigation: Users, Activity Logs. Bottom of sidebar: user profile and Logout. The active page must be visually obvious, use professional icons, and have subtle navigation transitions.
- Dashboard statistics: Total Tasks, Pending, In Progress, Completed, Overdue. Include Overview, Task Statistics, Upcoming Deadlines, Recent Tasks, and Recent Activity. Include useful charts for Tasks by Status, Tasks by Priority, Completion Trend where they provide useful information; use animated counters where appropriate and do not overuse animation.
- Create routes `/login`, `/register`, `/dashboard`, `/tasks`, `/tasks/:id`, `/tasks/create`, `/tasks/:id/edit`, `/calendar`, `/reports`, `/notifications`, `/profile`, `/settings`, `/admin`, `/admin/users`, `/admin/activity` with protected routes for authenticated pages and Admin routes.
- Create professional empty states such as “No tasks found” and provide “Create Task”. Do not use emojis or childish illustrations.
- The web application must work on desktop, laptop, tablet, and mobile browser. Do not build a separate mobile app. Use responsive CSS and Tailwind. Sidebar adapts appropriately; tables remain usable; forms remain readable; buttons remain accessible.

## 3. Task management, details, query operations, and completion

- Tasks page features: Search, Filter, Sort, Pagination, Create Task, View Task, Edit Task, Delete Task, Change Status. Use a clean table or list; do not put every task inside an oversized card.
- Task fields: Title, Description, Priority, Status, Category, Assigned User, Due Date, Created Date, Updated Date.
- Statuses: Pending, In Progress, Completed. Represent status with professional badges, consistent colors, and icons where useful; do not use emojis.
- Priorities: Low, Medium, High. Use consistent visual indicators, text labels, and optional professional icons; do not rely only on color.
- Dedicated Task Details page displays Title, Description, Status, Priority, Category, Assigned User, Created By, Due Date, Created Date, Updated Date. Actions: Edit, Delete, Complete, Change status. Activity history is visible.
- Create task fields: Title, Description, Priority, Status, Category, Assigned User, Due Date. Use clear labels, validation, helpful placeholders, loading states, and error messages. Submit button shows loading state. Show professional toast after success.
- Edit task supports Title, Description, Priority, Status, Category, Assigned User, Due Date. Use smooth transitions. Do not reload the entire page unnecessarily.
- Search Title, Description, Category, Assigned user; provide a clean search interface and use debouncing if appropriate.
- Combined filters: Status, Priority, Category, Assigned User, Due Date. Provide Clear Filters and do not make filters visually overwhelming.
- Sort ascending and descending by Due Date, Created Date, Updated Date, Priority, Status, Title.
- Use backend pagination. Display Current page, Total pages, Previous, Next, Page numbers where appropriate. Do not load thousands of tasks at once.
- Task completion uses a polished animated checkbox inspired by SpringCheck: smooth spring animation, checkmark drawing animation, subtle box scaling, fill animation, optional strike-through, press feedback, keyboard accessibility, reduced-motion support. When a task changes from Pending / In Progress to Completed, the interaction feels satisfying and polished. Use Motion / Motion React. Support controlled/uncontrolled state, disabled state, configurable colors/sizing/bounce/strike-through as appropriate, and accessibility through `aria-checked`.

## 4. Authentication, users, data models, security, and API

- Implement Register, Login, Logout, JWT, bcrypt, protected routes, role-based authorization. Never store plain-text passwords. Use environment variables for JWT secrets.
- User fields: firstName, lastName, username, email, password, role, profileImage, isActive, createdAt, updatedAt. Roles: User, Admin.
- Task fields: title, description, priority, status, category, assignedUser, createdBy, dueDate, createdAt, updatedAt. Use Mongoose references for users.
- Use Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt, dotenv, and cors.
- Register fields: First name, Last name, Username, Email, Password, Confirm password. Validate required fields, email, password strength, confirmation, duplicate email, and duplicate username.
- Login fields: Email or username, Password. Include show/hide password, validation, loading state, error messages, Link to Register; use a minimal professional design.
- Authentication API: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
- Users API: `GET /api/users`, `GET /api/users/:id`, `PUT /api/users/:id`, `DELETE /api/users/:id`.
- Tasks API: `GET /api/tasks`, `GET /api/tasks/:id`, `POST /api/tasks`, `PUT /api/tasks/:id`, `DELETE /api/tasks/:id`.
- Notifications API: `GET /api/notifications`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all`.
- Activity API: `GET /api/activity`. Dashboard API: `GET /api/dashboard`. Reports API: `GET /api/reports`.
- Use input validation, CORS, environment variables, secure error handling, handle authentication/authorization/not-found/database/network/validation errors, display user-friendly messages, and never expose stack traces.
- MongoDB URI default: `mongodb://127.0.0.1:27017/task_management`. Database: `task_management`. Collections: Users, Tasks, Notifications, ActivityLogs. Handle database connection errors.
- Backend environment: `PORT=5000`, `MONGO_URI=mongodb://127.0.0.1:27017/task_management`, `JWT_SECRET=your_secret_key`. Frontend environment: `VITE_API_URL=http://localhost:5000/api`. Create `.env` and `.env.example` files. Never commit secrets or expose real secrets.

## 5. Admin, notifications, activity logs, calendar, and reports

- Admin features: User management; view all users; search users; filter users; view user details; disable user; delete user; view all tasks; delete inappropriate tasks; view analytics; view activity logs. Use confirmation dialogs for destructive actions.
- Notifications: bell, dropdown, notification page, read/unread state, mark as read, mark all as read. Notification examples: Task assigned, Task updated, Task completed, Task approaching deadline, Task overdue. No emojis.
- Activity logs track Registration, Login, Task creation, Task update, Task deletion, Task assignment, Task completion, User changes. Store logs in MongoDB. Display recent activity on dashboard. Admin can view system activity logs.
- Calendar displays tasks based on due date and allows date selection, upcoming task viewing, and task detail access; keep it practical.
- Reports include Completion rate, Tasks by status, Tasks by priority, Tasks by category, Overdue tasks, Completed tasks, Task trends. Reports provide useful information.

## 6. Profile, settings, responsive accessibility, and interaction quality

- Profile displays Profile image, First name, Last name, Username, Email, Role, Created date; allow appropriate profile updates.
- Settings include Theme, Notification preferences, Password change, Account settings. Theme: Light, Dark, System. Save theme preference.
- Use semantic HTML, proper labels, keyboard navigation, focus states, ARIA labels, accessible dialogs, accessible buttons, sufficient contrast. For animated components, support `prefers-reduced-motion`; animations must not prevent usability.
- Use Motion / Motion React for selected interactions: Spring checkbox, Modal entrance, Dropdown entrance, Sidebar transition, Toast animation, Button feedback, Task completion, Dashboard counters, Progress indicators. Do not animate every component; animations are fast, smooth, subtle, purposeful.
- Every interactive element has appropriate feedback: buttons (hover/active/disabled/loading); inputs (focus/error/success); tasks (hover/selected/completed); dialogs (enter/exit); navigation (active/hover); notifications (enter/exit/read state).
- Loading states include skeleton loaders, button loading indicators, page loading states, and table loading states; avoid unnecessary page flashing.
- Toasts are professional and have no emojis. Success examples: “Task created successfully.”, “Task updated successfully.”, “Task deleted successfully.”, “Profile updated successfully.” Error examples include “Unable to load tasks.” and “Invalid email or password.”
- Before destructive actions such as Delete task, Delete user, Disable user, show confirmation. Example: “Delete this task? This action cannot be undone.” Buttons: Cancel, Delete. Use subtle motion.

## 7. Reports, documentation, code structure, and delivery

- Frontend structure: `frontend/public/`; `frontend/src/assets/`; `frontend/src/components/{common,layout,dashboard,tasks,notifications,users}/`; `frontend/src/pages/{auth,dashboard,tasks,calendar,reports,users,profile,settings}/`; `frontend/src/services/`; `frontend/src/context/`; `frontend/src/hooks/`; `frontend/src/utils/`; `frontend/src/App.jsx`; `frontend/src/main.jsx`; `frontend/src/index.css`; `frontend/package.json`; `frontend/vite.config.js`.
- Backend structure: `backend/config/db.js`; `backend/controllers/{authController,taskController,userController,notificationController,dashboardController,activityController}.js`; `backend/middleware/{authMiddleware,adminMiddleware,errorMiddleware}.js`; `backend/models/{User,Task,Notification,ActivityLog}.js`; `backend/routes/{authRoutes,taskRoutes,userRoutes,notificationRoutes,dashboardRoutes,activityRoutes}.js`; `backend/utils/`; `backend/server.js`; `backend/package.json`; `backend/.env`.
- Use good React practices: avoid unnecessary re-renders, duplicate API requests, duplicated API logic, and unnecessary state; use reusable services, pagination, lazy loading where useful, optimized API calls. Write clean JavaScript, descriptive names, reusable components, async/await, proper error handling, consistent formatting. Do not over-engineer or create unnecessary abstractions.
- Create complete `README.md` including project overview, features, technology stack, architecture, folder structure, installation, MongoDB setup, environment variables, backend setup, frontend setup, how to run, API documentation, user roles, security, testing, troubleshooting. Include exact commands.
- Frontend starts successfully; backend starts successfully; MongoDB connects; React uses Vite; frontend uses JavaScript and JSX; no TypeScript/TSX, React Native, Expo, mobile-app code, or emojis. Authentication, JWT, bcrypt, protected routes, admin routes, CRUD, search, filters, sorting, pagination, dashboard, calendar, reports, notifications, activity logs, profile, settings, dark mode, responsive browser layouts, loading/error states, toasts, confirmation dialogs, Motion interactions, and reduced-motion support work.
- Save a verified project checkpoint and deliver the current Preview unless a public deployment is specifically requested.

## Outcome status and evidence

1. **Browser-only JavaScript/JSX app and product design — Complete.** Evidence: the frontend production build succeeds; source uses React/Vite JavaScript/JSX, a restrained responsive design system, and reduced-motion/accessibility styles.
2. **Application shell, dashboard, and browser routes — Complete.** Evidence: source routes reconcile with the 16-entry `/manus-routes.json`; the public manifest returns HTTP 200 JSON; authenticated dashboard API returns HTTP 200.
3. **Task management, details, query operations, and completion — Complete.** Evidence: MongoDB-backed API smoke checks passed create/read/update/complete/delete, combined search and filters, backend pagination, due-date selection, Low-to-High priority ordering, activity details, and preservation of assignees/due dates during partial updates.
4. **Authentication, users, data models, security, and API — Complete.** Evidence: API smoke checks passed registration, duplicate rejection, invalid-password rejection, username login, password change, session restore/logout, required Secure/HttpOnly/SameSite=None cookie flags, protected user-directory access, and active-account enforcement; project secret is ignored and untracked.
5. **Admin, notifications, activity logs, calendar, and reports — Complete.** Evidence: smoke checks passed assignment/update/completion/deadline notifications, read/mark-all, preference-gated alerts, Admin user filtering/details/disable/delete, system activity, reports, and task moderation; calendar/report routes and screens build successfully.
6. **Profile, settings, responsive accessibility, and interaction quality — Complete.** Evidence: profile update and theme/notification preference persistence passed API checks; password changes, confirmation flows, keyboard/reduced-motion styles, and responsive layouts are implemented in source.
7. **Reports, documentation, code structure, and delivery — Complete.** Evidence: complete README and planned frontend/backend structure are present; `pnpm check` passes 22 backend unit tests and the production frontend build; API smoke suite, route-manifest check, and `git diff --check` pass. The original application baseline is in the existing main-branch checkpoint; the validated incremental changes are being included in this main-branch checkpoint.


## 8. Multi-user task assignment and legacy data — Complete

- The "Assigned User" field in the New Task form must allow selecting MULTIPLE users. The task can be assigned to one user or multiple users. The user should be able to select multiple users from the available users. Provide a clean multi-select UI suitable for a professional SaaS application. Selected users should be clearly visible. The user should be able to remove an individual selected user. Prevent duplicate user assignments.
- Update the Task model so a task can store multiple assigned users. Use an array of user references/IDs instead of a single assigned user field. Update task creation and update APIs. Update task retrieval/population so all assigned users are available. Update notifications so all assigned users can receive relevant task notifications. Update task cards, task details, dashboard, and other areas that display assigned users.
- Do not break existing tasks that may currently have only one assigned user. Handle existing single-user data safely during migration/reading.

## 9. Current-state dashboard synchronization and reversible completion — Complete

- **LAST 7 DAYS Completed Work must ALWAYS reflect the current task status.** If a task becomes `Completed`, it should appear in **LAST 7 DAYS Completed Work**. If a task changes from `Completed` back to `Pending` or `In Progress`, it MUST immediately disappear from **LAST 7 DAYS Completed Work**. It must return to the appropriate active/recent task section. The UI must update immediately after the status change. The database/backend status must also be updated correctly. Do not rely only on the original dashboard state or cached data. Make sure the frontend state is synchronized after task updates. Do NOT permanently move a task into a "completed" list. **LAST 7 DAYS Completed Work must be dynamically derived from the current task status.**
- Upcoming Deadlines must always be dynamically calculated from current task data. If the task is incomplete and still has a future due date, it should appear in Upcoming Deadlines. If the task is completed, it should not appear in Upcoming Deadlines. If the task is changed back to incomplete, it should automatically become eligible to appear again. No stale filtering or permanently removed task IDs. Make sure this works without requiring a full page refresh.
- In Recent Tasks, incomplete/active tasks should appear at the top and completed tasks toward the bottom. When checked, a task should move down toward the completed portion. When unchecked, it should return to the active/incomplete portion. Recalculate ordering after every status change; do not append tasks randomly. Use a predictable secondary order, such as most recently updated.
- Recent Tasks, Completed Work, Upcoming Deadlines, task statistics, progress indicators, Pending count, In Progress count, Completed count, and Overdue count must be based on CURRENT task state. Whenever a task is created, edited, completed, uncompleted, reassigned, or deleted, update the relevant dashboard sections immediately. Do not require refresh; keep counts and lists consistent.
- Completion is reversible: Pending → In Progress → Completed, Completed → Pending, and Completed → In Progress. Recalculate dashboard sections after either direction.

## 10. Optional task image upload and current task details — Complete

- Add an OPTIONAL image upload field to the New Task form. Creating a task must still work without an image. Allow selecting an image from the device, show a preview before creating the task, and allow removing/changing it. Validate that the file is actually an image, enforce a reasonable file-size limit, and show a clear message for invalid or too-large files.
- Update the Task model to support an optional image/image URL field. Reuse existing project image storage if implemented; do not introduce an unnecessary external service if the project already has suitable storage. Make task images display in Task Details and wherever appropriate in task cards.
- Task Details must reflect current data: Pending displays Pending; In Progress displays In Progress; Completed displays Completed. Show all assigned users. Show the current image, and immediately treat an uncompleted task as active again. Avoid stale data caused by old frontend state.

## 11. Synchronized task mutation behavior, recovery, loading, and responsive UI — Complete

- Keep the existing SpringCheck-style completion interaction: subtle spring/checkmark/fill/press animation; optional strike-through; when unchecking, smoothly reverse, remove strike-through, restore the normal task appearance, move to active/incomplete sections, and restore it to Completed Work/Upcoming Deadlines when conditions are satisfied. Animation must not interfere with server state.
- Follow one reliable task source of truth and derive `recentTasks`, `completedTasks`, `upcomingDeadlines`, `pendingTasks`, `inProgressTasks`, and `overdueTasks` from current task status instead of maintaining independent arrays that become out of sync. On a status change, update the database, return the updated task from the API, replace/update frontend state, recalculate dashboard sections/statistics, and keep Recent Tasks, Completed Work and Upcoming Deadlines consistent.
- If a task update fails, do not leave the UI in a wrong permanent state: restore the previous state if necessary, keep the frontend consistent with the database, and show a professional error notification/toast such as “Failed to update task. Please try again.” Prevent duplicate update requests and show a subtle loading state on the affected task without freezing the dashboard.
- Preserve the existing professional SaaS design; no full redesign. Keep clean spacing, typography, subtle borders, professional cards, consistent buttons/status badges, responsive layouts and purposeful micro-interactions. Avoid excessive gradients, glassmorphism, huge cards, neon colors, excessive animation, decorative elements, generic AI dashboard appearance and emojis.
- Maintain desktop, laptop, tablet and mobile-browser usability for the New Task form, multi-select, image upload/preview, Recent Tasks, Completed Work, Upcoming Deadlines, Task Details, task cards and dashboard statistics. Prevent overflow of cards, rows, buttons, avatars and previews. Preserve the existing React + Vite + JavaScript + JSX web architecture; introduce no TypeScript/TSX, mobile-app code or emojis.


### Completion evidence for outcomes 8–11

- **Outcome 8 — Complete:** MongoDB-backed regression/integration checks cover multi-user assignment, duplicate/empty assignment handling, assignment notifications, task visibility and legacy scalar reads; the browser created/edited a task with two users and the task table/detail displayed both assignees.
- **Outcome 9 — Complete:** Reversible completion/current-state trend helpers are covered by unit/API regression checks; the browser completed and reopened a task without a reload and observed dashboard counters, active deadlines and recent ordering update. An injected task-update failure showed the error toast and restored the prior state.
- **Outcome 10 — Complete:** The browser selected a real PNG, previewed it, saved and replaced the image, and viewed the saved task image/thumbnail in detail and task-list contexts. API/unit checks cover image bounds/signatures and image-optional task creation. Images are validated/compressed and stored within MongoDB, without adding an external image service.
- **Outcome 11 — Complete:** The production build, all 22 backend tests, API/route-manifest smoke checks, and `git diff --check` pass. Headless Chromium verified no page-level horizontal overflow at 390×844, 768×1024, 1024×900, and 1280×900. Dashboard and task-list status changes were observed in place; failure rollback/toast behavior was also observed. A read-only implementation review found no confirmed gap.


## 12. Current-deadline derivation and calendar synchronization — Complete

- A task with no deadline must not appear in Upcoming Deadlines or the Calendar. Null, empty string, undefined, or missing deadline values must be handled safely.
- When a task is edited from no deadline to a valid future deadline and saved, it must immediately appear in Upcoming Deadlines and the Calendar without requiring a page refresh. The opposite must also work: removing a deadline must immediately remove the task from Upcoming Deadlines and the Calendar.
- Upcoming Deadlines must be derived from current task data and include a task only when it has a valid due date, the due date is in the future, and the task is not Completed. Calendar must include any task with a valid due date regardless of Pending, In Progress, or Completed status, unless the existing application intentionally applies a different calendar rule.
- After editing a task, use the updated task returned from the backend or refresh relevant task state so dashboard/calendar sections recalculate; refresh/navigation must continue to show the saved current due date. Do not permanently classify tasks by their original deadline.

## 13. Select All Members — Complete

- Add a Select All option to the Assigned Users field. Clicking it selects all available members and immediately marks each member selected. When all available users are selected, Select All is checked, whether selected together or individually. When one member is unchecked, Select All becomes unchecked. Clicking it while everyone is selected deselects everyone. It must work both when creating and editing a task, preserve multiple-user assignment, and never create duplicate assignees.

## 14. Subtask checklist, editing, and progress — Complete

- Add optional subtasks/checklists to the existing Task model; tasks without subtasks must remain valid. Users can add subtasks while creating a task, and on edit they can add subtasks, edit subtask text, check/uncheck subtasks, delete subtasks, and reorder them if it can be added cleanly. Each subtask has its own completion state.
- Display completed-subtask progress such as “2 / 5 completed — 40%” and a suitable visual progress bar where appropriate. When there are no subtasks, show “Progress” and “No subtasks”; do not show 0 / 0 = 0%. Add helpful subtask progress to the dashboard where it improves the current design without overcrowding it.

## 15. Deterministic status synchronization from subtasks — Complete

- If a task has no subtasks, keep the manually selected task status and do not change it automatically. If a Pending task has at least one subtask completed and not all subtasks completed, change it to In Progress. If an In Progress task has some completed and some incomplete subtasks, keep it In Progress. If all subtasks become completed, change the task to Completed. If a Completed task has a subtask unchecked, change it back to In Progress.
- Apply the exact summary: no subtasks → keep manually selected status; at least one completed and not all completed → In Progress; all subtasks completed → Completed; a Completed task with any incomplete subtask → In Progress. If the user manually changes task status, do not unexpectedly override the user's choice unless these subtask rules explicitly require synchronization.
- Subtask-driven changes must immediately update Recent Tasks, Completed Work, Upcoming Deadlines, dashboard counts, task progress, and applicable notifications. A reopened task leaves Completed Work, returns to active/recent tasks and returns to Upcoming Deadlines if it has a future deadline. Keep status reversible and persist every transition to MongoDB.

## 16. Task comments, ownership, and notifications — Complete

- Add comments directly to tasks using the existing backend architecture. A comment has user, content, createdAt, and updatedAt. Display user name, profile image/avatar when available, comment content, and timestamp. Users assigned to a task can add comments and edit/delete their own comments. A normal user cannot edit/delete another user's comment unless the existing role/permission system explicitly authorizes administrators to do so.
- On an appropriate new comment, notify relevant assigned users (and task owner where appropriate) using the existing notification system, never notifying the author about their own comment. Do not notify on edits unless that behavior is already supported. Optional @mention highlighting/notification may be added only if clean; functional ordinary comments are required first.

## 17. Current-page task selection and bulk actions — Complete

- Users can select multiple tasks in the visible task-list page and see the selected count. A page-level Select All checkbox selects all visible/current-page tasks unless the existing pagination architecture supports selecting all matching tasks across every page. Select All is checked exactly when all visible tasks are selected and becomes unchecked when a selected task is deselected or no tasks are selected.
- Support bulk Complete (set every selected task to Completed), bulk Change Priority (Low, Medium, or High), bulk Assign (select one or multiple users and apply that user set to every selected task), and bulk Delete after confirmation. Confirm bulk deletion with the task count and clear text that the selected tasks will be deleted, with Cancel and Delete Tasks actions.

## 18. Bulk outcomes, reliable task source, and recovery — Complete

- After a bulk action, immediately reconcile the task list, Recent Tasks, Completed Work, Upcoming Deadlines, Calendar, dashboard counts/statistics, progress, and relevant notifications. Do not require a page refresh. All derived views must be based on current task data; do not maintain independent stale recent/completed/upcoming/pending/in-progress/overdue arrays as permanent state.
- Bulk actions must persist all affected task changes to MongoDB. If a bulk action fails, do not silently fail or leave unconfirmed rows visually updated. Show an error notification, keep/reconcile frontend state with backend state, and refresh/reconcile affected tasks when necessary. For large bulk operations show loading and prevent duplicate submissions. Do not show partial success unless the backend confirms which tasks were changed.

## 19. Responsive use and preservation — Complete

- Ensure Select All Members, multi-assignee selection, subtask checklists and progress bars, comments and comment input, task selection checkboxes, and bulk-action toolbars work at desktop, laptop, tablet, and mobile-browser widths without horizontal overflow. On mobile widths the bulk toolbar wraps or adapts appropriately. Preserve the existing professional SaaS visual design and all existing working features; keep React + Vite + JavaScript + JSX, web-only, and no emojis.


### Completion evidence for outcomes 12–19

- **Outcome 12 — Complete:** Regression/API smoke checks cover valid deadline updates, explicit date removal, and dashboard/calendar derived eligibility; the browser used the explicit Clear due date control, saved the change, and saw “No due date.” Calendar views exclude null/missing/empty/invalid dates while including valid dates regardless of task status.
- **Outcome 13 — Complete:** Preview UI selected every available member through Select All, verified the reversible deselect state, and created/edited multi-assignee tasks. The bulk-assignment dialog applied two selected members. Create/update/bulk validation now accepts up to the directory's 250 active-user limit and rejects 251; a dedicated regression covers the bound.
- **Outcome 14 — Complete:** Browser UI added subtasks by button and keyboard, edited text, reordered rows, removed a row, saved, and displayed the persisted two-item checklist. Details showed live progress; task list and dashboard use the same progress helper, and a no-subtasks task omits a 0/0 ratio.
- **Outcome 15 — Complete:** Browser and API checks observed Pending with partial completion move to In Progress, all subtasks move to Completed, and unchecking one reopen to In Progress with completion time cleared. Regression checks cover no-subtask/manual-status behavior and unchanged checklist edits.
- **Outcome 16 — Complete:** Browser UI posted a comment with author/time, edited it, and deleted it through confirmation. Two-user API checks confirmed only the author may edit/delete a normal user's comment, a non-owner receives 403, the author gets no self-notification, and the other task participant receives the comment notification.
- **Outcome 17 — Complete:** Browser UI selected all visible/current-page rows and showed the count; bulk High priority and two-member assignment reconciled into the list, bulk Complete updated status, and bulk Delete required confirmation and removed only the selected QA tasks.
- **Outcome 18 — Complete:** API smoke checks verified access control, duplicate-ID rejection, and persisted priority/assignment/complete/delete results. The client uses server-confirmed responses, loading guards, error toasts, and a task-list refresh on bulk failure rather than speculative row mutations; dashboard/calendar queries derive current persisted state.
- **Outcome 19 — Complete:** Authenticated headless Chromium checked Tasks with its open bulk toolbar, task editor, task detail, and dashboard at 390×844, 768×1024, 1024×900, and 1280×900. Each page stayed within the viewport; the bulk toolbar remained visible and dashboard subtask progress was readable at every width.

**Final verification:** `pnpm check` passes all 22 backend tests and the production Vite build. The API health endpoint reports MongoDB connected; the 16-page route manifest is valid. The `http://127.0.0.1:3000` preflight remains accepted by the local API with credentials enabled. The three reserved `example.test` QA users and their QA tasks were verified and removed from the temporary Preview database.

## 9. Free database-backed Kanban board — Complete

- Add a protected `/kanban` page and existing-sidebar navigation item with exactly three columns matching the existing `Task.status` values: `Pending`, `In Progress`, and `Completed`.
- Load real authenticated MongoDB tasks through the existing task API; do not use static demo tasks, mock users, fake avatars, separate Kanban state, a separate Kanban backend, a separate database, or a `kanbanStatus` field.
- Implement free/open-source drag-and-drop with `@dnd-kit/core`, including cross-column moves, pointer dragging, keyboard sensor support, visible focus states, and responsive horizontal scrolling on narrow screens.
- Persist every drop through the existing task update endpoint, update the optimistic card immediately, reconcile with the API response, and on failure restore/re-fetch the previous state and show a clear non-emoji error.
- Show existing task title, short description, priority, valid due date, optional thumbnail, existing profile-image avatars or initials for multiple assignees with a `+N` indicator, and actual subtask progress.
- Preserve existing theme, authentication, authorization, task details, comments, subtasks, activity/notification behavior, and synchronization expectations; broadcast successful task changes through the shared task-change event helper.
