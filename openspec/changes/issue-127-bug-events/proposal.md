## Why

開催中の「復刻版:盈月剣風帖」（Atlas event `80632`）が、ダッシュボードの「イベントページ」リンクにも `/events` 一覧にも出ない（#127）。取り込みが「ロトが空ならイベントごと捨てる」ため、Atlas にある交換所と周回クエストが KV に入らないことが原因である。ロトの無いイベントは珍しくなく、直近1年の `eventQuest` 79件のうち、ロトがあったのは1件、ロトが無く交換所があるのは11件だった（design.md の実測）。導線だけ戻して空のページを出すのは直したことにしない（#127 の材料コメント）。

## What Changes

- 取り込みのスキップ条件を「ロトも交換所も無ければスキップ」に緩める。交換所とクエストのドロップは箱イベントと同じ処理で取り込み、ロトは空配列で入れる
- 交換所の各エントリーに、対価の通貨の表示名とアイコンを任意項目として持たせる（既存の `name`・`icon` と同じ後方互換の任意項目）。通貨が複数ある交換所で、通貨ごとの合計を名前つきで出すため
- イベント機能の判定に `'shop'` を足す。KV に交換所があれば `'shop'`、ロトがあるときだけ `'box'` を返す（いまは KV にあれば無条件に `'box'`）。箱0件のイベントで壊れた箱計画画面を出さない
- ロトの無いイベントのページに、交換所の一覧（通貨ごとの、全交換に要る合計と品目）を出す。箱のあるイベントは、今までどおり箱計画の中で交換所を扱う
- `/events` 一覧の機能バッジに交換所を足す。ダッシュボードのリンクと一覧への掲載は、KV に入ることの結果として出る

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `event-planner`: 取り込み対象をロトの無い交換所イベントへ広げる。一覧と個別ページの機能判定に交換所を足し、ロトの無いイベントでは交換所一覧を出す。

## Impact

- `scripts/refresh-event-data.ts`（スキップ条件、交換所の通貨名）
- `lib/master-data/types.ts`（`EventShopItem` の任意項目）
- `data/event-features.ts`・`lib/event-features.ts`（`'shop'` と判定）、`app/events/page.tsx`・`app/events/[id]/page.tsx`
- `components/events/EventHubClient.tsx`、新しい交換所一覧のコンポーネント、`components/events/EventListClient.tsx`（バッジ）、locales
- KV の `event_data_json` は、1年分でおよそ 220 KB 増える（design.md）

## 範囲外

- 交換所からの周回計画: #128
- ミッション・ポイント報酬の取り込み: #115
