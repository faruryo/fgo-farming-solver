## ADDED Requirements

### Requirement: 推奨評価の余剰ストック追従

システムは配布アドバイザーの need(不足)算出を、グローバル設定 `stockEnabled` に追従して行う SHALL。`stockEnabled=ON` のとき各素材の need を共有純関数 `max(0, (育成必要数 + buffer(item)) − 所持)`、`OFF` のとき `max(0, 育成必要数 − 所持)` とする。`stockBuffer`・レアリティ判定はクエスト効率と同一の値・関数を共有 SHALL。これにより、ストックを狙うユーザーには配布/交換素材の推奨もストック込み不足で評価される。アドバイザーは現在 `stockEnabled=ON` であることをユーザーに示す SHALL。

#### Scenario: stockEnabled=ON はストック込みで評価
- **WHEN** `stockEnabled=ON` で配布アドバイザーが推奨を算出する
- **THEN** 各候補素材の価値は、ストック込み不足を周回ソルバーで解いたときの限界削減量で評価される

#### Scenario: stockEnabled=OFF は育成不足のみ
- **WHEN** `stockEnabled=OFF` で配布アドバイザーが推奨を算出する
- **THEN** 各候補素材の価値は育成不足のみに基づいて評価される

#### Scenario: ストック反映中の明示
- **WHEN** `stockEnabled=ON` の状態で配布アドバイザーを表示する
- **THEN** ストック込みで評価している旨が UI に示される
