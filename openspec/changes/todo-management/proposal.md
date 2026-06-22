## Why

FGO (Fate/Grand Order) features daily and weekly missions, as well as time-limited event item exchanges, that require players to complete tasks before specific deadlines. Forgetting to complete these tasks results in irreversible resource loss, such as Saint Quartz, Mana Prisms, and critical ascension materials. Currently, there is no centralized todo list or notification system in the application to keep track of these time-sensitive tasks, leading to player forgetfulness.

## What Changes

- **New TODO Management Panel/Page**: A centralized area in the user interface to manage game-related TODOs (Daily Missions, Weekly Missions, Event Exchanges, and custom tasks).
- **Automated Task Generation**: The system automatically adds daily mission, weekly mission, and event exchange tasks based on current master and event data, avoiding manual entry.
- **Deadline Notifications**: Sends Web Push notifications to users' browsers when TODO deadlines are near (e.g., 3 hours before daily reset, 12 hours before weekly reset, 24 hours before event exchange closing).
- **Notification Settings**: A configuration interface under user preferences allowing users to toggle ON/OFF automatic task generation and push notifications for specific categories.
- **Manual Task Check-off**: Ability for users to check off tasks which synchronizes across their devices.

## Capabilities

### New Capabilities
- `todo-notifications`: Covers the TODO management system, task auto-generation, notification settings, Web Push registration, service worker support, and background worker logic for dispatching push notifications.

### Modified Capabilities
- `dashboard`: Modified to integrate an "Upcoming Deadlines" or "TODO Summary" widget at the top of the dashboard, allowing users to quickly see what needs attention upon opening the application.

## Impact

- **UI**: Added a TODO widget on the main dashboard, a dedicated TODO settings page/tab, and service worker registration for Web Push subscriptions.
- **Database/Storage**: Update D1 database schemas to store Web Push subscriptions (`push_subscriptions` table) and user TODO task states (`todo_tasks` table). User notification settings will also be saved in local storage and synced.
- **Backend/API**:
  - New API route `/api/todos` for managing manual check-offs and custom TODOs.
  - New API route `/api/notifications/subscribe` for managing push subscription tokens.
  - A background notification dispatcher script or worker endpoint (e.g., `/api/notifications/dispatch`) that is triggered periodically to check deadlines and send push messages.
- **Dependencies**: Add `web-push` library for signing VAPID pushes on the server/worker.
