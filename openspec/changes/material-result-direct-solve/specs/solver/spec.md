## MODIFIED Requirements

### Requirement: 周回目標取り込みの余剰ストック追従

システムは育成計算機の結果画面(`/material/result`)から周回ソルバーへ不足分を取り込む導線において、**目標A(必要分) `max(0, 必要数 − 所持)` と、`stockEnabled=ON` のとき目標B(ストック込み) `effectiveDeficiency` の双方を算出し、`/farming` を経由せず `/api/solve` へ直接送信する** SHALL。目標A・Bは 必要数・所持の双方を持つ `/material/result` 側(`goSolver`)で算出 SHALL。`buffer(item)`・`stockBuffer`・レアリティ判定はクエスト効率と同一の値・関数を共有 SHALL。`stockEnabled=OFF`、または目標Bが目標Aと一致するときは目標Bを送信せず目標Aのみで計算する。2目標で計算・保存した目標B行には `stockIncluded=true` を付与する。直接送信には、`/material/result` 上で選択された周回対象クエスト(`material`capabilityの「育成計算機結果画面での周回対象クエスト選択」要件)も含める SHALL。

#### Scenario: 取り込みは目標Aと目標Bを直接送信する
- **WHEN** `stockEnabled=ON` で`/material/result`から周回ソルバーへ送信し、目標Bが目標Aと異なるとき
- **THEN** 目標A(`max(0, 必要数 − 所持)`)と目標B(`effectiveDeficiency`)の双方が`/farming`を経由せず`/api/solve`へ直接渡される。

#### Scenario: stockEnabled=OFF は目標Aのみを送信する
- **WHEN** `stockEnabled=OFF` で`/material/result`から周回ソルバーへ送信するとき
- **THEN** 目標Aのみが送信され、目標Bは送信されない。

#### Scenario: クエスト効率の重み判定と一致
- **WHEN** 同じ `stockBuffer`・所持数・育成必要数で目標Bを導出する
- **THEN** 目標Bの個数は、クエスト効率がストック込み実効目標で不足と判定する量と整合する。

#### Scenario: ストック込み計算のフラグ付与
- **WHEN** `stockEnabled=ON` で2目標計算して保存する
- **THEN** 目標B行の計算パラメータに `stockIncluded=true` が記録される。

#### Scenario: 送信には選択中の周回対象クエストが含まれる
- **WHEN** `/material/result`で一部のクエストを除外した状態で送信するとき
- **THEN** `/api/solve`への送信には除外後の周回対象クエストが含まれ、除外したクエストは計算対象から外れる。

#### Scenario: /farmingへの直接アクセスは影響を受けない
- **WHEN** ユーザーが`/material/result`を経由せず`/farming`を直接開き、個数を手入力して送信するとき
- **THEN** 従来どおり`/farming`のフォームから`/api/solve`が呼ばれ、挙動に変化はない。この経路では目標B(ストック込み)は発生しない。
