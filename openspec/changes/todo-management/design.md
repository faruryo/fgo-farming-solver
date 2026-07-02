## Context

現在のFGO Farming Solverは、Cloudflare Workers上（OpenNext経由）で動くNext.js App Routerアプリケーションである。プレイヤーデータ（素材・目標・除外リスト）をCloudflare KV（`CLOUD_SAVE`）へ同期し、履歴スナップショットをD1に記録している。デイリーミッション・ウィークリーミッション・イベント交換のような期限付きタスクを追跡する仕組みは現状存在しない。この機能追加には、堅牢なTODO追跡状態、ブラウザのWeb Push API連携、プッシュ購読用のデータベーステーブル、そして期限前に通知を発火させる定期ジョブが必要になる。

## Goals / Non-Goals

**Goals:**
- 日付と開催中のイベントデータに基づき、デイリー・ウィークリー・イベント交換のTODOを動的に生成する。
- 自動TODOカテゴリごとの有効/無効、プッシュ通知の有効/無効をユーザーが設定できるようにする。
- プッシュ通知の購読情報をD1に安全に保存する。
- 期限が近づいたタスクを定期的にチェックし、VAPIDキーを用いてWeb Push通知を配信する。
- 未完了の緊急タスクを表示するダッシュボードウィジェットを作成する。

**Non-Goals:**
- ネイティブモバイルプッシュ（iOS/AndroidのAPNsやFCM）は対象外とし、標準のWeb Push APIのみに絞る。
- 複雑なカスタム繰り返しスケジュールへの対応（デイリー/ウィークリー/イベント交換のプリセットと、単発のシンプルなカスタムタスクのみサポート）。
- Cloudflare Cron Workers/Worker HTTPエンドポイントでの通知配信（CPU制限を実質的に回避できないため、GitHub Actionsランナー側で完結させる。詳細はDecisions #3参照）。
- イベントショップの「交換ショップ専用の閉店時刻」の取り込み。現状`DashboardEvent.shopFinishedAt`はイベント終了時刻`endedAt`のエイリアスであり、今回はこの制約付き（ショップ期限＝イベント終了）で実装する。ショップ独自`closedAt`の取り込みは将来の別changeで対応する。

## Decisions

### 1. データスキーマと同期

ユーザーのTODOタスク（自動生成・手動どちらも）はローカルファースト状態として保持し、DB読み書き回数を抑えるため既存の`/api/cloud`エンドポイント（Cloudflare KV）経由でクラウドに同期する。

- **ローカルストレージ / KV状態（`todoState`）**:
  ```typescript
  interface TodoTask {
    id: string; // 例: "daily-20260622", "weekly-2026W26", "event-shop-90123"、カスタムタスクはUUID
    title: string;
    category: 'daily' | 'weekly' | 'event' | 'custom';
    deadline: string; // ISO日時文字列
    completed: boolean;
    completedAt?: string;
  }

  interface TodoSettings {
    autoDaily: boolean;   // デフォルト: true
    autoWeekly: boolean;  // デフォルト: true
    autoEvent: boolean;   // デフォルト: true
    pushEnabled: boolean; // デフォルト: false — 全カテゴリ一括のプッシュ通知トグル（カテゴリ別トグルは自動生成のみ）
  }
  ```
- **プッシュ購読D1テーブル（`push_subscriptions`）**:
  プッシュ通知用のVAPID購読エンドポイントを保存する:
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
- **通知重複防止D1テーブル（`notification_log`）**:
  期間ごとの通知済み記録。`notification_key`はタスクID（`daily-20260622`等、期間ごとに一意）で、
  送信直前に`ON CONFLICT DO NOTHING`でアトミック挿入し、新規挿入できた行のみ送信する
  （詳細はDecisions #3）。既存マイグレーション（`migrations/0001_init_schema.sql`）にFK制約の
  前例が無いためFKは張らず、購読削除時はスクリプト側で明示的に削除する:
  ```sql
  CREATE TABLE notification_log (
    subscription_id TEXT NOT NULL,
    notification_key TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subscription_id, notification_key)
  );
  ```

### 2. 自動生成ロジック（クライアント側での解決）

不要なバックエンド状態の初期化を避けるため、タスクはクライアント側の読み込み/描画時に動的に生成する。期間境界・タスクID生成のロジックは共有の純粋モジュール`lib/todo/period.ts`に集約し、このクライアント側コードとGHAディスパッチャースクリプト（Decisions #3参照）の両方からimportすることで、両者の実装がずれないようにする。
- **デイリータスク**: 現在のJST日（午前4:00リセット）に対して生成される。タスクIDは日付でブランドする（例: `daily-20260622`）。読み込んだ`todoState`に存在せず、かつ`autoDaily`が有効なら、未完了の新規タスクを追加する。
- **ウィークリータスク**: JST週識別子でブランドする（例: `weekly-2026W26`）。月曜0:00 JSTでリセットする。
- **イベント交換タスク**: ダッシュボードの既存イベント一覧（`DashboardMeta.events[]`、`lib/master-data/types.ts`）から導出する。現在時刻が`DashboardEvent.shopFinishedAt`より前でイベントが開催中なら、タスクを作成する（例: `event-shop-90123`）。注: `shopFinishedAt`は現状`endedAt`のエイリアスに過ぎない（`lib/master-data/update.ts`参照。Non-Goals参照）。
- **カスタムタスク**: TODOページからユーザーが任意のタイトル/期限で作成し、UUIDをキーとする（`category: 'custom'`）。詳細は`specs/todo-notifications/spec.md`の要件「カスタムタスクの管理」を参照。

