## Why

進捗パネルの比較相手(baseline)が「今日0時より前で最も新しいスナップショット」=直近の前日に固定されていた。そのため「昨日farmして今日見る」と、昨日の成果は既にスナップショットに取り込まれており、現在(ライブ)と昨日スナップショットがほぼ同一になって**進捗ゼロ**に見える、という不整合があった。

ユーザーの要望: 比較は「**今(ライブ状態)** ⟷ **約1ヶ月前に最も近い過去スナップショット**」の2点で行いたい。起点は常に今日に近いライブ状態、相手は最長で1ヶ月程度さかのぼった点とし、できるだけ長い期間の積み上げを見せる。ちょうど30日前のデータは通常存在しないため、30日前に最も近いものを採る。

## What Changes

- **MODIFIED**: `lib/progress/snapshot.ts` の `fetchAllSnapshotsByPeriod` を、previous/week/month の3バケット(固定年齢しきい値)から、**「約1ヶ月前(30日前)に最も近いスナップショット1つ」**を baseline として選ぶ方式へ変更。選定は純関数 `selectBaselineRow(rows, nowMs)`(30日前との時刻差が最小の行)に切り出す。week/month スロットは `null` を返す。
  - 手持ちが全て直近(<1ヶ月)なら最も古いものが選ばれる(最長比較)。
  - データが貯まれば約1ヶ月前のものへ寄る。
- **REMOVED**: 旧バケット選定の `fetchSnapshotByPeriod`(単数)と未使用ヘルパ(`daysAgo`)を削除。
- baseline は常に `previous` スロットに載り、比較時点ラベルは経過日数(`N日前`)で表示(既存 `compareLabel` の動的経路)。
- 「今(ライブ状態)」が比較の起点である点は不変(`/api/progress` は現在の localStorage 状態を受け取り、enriched がスループット/reducedAp を算出)。

## Capabilities

### Modified Capabilities
- `progress-visualizer`: 単一比較の baseline 選定を「実比較できる最古の固定バケット」から「約1ヶ月前に最も近いスナップショット」へ変更する。

## Impact

- **データ層**: `lib/progress/snapshot.ts`(選定ロジック)。
- **テスト**: `lib/progress/snapshot.test.ts`(`selectBaselineRow` の近接選定)。
- **後方互換**: 応答形(previous/week/month)は維持(week/month は null)。`selectBaseline`(クライアント)は previous を採用。degenerate 除外・zero_progress 優先などの既存ガードは不変。
