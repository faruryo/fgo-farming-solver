## MODIFIED Requirements

### Requirement: 所持数と目標による個人最適化(2段階重み)

システムは各素材の重みを所持数(`posession`)・目標(`items`)・カテゴリ群×レア別余剰ストック(`stockBuffer`)・グローバル設定 `stockEnabled` から決定 SHALL。対象モードは「全部」「不足のみ」の2値を維持する。

素材のストック個数を `buffer(item) = stockBuffer[group(item)][rarity(item)]` と定義 SHALL。`group` は `isSkillStone`/`isMonumentOrPiece`(largeCategory)で「スキル石 / モニュピ / 通常素材」を判定し、`rarity` は `getRarityByCategory`(category)で金銀銅を判定する。実効目標を `effGoal = goal + (stockEnabled ? buffer(item) : 0)` と定義 SHALL。「不足のみ」モードでは:
- `owned < goal`(育成不足) → 重み **1**(主優先)
- `goal ≤ owned < effGoal`(余剰ストック範囲) → `stockEnabled=OFF` なら重み **0.3**(次点)、`stockEnabled=ON` なら重み **1**(目標に昇格)
- `owned ≥ effGoal`(ストック込み目標達成 / レア不明) → 重み **0**

`goal=0`(育成目標なし)の素材は `effGoal = stockEnabled ? buffer(item) : 0` となる。レアリティ不明素材はストック対象外(`buffer=0` 相当)とする SHALL。QP・絆はドロップデータに存在しないため寄与しない。「全部」モードでは `stockEnabled` に関わらず全対象素材を重み1とする SHALL。

#### Scenario: 育成不足は主優先
- **WHEN** ある素材の所持数が育成必要数未満で、不足のみモード
- **THEN** その素材は重み1で効率ポイントに寄与する

#### Scenario: ストックOFFは余剰を次点で拾う
- **WHEN** `stockEnabled=OFF`・不足のみモードで、所持数が育成必要数以上だが余剰がレア別 `stockBuffer` 以下
- **THEN** その素材は重み0.3(次点)で寄与する

#### Scenario: ストックONは余剰を目標に昇格
- **WHEN** `stockEnabled=ON`・不足のみモードで、所持数が `育成必要数 + buffer(item)` 未満
- **THEN** その素材は重み1(主優先)で寄与する(次点0.3にはならない)

#### Scenario: ストック込み目標に到達したら除外
- **WHEN** 不足のみモードで、所持数が `育成必要数 + (stockEnabled ? buffer(item) : 0)` 以上
- **THEN** その素材の重みは0となり寄与しない

#### Scenario: カテゴリ群でストック個数が異なる
- **WHEN** `stockEnabled=ON` で、金レアの通常素材(例: 竜の逆鱗)と金レアのスキル石(秘石)が同じ所持数である
- **THEN** それぞれ `stockBuffer['normal']['gold']` と `stockBuffer['skillStone']['gold']` の別個の上乗せで実効目標が判定される

#### Scenario: 育成目標ゼロ素材もONなら一定数狙う
- **WHEN** `stockEnabled=ON`・不足のみモードで、育成目標が無く所持数が `buffer(item)` 未満の素材がある
- **THEN** その素材は重み1で寄与する(全素材を一定数ストックする意図)

#### Scenario: 全部モード
- **WHEN** 全部モードが有効
- **THEN** 所持数・目標・`stockEnabled` に関わらず、ドロップする全素材が寄与する

### Requirement: レア別余剰しきい値

システムは余剰ストック(`stockBuffer`)を **カテゴリ群(通常素材 / スキル石 / モニュピ)× レア(金銀銅、モニュピは金銀のみ)** で保持 SHALL(ストレージキー `efficiency/stockBuffer`)。各群×レアに妥当なデフォルト値を持ち(通常素材は既存の金50/銀100/銅200を踏襲、スキル石/モニュピは大量消費を見込んだ既定)、ユーザーが数値で上書きでき、上書き値はクラウド同期される SHALL。既存 `efficiency/surplusThreshold`(flat 金銀銅)が存在する場合は通常素材群へ移行する SHALL。この値は `stockEnabled` によって強度が切り替わる: `OFF` では「次点(重み0.3)で拾う余剰の上限」、`ON` では「目標(重み1)に上乗せするストック個数」として解釈される。

#### Scenario: デフォルトで動作
- **WHEN** ユーザーが `stockBuffer` 未設定のまま一覧を開く
- **THEN** 各カテゴリ群×レアのデフォルト値で、`stockEnabled` に応じて次点(OFF)または目標上乗せ(ON)が行われる

#### Scenario: カテゴリ群ごとの調整
- **WHEN** ユーザーがスキル石(秘石/魔石/輝石)のストック個数を通常素材と別に設定する
- **THEN** スキル石はその群の値で、通常素材は通常素材群の値で、それぞれ独立に判定される

#### Scenario: 旧 surplusThreshold の移行
- **WHEN** 旧 `efficiency/surplusThreshold`(flat 金銀銅)のみが保存された状態でページを開く
- **THEN** その値が通常素材群へ移行され、通常素材の OFF 時(次点)挙動は従来と変わらない

## ADDED Requirements

### Requirement: 余剰ストックを目標に含めるグローバル設定(stockEnabled)

システムは「余剰ストックを目標に含める」グローバルトグル `stockEnabled`(boolean, 既定 OFF, クラウド同期, ストレージキー `efficiency/stockEnabled`)を提供 SHALL。トグルは所持数モーダル内の「ストック目標設定」専用セクションに、カテゴリ群×レアの `stockBuffer` 編集とまとめて1つだけ置き、画面ごとの個別トグルは設けない SHALL。`stockEnabled=ON` のとき、farming 方向の各機能(クエスト効率の重み、周回ソルバー取り込み、配布アドバイザー)が一括して実効目標 `育成必要数 + buffer(item)`(`buffer(item) = stockBuffer[group(item)][rarity(item)]`)を参照する。実効必要数・実効不足は共有の純関数で算出し、各機能が同一定義を用いる SHALL。育成達成が近い上級者向けのオプトインであり、既定では一般ユーザーの挙動・保存値を変えない。

#### Scenario: グローバルトグルの一括反映
- **WHEN** ユーザーが所持数モーダルで `stockEnabled` を ON にする
- **THEN** クエスト効率ランキング・周回ソルバー取り込み・配布アドバイザーが、いずれもストック込み実効目標で再計算される

#### Scenario: 既定はOFFで従来挙動
- **WHEN** ユーザーが `stockEnabled` を一度も設定していない
- **THEN** `stockEnabled=OFF` として、従来どおり育成目標(次点0.3バンド含む)で動作する

#### Scenario: 説明文のモード連動
- **WHEN** `stockEnabled=ON` で所持数モーダルを開く
- **THEN** `stockBuffer` が「目標へ上乗せするストック個数」として説明される

#### Scenario: 実効目標の共有
- **WHEN** 同一の `stockBuffer`・所持数・育成必要数で、クエスト効率が不足と判定する量と周回ソルバー取り込みが渡す量を比較する
- **THEN** 両者は同じ共有純関数(`実効不足 = max(0, 育成必要数 + buffer(item) − 所持)`)に基づき一致する
