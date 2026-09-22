## 1. 共通コンポーネントの実装とテスト

- [x] 1.1 `components/common/collapsible-section.tsx` を作成し、カード型スタイル・ヘッダーバー・Chevron開閉インジケータ・アクセシビリティ（aria属性）を実装する
- [x] 1.2 `components/common/collapsible-section.test.tsx` を作成し、初期展開/折りたたみ、クリックトグル、キーボード操作、イベント伝播制御を単体テストする

## 2. 育成計算機結果画面 (/material/result) への適用

- [x] 2.1 `components/material/result.tsx` の「配布・交換券アドバイザー」アコーディオンを `CollapsibleSection` に置き換える
- [x] 2.2 `components/material/result.tsx` の「周回対象に含めるクエスト」アコーディオンを `CollapsibleSection` に置き換える
- [x] 2.3 関連コンポーネントテスト（`components/material/result.test.tsx` 等）を確認・更新し、開閉動作とアンカー設定（`#advisor`）を検証する

## 3. 品質検証

- [x] 3.1 `pnpm run type-check`、`pnpm run lint`、`pnpm test` を実行し、全テストと型チェックが合格することを確認する
- [x] 3.2 `openspec validate collapsible-section-ui --specs` を実行し、仕様整合性を確認する
