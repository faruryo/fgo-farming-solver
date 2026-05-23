## Context

`/farming/results/[id]` は計算履歴に保存された 1 件の結果を表示するページであり、新規計算直後と、計算履歴 (`/farming/history`) や外部共有 URL から戻ってきたとき、Twitter 経由で第三者が開いたとき、いずれの導線でも到達する。一方ページタイトルは固定で `計算結果` とだけ書かれており、「いま開いているこの結果が、いつ計算された (= いつ時点の drops / キャンペーン情報を元にした) ものか」を示す手掛かりがゼロである。

D1 スキーマ側には既に `farming_results.created_at DATETIME DEFAULT CURRENT_TIMESTAMP` が存在し (`migrations/0001_*.sql`)、保存時刻自体は自動的に記録されている。`lib/get-result.ts` が `SELECT result_data` で `created_at` カラムを **取得していないだけ** が問題なので、データ層の修正コストは最小である。

## Goals / Non-Goals

**Goals:**

- 結果ページのタイトル付近に保存時刻を視覚的に控えめだが確実に表示し、ユーザーが「これは今の結果か、過去の結果か」を即時判別できる。
- 旧形式 (legacy 単一 `Result`) と新形式 (AP / LAP の `BothResult`) どちらの結果ページでも同じ位置・同じ書式で表示する。
- ローカル開発時 (D1 なしのモック経路) でも UI 検証用に時刻表示が出ること。実時間 (`new Date().toISOString()`) を仮値として使う。
- `createdAt` が取れない・パース不能な場合に従来挙動 (時刻無し) へ非破壊フォールバック。

**Non-Goals:**

- `farming_results` スキーマ変更や追加カラム導入。`created_at` は既に存在するので読むだけ。
- ソルバー計算アルゴリズムや保存タイミング・保存形式の変更。
- 計算履歴 (`/farming/history`) 一覧側の表示変更。一覧側には既に行ごとの日付が出ているため本提案の対象外。
- 結果が依拠した **マスターデータバージョン** や **キャンペーン適用状況** の表示 (これは独立した将来課題)。
- 進捗レポート (`progress-visualizer`) の比較スナップショット時刻表示 (既に `compared snapshot timestamp` 対応済み)。

## Decisions

### D1. 表示場所はタイトル `<h1>` 内 inline span

**選択**: `c-page-title` の中に `<span className="text-xs font-normal text-muted-foreground ml-3">(計算日時: ...)</span>` を埋め込み、`createdAt` がパース成功した場合のみ描画する。

**理由**:

- タイトル横が最もユーザーが最初に視線を置く場所であり、「何のページか・いつのデータか」を一度に取れる。
- muted text + xs サイズで、メインタイトルの視認性を損なわず、必要な人だけが拾える「メタ情報」として機能する。
- 既に `c-page-header` 内に `c-result-actions` (`計算履歴` ボタン) や `c-back-btn` が存在し、レイアウト崩壊の心配がない。

**代替案**:

- ページ最下部や card ヘッダ内に出す → ユーザーが「いつのデータか」を確認するためにスクロールを強いる。却下。
- `ProgressReportPanel` の比較スナップショット時刻のように専用カードを設ける → タイトル横にあれば充分で、専用カードは情報過多。却下。

### D2. 書式は `M月D日 HH:MM` (現地時間)

**選択**: 年を省略し `M月D日 HH:MM` で表示する。タイムゾーンは `new Date(...)` の挙動に従ったブラウザローカルタイム。

**理由**:

- 結果が長期保存される頻度は低く (1〜2 ヶ月以内に再計算されるケースが大半)、年を出すと冗長。
- 「先週共有された URL を今開いた」「ちょうど数時間前に計算した」を主要判別軸とするなら、日付 + 時刻の粒度で十分。
- 既存の他画面 (履歴一覧やスナップショット表記) と表記の方向性を揃える。

**代替案**:

- ISO 文字列をそのまま表示 → 機械的・冗長。却下。
- 相対表記 (`3 時間前` 等) → タブを開いたまま放置すると古い情報を出し続ける副作用がある。却下。

### D3. `createdAt` は `getResult` で同梱して返す (アプリ層に経路差を漏らさない)

**選択**: `lib/get-result.ts` の戻り値型を `(Result | BothResult) & { createdAt?: string }` に拡張し、D1 経路では SELECT に `created_at` を追加、モック経路では `new Date().toISOString()` を補完して返す。

**理由**:

