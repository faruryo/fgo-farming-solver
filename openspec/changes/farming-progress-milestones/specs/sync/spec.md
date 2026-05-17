## ADDED Requirements

### Requirement: 状態スナップショットの保存
システムは、ユーザーの保存操作およびソルバー実行時にユーザーの localStorage 全体を D1 の `state_snapshots` テーブルへ保存しなければならない (SHALL)。

#### Scenario: クラウド同期時のスナップショット保存
- **WHEN** `/api/cloud` への POST が成功したとき
- **THEN** 保存対象の `KEYS` の全データが `state_snapshots` テーブルに JSON として記録される。
- **THEN** 同一 `user_id` の当日の既存レコードがあれば `UPDATE`、なければ `INSERT` する（同日上書き戦略）。

#### Scenario: ソルバー実行時のスナップショット保存
- **WHEN** `/api/solve` が成功したとき
- **THEN** 呼び出し元から渡された現在の localStorage スナップショットが `state_snapshots` に記録される。
- **THEN** 同一 `user_id` の当日の既存レコードがあれば `UPDATE`、なければ `INSERT` する（同日上書き戦略）。

### Requirement: 進捗比較のための履歴データ提供
システムは、現在のデータと比較するための過去のスナップショットデータを取得する手段を提供しなければならない (SHALL)。

#### Scenario: 過去スナップショットの取得
- **WHEN** 進捗比較のために過去のデータが必要なとき
- **THEN** `state_snapshots` から「前回」「指定日数前に最も近い」レコードを取得して返す。

#### Scenario: スナップショットが存在しない場合のフォールバック
- **WHEN** 「1週間前」または「1ヶ月前」のレコードが存在しないとき
- **THEN** `null` を返し、呼び出し元で「お疲れ様」モードのフォールバック表示を行う。