### 3. 通知ディスパッチャーのアーキテクチャ

Cloudflare Workers Freeの CPU制限（10ms超のinvocationが確率的にkillされる）を回避するため、
既存の refresh-event-data.yml / update-master-data.yml と同じ「重い処理はGitHub Actions
ランナー側、Cloudflareは薄いI/Oのみ」方針を踏襲する。**通知配信専用のWorkerエンド
ポイントは設けない。**

- ディスパッチャーは**GitHub Actions Cron Workflow**（毎時実行）で動くNodeスクリプト
  （`scripts/send-todo-notifications.ts`、`pnpm exec tsx`実行）。
- スクリプトはwrangler CLIでCloudflareリソースを直接読み書きする:
  - `wrangler d1 execute --remote`で`push_subscriptions`を全件取得。
  - 各購読の`user_id`について`wrangler kv key get cloud:<userId> --remote`でクラウド保存
    （`todoState` / `todoSettings`）を取得。イベント判定用にはKVキー`dashboard_meta`
    （`DashboardMeta.events[]`。`scripts/run-updater.ts` / `update-master-data.yml`が書き込む）
    を取得する。なお`event_data_json`はボックス（ロト）型イベントプランナー専用の別データ
    （`EventPlannerEvent[]`）であり、本ディスパッチャーが使うイベント情報とは別物なので
    混同しないこと。
- 通知対象判定・VAPID暗号化・各pushエンドポイントへの送信を**すべてNode（ランナー）側**で行う。
  暗号化は`web-push`ライブラリを使用し、`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`は
  GitHub Secretsから供給する。
- **判定ロジック**: 期間境界・タスクID生成は`lib/todo/period.ts`の純粋関数に集約し、
  クライアント（自動生成）と本スクリプトの両方からimportする（サーバー側で独立実装しない）。
  各カテゴリについて`todoSettings`の有効フラグ + `pushEnabled`が真で、かつ閾値時刻内であり、
  対応する`todoState`エントリが「未完了」または**存在しない**場合を通知対象とする
  （未オープンユーザーへのリマインドが主目的のため、未生成＝未完了として扱う）。
- **重複送信防止（アトミック）**: 送信前に
  `INSERT INTO notification_log (subscription_id, notification_key) VALUES (?, ?)
   ON CONFLICT(subscription_id, notification_key) DO NOTHING`を実行し、**実際に新規挿入
  できた（変更行数1）購読のみ**にpushを送信する。事前SELECTを挟まないことで、毎時
  実行の重複起動時でもTOCTOUによる二重送信を防ぐ。`notification_key`は`daily-20260622`
  等のタスクID（期間ごとに一意。カスタムタスクはUUIDをそのまま使う）。
- **失効処理**: 送信時に404/410が返った購読は`push_subscriptions`からDELETEし、
  併せて`DELETE FROM notification_log WHERE subscription_id = ?`を実行して残骸を掃除する
  （FK制約は張らずスクリプト側で明示削除する。理由はData Schema節参照）。

### 4. Web Pushプロトコル

- VAPIDキー（`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`）による標準のWeb Pushプロトコルを使用する。開発時は`.env.local`（gitignore済み）に保存し、`.dev.vars`はgit管理下のため実際の鍵は置かない。本番はWrangler環境変数（`VAPID_PUBLIC_KEY`）とGitHub Secrets（`VAPID_PRIVATE_KEY`はGitHub Secretsのみ）で供給する。
- Service Worker（`public/sw.js`）がクライアント側のプッシュ通知表示を担当する。

## Risks / Trade-offs

- **[Decided] Cookie/認証** → GHAランナーはユーザー認証しない。従来案の
  admin APIキー付きWorkerエンドポイントは廃止し、ランナーがwrangler経由でD1/KVを
  直接読む（refresh-event-data.ymlと同一の権限モデル）。Cloudflare APIトークンのみを
  GitHub Secretsで管理すればよく、公開HTTPサーフェスを増やさない。
- **[Decided] web-push暗号化によるCPU消費** → 暗号化・送信をGHAランナー
  （CPU無制限）で完結させることでWorkerのCPU予算問題を根本的に回避する。購読者増加時は
  スクリプト内でチャンク/並列度を調整するだけでスケールする。
- **[Risk] ブラウザのプッシュ制限（特にiOS Safari）** → **[Mitigation]** 標準的なPWAマニフェストのガイドラインに沿う。iOS Safariはサイトをホーム画面に追加した場合のみWeb Pushをサポートする。通知設定ページに、iOSユーザー向けにPWAのインストール手順（ホーム画面に追加）を案内する説明を追加する。**未実装（今回のスコープ外）**: このiOS向け案内文言は今回のタスクリスト（tasks.md）には含まれておらず、実装されていない。次回の関連changeで対応する。
