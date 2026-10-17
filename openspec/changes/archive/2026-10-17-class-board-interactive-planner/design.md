## Context

ユーザーがゲーム内のクラスボード画面と同じビジュアルマップ上で、各クラスのサイン（マス）を個別に選択し、現在解放状況と目標解放状況の差分から必要な素材（QP・星光の砂・トーチ・通常素材・モニュピ）を動的に計算して周回目標へ反映できるシミュレータを設計します。

## Goals / Non-Goals

**Goals:**
- **ゲーム内再現マップ**: Atlas Academy 公式データ（`nice_class_board.json`）に基づく正確な座標系（`posX`, `posY`）と接続ライン（`lines`）、スキルアイコン、ツアーロック描画。
- **軽量かつ滑らかな操作性**: SVGベースの2Dキャンバスによるパン・ドラッグおよびズーム（PC/スマホ対応）。
- **マス単位の状態選択**: 「未解放」「目標」「解放済」の個別指定、および起点からの最短ルート一括選択機能。
- **完全な素材合算連携**: `(目標マス - 解放済マス)` の必要素材を既存の素材目標システムおよび周回ソルバーへリアルタイム合算。
- **後方互換性**: 既存の「クラス全体の目標/解放済一括設定」とマス詳細設定のシームレスな統合。

**Non-Goals:**
- クラススコア盤面のマス配置そのものの編集（公式固定データ）。
- 外部大型グラフィックエンジン（Pixi.js, Three.js等）の導入（バンドル肥大化を避け、標準SVGとTailwind CSSのみで完結させる）。

## Decisions

### 1. 描画方式: SVGキャンバスの採用
- **決定**: HTML5 Canvas や WebGL ではなく、**インライン SVG** を採用する。
- **理由**:
  - 各クラスのマス数は約80〜91個、接続ラインは約80〜89本と非常に小規模。
  - SVGであれば各マス（`<g>` または `<foreignObject>` / `<circle>` / `<image>`）に対して React のイベント（`onClick`, `onMouseEnter`）を直接バインドでき、アクセシビリティ（`role="button"`, `aria-label`）も自然に実現可能。
  - Tailwind CSS のアニメーション（発光パルス、ホバー拡大）やフィルター効果をそのまま適用できる。
- **代替案（不採用）**:
  - *HTML5 Canvas*: 高速だがクリック判定に座標逆算が必要で、アクセシビリティやDOMインスペクションが困難。
  - *Three.js / PixiJS*: バンドルサイズが数百KB〜数MB増加し、Next.js SSR/Workers 環境で不要なリスクを招く。

### 2. パン・ズーム操作の実装設計
- **決定**: SVGの `viewBox` を座標 `(minX, minY, width, height)` で動的に制御する軽量カスタムフック `usePanZoom` を作成する。
- **仕様**:
  - 初期表示: 全マスが収まるよう全体が中央に自動フィット。
  - ドラッグ（マウス/タッチ）: `viewBox` の中心座標を平行移動。
  - ホイール / ピンチズーム: カーソル位置を中心に拡大縮小（0.5倍〜3.0倍にクランプ）。
  - リセットボタン: 初期全体表示へワンタップで復元。

### 3. 軽量マスターデータの構造と配置
- **決定**: `nice_class_board.json`（全量2.8MB）から、表示と計算に必要な属性のみを抽出した軽量マスターデータ `lib/class-score/board-data/` を作成する。
- **データ型**:
  ```ts
  export type ClassBoardSquare = {
    id: number
    posX: number
    posY: number
    iconUrl: string
    name: string
    detail: string
    isLock: boolean
    items: { id: string; name: string; amount: number }[]
  }
  export type ClassBoardLine = {
    id: number
    prevSquareId: number
    nextSquareId: number
  }
  export type ClassBoardDetail = {
    key: ClassScoreClassKey
    name: string
    squares: ClassBoardSquare[]
    lines: ClassBoardLine[]
    initialSquareId: number
  }
  ```

### 4. 状態管理（State & Storage）モデル
- **決定**: `STORAGE_KEYS.CLASS_SCORE` のデータ構造を安全に拡張する。
  ```ts
  export type ClassBoardSquareStatus = 'none' | 'target' | 'unlocked'

  export type ClassScoreState = {
    classes: Partial<Record<ClassScoreClassKey, ClassScoreStatus>> // 既存のクラス全体設定
    boards?: Partial<Record<ClassScoreClassKey, {
      unlocked: number[] // 解放済みマスID一覧
      targets: number[]  // 目標マスID一覧
    }>>
  }
  ```
- **優先順位**:
  - `boards[key]` にマス個別データがある場合: マス単位の差分素材を算出。
  - `boards[key]` が未設定で `classes[key] === 'target'` の場合: 既存どおりクラス全体の最大必要素材を計上。

### 5. 最短ルート探索アルゴリズム（BFS）
- **決定**: 盤面のトポロジーグラフ（隣接リスト）に対し、起点マス（`initialSquareId`）から目的マスまでの最短経路（ホップ数最小）を幅優先探索（BFS）で求める。
- **動作**: ユーザーが「このマスまでルート一括目標」を押すと、経路上の未解放マスが自動的に `targets` に追加される。

## Risks / Trade-offs

- **[Risk] スマホ画面でのSVGタッチ操作とスクロールの衝突**
  → **Mitigation**: 盤面領域に `touch-action: none` を適用し、画面外にページスクロール可能なヘッダー/フッター余白を確保する。
- **[Risk] アイコン画像のロード失敗・外部依存**
  → **Mitigation**: Atlas Academy CDN のアイコンが読み込めない場合のフォールバック（スキルタイプに応じたSVGアイコン表示）を用意する。
