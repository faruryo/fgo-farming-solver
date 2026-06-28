## ADDED Requirements

### Requirement: 2目標の batch 連結保存

システムは2目標(必要分/ストック込み)計算時に、目標A・目標Bを `farming_results` の**2行**として保存し、新規カラム `batch_id`(同一の UUID)で連結しなければならない (SHALL)。目標A行は `stockIncluded=false`(KPIアンカー)、目標B行は `stockIncluded=true` とする。単一目標計算(`stockEnabled=OFF` または `B==A`)では `batch_id` を NULL とし、従来どおり1行で保存 SHALL。

#### Scenario: 2目標は batch_id で連結された2行になる
- **WHEN** 2目標(必要分/ストック込み)で周回計算を実行したとき
- **THEN** 同一 `batch_id` を持つ2行が保存され、目標A行は `stockIncluded=false`、目標B行は `stockIncluded=true` を持つ。

#### Scenario: 単一目標は batch_id なしの1行
- **WHEN** `stockEnabled=OFF` または目標Bが目標Aと一致して単一目標で計算したとき
- **THEN** `batch_id` が NULL の1行のみが保存される。

#### Scenario: 着地は目標A行
- **WHEN** 2目標計算の完了後に結果ページへ遷移するとき
- **THEN** 目標A行(KPIアンカー)の結果ページに着地し、目標Bは同ページ内から参照できる。

### Requirement: batch ペアの集約表示

システムは履歴一覧および結果ページにおいて、同一 `batch_id` を持つ目標A・目標Bを**1つのカード/ビューに集約**して表示しなければならない (SHALL)。集約表示では目標A(必要分)を主、目標B(ストック込み)を従とし、両者の差分(上乗せ周回数/AP)を視認できるようにする。目標B行には「ストック込み」badge を表示 SHALL。

#### Scenario: 履歴一覧でペアを集約
- **WHEN** 同一 `batch_id` を持つ目標A・目標Bが履歴一覧に存在するとき
- **THEN** 両者は1カードに集約され、「必要分」と「+ストック(差分 +Δ)」が並べて表示され、目標B側に「ストック込み」badge が付く。

#### Scenario: 結果ページで A/B 切り替え
- **WHEN** `batch_id` を持つ結果ページを開いたとき
- **THEN** 兄弟行(目標A/目標B)を取得し、`[必要分 | +ストック]` のタブで切り替えて表示できる。

### Requirement: batch_id 後方互換

システムは `batch_id` が NULL の既存行(本機能導入前のデータ、および単一目標計算)を、エラーなく**単独カード**として表示しなければならない (SHALL)。旧 `stockEnabled=ON` で保存された既存行(buffer 焼き込み済み・`stockIncluded=true`)は、目標Aを復元せず単独のまま「ストック込み」badge付きで据え置き SHALL。

#### Scenario: batch_id NULL の単独表示
- **WHEN** `batch_id` が NULL の行を履歴一覧/結果ページで表示するとき
- **THEN** ペア集約・A/Bタブは適用されず、従来どおり単独カードとして表示され、エラーにならない。

#### Scenario: 旧ストック込み行の据え置き
- **WHEN** 本機能導入前に `stockEnabled=ON` で保存された行(`stockIncluded=true`・`batch_id=NULL`)を表示するとき
- **THEN** 目標Aへのレトロ変換は行わず、単独カードとして「ストック込み」badge付きで表示される。

## MODIFIED Requirements

### Requirement: 計算履歴の論理削除
システムは、ユーザーが自身の計算履歴を論理削除できる手段を提供しなければならない (SHALL)。削除は物理削除ではなく `deleted_at` の設定により行い、データは復元可能な形で保持される。`batch_id` を持つ2目標ペアの削除は、batch_id 単位で目標A・目標B両方を同時に論理削除する(A/B連動削除) SHALL。

#### Scenario: ペア(batch)の連動削除
- **WHEN** ログインユーザーが `batch_id` を持つ集約カードの削除を確認ダイアログで承認したとき
- **THEN** 同一 `batch_id` を持つ目標A・目標B両行の `deleted_at` に現在時刻が設定され、片肺状態は生じない。

#### Scenario: 単独行の削除
- **WHEN** ログインユーザーが `batch_id` を持たない履歴行の削除ボタンを押し、確認ダイアログで承認したとき
- **THEN** 該当行の `deleted_at` に現在時刻が設定され、履歴一覧と全ての履歴由来グラフ(履歴ページ・結果ページ・ダッシュボード)から除外される。

#### Scenario: 共有リンクの維持
- **WHEN** 論理削除済みの結果ページ URL(`/farming/results/[id]`)に直接アクセスしたとき
- **THEN** 結果ページは引き続き閲覧できる(共有済みリンクを壊さない)。

#### Scenario: 所有者以外による削除の拒否
- **WHEN** 未ログインで削除 API を呼び出したとき
- **THEN** 401 が返される。
- **WHEN** 他ユーザーの結果 ID・存在しない ID・削除済み ID に対して削除 API を呼び出したとき
- **THEN** 404 が返され、データは変更されない。
