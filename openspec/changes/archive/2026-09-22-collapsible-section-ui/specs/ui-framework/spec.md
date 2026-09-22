## ADDED Requirements

### Requirement: セクション型折りたたみコンポーネント (CollapsibleSection)
システムは、独立した機能ブロックやセクションを折りたたむための共通コンポーネント `CollapsibleSection` を提供しなければならない (SHALL)。
コンポーネントは以下の仕様を満たすこと：
- 見出しを含むヘッダーバーを持ち、クリック可能な領域として明確な境界線、背景、ホバーフィードバック、Chevron 開閉インジケータを備える。
- 単なるテキスト見出しではなく独立したボタン/ヘッダー領域として視覚化され、意図しない余白クリックによる誤操作を低減する。
- 開閉状態（open/closed）を制御可能（controlled または uncontrolled）とし、初期開閉状態（`defaultOpen`）を指定できる。
- キーボード操作（Enter, Space）およびアクセシビリティ属性（`aria-expanded`, `aria-controls`）をサポートする。
- 開閉状態に応じたアニメーションまたはスムーズな表示切り替えを行う。

#### Scenario: ヘッダーのクリックによる開閉トグル
- **WHEN** ユーザーが `CollapsibleSection` のヘッダー領域をクリックしたとき
- **THEN** セクションの開閉状態がトグルされ、コンテンツの表示/非表示が切り替わる
- **THEN** Chevron 開閉アイコンが開閉状態に応じて切り替わる

#### Scenario: 初期開閉状態の指定
- **WHEN** `defaultOpen={true}` を指定して `CollapsibleSection` をレンダリングしたとき
- **THEN** 初回表示時にコンテンツが開いた状態で表示される
- **WHEN** `defaultOpen={false}` を指定してレンダリングしたとき
- **THEN** 初回表示時にコンテンツが閉じた状態で表示される

#### Scenario: キーボード操作によるトグル
- **WHEN** ヘッダーのトリガーにフォーカスを当てて Enter または Space キーを押下したとき
- **THEN** 開閉状態がトグルされる
