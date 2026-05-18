## MODIFIED Requirements

### Requirement: キャンペーン情報の反映
システムは、開催中のキャンペーン情報を計算パラメータに反映できる呼び出しモードを提供しなければならない (SHALL)。ただしモードの選択は呼び出し側の責務とし、保存される計算結果には影響しない既定値を持たなければならない (SHALL)。

#### Scenario: AP 半減キャンペーンの実効値計算
- **WHEN** ソルバーが `applyCampaigns: true` で呼び出され、対象クエストが現在時刻で有効な questAp キャンペーンに含まれているとき
- **THEN** 該当クエストの AP は campaign 修正子（例: `multiplication value=500` → ×0.5、`fixedValue value=0` → 0）を適用した値を用いて最適化計算が行われる。
- **THEN** 結果オブジェクトの `quests[].ap` および `total_ap` は適用後（effective AP）の値となる。

#### Scenario: 適用前 (nominal) 計算の既定
- **WHEN** ソルバーが `applyCampaigns: false` で呼び出される、または `options` を省略して呼び出されたとき
- **THEN** AP 修正子は適用されず、`quests[].ap` および `total_ap` は drops バンドル上の原価 AP（campaign 未適用）に基づく値となる。
- **THEN** 計算履歴 / snapshot 保存経路など「キャンペーンに左右されない KPI」を扱う呼び出しはこのモードを使用する。

#### Scenario: 未対応 calcType のフォールバック
- **WHEN** campaign の `calcType` が `multiplication` / `fixedValue` 以外（例: `addition`, `none`, 未知の値）であるとき
- **THEN** 該当 campaign は無視され、対象クエストの AP は原価のまま用いられる。
- **THEN** 該当事象は将来の対応のためにログに記録される（実装詳細）。

## ADDED Requirements

### Requirement: 既存呼び出しの非破壊
システムは、`applyCampaigns` オプションを追加するにあたり、既存の `solve(drops, params)` 呼び出しが新オプションを意識しなくても従前と同一の振る舞いをすることを保証しなければならない (SHALL)。

#### Scenario: 旧シグネチャでの呼び出し
- **WHEN** 既存コードが `solve(drops, params)` または `solveBoth(drops, params)` を `options` なしで呼び出すとき
- **THEN** `applyCampaigns: false` 相当として動作し、計算結果は本変更導入前と同一になる。

### Requirement: 性能リグレッションの監視
システムは、ソルバーの実行時間が許容範囲内に収まっていることを継続的にテストで検証しなければならない (SHALL)。

#### Scenario: ベンチマークテストの存在
- **WHEN** CI またはローカルでテストスイートが実行されるとき
- **THEN** 代表的な入力規模（小: 3 items / 中: 10 items / 大: 30 items / 特大: 60 items）に対する `solve()` のベンチマークテストが存在し、各ケースで定めた上限ミリ秒を超えた場合にテストが失敗する。
