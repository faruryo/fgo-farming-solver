## MODIFIED Requirements

### Requirement: 新規入手サーヴァントによる必要AP増加分のオフセット
システムは、比較スナップショット間で新規に「所持」化されたサーヴァントを検出し、その rarity 別の推定APを `deltaAp` に足し戻して純粋進捗を計算しなければならない (SHALL)。新規検出は、比較対象スナップショットに chaldea state（material）が記録されている場合にのみ行い、記録が無い場合は新規 0 件として扱わなければならない (SHALL)。

#### Scenario: ガチャ後の進捗評価
- **WHEN** 比較スナップショット間で chaldea state の `disabled` が `true` から `false` に変化したサーヴァントが存在するとき
- **THEN** そのサーヴァントの rarity に応じた事前計算済み推定APを `deltaAp` に加算する。
- **THEN** オフセット適用後の値で tier 判定を行う。

#### Scenario: 比較対象に chaldea state が無い場合
- **WHEN** 比較対象スナップショットに chaldea state（material）が存在しない（`null`）とき
- **THEN** 新規サーヴァントを 0 件として扱い、`deltaAp` へのオフセットを加算しない。
- **THEN** 全所持サーヴァントを新規と誤判定して幻の進捗APを表示しない。
