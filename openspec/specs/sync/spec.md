# 仕様書: ユーザーデータ同期 (User Data Sync)

## Purpose
ユーザーの所持素材数、必要素材数、および計算設定を複数のデバイス間で同期し、データの永続性を確保する機能。

## Requirements

### Requirement: データの永続化と同期
システムは、ユーザーのローカルデータをクラウドストレージと同期し、永続化しなければならない (SHALL)。

#### Scenario: データの保存
- **WHEN** ローカルデータが更新され、オートシンクが有効であるとき
- **THEN** 変更から 5 秒後に `/api/cloud` を通じて Cloudflare KV にデータが保存される。

### Requirement: 自動ロード (Safe Auto-Load)
システムは、未同期の変更がない場合に限り、新しいデータを自動的に反映しなければならない (SHALL)。

#### Scenario: クリーンな状態でのロード
- **WHEN** クラウドのデータがローカルより新しく、かつローカルに未同期の変更がないとき
- **THEN** ユーザーの操作を介さずに最新のデータがローカルに適用される。

### Requirement: コンフリクトの検出と解決
システムは、データの不整合を検出し、ユーザーによる解決手段を提供しなければならない (SHALL)。

#### Scenario: 競合の発生
- **WHEN** クラウドのデータが新しく、かつローカルにも未同期の変更が存在するとき
- **THEN** 自動保存を中断し、ユーザーに「クラウドを優先」または「ローカルを優先」を選択するダイアログを表示する。

### Requirement: 認証済みユーザーの識別
システムは、NextAuth による認証情報を利用して、ユーザーごとのデータを分離しなければならない (SHALL)。

#### Scenario: ユーザー識別
- **WHEN** データを保存または取得するとき
- **THEN** ログイン中のユーザーの識別子（メールアドレス等）をキーとして Cloudflare KV にアクセスする。

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

### Requirement: 進捗比較のための履歴データ提供
システムは、現在のデータと比較するための過去のスナップショットデータを取得する手段を提供しなければならない (SHALL)。

#### Scenario: 過去スナップショットの取得
- **WHEN** 進捗比較のために過去のデータが必要なとき
- **THEN** `state_snapshots` から「前回」「指定日数前に最も近い」レコードを取得して返す。

#### Scenario: スナップショットが存在しない場合のフォールバック
- **WHEN** 「1週間前」または「1ヶ月前」のレコードが存在しないとき
- **THEN** `null` を返し、呼び出し元で「お疲れ様」モードのフォールバック表示を行う。

### Requirement: 除外クエストリストの永続化と同期
システムは、クエスト選択を「除外リスト」（`excludedQuests`）として localStorage に永続化し、クラウド同期対象（`KEYS`）に含めなければならない (SHALL)。チェック済みリスト（旧 `quests` キー）はスナップショット・同期の既存契約維持のためデュアルライトで併存させる (SHALL)。

#### Scenario: 除外リストの保存と同期
- **WHEN** ユーザーがクエストのチェックを変更したとき
- **THEN** 除外されたクエストIDの一覧が `excludedQuests` に保存され、クラウド同期・状態スナップショットの対象となる。
- **THEN** 旧 `quests` キーにもチェック済みリストが併せて書き込まれる。

#### Scenario: 旧形式からの一方向移行
- **WHEN** `excludedQuests` が存在せず旧 `quests` キーのみが存在する状態でフォームがマウントされたとき
- **THEN** `現在の全クエストID − 保存済みチェックID` を除外リストとして一度だけ保存し、選択状態を維持する。
- **WHEN** `excludedQuests` が既に存在するとき
- **THEN** 移行は再実行されない（クラウド復元で旧 `quests` が後から適用されても除外リストを上書きしない）。

#### Scenario: 新規クエストの既定選択
- **WHEN** マスターデータ更新で新しいクエストが追加されたとき
- **THEN** 除外リストに含まれないため、新クエストは自動的に周回対象（チェックON）となる。
- **THEN** ユーザーが過去に除外したクエストは除外され続ける。

## Constraints
- **同期対象**: `posession`, `input`, `objective`, `farming/results` 等、主要な設定および履歴データ。
- **メタデータ**: 各データセットは `updatedAt`, `lastSyncedAt`, `deviceId` を保持すること。
- **履歴の永続化**: 計算結果の履歴は D1 データベース (`farming_results` テーブル) に保存すること。
- **スナップショット**: `state_snapshots` テーブル（`id` / `user_id` / `data` / `created_at`）に localStorage 全体を保存する。同日上書き戦略を採用。
