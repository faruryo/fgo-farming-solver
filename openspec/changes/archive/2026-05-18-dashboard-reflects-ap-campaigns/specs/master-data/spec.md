## ADDED Requirements

### Requirement: AP キャンペーン情報の抽出
システムは、Atlas Academy `nice_event.json` の `target=questAp` キャンペーンを抽出し、drops バンドルに同梱しなければならない (SHALL)。

#### Scenario: キャンペーン抽出と quest ID 変換
- **WHEN** マスターデータ更新プロセスが `nice_event.json` を処理するとき
- **THEN** `campaigns[]` のうち `target` が `questAp` であるエントリが収集される。
- **THEN** 各 campaign について `campaignQuests[]` の `questId` (Atlas ID) を `aaQuestId` 経由でアプリ内短縮 quest ID に変換する。
- **THEN** `campaignQuests[].isExcepted === true` のエントリは対象から除外される。
- **THEN** 短縮 quest ID に変換できない（drops に存在しない）クエストは無視される。

#### Scenario: 出力データ構造
- **WHEN** 更新後の drops バンドルが KV `all_drops_json` に保存されるとき
- **THEN** バンドルには `campaigns` フィールドが含まれ、各エントリは少なくとも `{ id, calcType, value, validFrom, validTo, questIds }` を持つ。
- **THEN** `questIds` はアプリ内の短縮 quest ID 配列である。
- **THEN** `validFrom` / `validTo` は Unix 秒で、現在開催中だけでなく未来分のキャンペーンも含めて保存される（取得時点で Atlas が公開している範囲）。

#### Scenario: 既存フィールドの後方互換性
- **WHEN** `campaigns` フィールドを追加するとき
- **THEN** `items`, `quests`, `drop_rates` 等の既存フィールドの形状は変更されない。
- **THEN** `campaigns` フィールドを参照しない既存クライアントは従来どおり動作する。

### Requirement: campaigns の cron 周期と整合
システムは、`campaigns` の鮮度をマスターデータ更新の cron 周期と一致させなければならない (SHALL)。

#### Scenario: 毎時更新時のキャンペーン更新
- **WHEN** マスターデータ更新 cron が走るとき
- **THEN** `campaigns` フィールドも同じパス内で再生成され、KV に保存される。
- **THEN** 個別の更新エンドポイントや別経路は設けない。
