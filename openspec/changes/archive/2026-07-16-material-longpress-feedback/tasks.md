## 1. 視覚フィードバック実装

- [x] 1.1 `components/material/servant-card.tsx` に押下中の要素キーを保持する state（`pressedKey`）を追加し、`handlePointerDown` / `handlePointerEndOrLeave` / `handleContextMenu` で更新する。長押し判定タイマー・`-1` 適用ロジック・下限クランプは変更しない。
- [x] 1.2 スキルチップ・アペンドチップの `className` に、押下中のみ `is-pressing` を付与する。
- [x] 1.3 `app/globals.css` に `.c-sum-card.is-pressing` を追加し、軽い scale 縮小 + 明度低下 + インセットシャドウで押下感を表現する。既存の `.c-sum-card:active` とは共存させる。
- [x] 1.4 タッチ（pointerdown → pointercancel/pointerup）・マウス（pointerdown → pointerup/pointerleave）双方で、長押しキャンセル時に `is-pressing` が確実に解除されることを確認する。
- [x] 1.5 再臨ピップの長押し -1 を廃止する（点灯ピップクリックの -1 と重複のため。2026-07-16 実機確認後のユーザー判断）。ピップには contextmenu 後の click 抑止フラグをリセットする `handlePipPointerDown` のみ残し、プレス表現も撤去する。

## 2. 検証

- [x] 2.1 `pnpm run type-check` をパス。
- [x] 2.2 `pnpm run lint` をパス。
- [x] 2.3 `pnpm test` をパス（既存テストへの影響なしを確認）。
- [x] 2.4 実機（ブラウザ）で `/material` において、チップの長押し中に押下フィードバックが表示され、途中キャンセルで即座に元へ戻ること、ピップが長押しに反応しないことを確認する（2026-07-16 ローカル dev server でユーザー視認済み）。

## 3. ドキュメンテーション & 公開

- [x] 3.1 `openspec validate material-longpress-feedback --strict` をパス。
- [x] 3.2 マージ後、`openspec archive material-longpress-feedback` で specs を更新する。（2026-07-16 実施。ピップ長押し廃止を含む最終形で本specへ同期）
