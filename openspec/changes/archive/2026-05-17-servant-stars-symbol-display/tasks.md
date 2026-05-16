## 1. 共通コンポーネント作成

- [x] 1.1 `components/common/ServantStars.tsx` を作成（SVG 5角星、グラデーション、縁線、重なり）

## 2. 既存4箇所の置き換え

- [x] 2.1 `components/servants/servant.tsx` の STARS ブロックを ServantStars に置き換える
- [x] 2.2 `components/servants/index.tsx` のグループヘッダー星表示を ServantStars に置き換える
- [x] 2.3 `components/dashboard/RecentServantSection.tsx` の span 配列星表示を ServantStars に置き換える
- [x] 2.4 `components/material/servant-card.tsx` の `c-portrait-stars` 内を ServantStars に置き換える

## 3. スタイル調整

- [x] 3.1 `.c-stats { align-items: flex-end }` に変更して STARS/CLASS 段差を修正
- [x] 3.2 `.c-stat-num { min-height: 1em }` を追加して rarity 0 のレイアウト崩れを防止
- [x] 3.3 `.c-portrait-stars` の `letter-spacing: -1px` を削除

## 4. 動作確認・テスト

- [x] 4.1 `/servants/200200`（rarity 5）で星が5個重なって表示されることを確認
- [x] 4.2 `/servants/1100100`（rarity 0）でレイアウトが崩れないことを確認
- [x] 4.3 `pnpm run lint && pnpm run type-check` がエラーなしで通ることを確認
- [x] 4.4 `pnpm playwright test --update-snapshots` でスナップショットを更新
