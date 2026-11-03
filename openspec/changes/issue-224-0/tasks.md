# Tasks

## 1. 保存値を読み終えた印

- [x] 1.1 `hooks/use-local-storage.ts` の `useLocalStorage` の返り値に3つ目の要素（保存値を読み終えたかの真偽値）を足す。保存値の `setState` と同じ effect で立て、`useInitial` のときはマウント後に印だけ立てる。印は読み終えたキーについて立て、キーが変わった描画では新しいキーを読むまで立てない。既存の呼び出し側は変えない。`hooks/use-local-storage.test.tsx` に、最初の描画では印が立たず初期値であること、印が立った描画では値が保存値であること（保存値が無ければ初期値）、`useInitial` でも印が立つこと、キーを変えた描画では印が立たないことのテストを足し、`pnpm vitest run hooks/use-local-storage.test.tsx` が通る

## 2. 育成計画の「まだ読んでいない」

- [x] 2.1 `hooks/use-roster-need.ts` の `RosterNeed` に状態 `unread` を足し、育成計画の保存値を読み終えるまで `unread` を返す。読み終えた後の `empty` / `loading` / `error` / `ready` は今のまま。`components/events/EventCraftSection.tsx` の `resolveBlockedView` と `components/events/EventShopList.tsx` の育成計画の行（`RosterLine`）の状態の分岐を、扱いの無い状態があると型エラーになる網羅の形に書き換える。最初の描画で `unread`、保存値の無い端末で読み終えたら `empty` になるテストを足し、通る
- [x] 2.2 `components/events/EventPlannerClient.tsx` は `unread` を `empty` と同じに扱い（育成計画のボタン・未設定の説明・入力モードの初期値を今のまま保つ）、`components/events/EventCraftSection.tsx` は `unread` を `loading` と同じ読み込み中の表示にする。`components/events/EventCraftSection.test.tsx` に、育成計画を読む前は未設定の案内を出さず読み込み中になるテストを足す。`components/events/EventPlannerClient.test.tsx` に、`useRosterNeed` を `unread` にしたとき、育成計画のボタンが出ず、育成計画の未設定の説明が `empty` のときと同じに出て、入力モードが「箱数」で始まるテストを足す（`components/events/EventHubClient.test.tsx` の `vi.mock('../../hooks/use-roster-need', ...)` の形を使える）。既存のテストも変えずに通る。`pnpm type-check` が通る

## 3. AP 予算

- [x] 3.1 `components/events/ApBudget.tsx` の `useApBudgetProfile` が、マスターレベルと黄金の果実の両方を読み終えたかを返す。`ApBudgetInputs` は印が立つまで欄の代わりに `components/ui/skeleton.tsx` の `Skeleton`（囲む要素に `aria-busy`）を出し、交換所の `ShopApBudget`（`components/events/EventShopList.tsx`）も自分の `useApBudgetProfile` の印が立つまで内訳の代わりにスケルトンを出す。`components/events/ApBudget.test.tsx` に、保存値を読む前は既定のマスターレベルと黄金の果実の 0 の欄を出さず、読み終えたら保存値の欄になるテストを足し、通る

## 4. 交換所

- [x] 4.1 `components/events/EventShopList.tsx` の `EventShopList` は、交換所の入力・所持数・品目の「要る」の印がすべて立ち、育成計画が `unread` でなくなるまで、返す要素のうち `rosterPlan.loader` を除くすべて（`PlanSummary`、`SelectControls` と育成計画の行、`CurrencyGroupCard`、`ShopBonusCard`、`PerRunTable`、`FarmingPlan`、`ShopApBudget`）の代わりに `Skeleton`（囲む要素に `aria-busy`、表のおおよその高さ）を出す。`EventShopCatalog` は変えない。文言と翻訳の辞書は変えない
- [x] 4.2 交換所のテスト（`components/events/EventHubClient.test.tsx` か、新しい `components/events/EventShopList.test.tsx`）に次を足して通す。保存値のあるイベントで、保存値を読む前の描画（サーバー描画を `react-dom/server` で描いたものを含む）に交換回数・所持数・ボーナスの欄が無く、読み込み中の表示があり、「周回の合計」の文言と1周の獲得量の表（`data-testid="shop-per-run"`）も無いこと。読み終えたら交換回数・所持数・ボーナスが保存値で表示され、必要量がその値で計算されること。保存値の無いイベントを開いて読み終えたら欄が 0 で、端末に書き込まれていないこと。育成計画の保存値を読む前は「育成対象を設定すると…」の案内を出さないこと。交換所の保存値は読み終え、`useApBudgetProfile` を mock して AP 予算の印が立たない状態にしたとき、周回の内訳に AP 予算の内訳と欄が無く読み込み中の表示があること

## 5. 確認

- [ ] 5.1 `pnpm lint`、`pnpm lint:ratchet`、`pnpm type-check`、`pnpm vitest run` が通る <!-- verify-only -->
- [ ] 5.2 `pnpm dev` を起動したブラウザで /events/80632 の交換所に交換回数・所持数・ボーナスを入れて読み込み直し、保存値が出る前に 0 が見えず読み込み中の表示になること、ロト計画のあるイベントで育成計画のボタンと入力モードの初期値が今までと同じであることを確かめる <!-- verify-only -->
