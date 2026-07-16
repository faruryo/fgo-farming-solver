## Why

`material-tracking-mode`（アーカイブ済）の task 5.5（任意項目）が後続送りになっていた。育成記録モードにおける現在値の減算ジェスチャー（再臨ピップ／スキル・アペンドチップの長押し 500ms）実行中、ユーザーに「押している最中である」という視覚的な手がかりが無く、長押しが成立するかどうか（-1 が発火するタイミング）を目視で判断できない。

## What Changes

- `components/material/servant-card.tsx` のスキルチップ・アペンドチップに、`pointerdown` 開始から `pointerup`/`pointerleave`/`pointercancel` までの間だけ有効な「押下中」状態（`pressedKey`）を追加し、対象要素に `is-pressing` クラスを付与する。
- `app/globals.css` に `.c-sum-card.is-pressing` を追加し、押下中は軽い縮小（scale）＋明度低下＋インセットシャドウで「押し込まれている」感触を表現する。
- **再臨ピップの長押し -1 は廃止する**（実機確認の結果、点灯中ピップのクリックによる -1 と機能が重複するため。2026-07-16 ユーザー判断）。ピップの減算はクリックまたは右クリックで行い、プレス表現も付与しない。ただし contextmenu 後の click 抑止フラグは pointerdown でのリセットが前提のため、ピップにはフラグリセットのみの `handlePipPointerDown` を残す。
- チップ側の長押し判定ロジック（500ms のタイマー、-1 適用、下限クランプ、コンテキストメニュー処理）は一切変更しない。視覚状態は判定結果に影響しない。

## Capabilities

### New Capabilities

*(なし)*

### Modified Capabilities

- `material`: 「現在値の減算ジェスチャー」要件に、チップ長押し中の視覚フィードバック（押下中の軽いプレス表現）を追加し、再臨ピップを長押しの対象外に変更する。

## Impact

- `components/material/servant-card.tsx`: 押下中の要素キーを保持する state を追加（表示用途のみ、判定ロジックには不参加）。ピップの長押しタイマー起動を撤去。
- `app/globals.css`: `.c-sum-card.is-pressing` の追加。
- 右クリック（contextmenu）による -1 はワンショットのため、視覚フィードバックの対象外（既存挙動どおり即時発火）。
- material-component-tests（PR #14）のピップ長押しテスト2件は本 change のマージ後に新仕様（長押しで変化しない）へ更新が必要。
