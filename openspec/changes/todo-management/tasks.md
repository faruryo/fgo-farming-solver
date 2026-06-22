## 1. Setup and Schema Updates

- [ ] 1.1 Create a database migration script to define the `push_subscriptions` D1 table.
- [ ] 1.2 Apply migrations locally using Wrangler.
- [ ] 1.3 Update global types in the project (e.g. `types/todo.ts`) for `TodoTask`, `TodoSettings`, and the DB schema.
- [ ] 1.4 Add `web-push` dependency to `package.json` and install.
- [ ] 1.5 Configure VAPID keys (`VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`) in `.dev.vars` and `wrangler.toml` for local development and cloud deployments.

## 2. Service Worker & Subscription API

- [ ] 2.1 Create the service worker file `public/sw.js` to listen to standard `push` events and show browser notifications.
- [ ] 2.2 Register the Service Worker upon app initialization (client-side layout/provider).
- [ ] 2.3 Implement the `/api/notifications/subscribe` API route to handle subscription registration and cancellation.
- [ ] 2.4 Add database client helpers to write/read `push_subscriptions` in D1.

## 3. Client-Side Auto-Generation and Sync

- [ ] 3.1 Implement utility functions to detect current JST day/week boundaries and check active events.
- [ ] 3.2 Implement client-side auto-generation logic to automatically populate daily, weekly, and event exchange TODOs.
- [ ] 3.3 Add `todoState` and `todoSettings` keys to local storage, and update the unified cloud sync hook to save and sync these keys via `/api/cloud`.
- [ ] 3.4 Implement the Settings UI section to allow users to toggle ON/OFF auto-generation and notifications.

## 4. UI components and Dashboard Integration

- [ ] 4.1 Create the `components/todo/TodoWidget.tsx` component using shadcn/ui and Tailwind.
- [ ] 4.2 Integrate the TODO widget at the top of the main dashboard (`app/page.tsx`).
- [ ] 4.3 Build a dedicated TODO page/modal for viewing all tasks, checking off items, and adding custom tasks.

## 5. Notification Dispatcher & GitHub Actions

- [ ] 5.1 Implement the `/api/notifications/dispatch` API route that validates `x-api-key`, scans subscriptions, reads associated user data, and dispatches Web Push payloads.
- [ ] 5.2 Add error handling in the API route to delete expired/revoked subscriptions from D1.
- [ ] 5.3 Create the GitHub Actions workflow file `.github/workflows/send-todo-notifications.yml` to trigger dispatching hourly.

## 6. Verification and Testing

- [ ] 6.1 Write unit tests for JST date boundary checks and TODO auto-generation logic.
- [ ] 6.2 Test subscription/unsubscription flow locally using a simulated VAPID setup.
- [ ] 6.3 Manually trigger the dispatcher API route locally to verify notification reception.
