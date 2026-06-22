## ADDED Requirements

### Requirement: 育成計算機結果のストック込み不足の副表示

システムは育成計算機の結果(`/material/result`)において、育成必要数/不足を主表示として維持 SHALL。保存値 `material/result`(育成必要数, Atlas ID キー)はストックで書き換えない SHALL。グローバル設定 `stockEnabled=ON` のときのみ、各素材に「+ストック分」(=`buffer(item)`)を含めた目標/不足を控えめに副表示する SHALL。`stockEnabled=OFF` のときは従来どおり育成必要数/不足のみを表示する。

#### Scenario: 既定は育成必要数のみ
- **WHEN** `stockEnabled=OFF` で育成計算機の結果を表示する
- **THEN** 各素材は育成必要数/不足のみが表示され、表示は従来と変わらない

#### Scenario: stockEnabled=ON で副表示
- **WHEN** `stockEnabled=ON` で育成計算機の結果を表示する
- **THEN** 育成必要数/不足を主としつつ、ストック込み目標(育成必要数 + `buffer(item)`)が控えめに併記される

#### Scenario: 保存値は不変
- **WHEN** `stockEnabled` を切り替える
- **THEN** `material/result`(育成必要数)の保存値は変化しない(ストックは表示・取り込み時に計算)
