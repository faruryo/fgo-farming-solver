## ADDED Requirements

### Requirement: ServantStars 共通コンポーネント
`components/common/ServantStars.tsx` が存在し、サーヴァントのレアリティを SVG 5角星で表示する共通コンポーネントとして機能する。`rarity` prop（number）を受け取り、その数だけ星を並べる。星は右に行くほど上に重なる（右の星が前面）。rarity が 0 の場合は何も表示しない（空レンダリング）。

#### Scenario: rarity 5 のサーヴァントを表示する
- **WHEN** rarity が 5 のサーヴァント詳細ページを開く
- **THEN** STARS ブロックに SVG 5角星が5個、右の星が左の星に重なって表示される

#### Scenario: rarity 1 のサーヴァントを表示する
- **WHEN** rarity が 1 のサーヴァントの詳細ページを開く
- **THEN** STARS ブロックに SVG 5角星が1個表示される

#### Scenario: rarity 0 のサーヴァントを表示する
- **WHEN** rarity が 0 のサーヴァント詳細ページを開く
- **THEN** STARS ブロックは空欄（星なし）になり、レイアウトが崩れない

### Requirement: 星表示の統一
サーヴァントのレアリティを表示する全箇所（サーヴァント詳細・一覧・マテリアルカード・ダッシュボード）が ServantStars コンポーネントを使用する。各ページ独自の星表示実装（文字列 repeat、span 配列）は存在しない。

#### Scenario: 全ページで同一コンポーネントを使用
- **WHEN** サーヴァント詳細・一覧・マテリアル・ダッシュボードページを開く
- **THEN** いずれのページでも星が同じ SVG スタイル（グラデーション・縁線・重なり）で表示される

### Requirement: サーヴァント詳細ページの STARS/CLASS 段差修正
サーヴァント詳細ページ右上の STARS ブロックと CLASS ブロックのラベルが同じ高さに揃う。

#### Scenario: STARS と CLASS のラベル位置
- **WHEN** サーヴァント詳細ページを開く
- **THEN** "STARS" ラベルと "CLASS" ラベルが同じ底辺ラインに並ぶ
