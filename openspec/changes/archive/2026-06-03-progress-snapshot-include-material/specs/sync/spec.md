## MODIFIED Requirements

### Requirement: 状態スナップショットの保存
システムは、ユーザーの保存操作およびソルバー実行時にユーザーの localStorage 全体（`material` を含む `KEYS`）を D1 の `state_snapshots` テーブルへ保存しなければならない (SHALL)。material を欠く部分的なスナップショットで、material を含む既存スナップショットを上書きしてはならない (SHALL NOT)。

#### Scenario: クラウド同期時のスナップショット保存
- **WHEN** `/api/cloud` への POST が成功したとき
- **THEN** 保存対象の `KEYS` の全データが `state_snapshots` テーブルに JSON として記録される。
- **THEN** 同一 `user_id` の当日の既存レコードがあれば `UPDATE`、なければ `INSERT` する（同日上書き戦略）。

#### Scenario: ソルバー実行時のスナップショット保存
- **WHEN** ソルバー実行（`/api/solve`）が成功したとき
- **THEN** 呼び出し元（クライアント）から渡された `material`, `material/result`, `posession`, `items`, `quests` を含む localStorage 全体（`KEYS`）が `state_snapshots` に記録される。
- **THEN** 同一 `user_id` の当日の既存レコードがあれば `UPDATE`、なければ `INSERT` する（同日上書き戦略）。
- **THEN** Cloudflare KV（`cloud:<userId>`）は変更しない。

#### Scenario: material を欠くスナップショットを保存しない
- **WHEN** ソルバー実行経路が `material` を含まない部分的なデータ（例: `items`/`quests` のみ）しか持たないとき
- **THEN** `state_snapshots` への保存を行わない（material 入り既存レコードの破壊的上書きを避ける）。
