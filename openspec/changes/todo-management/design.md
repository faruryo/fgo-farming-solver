## Context

Currently, the FGO Farming Solver is a Next.js App Router application running on Cloudflare Workers (via OpenNext). It syncs player data (materials, goals, exclusion list) to Cloudflare KV (`CLOUD_SAVE`) and records history snapshots in D1. The application does not track time-sensitive tasks like daily missions, weekly missions, and event exchanges. Adding these features requires a robust TODO tracking state, browser Web Push API integration, database tables for push subscriptions, and a periodic job to trigger notifications before deadlines.

## Goals / Non-Goals

**Goals:**
- Dynamically generate daily, weekly, and event exchange TODOs based on dates and active event data.
- Manage user settings to enable/disable automated TODO categories and push notifications.
- Store push notification subscriptions securely in D1.
- Periodically check upcoming deadlines and dispatch Web Push notifications using VAPID keys.
- Create a dashboard widget displaying urgent uncompleted tasks.

**Non-Goals:**
- Native mobile push notifications (iOS/Android APNs or FCM), focusing strictly on standard Web Push API.
- Support for complex custom recurrent todo task schedules (only daily/weekly/event exchange presets and basic one-off custom tasks are supported).
- Cloudflare Cron Workers for dispatching notifications, due to CPU time limits on free plans.

## Decisions

### 1. Data Schema & Synchronization

User TODO tasks (both auto-generated and manual) are stored as local-first state and synced to the cloud via the existing `/api/cloud` endpoint (Cloudflare KV) to keep database read/write counts low.

- **Local Storage / KV State (`todoState`)**:
  ```typescript
  interface TodoTask {
    id: string; // e.g. "daily-20260622", "weekly-2026W26", "event-shop-90123", or UUID for custom tasks
    title: string;
    category: 'daily' | 'weekly' | 'event' | 'custom';
    deadline: string; // ISO datetime string
    completed: boolean;
    completedAt?: string;
  }

  interface TodoSettings {
    autoDaily: boolean;   // default: true
    autoWeekly: boolean;  // default: true
    autoEvent: boolean;   // default: true
    pushEnabled: boolean; // default: false
  }
  ```
- **Push Subscriptions D1 Table (`push_subscriptions`)**:
  Used to store VAPID subscription endpoints for push notifications:
  ```sql
  CREATE TABLE push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  ```

### 2. Auto-Generation Logic (Client-Side Resolution)
To avoid unnecessary backend state initialization, tasks are generated dynamically on the client side when loading/rendering.
- **Daily Tasks**: Generated for the current JST day (resets at 4:00 AM JST). The task ID is branded with the date (e.g. `daily-20260622`). If it doesn't exist in the loaded `todoState` and `autoDaily` is enabled, a new uncompleted task is appended.
- **Weekly Tasks**: Branded with JST week identifier (e.g. `weekly-2026W26`). Resets Mondays at 0:00 JST.
- **Event Exchange Tasks**: Derived from active event list in `nice_event.json` (stored in KV / master data). If the current time is before `shopEnd` and the event is active, a task is created (e.g. `event-shop-90123`).

### 3. Notification Dispatcher Architecture
To avoid Cloudflare Workers Cron CPU limitations (10ms limit on Workers Free):
- The dispatcher runs via **GitHub Actions Cron Workflow** (runs hourly).
- The workflow calls `/api/notifications/dispatch` API endpoint.
- To secure this endpoint, a secret header `x-api-key: ${{ secrets.NOTIFICATION_API_KEY }}` is validated by the server.
- The endpoint queries D1 for subscriptions, looks up the associated user's KV cloud save to check if their upcoming tasks are completed, and fires Web Push notifications using `web-push` for those who have uncompleted tasks near deadlines.

### 4. Web Push Protocol
- Uses standard Web Push protocol with VAPID keys (`VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` stored in `.dev.vars` / Wrangler environment variables).
- Service worker `public/sw.js` handles client-side push notification display.

## Risks / Trade-offs

- **[Risk] Cookie/Authentication inside GitHub Actions trigger** → **[Mitigation]** The GHA runner does not authenticate as a user; it triggers `/api/notifications/dispatch` with an admin API key. The server endpoint queries all user subscriptions and corresponding KV cloud saves directly.
- **[Risk] High CPU consumption from web-push library encryption** → **[Mitigation]** Since notifications are sent in batches, if the number of users grows, we can chunk the dispatch or offload Web Push encryption to the GHA runner itself by fetching the list of payloads to send and encrypting/dispatching them from the runner.
- **[Risk] Browser Push restrictions (especially iOS Safari)** → **[Mitigation]** Support standard PWA manifest guidelines. iOS Safari supports Web Push only when the site is added to the Home Screen. Add clear instructions in the notification settings page to guide iOS users on how to install the PWA (Add to Home Screen) to receive notifications.
