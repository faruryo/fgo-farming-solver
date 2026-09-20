## 1. クラスボード詳細マスタデータ構築

- [x] 1.1 Atlas Academy 公式データから全9クラスの軽量マス配置・接続ライン・要求素材データを抽出・生成するスクリプトおよび静的マスターデータを作成する
- [x] 1.2 マスタデータの型定義とデータローダー純関数（`lib/class-score/board-loader.ts`）を実装し、全クラスのデータ整合性を単体テストで検証する

## 2. マス差分素材集計 & 最短ルート探索ロジック

- [x] 2.1 起点マスから対象マスまでの最短経路（ノード列）を探索するBFS純関数（`lib/class-score/find-shortest-path.ts`）を実装し、単体テストを作成する
- [x] 2.2 `(目標マス - 解放済マス)` の必要素材（QP・砂・トーチ・素材・モニュピ）を集計する純関数（`lib/class-score/calculate-board-diff.ts`）を実装し、単体テストを作成する
- [x] 2.3 `hooks/use-class-score.ts` を拡張し、マス単位の状態更新、ルート一括選択、差分素材集計の反映を実装する

## 3. クラスボードSVGキャンバスとUIコンポーネント

- [x] 3.1 SVGのパン（ドラッグ移動）およびズーム（拡大縮小）を滑らかに制御するカスタムフック（`hooks/use-pan-zoom.ts`）を実装する
- [x] 3.2 ゲーム内を再現したSVG盤面マップコンポーネント（`components/class-score/board-canvas.tsx`）を実装する（マス、接続線、スキルアイコン、ツアーロック、未解放/目標/解放済の色分け）
- [x] 3.3 マスタップ時のサイン詳細ダイアログ（`components/class-score/square-dialog.tsx`）を実装する（効果説明、必要素材、状態切替、ルート一括目標ボタン）
- [x] 3.4 クラス別ボード詳細画面（`app/material/class-score/[className]/page.tsx`）を新設し、クラス一覧カード（`class-card.tsx`）からの遷移導線を配置する

## 4. 素材結果画面連携・多言語・品質検証

- [x] 4.1 マス単位で選択された必要素材が `/material/result`（素材結果画面）および周回ソルバーへ動的に合算反映されることを検証する
- [x] 4.2 多言語辞書（`locales/ja.json`, `locales/en.json`）に必要な翻訳キーを追加する
- [x] 4.3 `pnpm run type-check`、`pnpm run lint:ratchet`、`pnpm test run` を実行し、型チェック・lint・全ユニットテストが合格することを確認する
- [x] 4.4 `openspec validate class-board-interactive-planner --specs` を実行し、仕様整合性を確認する
