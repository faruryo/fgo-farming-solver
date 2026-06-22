## ADDED Requirements

### Requirement: 周回目標取り込みの余剰ストック追従

システムは育成計算機から周回ソルバーへ不足分を取り込む導線(`goSolver` → `/farming?items=...`)において、グローバル設定 `stockEnabled` に追従して取り込み個数を算出 SHALL。`stockEnabled=ON` のとき各素材の取り込み個数を共有純関数 `max(0, (育成必要数 + buffer(item)) − 所持)`、`OFF` のとき `max(0, 育成必要数 − 所持)` とする。`stockBuffer`・レアリティ判定はクエスト効率と同一の値・関数を共有 SHALL。ストック上乗せは育成必要数(目標)がある素材に対して行い、別途の取り込み専用トグルは持たない SHALL。取り込み時、ストック込みで遷移した場合は計算パラメータに `stockIncluded=true` を付与する。

#### Scenario: stockEnabled=ON はストック込みで取り込む
- **WHEN** `stockEnabled=ON` で周回ソルバーへ遷移する
- **THEN** 各素材は `育成必要数 + buffer(item) − 所持`(0未満は0)を目標個数として `/farming` に渡される

#### Scenario: stockEnabled=OFF は従来どおり
- **WHEN** `stockEnabled=OFF` で周回ソルバーへ遷移する
- **THEN** 各素材は `育成必要数 − 所持`(0未満は0)を目標個数として渡される

#### Scenario: クエスト効率の重み判定と一致
- **WHEN** 同じ `stockBuffer`・所持数・育成必要数で取り込む
- **THEN** 渡される目標個数は、クエスト効率がストック込み実効目標で不足と判定する量と整合する

#### Scenario: ストック込み遷移のフラグ付与
- **WHEN** `stockEnabled=ON` で周回ソルバーへ遷移して計算・保存する
- **THEN** 計算パラメータに `stockIncluded=true` が記録される
