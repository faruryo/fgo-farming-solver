# farming-history Specification

## Purpose
TBD - created by archiving change farming-history-management. Update Purpose after archive.
## Requirements
### Requirement: 計算履歴の保存
システムは、ログインユーザーの周回計算実行時に、計算結果と対象クエストの要約を D1 の `farming_results` に保存しなければならない (SHALL)。

#### Scenario: 計算結果の保存
- **WHEN** ユーザーが周回計算を実行したとき
- **THEN** 結果 ID・目的・対象アイテム・合計AP・合計周回数・結果データ・対象クエスト要約（`quest_selection`）が保存される。

#### Scenario: 対象クエスト要約の非正規化
- **WHEN** 計算結果を保存するとき
- **THEN** `quest_selection` には全クエスト数・選択数・「選択/除外のうち少ない側」のクエスト名一覧（エリア名付き、上限あり）が短縮IDではなく**名前で**保存される。
- **THEN** 保存時に現データへ解決できない選択IDは選択数に数えない。

### Requirement: 計算履歴の一覧表示
システムは、ログインユーザー自身の有効な（削除されていない）計算履歴を新しい順に一覧表示しなければならない (SHALL)。

#### Scenario: 履歴一覧の取得
- **WHEN** ログインユーザーが履歴ページを開いたとき
- **THEN** `deleted_at` が NULL の自身の履歴のみが新しい順（上限50件）で返される。

#### Scenario: 対象クエストの表示
- **WHEN** 履歴行に `quest_selection` が存在するとき
- **THEN** 「選択数/全体数」が表示され、全選択でない場合は除外（または選択）クエストの一覧を展開して確認できる。
- **WHEN** `quest_selection` が NULL（本機能導入前のデータ）のとき
- **THEN** 対象クエスト欄はプレースホルダ（`—`）を表示し、エラーにならない。

### Requirement: 計算履歴の論理削除
システムは、ユーザーが自身の計算履歴を論理削除できる手段を提供しなければならない (SHALL)。削除は物理削除ではなく `deleted_at` の設定により行い、データは復元可能な形で保持される。

#### Scenario: 履歴の削除
- **WHEN** ログインユーザーが履歴行の削除ボタンを押し、確認ダイアログで承認したとき
- **THEN** 該当行の `deleted_at` に現在時刻が設定され、履歴一覧と全ての履歴由来グラフ（履歴ページ・結果ページ・ダッシュボード）から除外される。

#### Scenario: 共有リンクの維持
- **WHEN** 論理削除済みの結果ページ URL（`/farming/results/[id]`）に直接アクセスしたとき
- **THEN** 結果ページは引き続き閲覧できる（共有済みリンクを壊さない）。

#### Scenario: 所有者以外による削除の拒否
- **WHEN** 未ログインで削除 API を呼び出したとき
- **THEN** 401 が返される。
- **WHEN** 他ユーザーの結果 ID・存在しない ID・削除済み ID に対して削除 API を呼び出したとき
- **THEN** 404 が返され、データは変更されない。

