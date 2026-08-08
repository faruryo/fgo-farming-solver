## ADDED Requirements

### Requirement: Material Catalog による非同期データ読込
育成素材計算機の `/material` および `/material/[className]` は静的な UI シェルとして配信され、クライアントから Material Catalog API を取得して表示データを初期化しなければならない (SHALL)。ページのサーバーレンダリング処理は Atlas Academy の `nice_servant.json` または `nice_item.json` を取得してはならない (SHALL NOT)。

#### Scenario: カタログ取得成功後に計算機を初期化する
- **WHEN** Material Catalog API が互換性のある正常なカタログを返したとき
- **THEN** サーヴァント一覧、素材、アイテム情報を使って既存の育成素材計算機 UI が表示される。
- **THEN** 新しいカタログが KV に反映された後は、アプリ本体を再デプロイしなくてもブラウザキャッシュの有効期間終了後に新サーヴァントが表示される。

#### Scenario: 読込中は空の Chaldea state を初期化しない
- **WHEN** Material Catalog の取得が完了していないとき
- **THEN** 読込状態を表示し、`Index` またはクラス別 `Material` コンポーネントを空のサーヴァント配列で mount しない。
- **THEN** `localStorage['material']` と `localStorage['posession']` を読み書きせず、`ls-sync` を発火しない。

#### Scenario: 取得失敗時に利用者状態を変更しない
- **WHEN** Material Catalog API が失敗、非対応 schema、または壊れた JSON を返したとき
- **THEN** 計算機の代わりに再試行可能なエラー表示を行う。
- **THEN** `localStorage['material']`、`localStorage['posession']`、クラウド同期メタデータを変更しない。

### Requirement: カタログ更新と既存利用者状態の互換性
Material Catalog は読み取り専用のマスターデータとして扱い、既存の `material` / `posession` 保存スキーマおよびクラウド同期対象キーを変更してはならない (SHALL NOT)。新しいサーヴァント ID は既存の Chaldea state へ安全に追加し、保存済みの既存サーヴァント状態を上書きしてはならない (SHALL NOT)。

#### Scenario: 新サーヴァントを既定状態で追加する
- **GIVEN** 利用者の `localStorage['material']` に既存サーヴァントの編集済み状態が保存されている
- **WHEN** 新しいサーヴァント ID を含む Material Catalog を読み込んだとき
- **THEN** 新サーヴァントは未所持かつ既定の現在値・目標値で追加される。
- **THEN** 既存サーヴァントの所持、現在値、目標値は保持される。

#### Scenario: 一時的にカタログから見えない ID を削除しない
- **GIVEN** 利用者の `localStorage['material']` に、現在のカタログに存在しないサーヴァント ID が保存されている
- **WHEN** Chaldea state とカタログをマージしたとき
- **THEN** 保存済み ID の状態を localStorage から削除しない。

### Requirement: クラス別 URL の事前検証
`/material/[className]` は正規の Material クラス名だけを受理し、不正な値をデータ取得前に 404 としなければならない (SHALL)。有効クラス一覧は静的生成、URL 検証、クラス選択 UI で共有しなければならない (SHALL)。

#### Scenario: 既知クラスを表示する
- **WHEN** `saber`、`alterEgo`、`beastEresh` など定義済みのクラス URL を開いたとき
- **THEN** 対応する静的 UI シェルが表示され、Material Catalog の取得後にそのクラスの計算機が表示される。

#### Scenario: 不正クラスを 404 にする
- **WHEN** `/material/zzzz` のような未定義クラス URL を開いたとき
- **THEN** `404 Not Found` を返す。
- **THEN** Material Catalog API、KV、Atlas Academy のいずれにもアクセスしない。
