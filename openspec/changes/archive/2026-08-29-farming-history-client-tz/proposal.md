## Why

計算履歴ページ（`/farming/history`）において、D1（SQLite）が返す `created_at`（UTC の `YYYY-MM-DD HH:MM:SS` 形式）をクライアントでパースする際、タイムゾーン指定（末尾 `Z`）がないためブラウザがローカル時刻として解釈してしまい、UTC からローカルタイムゾーン（例: JST では 9時間）ずれた誤った日時が表示される問題が発生していました。
また、既存の日時フォーマットヘルパー（`lib/format-date.ts`）は `Asia/Tokyo` 固定で実装されており、ユーザーのクライアント環境のタイムゾーン（ブラウザのローカルタイムゾーン）が反映されていませんでした。

本変更により、SQLite UTC 日時文字列を確実に UTC としてパース・正規化し、計算履歴一覧・推移グラフ・結果詳細・クラウド同期などの各画面でクライアントのタイムゾーンを反映した正確な日時を表示します。

## What Changes

- **日時パース・正規化の統一**: SQLite の DATETIME 文字列（`YYYY-MM-DD HH:MM:SS`）および ISO 8601 文字列を確実に UTC 日時として解釈するユーティリティ（または `formatDate` の拡張）を整備。
- **クライアントタイムゾーンの反映**: `lib/format-date.ts` の `Asia/Tokyo` ハードコードを解消し、閲覧しているクライアント（ブラウザ）のローカルタイムゾーンで日時をフォーマット。
- **計算履歴一覧 (`/farming/history`) の修正**: テーブル行の日時表示で UTC パース漏れを修正し、クライアント tz に基づく整形表示を適用。
- **計算履歴グラフ (`FarmingHistoryChart`) の修正**: グラフのフィルタリング、回帰直線計算、X 軸目盛り、ツールチップの日時パースおよび表示において、UTC パース漏れを修正しクライアント tz を反映。
- **結果ページ・クラウド同期の整合性維持**: 結果ページ (`/farming/results/[id]`) およびクラウド同期モーダル (`/cloud`) での日時表示もクライアント tz を反映。

## Capabilities

### New Capabilities
<!-- なし -->

### Modified Capabilities
- `farming-history`: 計算履歴の一覧表示および推移グラフにおいて、保存日時（UTC）をクライアント環境のローカルタイムゾーンで正確に解釈・表示する要件を追加。

## Impact

- **Affected Code**:
  - `lib/format-date.ts` / `lib/format-date.test.ts`
  - `app/farming/history/page.tsx`
  - `components/farming/FarmingHistoryChart.tsx`
  - `components/farming/result.tsx`
  - `components/cloud/index.tsx`
- **APIs / DB**: 既存の D1 スキーマ（`farming_results.created_at`）や API レスポンス形式への破壊的変更はありません。
