## Why

`material-tracking-mode`（アーカイブ済）の task 5.5（任意項目）が後続送りになっていた。育成記録モードにおける現在値の減算ジェスチャー（再臨ピップ／スキル・アペンドチップの長押し 500ms）実行中、ユーザーに「押している最中である」という視覚的な手がかりが無く、長押しが成立するかどうか（-1 が発火するタイミング）を目視で判断できない。

## What Changes

- `components/material/servant-card.tsx` の再臨ピップ・スキルチップ・アペンドチップに、`pointerdown` 開始から `pointerup`/`pointerleave`/`pointercancel` までの間だけ有効な「押下中」状態（`pressedKey`）を追加し、対象要素に `is-pressing` クラスを付与する。
- `app/globals.css` に `.c-sum-pip.is-pressing` / `.c-sum-card.is-pressing` を追加し、押下中は軽い縮小（scale）＋明度低下＋インセットシャドウで「押し込まれている」感触を表現する。
- 既存の `cursor: pointer`（`.c-sum-pip` / `.c-sum-card` に既存）と合わせて、長押し中のフィードバックを完成させる。
- 長押し判定ロジック（500ms のタイマー、-1 適用、下限クランプ、コンテキストメニュー処理）は一切変更しない。視覚状態は判定結果に影響しない。

## Capabilities

### New Capabilities

*(なし)*

### Modified Capabilities

- `material`: 「現在値の減算ジェスチャー」要件に、長押し中の視覚フィードバック（押下中の軽いプレス表現）を追加する。

## Impact

- `components/material/servant-card.tsx`: 押下中の要素キーを保持する state を追加（表示用途のみ、判定ロジックには不参加）。
- `app/globals.css`: `.c-sum-pip.is-pressing` / `.c-sum-card.is-pressing` の追加。
- 右クリック（contextmenu）による -1 はワンショットのため、視覚フィードバックの対象外（既存挙動どおり即時発火）。
