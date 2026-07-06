## 1. セットアップとスキーマ更新

- [x] 1.1 `push_subscriptions`と`notification_log`のD1テーブルを定義するマイグレーション（`migrations/0004_todo_notifications.sql`）を作成する（両テーブル間にFK制約は張らない — `migrations/0001_init_schema.sql`にも前例が無く、削除処理はディスパッチャースクリプト側で明示的に行う）。
- [x] 1.2 Wranglerでローカルにマイグレーションを適用する。
- [x] 1.3 `TodoTask`・`TodoSettings`・DBスキーマ用の共通型（例: `types/todo.ts`）をプロジェクトに追加する。
- [x] 1.4 `web-push`依存を`package.json`に追加してインストールする。
- [x] 1.5 VAPIDキーを生成する。`VAPID_PUBLIC_KEY`はWorker側（クライアントへの購読情報配布用）が必要とする — `.env.local`（gitignore済み、`.dev.vars`はgit管理下のため実鍵は置かない）とWranglerシークレットに追加する。`VAPID_PRIVATE_KEY`はGHAディスパッチャースクリプト（5.6）のみが必要とするため、Wranglerではなく GitHub Secretsに設定する — ローカルでのディスパッチャー動作確認（6.3）用に`.env.local`にも追加する。
 
## 2. Service Workerと購読API

- [x] 2.1 標準の`push`イベントを受けてブラウザ通知を表示するService Workerファイル（`public/sw.js`）を作成する。
- [x] 2.2 アプリ初期化時（クライアント側layout/provider）にService Workerを登録する。
- [x] 2.3 購読の登録/解除を扱う`/api/notifications/subscribe` APIルートを実装する。認証済みセッション（`/api/cloud`と同じ`auth()`ガード）を必須とし、未認証時は401を返す（購読は`session.user.id`に紐づくため）。
- [x] 2.4 D1の`push_subscriptions`を読み書きするデータベースクライアントヘルパーを追加する。

## 3. クライアント側の自動生成と同期

- [x] 3.1 JSTの日/週境界判定・タスクID生成・開催中イベント判定を、**共有モジュール`lib/todo/period.ts`**内の純粋関数として実装する（フレームワーク/ランタイム依存のimportを持たない）。これによりGHAディスパッチャースクリプト（5.1）からも同じロジックをimportできる。
- [x] 3.2 デイリー・ウィークリー・イベント交換のTODOを自動的に埋めるクライアント側の自動生成ロジックを実装する。イベント交換の期限には`DashboardMeta.events[].shopFinishedAt`（`lib/master-data/types.ts`）を使う（現状`endedAt`のエイリアス。design.mdのNon-Goals参照）。
- [x] 3.3 `todoState`と`todoSettings`のキーをローカルストレージに追加し、統一クラウド同期フック（`hooks/use-cloud-sync.ts`の`KEYS`）を更新して`/api/cloud`経由でこれらのキーを保存・同期する。
- [x] 3.4 カテゴリごと（`autoDaily`/`autoWeekly`/`autoEvent`）の自動生成ON/OFFと、プッシュ通知の単一の統合トグル（`pushEnabled`）を切り替えられる設定UIセクションを実装する。

## 4. UIコンポーネントとダッシュボード統合

- [x] 4.1 shadcn/uiとTailwindを使って`components/todo/TodoWidget.tsx`コンポーネントを作成する。
- [x] 4.2 メインダッシュボード（`app/page.tsx`）の上部にTODOウィジェットを統合する。
- [x] 4.3 全タスクの閲覧・チェック・カスタムタスク追加ができる専用のTODOページ/モーダルを構築する。
- [x] 4.4 TODOページにカスタムタスクの作成・編集・削除UI（タイトル + 期限日時入力、UUID採番、`todoState`への永続化）を実装する。
- [x] 4.5 通知設定UIにおいて「プッシュ通知を有効にする」トグルを`useSession()`でゲーティングする: 未ログイン時はトグルを無効化し、「プッシュ通知にはログインが必要です」というメッセージと`signIn('google')`リンクを表示する（`components/common/auth-button.tsx`のパターンを再利用）。

