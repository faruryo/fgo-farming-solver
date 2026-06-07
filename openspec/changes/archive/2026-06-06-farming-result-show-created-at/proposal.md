## Why

`/farming/results/[id]` の結果ページは「計算結果」とだけ表示しており、その結果が **いつ計算されたものか** がページ上に一切表示されない。ユーザーは計算履歴 (`/farming/history`) から戻ってきた直後でも、開いている結果が今日のものなのか・先週共有された URL なのか判別できず、古い結果を見て周回計画を組んでしまうリスクがある。共有 URL を Twitter 等で受け取った第三者にとっても「ドロップデータ・キャンペーン状況がいつ時点か」が不明だと結果の信頼度を判断できない。

## What Changes

- **MODIFIED**: `/farming/results/[id]` (`components/farming/result.tsx` の `Page`) のタイトル横に、その結果が D1 に保存された日時 (`farming_results.created_at`) を `M月D日 HH:MM` 形式で添える。ラベルは `(計算日時: ...)`。
- **MODIFIED**: `lib/get-result.ts` の戻り値型を `(Result | BothResult) & { createdAt?: string }` に拡張し、D1 から `created_at` カラムを併せて取得して返す。ローカルモック経路では取得時刻 (`new Date().toISOString()`) で埋める。
- **MODIFIED**: `app/farming/results/[id]/page.tsx` は `getResult` の戻り値から `createdAt` を取り出し、`<Page>` に `createdAt` prop として渡す。
- 旧形式 (legacy) の単一 `Result` 経路と、新形式 (`BothResult` = AP/LAP 両モード保持) のどちらの結果でも同じ位置に表示する。
- `createdAt` が欠落・パース不能なときは何も表示せず、計算結果タイトル自体は従来通り表示する (非破壊フォールバック)。

## Capabilities

### New Capabilities
- なし

### Modified Capabilities
- `solver`: 計算結果の表示要件に「保存時刻 (`createdAt`) をタイトル付近に併記する」要件を追加する。計算ロジック・保存スキーマには変更を加えない (`farming_results.created_at` は既に存在するカラムを読み出すのみ)。

## Impact

- **データ層**:
  - `lib/get-result.ts`: D1 SELECT 文に `created_at` を追加し、戻り値に `createdAt` を含める。
- **UI 層**:
  - `app/farming/results/[id]/page.tsx`: `createdAt` を `<Page>` に伝搬。
  - `components/farming/result.tsx`: `PageProps` に `createdAt?: string` を追加。`formatDate` ヘルパでローカルタイム表記に整形し、タイトル `<h1>` 内の `<span>` で muted text として表示。`legacyResult` 経路と `apResult/lapResult` 経路の両方に同じ表示を適用。
- **テスト**:
  - `lib/get-result.ts` に対する単体テスト追加 (D1 から `created_at` を読み出して返すこと / モック経路では現在時刻が入ること)。
  - `formatDate` ヘルパは pure function なので必要なら単体テスト化 (ISO 文字列・スペース区切り・タイムゾーン無し文字列のいずれでも正しく整形できること、不正値は空文字を返すこと)。
- **影響を受ける既存ファイル数**: 3 ファイル (`lib/get-result.ts`, `app/farming/results/[id]/page.tsx`, `components/farming/result.tsx`)。
- **後方互換**:
  - DB スキーマ変更なし。`created_at` カラムは `migrations/` 既存スキーマで設定済みの想定。
  - `createdAt` が無い古い経路ではタイトル右の日時表示を出さないだけで、結果表示全体は従来どおり動作する。
