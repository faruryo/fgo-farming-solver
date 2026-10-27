## ADDED Requirements

### Requirement: サーヴァントのコストの蒸留

システムはサーヴァントの編成コストを `cost` として蒸留しなければならない (SHALL)。`cost` は0以上の整数でなければならず、条件を満たさないサーヴァントは `cost` を省いて蒸留し、それを理由に候補カタログ全体を拒否してはならない (SHALL NOT)。`cost` の追加は既存の consumer と互換であり、キーとスキーマバージョンを変えてはならない (SHALL NOT)。

#### Scenario: 正常なコスト
- **WHEN** `nice_servant.json` の★5サーヴァントがコスト16を持つ
- **THEN** 蒸留後のそのサーヴァントに `cost` 16 が含まれる

#### Scenario: コストが0のサーヴァント
- **WHEN** `nice_servant.json` のサーヴァントがコスト0を持つ(例: マシュ・キリエライト)
- **THEN** 蒸留後のそのサーヴァントに `cost` 0 が含まれる

#### Scenario: 不正なコスト
- **WHEN** あるサーヴァントのコストが欠落している、または負値・非整数である
- **THEN** そのサーヴァントは `cost` なしで蒸留され、他の検証を通過すれば候補カタログは保存される

### Requirement: 絆礼装の一覧の蒸留

システムは Atlas Academy の JP 概念礼装データ(`nice_equip.json`)から、獲得絆を増やす効果を持つ概念礼装を絆礼装の一覧として蒸留し、Material Catalog に含めなければならない (SHALL)。一覧の各礼装は、ID、図鑑番号、名前、レアリティ、コスト、表示用の顔画像 URL、効果の対象(パーティ全体か装備したサーヴァント自身か)、最大解放時の獲得絆の増加率(千分率)と固定の増加量を持たなければならない (SHALL)。

特定のイベントの間だけ効く効果、特定の特性を持つサーヴァントにだけ効く効果は蒸留してはならない (SHALL NOT)。獲得絆を増やす効果がそれしかない礼装は一覧に含めてはならない (SHALL NOT)。最大解放で効果が変わる礼装は最大解放時の値を、変わらない礼装はその値を使わなければならない (SHALL)。

`nice_equip.json` は保存済みの ETag / Last-Modified を使って条件付き GET で取得し、`304 Not Modified` のときは parse せず、既存の検証済みカタログの絆礼装の一覧を再利用しなければならない (SHALL)。絆礼装の一覧の追加は既存の consumer と互換であり、キーとスキーマバージョンを変えてはならない (SHALL NOT)。

書き込む前に、絆礼装の ID の一意性、名前と顔画像 URL が空でないこと、コストが正の整数であること、増加率と増加量が有限の0以上の値でいずれかが正であることを検証し、満たさない候補カタログを拒否して既存の `material_catalog_v1` を保持しなければならない (SHALL)。既存の正常なカタログに対して絆礼装の件数が20%超減少する候補を受理してはならない (SHALL NOT)。

#### Scenario: パーティ全体の増加率を持つ礼装
- **WHEN** `nice_equip.json` の礼装が、パーティ全体の獲得絆を未解放で2%、最大解放で10%増やす効果を持つ
- **THEN** 蒸留後の一覧にその礼装が対象パーティ全体、増加率100、固定の増加量0として含まれる

#### Scenario: 自身の固定値を持つ礼装
- **WHEN** 礼装が、装備したサーヴァント自身の獲得絆を50増やす効果だけを持ち、最大解放で効果が変わらない
- **THEN** 蒸留後の一覧にその礼装が対象自身、増加率0、固定の増加量50として含まれる

#### Scenario: イベント限定の効果を除く
- **WHEN** 礼装の獲得絆を増やす効果が、特定のイベントの間だけ効くものしかない
- **THEN** その礼装は絆礼装の一覧に含まれない

#### Scenario: 概念礼装データが未変更
- **WHEN** `nice_equip.json` の条件付き GET が `304 Not Modified` を返し、既存カタログが絆礼装の一覧を持つ
- **THEN** updater は `nice_equip.json` を parse せず、既存の絆礼装の一覧を候補カタログに引き継ぐ

#### Scenario: 不正な絆礼装を拒否する
- **WHEN** 候補カタログの絆礼装に、コストが0の礼装、または増加率と増加量がともに0の礼装が含まれる
- **THEN** updater は KV への書き込みを行わず、既存の `material_catalog_v1` を保持する

## MODIFIED Requirements

### Requirement: バージョン付き Material Catalog の生成

システムは、Atlas Academy の JP サーヴァント・育成素材・アイテム・概念礼装データから、育成素材計算機と絆トラッカーに必要な項目だけを含む `schemaVersion: 1` の Material Catalog を生成し、`MASTER_DATA` namespace の単一キー `material_catalog_v1` に保存しなければならない (SHALL)。カタログは `updatedAt`、取得元の ETag / Last-Modified、サーヴァント一覧、サーヴァント別素材、表示用アイテム一覧、絆礼装の一覧を含み、すべて同一の更新単位として扱わなければならない (SHALL)。

