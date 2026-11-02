# Tasks

## 1. 品目キーと保存値の読み方

- [ ] 1.1 `lib/event-shop-summary.ts` に、交換所の配列から品目キー（design の Decisions 2）を作る関数と、添字のキーの交換回数と品目キーの表を相互に変換する関数（今の交換所に無い品目キーは捨て、在庫上限のある品目は `clampExchangeCount` で頭打ちにする）を足す。`lib/event-shop-summary.test.ts` に、specs の「並びが変わった交換所」「同じ獲得物が同じ通貨で2つ並ぶ」「無くなった品目」「在庫上限が減った品目」「同じ獲得物で個数や対価の違う品目が前に加わる」と、サーヴァント扱いとアイテムで番号が同じ品目を取り違えないケースを足し、`pnpm vitest run lib/event-shop-summary.test.ts` が通ることで確かめる
- [ ] 1.2 保存値を交換回数・所持数・ボーナスの3つの表に直す関数（design の Decisions 3。全体や各表が表でなければ空、有限の数でない値は捨て、小数は切り捨て、負の数は 0）を `lib/event-shop-summary.ts` に足し、イベント ID から保存のキー（`events/shopInputs/<イベント ID>`）を作る関数を `lib/constants/storage-keys.ts` に足す（`CLOUD_SYNC_KEYS` には入れない）。specs の「保存値全体が壊れている」「一部の値が壊れている」をテストに足し、`pnpm vitest run lib/event-shop-summary.test.ts` が通ることで確かめる

## 2. 交換所の画面の保存

- [ ] 2.1 `components/events/EventShopList.tsx` の `counts`・`owned`・`bonus` の `useState` を、design の Decisions 5 のとおり、イベントごとのキーの `useLocalStorage`（`lazyWrite: true`、1.2 の関数を `onGet`）と、それを添字のキーに直す `useMemo` に置き換える。欄の変更・「全部交換」・「不足素材のみ」の書き込みはすべて関数形の setter で行う。`EventShopList` の説明のコメント（「画面を開いている間だけ持つ」）を直し、`EventShopList` を描く箇所に `key={event.id}` を渡す。`components/events/EventHubClient.test.tsx` に、specs の「開き直しても残る」「別のイベントには混ざらない」「開いただけでは書き込まない」「全部交換の後に開き直す」「不足素材のみの後に開き直す」「交換所のボーナスを開き直したとき」と、同じ画面のまま別のイベントに描き直しても前のイベントの値が新しいイベントに書かれないテストと、壊れた保存値（JSON として読めない文字列）で画面が落ちないテストを足し、`pnpm vitest run components/events/EventHubClient.test.tsx` が通ることで確かめる
- [ ] 2.2 箱計画の入力が保存されないこと（specs の「箱計画は保存しない」「画面を開き直したとき」）が `components/events/EventPlannerClient.test.tsx` の既存か追加のテストで確かめられていることを確認し、無ければ足して `pnpm vitest run components/events/EventPlannerClient.test.tsx` が通ることで確かめる

## 3. 確認

- [ ] 3.1 `pnpm type-check`、`pnpm lint`、`pnpm vitest run` が通ることを確かめる <!-- verify-only -->
- [ ] 3.2 dev server で 80632 のイベントページを開き、交換回数・所持数・ボーナスを入れてから読み込み直して値が残ること、別のイベントの交換所に混ざらないことを実画面で確かめる <!-- verify-only -->
