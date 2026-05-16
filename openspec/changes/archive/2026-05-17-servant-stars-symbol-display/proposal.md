## Why

サーヴァント詳細ページの右上にあるSTARS欄が数字（例: `5`）で表示されており、視覚的なわかりやすさに欠ける。星記号（✦✦✦✦✦）で表示することでゲームのレアリティ表現と一致させ、UIの直感性を向上させる。

## What Changes

- サーヴァント詳細ページの STARS stat ブロックで、`servant.rarity` の数値を `✦` 記号を rarity 個並べた文字列に置き換える。
- rarity が 0 の場合は特別扱い（例: `✦` を1個表示するか、空欄）。

## Capabilities

### New Capabilities

- なし（既存表示ロジックの変更のみ）

### Modified Capabilities

- `ui-framework`: servant detail page の STARS 表示が数値から記号列に変わる（表示要件の変更）

## Impact

- `components/servants/servant.tsx` の STARS 表示箇所のみ変更。
- 依存ライブラリ追加なし。
- i18n 影響なし（"STARS" ラベル自体は変更しない）。
