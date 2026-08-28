## 1. 日時ユーティリティの改善 (`lib/format-date.ts`)

- [x] 1.1 `lib/format-date.ts` に `parseUtcDate(str?: string | null): Date | null` を実装し、SQLite DATETIME 文字列（`YYYY-MM-DD HH:MM:SS`）および ISO 8601 文字列を確実に UTC としてパースできるようにする
- [x] 1.2 `lib/format-date.ts` の `formatDate` から `timeZone: 'Asia/Tokyo'` を除外し、ブラウザ/クライアント環境のローカルタイムゾーンで整形するように変更する
- [x] 1.3 `lib/format-date.test.ts` を更新・拡充し、`parseUtcDate` の単体テストおよび各フォーマット形式・クライアント tz での動作を検証する

## 2. 計算履歴一覧ページ (`app/farming/history/page.tsx`) の修正

- [x] 2.1 履歴一覧テーブルの日時セルで `parseUtcDate` / `formatDate` を用いて、UTC からクライアントのローカルタイムゾーンに変換した日時を表示する
- [x] 2.2 グルーピング（`groupByBatch`）や最新アイテム判定における `new Date(h.created_at)` 比較を `parseUtcDate` ベースに修正する

## 3. 計算履歴推移グラフ (`components/farming/FarmingHistoryChart.tsx`) の修正

- [x] 3.1 `deriveStockMeta`、期間フィルタリング、`baseData`、回帰直線計算における `new Date(h.created_at)` を `parseUtcDate` に統一する
- [x] 3.2 `CustomTooltip` および X 軸の `tickFormatter` で、正規化されたタイムスタンプからクライアントのローカル日時を表示する

## 4. 関連コンポーネントおよびテストの検証

- [x] 4.1 結果ページ (`components/farming/result.tsx`) およびクラウド同期 (`components/cloud/index.tsx`) での表示確認
- [x] 4.2 `pnpm run test`、`pnpm run type-check`、`pnpm run lint:ratchet` を実行し、全テストと型チェック・Lint が正常に通ることを確認する