- 上位 (`app/farming/results/[id]/page.tsx`) は D1 / モックの違いを意識せず常に `createdAt` を扱える。
- 既存呼び出し (もしあれば) は `createdAt` を読まないだけで影響を受けない (オプショナルフィールド)。
- 経路の違いをコンポーネント側に漏らすと UI 側で `if (env.DB)` のような分岐が増えてしまうため、データ層で吸収する。

**代替案**: `<Page>` 側で `app/farming/results/[id]/page.tsx` の中で別 D1 クエリを発行 → クエリが二重になり性能・複雑度の双方で不利。却下。

### D4. `formatDate` ヘルパは `result.tsx` 内に閉じる

**選択**: `formatDate(isoStr?: string): string` を `components/farming/result.tsx` 内に定義し、`isoStr` が空文字・パース不能なら `''` を返す。

**理由**:

- 本機能専用の表示整形ロジックであり、共通化するほどの再利用先が現時点では存在しない。
- 進捗レポートの時刻表示 (`ProgressReportPanel`) と将来統合したくなったら、その時点で `lib/format-date.ts` などに昇格させればよい。

**代替案**: `Intl.DateTimeFormat` を採用 → ロケール対応上の利点はあるが、現状アプリは ja 固定で `M月D日` 表記を直接書きたいので採用しない。

### D5. ISO 文字列の `Z` 付与によるタイムゾーン解釈の安定化

**選択**: D1 が返す `created_at` は SQLite の `DATETIME` で、`YYYY-MM-DD HH:MM:SS` 形式 (タイムゾーン情報なし) で来る場合がある。`formatDate` 内で `T` 補完 + `Z` 付与により UTC として解釈し、`Date` 側で現地時間に変換させる。

**理由**:

- `farming_results.created_at DEFAULT CURRENT_TIMESTAMP` は SQLite では UTC で保存される。タイムゾーン無し文字列を `new Date(...)` に渡すと **ブラウザは現地時間として解釈** してしまうため、`Z` を付けない場合 9 時間ずれる。
- 既に ISO 形式 (`Z` 付き) で来るモック経路も同じヘルパを通すため、`endsWith('Z')` チェックで二重付与を回避。

**代替案**: D1 側で `strftime('%Y-%m-%dT%H:%M:%fZ', created_at)` を SELECT で整形 → SQL に表示ロジックが漏れるので嫌。クライアントで吸収する方が一貫性が高い。

## Risks / Trade-offs

[D1 の `created_at` が UTC である前提を将来誰かが変えた場合、9 時間ずれて表示される] → `getResult` の単体テストに「`2026-05-24T12:34:56Z` を返したとき表示が `5月24日 21:34` (JST) になる」相当のアサーションを置く。または UTC 解釈の前提を `lib/get-result.ts` のコメントで明示する。

[`formatDate` ヘルパが `result.tsx` 内に閉じているため、将来同種の表示が増えると重複が発生] → 重複が現実化した段階で `lib/format-date.ts` に切り出す。本変更時点では先回り抽象化しない。

[Twitter 共有 URL を時間差で開く第三者にとって、ブラウザのタイムゾーン依存表示は理解しづらい場合がある] → 本提案ではあくまで「結果の鮮度」を伝えるための補助情報なので、現地時間表示で十分。タイムゾーン併記は過剰。

## Migration Plan

1. `lib/get-result.ts` の戻り値を拡張し、D1 / モック双方で `createdAt` を返すように修正。
2. `app/farming/results/[id]/page.tsx` で `createdAt` を `<Page>` に伝搬。
3. `components/farming/result.tsx` の `PageProps` を拡張、`formatDate` を追加、`<h1>` 内に inline span を描画。
4. `pnpm run lint` / `pnpm run type-check` / `pnpm dev` で local 確認。
5. ローカル D1 シード経路 (`pnpm run seed:progress` 等で生成された結果データ) から開けるパスがあれば、そこで時刻表示を実機検証。
6. 既存結果 (`createdAt` が DB に既に存在するもの) には自動的に時刻が表示されるため、データ移行・バックフィル不要。

## Open Questions

- `formatDate` の表示書式は将来的に `M/D HH:MM` のような英字寄り表記に切り替える可能性があるか。今回は `M月D日` で進める。
- 履歴ページ (`/farming/history`) の日付表記と書式を完全に揃えるかどうか (現状未確認)。揃えるべきと判断したら同 PR で対応するか follow-up タスクにするかを実装段階で再評価。
