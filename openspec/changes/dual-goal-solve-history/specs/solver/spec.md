## ADDED Requirements

### Requirement: 2目標(必要分/ストック込み)の同時計算

システムは育成計算機(`goSolver`)からの周回計算において、**目標A(必要分)と目標B(必要分+バッファー)を同時に解いて両方を保存**しなければならない (SHALL)。目標A個数は各素材 `max(0, 必要数 − 所持)`、目標B個数は各素材 `effectiveDeficiency = max(0, 必要数 + buffer(item) − 所持)`(`lib/quest-efficiency.ts` の共有純関数)とする。両者とも 必要数・所持の双方を持つ取り込み元(`goSolver`)で算出 SHALL。これにより「必要数 ≤ 所持 < 必要数+buffer」の素材(base は充足だがストック分は不足=stock-only 素材)も目標Bに含まれる。目標Bは目標Aを包含する(B ⊇ A)。目標A・Bはそれぞれ `solveBoth`(AP最小・周回数最小)で解かれる。

#### Scenario: 2目標の同時計算と保存
- **WHEN** `stockEnabled=ON` かつ少なくとも1素材で `buffer(item)` により目標Bの個数が目標Aより増えるとき
- **THEN** 目標A(必要分)と目標B(必要分+バッファー)の双方が同一リクエスト内で計算され、両方が計算履歴に保存される。

#### Scenario: 目標Bが目標Aと一致する場合は単一計算
- **WHEN** `stockEnabled=OFF` のとき、または全素材で目標Bの実効個数が目標Aと等しい(バッファーの増分が実効ゼロ)とき
- **THEN** 目標Bは保存されず、目標Aのみが従来どおり単一の計算結果として保存される。

#### Scenario: 目標Bは取り込み元で effectiveDeficiency として算出
- **WHEN** 目標Bの個数を決定するとき
- **THEN** 各素材の目標B個数は `effectiveDeficiency = max(0, 必要数 + buffer(item) − 所持)` として算出され、`buffer(item)`・`stockBuffer` 値・レアリティ判定はクエスト効率と同一の純関数・値を共有する。

#### Scenario: stock-only 素材も目標Bに含まれる
- **WHEN** ある素材が `必要数 ≤ 所持 < 必要数 + buffer(item)`(目標Aでは不足ゼロだがストック分は不足)であるとき
- **THEN** その素材は目標Aには現れず(個数0で除外)、目標Bには `必要数 + buffer(item) − 所持` の個数で含まれる。

### Requirement: 2目標結果の進捗アンカー

システムは2目標計算において、進捗KPI・ダッシュボード・「あと何周」等の集計の基準(アンカー)を**目標A(必要分)**としなければならない (SHALL)。目標B(ストック込み)は比較・上乗せ表示のための補助であり、進捗の分母を膨らませてはならない (SHALL NOT)。

#### Scenario: 進捗は必要分をアンカーにする
- **WHEN** 2目標で計算・保存した結果から進捗スナップショットやKPIを算出するとき
- **THEN** 目標A(`stockIncluded=false`・nominal AP)の結果が基準として用いられ、目標Bは進捗の分母に含まれない。

## MODIFIED Requirements

### Requirement: 周回目標取り込みの余剰ストック追従

システムは育成計算機から周回ソルバーへ不足分を取り込む導線(`goSolver` → `/farming`)において、**目標A(必要分) `items=<max(0, 必要数 − 所持)>` と、`stockEnabled=ON` のとき目標B(ストック込み) `itemsStock=<effectiveDeficiency>` の双方を URL で渡す** SHALL。目標A・Bは 必要数・所持の双方を持つ `goSolver` で算出し、`/farming` はこれを受け取って `/api/solve` へ転送 SHALL(`/farming` 側では再導出しない)。`buffer(item)`・`stockBuffer`・レアリティ判定はクエスト効率と同一の値・関数を共有 SHALL。`stockEnabled=OFF`、または目標Bが目標Aと一致するときは `itemsStock` を渡さず目標Aのみで計算する。2目標で計算・保存した目標B行には `stockIncluded=true` を付与する。

#### Scenario: 取り込みは目標Aと目標Bを渡す
- **WHEN** `stockEnabled=ON` で周回ソルバーへ遷移し、目標Bが目標Aと異なるとき
- **THEN** `items=`(目標A=`max(0, 必要数 − 所持)`)と `itemsStock=`(目標B=`effectiveDeficiency`)の双方が `/farming` 経由で `/api/solve` に渡される。

#### Scenario: stockEnabled=OFF は目標Aのみを渡す
- **WHEN** `stockEnabled=OFF` で周回ソルバーへ遷移するとき
- **THEN** `items=`(目標A)のみが渡され、`itemsStock` は付与されない。

#### Scenario: クエスト効率の重み判定と一致
- **WHEN** 同じ `stockBuffer`・所持数・育成必要数で目標Bを導出する
- **THEN** 目標Bの個数は、クエスト効率がストック込み実効目標で不足と判定する量と整合する。

#### Scenario: ストック込み計算のフラグ付与
- **WHEN** `stockEnabled=ON` で2目標計算して保存する
- **THEN** 目標B行の計算パラメータに `stockIncluded=true` が記録される。
