# Taskflow incremental implementation plan

## Scope and architecture

Extend the existing committed React + Vite + JavaScript/JSX app only; do not rebuild, remove working features, add a state-management dependency, or introduce mobile/TypeScript code. Keep current routes and reuse the existing Task model, task service, notification helpers, task detail/editor pages, dashboard/calendar queries, TaskTable, ConfirmDialog, ToastContext, and Inter/Avenir/teal design tokens.

- **Deadlines:** Keep MongoDB's current task due date as the source of truth. The dashboard derives Upcoming Deadlines from current, non-completed documents with a valid due date inside its existing UTC window; the Calendar derives all dated tasks for its month irrespective of status. Null, missing, and empty values must not match either dated view. The editor provides an explicit accessible Clear date action, sends explicit `null` when a due date is cleared, and handles the returned updated task. The destination dashboard/calendar fetches current data when visited; no permanent original-deadline classification or separate deadline cache is introduced.
- **Assignees:** Derive Select All Members from whether all active users are selected; the action selects/deselects all available users, and individual toggles immediately update that derived state without duplicate IDs. Respect the existing searchable multi-select. Create, update, and bulk assignment validation accept up to the assignee directory's bounded maximum of 250 active members.
- **Checklist and status:** Embed bounded `subtasks` in the Task document. Subtask changes use server-side deterministic status derivation: no subtasks means leave status alone; on a subtask change, all complete means Completed; otherwise reopen from Completed to In Progress; otherwise a Pending task with at least one complete subtask advances to In Progress; partially complete In Progress remains In Progress. Do not override a deliberate manual status change merely because an unchanged subtask list is included in a general task edit. Update `completedAt` consistently and return the saved task. Expose checklist add/edit/check/delete/reorder in the existing editor; details support live check/uncheck; show useful progress and omit 0/0; add compact progress to recent active dashboard rows.
- **Comments:** Store comments as timestamped embedded subdocuments on the existing Task, with a user reference and bounded plain-text content. Populate author name/avatar/timestamps only on task detail, and omit comments from list projections. Reuse task visibility: creator, assignee, or Admin may read/post. A comment owner may edit/delete their own comment; Admin may moderate per the existing role policy. Add POST/PUT/DELETE nested task comment endpoints and validation. Notify the task creator and other assignees for a new comment, never the author, using the existing Notification model/helper; use the existing updates preference. Mentions are explicitly optional, so defer mention parsing/highlighting and mention-specific notification rather than making core commenting brittle.
- **Bulk actions:** Add one validated authenticated bulk API operation for complete, priority, assignment, and delete, with bounded unique IDs and pre-validation of all task access and assignees. Return canonical updated tasks/deleted IDs. Implement current-server-page select-all in the task table, a selected count, a responsive bulk toolbar, priority application, multi-user assignment dialog, and confirmed bulk deletion. Do not optimistically mutate bulk rows: show loading, wait for server confirmation, then reconcile the task list; after ambiguous failures, reload visible tasks and show an error toast. This prevents presenting unconfirmed partial success. Record status/assignment activity and send applicable existing notifications.
- **Synchronization:** Keep views derived from persisted task records rather than maintaining new permanent recent/completed/upcoming arrays. On navigation dashboard/calendar already query the backend; their queries remain current and date-safe. Task editor/details and bulk actions apply returned server state or reload relevant data. Status/completion/progress, upcoming dates, calendar, and summary counts must agree.
- **UX and accessibility:** Add restrained controls and panels to existing pages; use Lucide icons, visible focus, associated labels, keyboard operation, aria state, loading/error/success feedback, reduced-motion-aware progress/checkbox transitions, and usable wrapping/scrolling on phone, tablet, laptop, and desktop. Preserve light/dark token support. No emoji or decorative image assets are needed.

## Project structure and responsibilities

- `backend/models/Task.js`: embedded bounded subtask and timestamped comment schemas; retain legacy assignee compatibility.
- `backend/utils/validation.js`: strict create/update, subtask, comment, and discriminated bulk-operation validation.
- `backend/controllers/taskController.js` and `backend/routes/taskRoutes.js`: preserve CRUD; add nested comment handlers and validated bulk action, authorization, activity/notification, and server-returned task state.
- `backend/models/Notification.js` and `backend/utils/notifications.js`: permit/reuse comment event notifications and the existing updates preference.
- `backend/controllers/dashboardController.js`: preserve current due-date/status queries; include subtasks for compact Recent Tasks progress while excluding comment payloads from the dashboard list projection.
- `frontend/src/components/tasks/AssigneeMultiSelect.jsx`: all-active-member toggle.
- `frontend/src/components/tasks/SubtaskChecklist.jsx`: reusable accessible create/edit and detail checklist behavior with progress. `TaskCommentsPanel.jsx` handles comment rendering/composition, and `BulkAssigneeDialog.jsx` handles bulk assignment.
- `frontend/src/pages/tasks/TaskEditorPage.jsx`, `TaskDetailsPage.jsx`, `TasksPage.jsx`, and `frontend/src/pages/calendar/CalendarPage.jsx`: integrate current server state, comments, live subtasks, current-page selection/bulk controls, and date-safe calendar views.
- `frontend/src/components/tasks/TaskRow.jsx` and `TaskTable.jsx`: selection controls and compact progress while retaining existing completion and row actions.
- `frontend/src/services/taskService.js`: bulk and comment methods.
- `frontend/src/index.css`: additive selectors only, reusing existing variables and breakpoints.
- `backend/tests/` and `TODO.md`: focused validation for deadline helpers, subtask transitions, permissions, comment notifications, bulk validation and outcomes; preserve all existing tracker outcomes. `README.md`: document new task shape and endpoints.

