# Spec Delta

## MODIFIED Requirements

### Requirement: バージョン付き Material Catalog の生成

システムは、Atlas Academy の JP サーヴァント・育成素材・アイテムデータから、育成素材計算機と絆トラッカーに必要な項目だけを含む `schemaVersion: 1` の Material Catalog を生成し、`MASTER_DATA` namespace の単一キー `material_catalog_v1` に保存しなければならない (SHALL)。カタログは `updatedAt`、取得元の ETag / Last-Modified、サーヴァント一覧、サーヴァント別素材、表示用アイテム一覧を含み、すべて同一の更新単位として扱わなければならない (SHALL)。

#### Scenario: 正常な入力から単一スナップショットを生成する

- **WHEN** Atlas Academy のサーヴァントデータとアイテムデータが正常に取得され、検証を通過したとき
- **THEN** `servants`、`materials`、`items`、`schemaVersion`、`updatedAt`、取得元検証子を含むカタログが 1 つの KV 値として保存される。
- **THEN** 利用者は異なる更新世代のサーヴァント情報・素材・アイテム情報を組み合わせて受け取らない。

#### Scenario: 表示に不要なアセットを除外する

- **WHEN** Atlas Academy の `nice_servant.json` からサーヴァント表示情報を蒸留するとき
- **THEN** 各サーヴァントには `id`、`name`、`className`、`collectionNo`、`rarity` と、カードで使用する代表顔画像 URL と、絆Lv別の累積必要ポイント `bondGrowth` だけが含まれる。
- **THEN** `charaGraph`、衣装別画像一式、その他の未使用 `extraAssets` は Material Catalog に含まれない。

#### Scenario: アイテム情報を用途に限定する

- **WHEN** 育成素材計算機用のアイテム情報を蒸留するとき
- **THEN** 素材増減・不足表示に必要な `id`、`name`、`icon` だけが Material Catalog に含まれる。

## ADDED Requirements

### Requirement: 絆Lv別累積必要ポイントの蒸留

システムはサーヴァントの `bondGrowth` を任意項目として蒸留しなければならない (SHALL)。`bondGrowth` は1要素以上の配列で、各要素が有限の正値であり、要素が単調非減少である場合に限り含めなければならない (SHALL)。条件を満たさないサーヴァントは `bondGrowth` を省いて蒸留し、それを理由に候補カタログ全体を拒否してはならない (SHALL NOT)。`bondGrowth` の追加は既存の consumer と互換であり、キーとスキーマバージョンを変えてはならない (SHALL NOT)。

#### Scenario: 正常な絆データ
- **WHEN** `nice_servant.json` のサーヴァントが16要素の単調増加する `bondGrowth` を持つ
- **THEN** 蒸留後のサーヴァントに同じ `bondGrowth` が含まれる

#### Scenario: 不正な絆データ
- **WHEN** あるサーヴァントの `bondGrowth` が欠落している、または負値・非数・減少する要素を含む
- **THEN** そのサーヴァントは `bondGrowth` なしで蒸留され、他の検証を通過すれば候補カタログは保存される

### Requirement: 蒸留項目が欠けた既存カタログからの取り直し

システムは、既存カタログのサーヴァントがいずれも `bondGrowth` を持たない場合、`nice_servant.json` を条件なしで取得して蒸留し直さなければならない (SHALL)。取得元が未変更でも、`bondGrowth` を持たないサーヴァント一覧を再利用し続けてはならない (SHALL NOT)。

#### Scenario: 項目追加後の最初の更新
- **WHEN** 既存の `material_catalog_v1` のサーヴァントがいずれも `bondGrowth` を持たず、`nice_servant.json` は前回から変化していない
- **THEN** updater は検証子を付けずに `nice_servant.json` を取得し、`bondGrowth` を含む候補カタログを構築する
