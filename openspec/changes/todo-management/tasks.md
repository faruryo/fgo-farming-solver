## 1. Setup and Schema Updates

- [ ] 1.1 Create a database migration script (`migrations/0004_todo_notifications.sql`) to define the `push_subscriptions` and `notification_log` D1 tables (no FK constraint between them — no precedent in `migrations/0001_init_schema.sql`; cleanup is done explicitly by the dispatcher script).
- [ ] 1.2 Apply migrations locally using Wrangler.
- [ ] 1.3 Update global types in the project (e.g. `types/todo.ts`) for `TodoTask`, `TodoSettings`, and the DB schema.
- [ ] 1.4 Add `web-push` dependency to `package.json` and install.
- [ ] 1.5 Generate VAPID keys. `VAPID_PUBLIC_KEY` is needed by the Worker (served to the client for subscription) — add to `.dev.vars` and Wrangler secrets. `VAPID_PRIVATE_KEY` is only needed by the GHA dispatcher script (5.6), so it goes into GitHub Secrets, not Wrangler — add to `.dev.vars` only for local dispatcher testing (6.3).

## 2. Service Worker & Subscription API

- [ ] 2.1 Create the service worker file `public/sw.js` to listen to standard `push` events and show browser notifications.
- [ ] 2.2 Register the Service Worker upon app initialization (client-side layout/provider).
- [ ] 2.3 Implement the `/api/notifications/subscribe` API route to handle subscription registration and cancellation. Require an authenticated session (`auth()`, same guard as `/api/cloud`) — return 401 if unauthenticated, since subscriptions are keyed by `session.user.id`.
- [ ] 2.4 Add database client helpers to write/read `push_subscriptions` in D1.

## 3. Client-Side Auto-Generation and Sync

- [ ] 3.1 Implement JST day/week boundary detection, task-ID generation, and active-event checks as pure functions in the **shared module `lib/todo/period.ts`** (no framework/runtime-specific imports), so it can also be imported by the GHA dispatcher script (5.1).
- [ ] 3.2 Implement client-side auto-generation logic to automatically populate daily, weekly, and event exchange TODOs, using `DashboardMeta.events[].shopFinishedAt` (`lib/master-data/types.ts`) for event exchange deadlines (currently an alias of `endedAt`; see design.md Non-Goals).
- [ ] 3.3 Add `todoState` and `todoSettings` keys to local storage, and update the unified cloud sync hook (`hooks/use-cloud-sync.ts` `KEYS`) to save and sync these keys via `/api/cloud`.
- [ ] 3.4 Implement the Settings UI section to allow users to toggle ON/OFF auto-generation per category (`autoDaily`/`autoWeekly`/`autoEvent`) and push notifications as a single combined toggle (`pushEnabled`).

## 4. UI components and Dashboard Integration

- [ ] 4.1 Create the `components/todo/TodoWidget.tsx` component using shadcn/ui and Tailwind.
- [ ] 4.2 Integrate the TODO widget at the top of the main dashboard (`app/page.tsx`).
- [ ] 4.3 Build a dedicated TODO page/modal for viewing all tasks, checking off items, and adding custom tasks.
- [ ] 4.4 Implement custom task create/edit/delete UI on the TODO page (title + deadline datetime input, UUID assignment, persisted to `todoState`).
- [ ] 4.5 In the notification settings UI, gate the "プッシュ通知を有効にする" toggle on `useSession()`: when unauthenticated, disable the toggle and show a "プッシュ通知にはログインが必要です" message with a `signIn('google')` link (reuse the pattern in `components/common/auth-button.tsx`).

## 5. Notification Dispatcher (GitHub Actions Node Script)

- [ ] 5.1 Reuse `lib/todo/period.ts` (3.1) in `scripts/send-todo-notifications.ts` to independently recompute each subscription's expected daily/weekly/event/custom tasks — treating a task that is absent from `todoState` (not just `completed: false`) as incomplete, since auto-generated tasks only materialize on client render.
- [ ] 5.2 Implement `scripts/send-todo-notifications.ts`: fetch `push_subscriptions` via `wrangler d1 execute --remote`, then for each subscription read `cloud:<userId>` (`todoState`/`todoSettings`) and `event_data_json` via `wrangler kv key get --remote`, and filter to tasks due within the category's threshold with the matching `autoX`/`pushEnabled` settings on.
- [ ] 5.3 Before sending, atomically insert into `notification_log` via `INSERT ... ON CONFLICT(subscription_id, notification_key) DO NOTHING`; only send to subscriptions where the insert actually added a row (avoids double-send on overlapping/retried hourly runs).
- [ ] 5.4 Implement VAPID encryption and delivery via the `web-push` library, run entirely in the Node script (not in a Worker route).
- [ ] 5.5 On 404/410 responses, delete the subscription from `push_subscriptions` and explicitly delete its rows from `notification_log` (no FK cascade — see 1.1).
- [ ] 5.6 Create the GitHub Actions workflow file `.github/workflows/send-todo-notifications.yml` (hourly cron + `workflow_dispatch`), supplying `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` via GitHub Secrets — no API key/HTTP endpoint needed since the script talks to Cloudflare directly via wrangler.

## 6. Verification and Testing

- [ ] 6.1 Write unit tests for JST date boundary checks and TODO auto-generation logic in `lib/todo/period.ts` (shared by client and dispatcher).
- [ ] 6.2 Test subscription/unsubscription flow locally using a simulated VAPID setup.
- [ ] 6.3 Manually run `scripts/send-todo-notifications.ts` locally (pointed at a dev D1/KV) to verify notification reception.
- [ ] 6.4 Write a test for the `notification_log` dedup insert (same `notification_key` run twice → only the first insert succeeds / only one send).
