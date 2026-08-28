## Context

周回計算結果は Cloudflare D1（SQLite）の `farming_results` テーブルに保存され、`created_at` カラムには SQLite の `CURRENT_TIMESTAMP`（UTC の `YYYY-MM-DD HH:MM:SS` 形式）が記録されます。
一方、計算履歴一覧（`app/farming/history/page.tsx`）や履歴グラフ（`components/farming/FarmingHistoryChart.tsx`）では、`new Date(item.created_at)` と直接パースしていたため、末尾 `Z` がない文字列がブラウザのローカル時刻として解釈され、UTC から 9 時間ずれた時刻が表示されていました。
また、`lib/format-date.ts` は `timeZone: 'Asia/Tokyo'` がハードコードされており、海外ユーザー等のクライアント環境タイムゾーンが反映されていませんでした。

## Goals / Non-Goals

**Goals:**
- SQLite DATETIME 文字列（`YYYY-MM-DD HH:MM:SS`）および ISO 8601 文字列を確実に UTC 日時として解釈する共通関数（`parseUtcDate`）を整備する。
- `lib/format-date.ts` のタイムゾーン固定を解除し、閲覧環境（クライアント）のタイムゾーンを反映した日時フォーマットを提供する。
- 計算履歴一覧テーブル、推移グラフ（ツールチップ、X 軸目盛り、期間フィルタリング、達成予想日）、結果詳細ページ、クラウド同期画面において、統一された正確なクライアントタイムゾーン表示を実現する。
- 単体テスト（`lib/format-date.test.ts`）で様々な日時文字列形式（SQLite DATETIME、ISO Z、ミリ秒付き、不正値等）が確実にパース・変換されることを検証する。

**Non-Goals:**
- D1 データベーススキーマや過去の保存データの変更・マイグレーション（UTC で保存されていること自体は正常なため不要）。
- ユーザーごとのタイムゾーン手動設定 UI の追加（ブラウザ環境のタイムゾーンを自動反映するため不要）。

## Decisions

### 1. UTC 日時パース関数 `parseUtcDate` の新設・共通化
- **選択**: `lib/format-date.ts` に `parseUtcDate(dateStr?: string | null): Date | null` を定義・エクスポートする。
- **処理内容**:
  1. 引数が falsy の場合は `null` を返す。
  2. スペース区切りの場合（`YYYY-MM-DD HH:MM:SS`）は `T` に置換する。
  3. 末尾に `Z` またはタイムゾーンオフセット（`+` / `-`）がない場合、末尾に `Z` を付与して UTC として明示する。
  4. `new Date(...)` を生成し、`isNaN(d.getTime())` の場合は `null` を返す。
- **代替案**: 各コンポーネント内で個別に `.replace(' ', 'T') + 'Z'` する案 → 重複・漏れのリスクが高いため共通関数化する。

### 2. `formatDate` のクライアントタイムゾーン対応
- **選択**: `Intl.DateTimeFormat` の `timeZone: 'Asia/Tokyo'` を削除し、ブラウザのデフォルトタイムゾーンを使用する。
- **書式**: 既存の `M月D日 HH:MM`（またはロケールに応じた表示）の形式を保ちつつ、クライアントのローカルタイムゾーンで時・分を算出する。
- **パース**: 内部で `parseUtcDate` を使用して安全に Date オブジェクトへ変換する。

### 3. 計算履歴一覧（`app/farming/history/page.tsx`）の修正
- **テーブルの日時セル**: `formatDate(item.created_at)` または `parseUtcDate` を用いて、クライアント tz に沿った見やすい日時形式で表示する。
- **ソート・グルーピング・比較処理**: `new Date(h.created_at)` を `parseUtcDate(h.created_at)`（またはそのタイムスタンプ）に置き換え、正確な UTC 時系列比較を保証する。

### 4. 計算履歴グラフ（`FarmingHistoryChart.tsx`）の修正
- **データマッピング**: `baseData` や `regressionData` のタイムスタンプ算出を `parseUtcDate(h.created_at)?.getTime()` で統一する。
- **期間フィルタ**: `startTime` との比較を UTC タイムスタンプ基準で正しく行う。
- **ツールチップ・X 軸目盛り**: `timestamp` から `new Date(timestamp).toLocaleString()` / `toLocaleDateString()` でクライアントのローカル日時を表示する。

## Risks / Trade-offs

- **[ハイドレーション不一致（Hydration Mismatch）のリスク]** → `HistoryPage`、`FarmingHistoryChart`、`result.tsx` は `'use client'` であり、かつ履歴データはクライアント側の `fetch`（`useEffect`）またはクライアント遷移で取得・描画されるため、SSR と CSR の差異によるハイドレーションエラーは発生しない。
- **[テスト環境（CI / Vitest）でのタイムゾーン差異]** → `Intl.DateTimeFormat` や `toLocaleDateString` の単体テストにおいて、ローカル tz に依存するアサーションは、テスト実行環境の tz に応じた相対検証または UTC 基準での変換検証を行う。
