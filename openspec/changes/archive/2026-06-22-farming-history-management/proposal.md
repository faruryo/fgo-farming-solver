## Why

計算履歴（`/farming/history`）は閲覧専用で、誤った入力や不具合（例: 対象クエスト選択の破損）で生成された「変なデータ」を取り除く手段がない。壊れた履歴行はテーブルだけでなく消費AP推移グラフ（履歴ページ・結果ページ・ダッシュボード）のトレンドも汚染する。

また、履歴には目的・合計AP・合計周回数しか表示されず、**どのクエストを対象に計算したか**が分からない。今回の調査でも「保存済みクエスト選択の破損」が原因特定の鍵だったが、結果ページの埋め込みJSONを解析しないと判別できなかった。対象クエストの可視化はこの種の異常の発見を容易にする。

## What Changes

- **履歴の論理削除（soft delete）**
  - `farming_results` に `deleted_at` カラムを追加（D1 マイグレーション）。
  - `DELETE /api/farming/results/[id]`: 認証必須。自分の結果のみ `deleted_at` を設定（物理削除しない）。
  - `/api/farming/history` は `deleted_at IS NULL` の行のみ返す → テーブル・全グラフから自動的に除外。
  - 結果ページ（`/farming/results/[id]`）への直接アクセスは削除後も可能（共有リンクを壊さない）。
  - 履歴テーブルの各行に削除ボタン + 確認ダイアログ（shadcn AlertDialog）。
- **対象クエストの履歴表示**
  - 計算保存時（`/api/solve`）に対象クエストの要約を `quest_selection` カラム（JSON）として非正規化保存: 選択数/全体数 + 「選択・除外のうち少ない側」のクエスト名リスト（エリア名付き、上限付き）。
  - 短縮IDではなく**名前で保存**する（IDは世代間で不安定だったため。`result_data` がクエスト名を非正規化しているのと同じパターン）。
  - 履歴テーブルに「対象クエスト」列を追加: `238/304` 形式 + ポップオーバーで除外（または選択）クエスト一覧。旧データ（カラム NULL）は `—` 表示。

## Non-goals

- 削除済み履歴の復元 UI（論理削除のため将来追加可能だが今回は対象外）。
- 過去の履歴行への `quest_selection` の遡及付与（保存時の選択情報を後から正確に復元できないため）。
- 匿名ユーザー（`user_id = 'anonymous'`）の結果の削除（履歴に表示されないため不要）。

## Capabilities

### New Capabilities
- `farming-history`: 計算履歴の保存・一覧表示・論理削除・対象クエスト可視化

## Impact

- **DB**: `migrations/0002_farming_results_soft_delete.sql`（`deleted_at` / `quest_selection` カラム追加）
- **API**:
  - `app/api/farming/results/[id]/route.ts` に `DELETE` ハンドラ追加
  - `app/api/farming/history/route.ts` に `deleted_at IS NULL` フィルタと `quest_selection` の SELECT 追加
  - `app/api/solve/route.ts` の INSERT に `quest_selection` を追加
- **UI**: `app/farming/history/page.tsx`（削除ボタン・確認ダイアログ・対象クエスト列）
- **i18n**: `locales/` に削除・対象クエスト関連キー追加
- **モック**: `mocks/history.json` に `quest_selection` フィールド追加（dev 検証用）
