## Why

進捗パネルが何度アクセスしても `tier: none` ＝「今日はここまで、で大丈夫です」のまま固定され、実際の周回成果（残りAP減少・育成総量）が一切反映されない不具合が本番で発生している。

本番 D1 (`state_snapshots`) を実調査して原因を確定した（`user_id = 118314056864811158814`）:

| created_at | サイズ | material | posession | 由来 |
|---|---|---|---|---|
| 2026-06-06 17:04 | 191KB | ✓ | ✓ | 正常（フル保存） |
| 2026-06-03 / 06-02 | 191KB | ✓ | ✓ | 正常 |
| **2026-05-30 07:41** | **1.4KB** | **✗** | **✗** | 旧 `/api/solve` が書いた `{items,quests}` のみのレガシー残骸 |
| 2026-05-24 / 05-23 / 06-01 | 1.4KB | ✗ | ✗ | 同上 |

`/api/progress` の期間解決では `week`（7日前以前で最新）が **2026-05-30 のレガシー残骸**に解決される。`selectBaseline` は「fallback の無い最も古い期間」を優先するが、**snapshot が non-null でありさえすれば（中身が空でも）有効な比較基準とみなす**ため、`material` も `posession` も持たない 05-30 の残骸を採用し、本来比較したい 06-06 のフルデータ（`previous`）を無視してしまう。

結果:
- baseline に `pastPosession` が無い → クライアントの reducedAp 再ソルブがスキップ（`use-progress-report.ts`）→ サーバスタブの `tier: 'none'` が上書きされず残る。
- baseline に `material` が無い → `growthTotal = 0`、サーヴァント成長も空。
- → メッセージは `apProgress.none` 固定、表示は「マシュのセリフ + tier:none + 経過時間」だけになる。

経過時間も計算が一致する: 05-30 07:41:52 → 06-06 17:04 ≒ **10643 分**（ユーザー報告値と完全一致）。

書き込み側（`/api/solve`）は既に material-less スナップショットを書かないよう修正済みのため、上記 4 行は過去の残骸で新規発生はない。読み取り側がこの残骸を「有効な比較基準」とみなしてしまう点が本不具合の本質。

## What Changes

中身の無いスナップショット（`material` も `posession` も持たないもの = "degenerate"）を比較基準として採用しないよう、サーバ・クライアント・既存データの 3 層で対処する。

- **MODIFIED (サーバ／根治)**: `lib/progress/summary.ts` の `buildPeriodSummary` で、スナップショットが存在しても `material`・`posession` のどちらも持たない場合は比較不能として `fallback: 'no_snapshot_for_period'` を返す（実比較できる指標が一つも無いため）。これにより、今後どのようなレガシー残骸が来ても比較基準に選ばれない。
- **MODIFIED (クライアント／多層防御)**: `lib/progress/select-baseline.ts` の `selectBaseline` を、`fallback` が無いことに加えて「比較に使える中身がある（`material` または `pastPosession` のいずれかを持つ）期間」を採用条件とし、サーバ側判定とずれても degenerate を選ばないようにする。
- **DATA CLEANUP（後始末）**: 本番 D1 の既存レガシー残骸 4 行（`118314056864811158814:2026-05-23 / 05-24 / 05-30 / 06-01`）を、コード修正のマージ・デプロイ後に削除する。コードが直っていれば削除しなくても表示は正常化するが、ノイズ除去として実施する。

degenerate の判定基準は「`material` と `posession` の**どちらも無い**」とする。`material` だけある（育成成長は出せる）スナップショットは比較基準として活かす。

## Capabilities

### New Capabilities
- なし

### Modified Capabilities
- `progress-visualizer`: 「最古スナップショットを基準とした単一比較」要件に、`material` も `posession` も持たない degenerate スナップショットは比較基準として採用しない旨を追加する。比較指標の算出ロジック自体は変更しない。

## Impact

- **データ層**:
  - `lib/progress/summary.ts`: `buildPeriodSummary` で degenerate 判定を追加し fallback を返す。
- **UI/選定層**:
  - `lib/progress/select-baseline.ts`: 採用条件に「使える中身がある」判定を追加。
- **テスト**:
  - `lib/progress/summary.test.ts`: degenerate スナップショット（material/posession 双方欠落）が fallback 扱いになること。
  - `lib/progress/select-baseline.test.ts`: degenerate な期間が baseline に選ばれず、フルデータの期間が採用されること。
- **本番データ**:
  - レガシー残骸 4 行の DELETE（マージ後、`wrangler d1 execute --remote`）。
- **影響を受ける既存ファイル数**: 2 ファイル（`lib/progress/summary.ts`, `lib/progress/select-baseline.ts`）＋テスト 2 ファイル。
- **後方互換**:
  - DB スキーマ変更なし。`material` または `posession` を持つ正常スナップショットの挙動は不変。
  - degenerate しか存在しない初期ユーザーは従来どおり `no_snapshot_for_period` 系メッセージとなり、破壊的変化はない。
