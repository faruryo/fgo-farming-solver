## 1. 料理データと最適化ソルバーの実装

- [ ] 1.1 水着2026の料理レシピと素材マスタデータ（`data/event-craft-recipes.ts`）を作成する。
- [ ] 1.2 多次元ナップサック ILP ソルバー（`lib/event-craft-advisor.ts`）を実装する（シャドウプライス連携、2段階価値、使い切りオプション、残余食材タイブレーク、マシュのアドバイス生成）。
- [ ] 1.3 ソルバーの単体テスト（`lib/event-craft-advisor.test.ts`）を作成し、AP/周回数最適化・使い切り・不足上限・残余食材最小化の各シナリオを網羅して検証する。

## 2. UIコンポーネントの実装

- [ ] 2.1 イベントクラフト入力および結果表示コンポーネント（`components/material/event-craft-advisor.tsx`）を実装する（食材入力、AP/周回モード切替、使い切りトグル、マシュのアドバイス、料理カード一覧、残余食材表示）。
- [ ] 2.2 `components/material/material-selection-advisor.tsx` にタブ切り替えUIを統合し、「毎月の交換券・配布」と「水着2026 料理作成」を切り替え可能にする。
- [ ] 2.3 localStorage によるタブ選択状態・食材数・設定の永続化を実装する。

## 3. テストと品質検証

- [ ] 3.1 UIコンポーネントのテスト（`components/material/material-selection-advisor.test.tsx` 等）を追加・更新する。
- [ ] 3.2 `pnpm run type-check`、`pnpm run lint`、`pnpm test` を実行し、型チェック・リント・テストがすべてパスすることを確認する。
