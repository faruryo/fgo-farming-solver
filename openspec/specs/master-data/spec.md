# 仕様書: マスターデータ管理 (Master Data Management)

## Purpose
FGO周回ソルバーが必要とする最新のアイテム情報、クエスト情報、およびドロップ率データを外部ソースから取得し、アプリケーションが利用可能な形式に変換・保持する機能。

## Requirements

### Requirement: データソースの統合
システムは、複数の外部ソースからデータを取得し、一貫性のある形式に統合しなければならない (SHALL)。

#### Scenario: データのフェッチ
- **WHEN** データ更新プロセスが実行されるとき
- **THEN** 「FGOアイテム効率劇場～2～」スプレッドシート（CSV）および Atlas Academy API からデータが取得される。

### Requirement: アイテム名のマッピング
システムは、スプレッドシート上の日本語略称を Atlas Academy の正式名称に正確に変換しなければならない (SHALL)。

#### Scenario: 名称変換の実行
- **WHEN** マッピングルール（静的テーブル、パターン変換、フォールバック）が適用されるとき
- **THEN** 略称（例: 「証」）が正式名称（例: 「英雄の証」）に変換される。

### Requirement: データ最適化 (Top 5 フィルタリング)
システムは、ソルバーの性能とストレージ制限を維持するため、保存するデータ量を最適化しなければならない (SHALL)。

#### Scenario: クエストデータの削減
- **WHEN** 最終的なデータセットを構築するとき
- **THEN** アイテムごとにドロップ率上位 5 件のクエスト、および相対効率上位 100 件のマルチドロップ候補のみが保持される。
- **THEN** 保存されるデータに wave (enemy) 情報は含まれない。

### Requirement: Quest データに `aaQuestId` を保持
システムは、Atlas Academy API との紐付けを維持するため、クエストごとに固有の ID を保持しなければならない (SHALL)。

#### Scenario: `aaQuestId` の保存
- **WHEN** スプレッドシートのクエストと Atlas Academy のデータが一致したとき
- **THEN** 出力される Quest データに `aaQuestId` フィールドが含まれる。

### Requirement: 定期的なデータ更新
システムは、常に最新のドロップデータを提供するため、定期的に自動更新を実行しなければならない (SHALL)。

#### Scenario: 自動更新の実行
- **WHEN** GitHub Actions の Cron ジョブがトリガーされたとき
- **THEN** `fetchAndTransformData` が実行され、KV 内のデータが更新される。

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

### Requirement: ガチャフィルタリングの精度
システムは、ガチャタイプに基づいてフレポ召喚を除外し、課金石・有料石限定のガチャのみを表示しなければならない (SHALL)。

#### Scenario: stone/chargeStone タイプのみ表示
- **WHEN** アクティブガチャをフィルタリングするとき
- **THEN** `type` が `stone` または `chargeStone` であるエントリのみが `DashboardMeta.gachas` に含まれる。
- **THEN** `type` が `friendPoint` のエントリは除外される。

## Constraints
- **データ構造**: `MASTER_DATA` KV 内の `all_drops_json` キーに、`items`, `quests`, `drop_rates` の構造で保存されること。
- **除外ルール**: AP 5 未満のクエストはノイズとして除外されること。
- **wave データの非保持**: updater プロセスにおいて Atlas Academy からの wave データ取得は行わないこと。