## 5. 通知ディスパッチャー（GitHub Actions Nodeスクリプト）

- [x] 5.1 `scripts/send-todo-notifications.ts`で`lib/todo/period.ts`（3.1）を再利用し、各購読が期待するデイリー/ウィークリー/イベント/カスタムタスクを独立に再計算する — `todoState`に存在しないタスク（`completed: false`だけでなく）も未完了として扱う。自動生成タスクはクライアント描画時にしか実体化しないため。
- [x] 5.2 `scripts/send-todo-notifications.ts`を実装する: `wrangler d1 execute --remote`経由で`push_subscriptions`を取得し、各購読について`cloud:<userId>`（`todoState`/`todoSettings`）を読み、対応する`autoX`/`pushEnabled`設定が有効かつカテゴリごとの閾値内にあるタスクへ絞り込む。イベントの期限はKVキー`dashboard_meta`（`DashboardMeta.events[]`。`scripts/run-updater.ts` / `update-master-data.yml`が書き込む）から取得する。`event_data_json`は別物（ボックスガチャプランナー用の`EventPlannerEvent[]`）であり使わない — 実装時に`lib/get-dashboard-meta.ts`と`scripts/run-updater.ts`を読んで確認済み。
- [x] 5.3 送信前に`INSERT ... ON CONFLICT(subscription_id, notification_key) DO NOTHING`で`notification_log`へアトミックに挿入し、実際に行が追加された購読にのみ送信する（毎時実行が重複/リトライした場合の二重送信を防ぐ）。
- [x] 5.4 `web-push`ライブラリでVAPID暗号化と配信を実装する。すべてNodeスクリプト側で行う（Workerルートでは行わない）。
- [x] 5.5 404/410応答を受けたら、`push_subscriptions`から該当購読を削除し、`notification_log`の対応行も明示的に削除する（FKカスケードは無い — 1.1参照）。
- [x] 5.6 GitHub Actionsワークフローファイル（`.github/workflows/send-todo-notifications.yml`、毎時cron + `workflow_dispatch`）を作成し、`CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`・`VAPID_PUBLIC_KEY`・`VAPID_PRIVATE_KEY`をGitHub Secrets経由で供給する — スクリプトがwrangler経由で直接Cloudflareと通信するため、APIキーやHTTPエンドポイントは不要。

## 6. 検証とテスト

- [x] 6.1 JSTの日付境界判定とTODO自動生成ロジック（`lib/todo/period.ts`、クライアント・ディスパッチャー共有）のユニットテストを書く。
- [x] 6.2 疑似VAPID環境でローカルの購読/解除フローをテストする。**本番で代替検証済み（2026-07-05）**: 管理者が iPhone のホーム画面追加 PWA から実際に許可取得→購読→POST 登録に成功（ios-push-guidance change の調査時に確認）。**リポジトリ管理者による手動対応が必要** — ログイン済みGoogleセッションでの実際のブラウザ通知許可取得が必要で、エージェントによる自動化はできない。最終レビュー時にブラウザで認証ゲーティング（未ログイン時はトグル無効化＋サインイン導線、ログイン時はトグル有効化）は確認済みだが、実際の許可取得→購読→POSTの一連の流れはend-to-endで検証していない。
- [x] 6.3 `scripts/send-todo-notifications.ts`をローカル（開発用D1/KVを指定）で手動実行し、通知が届くことを確認する。**本番で代替検証済み（2026-07-06）**: 毎時の GitHub Actions ワークフロー（Send TODO deadline notifications）が本番シークレットで正常稼働していることを確認（ローカル実行は不要と判断しクローズ）。**リポジトリ管理者による手動対応が必要** — 本番相当のシークレット（`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`）を使い実際に`--remote`のCloudflareリソースに対してディスパッチャーを実行する必要があり、今回のセッションではエージェントが`--remote`に一切触れない方針のため意図的にスコープ外とした。重複防止insertのロジック自体（タスク6.4）はローカルD1で検証済み。
- [x] 6.4 `notification_log`の重複防止insertのテストを書く（同一`notification_key`を2回実行 → 最初のinsertのみ成功/送信は1回のみ）。
