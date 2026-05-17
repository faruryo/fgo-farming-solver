## Why

PC表示の「周回予定クエスト」カードに表示されるドロップアイテムアイコンが最大3個に制限されており、クエストの収穫性を一目で把握しにくい。レイアウト余裕が十分あるため、5個まで増やしてより多くの情報を提供する。

## What Changes

- `RecommendedQuest.tsx` のデータ準備で `topItems` を `.slice(0, 3)` → `.slice(0, 5)` に変更（recentResult ブランチ・fallback ブランチの両方）
- PC 表示（sm ブレークポイント以上）でのアイテムアイコン表示を最大 3個 → 最大 5個 に変更
- モバイル表示は引き続き 1個のみ（変更なし）

## Capabilities

### New Capabilities
<!-- なし -->

### Modified Capabilities
- `dashboard`: 推奨周回クエスト (RecommendedQuest) のアイテムアイコン表示数の要件を追加（PC: 最大5個、モバイル: 1個）

## Impact

- `components/dashboard/RecommendedQuest.tsx` のみ変更
- データフェッチや API への影響なし（既存の drop_rates データを追加利用するだけ）
- レスポンシブ対応はそのまま維持（`hidden sm:flex` パターンを継続）
