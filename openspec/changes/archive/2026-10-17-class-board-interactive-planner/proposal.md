## Why

現在のクラススコアシミュレータは「クラス全体の全解放（最大目標）」の一括指定のみに対応しています。しかし実際のFGOでは、各クラスのクラスボード上に約80〜90個のサイン（マス）とツアーロック（関所）が配置されており、ユーザーは「特定のバフ（Busterクリティカルや宝具威力等）のルートだけを狙って解放する」「現在途中まで解放しており、追加でこのマスまで解放したい」といった段階的・戦略的な育成を行います。

ゲーム内のクラスボード画面（白紙化地球と星座盤マップ）をWeb上で再現し、マスを視覚的に選択して「解放済み」「目標」を指定できるようにすることで、ユーザーの実情に即した正確な必要素材（QP・星光の砂・トーチ・通常素材・モニュピ）の算出と周回目標への反映を実現します。

## What Changes

- **クラスボード盤面ビジュアルシミュレータの導入**:
  - 各クラス詳細画面（`/material/class-score/[className]`）を新設。
  - ゲーム内のクラスボードと同じ配置・トポロジー（Atlas Academy公式データ準拠）をSVGキャンバスで描画（マス、接続線、スキルアイコン、ツアーロック）。
  - パン・ドラッグ移動、ピンチ/ホイールによるズーム対応。
- **マス単位のインタラクティブな状態管理**:
  - 各マスに対して「未解放」「目標（target）」「解放済（unlocked）」を設定可能。
  - マスタップ時にサイン詳細ポップアップ（付与効果、必要QP、砂、トーチ、通常素材）を表示。
  - ルート一括選択機能（起点から対象マスまでの最短経路を一括で目標に設定）。
- **差分必要素材の動的集計と目標反映**:
  - `(目標マス - 解放済マス)` の必要素材を正確に集計。
  - 算出した必要素材を既存のクラススコア目標システム経由で `/material/result`（素材計算結果）および周回ソルバーに自動合算。
- **データ永続化と後方互換性**:
  - マス単位の解放・目標状態を `localStorage` の `classScore` 構造に統合（従来のクラス単位一括設定との互換性を維持）。
  - クラウド同期に対応。

## Capabilities

### Modified Capabilities

- `class-score`: クラスボードの盤面マップ表示、マスごとの状態管理（未解放/目標/解放済）、マスタップ詳細表示、最短ルート選択、マス差分による必要素材集計の要件を追加。
- `material`: マス単位選択によって動的計算されたクラススコア必要素材が、素材結果画面および周回ソルバーへ正確に合算反映される要件を更新。

## Impact

- **Affected Code**:
  - `app/material/class-score/[className]/page.tsx`（新設）
  - `components/class-score/board-canvas.tsx`（新設: SVGボードマップ）
  - `components/class-score/square-dialog.tsx`（新設: サイン詳細ダイアログ）
  - `components/class-score/class-card.tsx`（盤面詳細への導線追加）
  - `lib/class-score/board-data.ts`（新設: Atlas Academyのマス配置・ライン・素材軽量マスタ）
  - `lib/class-score/calculate-board-diff.ts`（新設: マス差分素材集計ロジック）
  - `hooks/use-class-score.ts`（マス単位状態の更新メソッド追加）
- **APIs & Master Data**:
  - Atlas Academy `nice_class_board.json` から抽出したクラスボードデータ。
- **Dependencies**:
  - 新規外部依存ライブラリの追加はなし（Next.js、React、Tailwind CSS、lucide-react のみ使用）。
