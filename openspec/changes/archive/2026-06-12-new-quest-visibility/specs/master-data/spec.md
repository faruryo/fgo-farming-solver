## ADDED Requirements

### Requirement: クエスト初登場日時の記録
システムは、クエストに新規の短縮IDを割り当てた日時を `id_registry` に記録し、公開ペイロードの該当クエストに `addedAt` として露出しなければならない (SHALL)。

#### Scenario: 新規クエストへの addedAt 付与
- **WHEN** レジストリに存在しないクエストへ新規IDが割り当てられたとき
- **THEN** 当該レジストリエントリに割当日時（ISO 8601）が記録され、公開ペイロードの `Quest.addedAt` に反映される。

#### Scenario: 既存クエストの addedAt 維持
- **WHEN** レジストリ一致によりIDが再利用されたとき
- **THEN** 既存の `addedAt` は変更されない。

#### Scenario: レジストリ合成時の非付与
- **WHEN** `id_registry` を持たない旧ペイロードからレジストリを合成するとき（移行初回）
- **THEN** 合成されたエントリに `addedAt` は付与されず、既存クエストが一斉に「新着」扱いになることはない。

#### Scenario: 派生計算への非影響
- **WHEN** `addedAt` のみが変化したとき
- **THEN** rarity AP テーブル等の指紋ベース再計算はトリガーされない（`addedAt` は指紋入力に含めない）。
