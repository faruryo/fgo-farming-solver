## 1. データ準備の上限を拡張

- [x] 1.1 `RecommendedQuest.tsx` の recentResult ブランチで `topRates` の `.slice(0, 3)` を `.slice(0, 5)` に変更
- [x] 1.2 同ファイルの fallback ブランチで `questDrops` の `.slice(0, 3)` を `.slice(0, 5)` に変更

## 2. PC 表示の描画を更新

- [x] 2.1 JSX の `topItems.slice(1, 3)` を `topItems.slice(1, 5)` に変更し、PC 表示で最大 5個 のアイテムアイコンを表示する
- [x] 2.2 全アイテムアイコンのサイズを `size={26}` → `size={22}` に変更（1行維持・NearGoalSection との高さ統一のため）
- [x] 2.3 コメント「ドロップアイコン: スマホ1個、PC3個」を「スマホ1個、PC最大5個」に更新
