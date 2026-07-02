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
- Cloudflare Cron Workers/Worker HTTP エンドポイントでの通知配信（CPU 制限を実質的に回避できないため、GitHub Actions ランナー側で完結させる。詳細は Decisions #3 参照）。
- イベントショップの「交換ショップ専用の閉店時刻」の取り込み。現状 `DashboardEvent.shopFinishedAt` はイベント終了時刻 `endedAt` のエイリアスであり、今回はこの制約付き（ショップ期限＝イベント終了）で実装する。ショップ独自 `closedAt` の取り込みは将来の別 change で対応する。

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
    pushEnabled: boolean; // default: false — 全カテゴリ一括のプッシュ通知トグル（カテゴリ別トグルは自動生成のみ）
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
- **Notification Dedup D1 Table (`notification_log`)**:
  期間ごとの通知済み記録。`notification_key` はタスクID（`daily-20260622` 等、期間ごとに一意）で、
  送信直前に `ON CONFLICT DO NOTHING` でアトミック挿入し、新規挿入できた行のみ送信する
  （詳細は Decisions #3）。既存マイグレーション（`migrations/0001_init_schema.sql`）に FK 制約の
  前例が無いため FK は張らず、購読削除時はスクリプト側で明示的に削除する:
  ```sql
  CREATE TABLE notification_log (
    subscription_id TEXT NOT NULL,
    notification_key TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subscription_id, notification_key)
  );
  ```

### 2. Auto-Generation Logic (Client-Side Resolution)
To avoid unnecessary backend state initialization, tasks are generated dynamically on the client side when loading/rendering. Period-boundary and task-ID logic lives in the shared pure module `lib/todo/period.ts`, imported both by this client-side code and by the GHA dispatcher script (see Decisions #3) so the two never drift.
- **Daily Tasks**: Generated for the current JST day (resets at 4:00 AM JST). The task ID is branded with the date (e.g. `daily-20260622`). If it doesn't exist in the loaded `todoState` and `autoDaily` is enabled, a new uncompleted task is appended.
- **Weekly Tasks**: Branded with JST week identifier (e.g. `weekly-2026W26`). Resets Mondays at 0:00 JST.
- **Event Exchange Tasks**: Derived from the dashboard's existing event list (`DashboardMeta.events[]`, `lib/master-data/types.ts`). If the current time is before `DashboardEvent.shopFinishedAt` and the event is active, a task is created (e.g. `event-shop-90123`). Note: `shopFinishedAt` is currently just an alias of `endedAt` (see `lib/master-data/update.ts`) — see Non-Goals for the known limitation.
- **Custom Tasks**: User-created via the TODO page with an arbitrary title/deadline, keyed by UUID (`category: 'custom'`). See `specs/todo-notifications/spec.md` Requirement "カスタムタスクの管理".

### 3. Notification Dispatcher Architecture
Cloudflare Workers Free の CPU 制限（10ms 超 invocation の確率的 kill）を回避するため、
既存の refresh-event-data.yml / update-master-data.yml と同じ「重い処理は GitHub Actions
ランナー側、Cloudflare は薄い I/O のみ」方針を踏襲する。**通知配信専用の Worker エンド
ポイントは設けない。**

- ディスパッチャは **GitHub Actions Cron Workflow**（毎時実行）で動く Node スクリプト
  （`scripts/send-todo-notifications.ts`、`pnpm exec tsx` 実行）。
- スクリプトは wrangler CLI で Cloudflare リソースを直接読み書きする:
  - `wrangler d1 execute --remote` で `push_subscriptions` を全件取得。
  - 各購読の `user_id` について `wrangler kv key get cloud:<userId> --remote` で cloud save
    （`todoState` / `todoSettings`）を取得。イベント判定用に `event_data_json` KV も取得。
- 通知対象判定・VAPID 暗号化・各 push エンドポイントへの送信を **すべて Node（ランナー）側**で行う。
  暗号化は `web-push` ライブラリを使用し、`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` は
  GitHub Secrets から供給する。
- **判定ロジック**: 期間境界・タスクID生成は `lib/todo/period.ts` の純粋関数に集約し、
  クライアント(自動生成)と本スクリプトの両方から import する（サーバー側で独立実装しない）。
  各カテゴリについて `todoSettings` の有効フラグ + `pushEnabled` が真で、かつ閾値時刻内であり、
  対応する `todoState` エントリが「未完了」または **存在しない** 場合を通知対象とする
  （未オープンユーザーへのリマインドが主目的のため、未生成＝未完了として扱う）。
- **重複送信防止（アトミック）**: 送信前に
  `INSERT INTO notification_log (subscription_id, notification_key) VALUES (?, ?)
   ON CONFLICT(subscription_id, notification_key) DO NOTHING` を実行し、**実際に新規挿入
  できた（変更行数 1）購読のみ**に push を送信する。事前 SELECT を挟まないことで、毎時
  実行の重複起動時でも TOCTOU による二重送信を防ぐ。`notification_key` は `daily-20260622`
  等のタスクID（期間ごとに一意。カスタムタスクは UUID をそのまま使う）。
- **失効処理**: 送信時に 404/410 が返った購読は `push_subscriptions` から DELETE し、
  併せて `DELETE FROM notification_log WHERE subscription_id = ?` を実行して残骸を掃除する
  （FK 制約は張らずスクリプト側で明示削除する。理由は Data Schema 節参照）。

### 4. Web Push Protocol
- Uses standard Web Push protocol with VAPID keys (`VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` stored in `.dev.vars` / Wrangler environment variables).
- Service worker `public/sw.js` handles client-side push notification display.

## Risks / Trade-offs

- **[Decided] Cookie/Authentication** → GHA ランナーはユーザー認証しない。従来案の
  admin API キー付き Worker エンドポイントは廃止し、ランナーが wrangler 経由で D1/KV を
  直接読む（refresh-event-data.yml と同一の権限モデル）。Cloudflare API トークンのみを
  GitHub Secrets で管理すればよく、公開 HTTP サーフェスを増やさない。
- **[Decided] CPU consumption from web-push encryption** → 暗号化・送信を GHA ランナー
  （CPU 無制限）で完結させることで Worker の CPU 予算問題を根本的に回避。購読者増加時は
  スクリプト内でチャンク/並列度を調整するだけでスケールする。
- **[Risk] Browser Push restrictions (especially iOS Safari)** → **[Mitigation]** Support standard PWA manifest guidelines. iOS Safari supports Web Push only when the site is added to the Home Screen. Add clear instructions in the notification settings page to guide iOS users on how to install the PWA (Add to Home Screen) to receive notifications.
