# Tasks: farming-history-management

## 1. DB マイグレーション

- [x] 1.1 `migrations/0002_farming_results_soft_delete.sql` を作成（`deleted_at` / `quest_selection` の ALTER TABLE）
- [x] 1.2 ローカル D1 に適用し、既存行（NULL）と新規行で動作確認

## 2. API

- [x] 2.1 `app/api/solve/route.ts`: `QuestSelection` 要約（total/selected/mode/quests 上限100/truncated）を構築し INSERT に追加
- [x] 2.2 `app/api/farming/results/[id]/route.ts`: `DELETE` ハンドラ追加（認証・所有者チェック・`deleted_at` 設定・404/401 ハンドリング・dev no-op）
- [x] 2.3 `app/api/farming/history/route.ts`: `deleted_at IS NULL` フィルタと `quest_selection` カラムを SELECT に追加
- [x] 2.4 `mocks/history.json` に `quest_selection` フィールドを追加（excluded 少数 / selected 少数 / NULL の3パターン）

## 3. UI

- [x] 3.1 `app/farming/history/page.tsx`: 「対象クエスト」列を追加（`selected/total` Badge + Popover でクエスト一覧、NULL は `—`）
- [x] 3.2 同ページに削除ボタン + AlertDialog 確認 → DELETE 呼び出し → 成功時に行を state から除去、失敗時に通知
- [x] 3.3 `components/farming/FarmingHistoryChart.tsx` の `HistoryItem` 型に `quest_selection?: string` を追加
- [x] 3.4 i18n キーを `locales/` に追加（ja/en）

## 4. 検証

- [x] 4.1 `pnpm run type-check` / `pnpm run lint` 通過
- [x] 4.2 dev でモック履歴の表示（対象クエスト列・3パターン）を視認（UI 変更のため push 前にブラウザ確認）
- [x] 4.3 ローカル D1 で: solve 実行 → 履歴に quest_selection 表示 → 削除 → 一覧/グラフから消える → 結果ページ直リンクは引き続き 200
- [x] 4.4 他ユーザーの結果 ID への DELETE が 404 になることを確認
- [x] 4.5 `openspec validate farming-history-management` 通過
- [x] 4.6 本番マイグレーション適用（`wrangler d1 migrations apply --remote`）をデプロイ前に実施
  - 手動不要: `.github/workflows/deploy.yml` の `deploy-main` ジョブが「Run D1 Database Migrations」ステップで `d1 migrations apply fgo-farming-solver-db --remote` をデプロイステップの前に自動実行する。`main` への push で正しい順序（マイグレーション→デプロイ）が保証される。
