## Context

現在 `/material/result` では、shadcn/ui の `Accordion` が使われていますが、トリガーに通常のセクション見出しクラス（`.c-mat-section-title`）が直接付与されているため、以下の問題が生じています：
1. 静的な見出し（素材のレアリティ見出し等）と同じ見た目で、開閉可能な要素に見えない（アフォーダンス不足）。
2. ヘッダーの幅全体が透明なボタンとなっており、余白のクリックやスクロール操作時に誤って閉じてしまう。
3. サイト内の他箇所（ダッシュボード等）での折りたたみUIとスタイルが統一されていない。

本設計では、これらを解消する共通UIコンポーネント `CollapsibleSection` を導入します。

## Goals / Non-Goals

**Goals:**
- **明確なアフォーダンス**: ヘッダーが「クリックして開閉できるボタン領域」であることを視覚的に明示（カード外枠、ヘッダー背景色、ホバーフィードバック、Chevronアイコン）。
- **誤クリックの防止**: ヘッダーとコンテンツ領域を構造的・視覚的に明確に分離し、コンテンツ操作時の誤折りたたみを防止する。
- **再利用性**: 独立したセクションやカードの開閉ブロックとして、サイト全体で一貫して再利用可能なコンポーネント設計。
- **アクセシビリティ**: WAI-ARIA（`aria-expanded`, `aria-controls`）およびキーボード操作（Enter/Space）の標準サポート。

**Non-Goals:**
- 複数項目が連続して並ぶリスト型アコーディオン（`/farming` のアイテムカテゴリなど）の全面置換（今回は独立セクション型を優先）。
- アドバイザーやクエストツリー内部の計算ロジック、データ構造の変更。

## Decisions

### 1. 「カード型セクション（Collapsible Card）」デザインの採用
- **決定**: パネル全体を外枠ボーダー（`border border-border`）と背景（`var(--panel)`）で囲み、上部に独立したヘッダーバーを配するカード型レイアウトを採用する。
- **理由**: 単に見出し行をボタン化するだけ（ヘッダーバー型）では、下部の広大なコンテンツ領域との境界が曖昧なままとなり、アドバイザー内部のタブや素材カード操作時に上部余白を誤タップするリスクが残る。カードとして一体化することで、操作エリアの境界が一目で認識できる。
- **代替案（不採用）**:
  - *ヘッダーバー型（枠なし）*: 既存のフラット感は保てるが、中身がどこまで続いているかが分かりにくく、誤クリック抑止効果が弱い。

### 2. コンポーネント設計 (`CollapsibleSection`)
- **インターフェース**:
  ```tsx
  export type CollapsibleSectionProps = {
    id?: string
    title: React.ReactNode
    subtitle?: React.ReactNode
    icon?: React.ReactNode
    badge?: React.ReactNode
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
    headerActions?: React.ReactNode
    className?: string
    headerClassName?: string
    contentClassName?: string
    children: React.ReactNode
  }
  ```
- **実装方針**:
  - 単一の開閉セクションとして軽量かつ柔軟に動作するよう、`@base-ui/react/collapsible` または制御ステートとアクセシビリティ属性（`button` + `aria-expanded` + `aria-controls`）を用いた堅牢な実装とする。
  - ヘッダー右端に開閉 Chevron アイコン（開閉時に 180 度回転アニメーション）を配置。
  - `headerActions` を配置した場合、アクション要素のクリックがセクション開閉をトリガーしないよう `e.stopPropagation()` を適切にハンドリング。

### 3. `/material/result` での適用
- 「配布・交換券アドバイザー」:
  - `defaultOpen={true}`（デフォルト展開）
  - タイトル: 「配布・交換券アドバイザー」
  - コンテンツ内に `MaterialSelectionAdvisor` を配置
- 「周回対象に含めるクエスト」:
  - `defaultOpen={false}`（デフォルト折りたたみ）
  - タイトル: `t('quest-selection-heading', '周回対象に含めるクエスト')`
  - コンテンツ内に `CheckboxTree` を配置

## Risks / Trade-offs

- **[Risk] カード枠の導入による視覚的密度・縦幅の変化**
  → **Mitigation**: ヘッダーの縦パディングを程よい高さ（`py-2.5 px-4`）に抑え、コンテンツとの仕切り線（`border-b`）を繊細な色合いにすることで、圧迫感を与えずに境界を際立たせる。
- **[Risk] 既存のアンカーリンク（`/material/result#advisor`）が機能しなくなる**
  → **Mitigation**: `CollapsibleSection` に `id="advisor"` を渡し、セクション外枠にアンカーが当たるようにする。
