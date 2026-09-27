# Tasks: 周回計算結果の公開・非公開設定

## 1. Database & Data Access Layer

- [x] 1.1 `migrations/0005_farming_results_visibility.sql` を作成し、`farming_results` に `is_public INTEGER NOT NULL DEFAULT 1` を追加する。また参照スキーマ `db/schema.sql` にも同期する。
- [x] 1.2 `lib/get-result.ts` を修正し、`is_public` を含めた上で、非所有者による非公開アクセスの拒否（エラー送出）と所有者判定（`isOwner`）を実装する（共有リンク維持のため `deleted_at` 条件は除外）。
- [x] 1.3 `lib/get-result.test.ts` を作成または拡充し、公開行・所有者による非公開行・第三者による非公開行の取得挙動および `userId` 非露出を検証するテストを通す。

## 2. Backend API Routes

- [x] 2.1 `app/api/solve/route.ts` を修正し、リクエストパラメータから公開設定を受け取って D1 保存時に `is_public`（未ログイン時の非公開要求は 401 fail-closed、batch_id ペア時は両行）を保存する。
- [x] 2.2 `app/api/farming/results/[id]/route.ts` に `PATCH` ハンドラを実装し、セッション検証・所有者検証・`batch_id` 連動更新を含む公開・非公開状態の切り替えを実装する。
- [x] 2.3 `app/api/farming/results/[id]/route.ts` の `GET` ハンドラに認証セッション連携と非公開時の 404 判定を統合する。
- [x] 2.4 API ルートのユニットテスト（`app/api/farming/results/[id]/route.test.ts` および `app/api/solve/route.test.ts`）を作成または更新して検証する。

## 3. Frontend UI & Settings

- [x] 3.1 `lib/constants/storage-keys.ts` に `FARMING_RESULT_DEFAULT_PUBLIC` を追加し、`components/farming/index.tsx` のオプション欄に既定公開設定の切り替え UI を追加する。
- [x] 3.2 `app/farming/results/[id]/page.tsx` で `auth()` セッションを取得し、`isOwner`、`isPublic`、`resultId` を `Page` コンポーネントへ渡す。
- [x] 3.3 `components/farming/result.tsx` に所有者限定の公開/非公開切り替えスイッチと `PATCH` API 呼び出し処理を実装する。
- [x] 3.4 `components/farming/result.tsx` で非公開結果（`isPublic === false`）におけるツイートボタンの非表示制御を実装する。
- [x] 3.5 `locales/ja.json` および `locales/en.json` に公開設定・トグル・通知用の i18n キーを追加する。
- [x] 3.6 `components/farming/result.test.tsx` を作成または更新し、所有者時のトグル表示、非所有者時の非表示、ツイートボタンの出し分けを検証する。

## 4. Verification & Quality Checks

- [x] 4.1 `pnpm run type-check` および `pnpm test` を実行し、型チェックと全ユニットテストが成功することを確認する。
- [x] 4.2 `pnpm run lint:ratchet` を実行し、lint エラーや警告の増加がないことを確認する。
- [x] 4.3 ブラウザ実画面（またはローカル環境）にて `/farming` での設定変更、計算後の `/farming/results/[id]` でのトグル切り替え、ツイートボタンの表示/非表示を確認する。