#### Scenario: 正常な入力から単一スナップショットを生成する

- **WHEN** Atlas Academy のサーヴァントデータ、アイテムデータ、概念礼装データが正常に取得され、検証を通過したとき
- **THEN** `servants`、`materials`、`items`、絆礼装の一覧、`schemaVersion`、`updatedAt`、取得元検証子を含むカタログが 1 つの KV 値として保存される。
- **THEN** 利用者は異なる更新世代のサーヴァント情報・素材・アイテム情報・絆礼装を組み合わせて受け取らない。

#### Scenario: 表示に不要なアセットを除外する

- **WHEN** Atlas Academy の `nice_servant.json` からサーヴァント表示情報を蒸留するとき
- **THEN** 各サーヴァントには `id`、`name`、`className`、`collectionNo`、`rarity` と、カードで使用する代表顔画像 URL だけが含まれ、有効な絆Lv別の累積必要ポイントを持つサーヴァントにはそれに加えて `bondGrowth` が、有効な編成コストを持つサーヴァントには `cost` が含まれる。
- **THEN** `charaGraph`、衣装別画像一式、その他の未使用 `extraAssets` は Material Catalog に含まれない。

#### Scenario: アイテム情報を用途に限定する

- **WHEN** 育成素材計算機用のアイテム情報を蒸留するとき
- **THEN** 素材増減・不足表示に必要な `id`、`name`、`icon` だけが Material Catalog に含まれる。

### Requirement: 条件付き取得と未変更時の処理抑止

Material Catalog の更新処理は GitHub Actions の定期更新経路で実行し、保存済み ETag / Last-Modified を使って Atlas Academy へ条件付き GET を行わなければならない (SHALL)。入力または蒸留結果が変化していない場合、巨大 JSON の再 parse と KV の再書き込みを行ってはならない (SHALL NOT)。

#### Scenario: 全入力が 304 の場合は既存値を再利用する

- **WHEN** `nice_servant.json`、`nice_item.json`、`nice_equip.json` の条件付き GET がすべて `304 Not Modified` を返し、検証済みの既存カタログが存在するとき
- **THEN** updater はいずれのレスポンスも parse せず、`material_catalog_v1` への `put` を行わない。

#### Scenario: 一方の入力だけが更新された場合は正常部分を再利用する

- **WHEN** 一部の取得元が `200 OK`、残りが `304 Not Modified` を返したとき
- **THEN** updater は変更された取得元だけを parse・蒸留し、未変更側は、参照整合性を保てる場合に限り既存の検証済みカタログから再利用して完全な候補カタログを構築する。
- **THEN** 完全な候補カタログ全体の検証が成功した場合に限り、単一 KV 値を更新する。

#### Scenario: サーヴァント更新で不足するアイテム定義を補完する

- **WHEN** `nice_servant.json` が `200 OK`、`nice_item.json` が `304 Not Modified` を返し、新しい素材参照が保存済み catalog の item 集合に存在しないとき
- **THEN** updater は `nice_item.json` を条件なしで 1 回だけ再取得し、新しい素材参照を含む item 集合から候補カタログを再構築する。
- **THEN** 再取得が失敗する、または参照整合性を満たせない場合、updater は既存の `material_catalog_v1` を変更せず workflow を失敗として終了する。

#### Scenario: 蒸留結果が同一なら書き込まない

- **WHEN** 取得元の検証子は変化したが、時刻・検証子を除く蒸留済みデータが既存カタログと同一だったとき
- **THEN** updater は `material_catalog_v1` への `put` を行わない。

### Requirement: 蒸留項目が欠けた既存カタログからの取り直し

システムは、既存カタログのサーヴァントがいずれも `bondGrowth` を持たない場合、またはいずれも `cost` を持たない場合、`nice_servant.json` を条件なしで取得して蒸留し直さなければならない (SHALL)。取得元が未変更でも、`bondGrowth` または `cost` を持たないサーヴァント一覧を再利用し続けてはならない (SHALL NOT)。既存カタログが絆礼装の一覧を持たない場合は、`nice_equip.json` を条件なしで取得しなければならない (SHALL)。

#### Scenario: 項目追加後の最初の更新
- **WHEN** 既存の `material_catalog_v1` のサーヴァントがいずれも `bondGrowth` を持たず、`nice_servant.json` は前回から変化していない
- **THEN** updater は検証子を付けずに `nice_servant.json` を取得し、`bondGrowth` を含む候補カタログを構築する

#### Scenario: コストの追加後の最初の更新
- **WHEN** 既存の `material_catalog_v1` のサーヴァントがいずれも `cost` を持たず、`nice_servant.json` は前回から変化していない
- **THEN** updater は検証子を付けずに `nice_servant.json` を取得し、`cost` を含む候補カタログを構築する

#### Scenario: 絆礼装の一覧の追加後の最初の更新
- **WHEN** 既存の `material_catalog_v1` が絆礼装の一覧を持たない
- **THEN** updater は検証子を付けずに `nice_equip.json` を取得し、絆礼装の一覧を含む候補カタログを構築する
