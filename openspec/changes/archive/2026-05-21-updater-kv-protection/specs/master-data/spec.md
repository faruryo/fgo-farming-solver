## ADDED Requirements

### Requirement: 失敗・空応答時の KV 保護
システムは、KV (`all_drops_json` / `dashboard_meta`) を上書きする前にフェッチ結果を検証し、欠損が疑われる場合は書き込みをスキップして既存データを温存しなければならない (SHALL)。

#### Scenario: フェッチが throw したら KV を変更しない
- **WHEN** `fetchAndTransformData` または `fetchDashboardMeta` が例外を投げたとき
- **THEN** worker は例外をログに残し、対応する KV キーへの `put` を実行しない。
- **THEN** 既存の KV データはそのまま保持される。

#### Scenario: drops の必須配列が空なら書き込まない
- **WHEN** `fetchAndTransformData` が完走したが `items` / `quests` / `drop_rates` のいずれかが空配列だったとき
- **THEN** worker は警告ログを出力し、`all_drops_json` への `put` を実行しない。
- **THEN** 既存の `all_drops_json` はそのまま保持される。

#### Scenario: dashboard meta の events と gachas が両方空なら書き込まない
- **WHEN** `fetchDashboardMeta` が完走したが `events` と `gachas` が両方とも空だったとき
- **THEN** worker は警告ログを出力し、`dashboard_meta` への `put` を実行しない。
- **THEN** 既存の `dashboard_meta` はそのまま保持される。

#### Scenario: dashboard meta の片方だけが空なら書き込みを許可する
- **WHEN** `fetchDashboardMeta` が `events` または `gachas` のどちらか片方だけ空のレスポンスを返したとき
- **THEN** worker は通常通り `dashboard_meta` を更新する（ガチャ無し期間／イベント切替期間として有効）。
