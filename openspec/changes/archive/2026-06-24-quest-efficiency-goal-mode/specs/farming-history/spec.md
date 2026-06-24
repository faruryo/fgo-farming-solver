## ADDED Requirements

### Requirement: ストック込み計算のフラグ記録と badge 表示

システムは周回ソルバーの計算パラメータ(`Params`)に `stockIncluded?: boolean` を保持 SHALL。余剰ストックを含めた目標で解いた計算は `stockIncluded=true` を記録する。計算履歴/結果は解いた目標(`params.items`)をそのまま(as-solved)表示し、育成目標とストック目標を並列保存・並列表示しない SHALL。`stockIncluded=true` の履歴には「ストック込み」badge を表示する SHALL。後方互換のため、`stockIncluded` 未設定の既存履歴は false(badge なし)として扱う SHALL。

#### Scenario: ストック込み履歴に badge
- **WHEN** `stockIncluded=true` で保存された計算を履歴/結果で表示する
- **THEN** 「ストック込み」badge が表示される

#### Scenario: 通常履歴は badge なし
- **WHEN** `stockIncluded` が false または未設定の計算を表示する
- **THEN** badge は表示されず、解いた目標がそのまま表示される

#### Scenario: 既存履歴の後方互換
- **WHEN** `stockIncluded` フィールドを持たない既存の保存データを表示する
- **THEN** エラーなく false 扱いとなり badge は表示されない
