## MODIFIED Requirements

### Requirement: ガチャバナー URL の生成
システムは、Atlas Academy CDN の正しいパスを使用してガチャバナー画像 URL を生成しなければならない (SHALL)。

#### Scenario: バナー URL の構築
- **WHEN** `fetchDashboardMeta()` がアクティブなガチャエントリを処理するとき
- **THEN** バナー URL は `{staticOrigin}/JP/SummonBanners/img_summon_{imageId}.png` の形式で生成される。
- **THEN** 旧形式 (`/JP/Banner/summon_{imageId}.png`) は使用されない。

### Requirement: イベントデータの一括取得
システムは、アクティブなイベント情報を N+1 リクエストなしに取得しなければならない (SHALL)。

#### Scenario: 一括フェッチの実行
- **WHEN** `fetchDashboardMeta()` が実行されるとき
- **THEN** `export/JP/nice_event.json` を1リクエストで取得し、メモリ内でフィルタリングを行う。
- **THEN** 個別の `/nice/JP/event/{id}` エンドポイントへのリクエストは行われない。

## ADDED Requirements

### Requirement: ガチャフィルタリングの精度
システムは、ガチャタイプに基づいてフレポ召喚を除外し、課金石・有料石限定のガチャのみを表示しなければならない (SHALL)。

#### Scenario: stone/chargeStone タイプのみ表示
- **WHEN** アクティブガチャをフィルタリングするとき
- **THEN** `type` が `stone` または `chargeStone` であるエントリのみが `DashboardMeta.gachas` に含まれる。
- **THEN** `type` が `friendPoint` のエントリは除外される。