## Design system

- **Design movement:** Quiet precision: restrained editorial productivity software with a Swiss-grid sensibility and readable data density, extending the current Taskflow interface.
- **Core principles:** Current state always wins; compact controls with clear hierarchy; safe, reversible feedback; accessibility and responsive operation by default.
- **Color philosophy:** Preserve the existing calm off-white/forest-teal palette and semantic green/amber/red status tokens; dark mode uses the already-defined contrast-aware tokens. Color supplements labels, never replaces them.
- **Layout paradigm:** Keep the current sidebar and page-header canvas; place checklist/comments in the detail content column, checklist editing beside existing task fields, and selection controls in a wrapping toolbar immediately above the existing list. Avoid a redesign or dashboard grid expansion.
- **Signature elements:** Small uppercase section labels; teal task-status/progress indicators; quiet bordered surfaces and compact assignee chips.
- **Interaction philosophy:** Explicit checkbox/action labels and predictable server-confirmed bulk operations. Checklist transitions update promptly and roll back visibly on failure. Never silently leave stale state.
- **Animation:** Retain subtle existing Motion behavior; use short progress-width/check transitions, obey `prefers-reduced-motion`, and avoid stagger/large-scale effects on bulk rows.
- **Typography system:** Preserve Inter with Avenir/system fallbacks. Keep current title, section-label, body, metadata, and hint scale; new progress and comment metadata remain compact/readable.
- **Brand essence:** A composed, dependable task workspace for teams that makes ongoing work and its next action visible. Personality: calm, precise, dependable.
- **Brand voice:** Clear, concise, collaborative. Example headings: “Small steps, clearly tracked.” and “Keep the whole team moving.” Example action/error copy: “Save checklist” and “Your changes weren’t saved. Try again.”
- **Wordmark & logo:** Preserve the existing Taskflow wordmark and three-line angled teal mark; this scoped feature update does not introduce a new brand asset.
- **Signature brand color:** Preserve Taskflow teal (`--brand: #19766b`, with the existing light/dark variants).

## Material choices

No external service, new package, new top-level page route, or schema migration tool is needed. New arrays default empty so existing MongoDB documents continue to load. Bulk failure handling favors server confirmation plus re-fetch over speculative multi-document optimistic updates. Mention parsing is intentionally deferred because the request marks it optional; ordinary comments, author ownership, and comment notifications remain required.

## Kanban integration update

- Use the existing Task API and `Task.status` values (`Pending`, `In Progress`, `Completed`) as the single source of truth.
- Add `/kanban` and a sidebar item while preserving all existing routes and features.
- Use the free, open-source `@dnd-kit/core` primitives for pointer and keyboard-aware drag and drop; no React Bits Pro or license key is used.
- Load real MongoDB tasks through `taskService.list({ page: 1, limit: 100 })`; render existing titles, descriptions, priorities, due dates, assigned-user profile images/initials, task thumbnails, and subtask progress.
- Persist every cross-column drop through `taskService.update(id, { status })`; optimistically render the destination, reconcile with the returned task, and restore/re-fetch on failure.
- Broadcast successful task changes through a small browser event helper so existing task-detail/editor/list/dashboard interactions can notify the Kanban without a second task store.
- Apply existing Taskflow visual tokens, theme behavior, accessible labels/focus states, reduced-motion handling, responsive horizontal board scrolling, empty columns, and WIP display limits (Pending 10, In Progress 5, Completed unlimited).

## Profile photo upload update

- Reused the existing `User.profileImage` field and `/api/users/:id` profile update endpoint rather than introducing a second image system.
- Replaced the visible Profile Image URL input with a keyboard-accessible clickable avatar and Change photo control.
- Reused the existing browser image preparation pipeline for type validation, preview, aspect-ratio-safe resizing, and the 1 MB stored image limit.
- Added server-side validation for uploaded JPEG, PNG, and WebP data URIs while preserving existing HTTP(S) profile-image URL compatibility.
- Added preview, Save photo, Cancel, loading, and error states; successful saves update AuthContext immediately so sidebar and other avatar consumers receive the new `profileImage` without a refresh.

## Comment mentions and ping preferences

- Added `@username` and `@everyone` support to task comments using active workspace users.
- Stored resolved mention references on comment subdocuments and populated them with task detail responses.
- Added mention notifications separate from ordinary comment/update notifications; `@everyone` notifies every active workspace user except the author, with the existing notification preference filter applied.
- Added a Settings toggle for “Mentions and pings” so each user can mute direct and `@everyone` ping notifications independently.
- Added composer autocomplete, mention highlighting, and an accessible suggestion list while preserving the existing comment create/edit/delete flow.
