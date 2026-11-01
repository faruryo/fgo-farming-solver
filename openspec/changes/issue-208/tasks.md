# Tasks

## 1. 既定で交換する品目の状態と割り当て

- [x] 1.1 `lib/event-shop-summary.ts` に既定で交換する品目の番号の集合（6999・1000）と判定の関数を置き、`shopItemStatus` が育成計画で扱う素材の一覧を読めないときも伝承結晶を `unused`（必要数 0 のとき）、夢火を `outside` にするようにする。`lib/event-shop-summary.test.ts` の `shopItemStatus` に、一覧を読めないときの伝承結晶と夢火（specs の「一覧を読み込めないときの既定で交換する品目」）と、サーヴァント扱いの同じ番号の品目が含まれないケースを足し、`pnpm vitest run lib/event-shop-summary.test.ts` が通ることで確かめる
- [x] 1.2 `allocateShortfallOnly` を design の「割り当て」のとおりにする（「必要」の既定で交換する品目を在庫上限まで、在庫上限なしは不足の分か 0 と案内、「不要」なら今までどおり）。specs の「不足素材のみ」の既定で交換する品目の8つの Scenario（2・2・1 の3品目、夢火、不足 1・上限 2、不足 5・上限 2 の残り 3、在庫上限なし、不足を埋めた後の在庫上限なし、不要にした伝承結晶、不要にした不足の無い品目）をテストに足し、`pnpm vitest run lib/event-shop-summary.test.ts` が通ることで確かめる

## 2. 保存と表示

- [x] 2.1 `components/events/EventShopList.tsx` の `useWantedItems` を design の「保存」のとおりにし（既定で交換する品目は「不要」を `false` で保存、未選択は「必要」）、`allocateShortfallOnly` に解決後の「必要」のキーを渡す。切り替えを、状態のある既定で交換する品目の行（「使わない」「足りている（交換不要）」「あと N 個」「計画の対象外」）にも出し、在庫上限なしの案内の対象になった既定で交換する品目で回数 0 のときに「上限なし: 回数を入れてください」を出す。`components/events/EventHubClient.test.tsx` に、未選択の伝承結晶が「使わない」と「必要」の切り替えで表示され不足素材のみで在庫上限の回数が入るテスト、伝承結晶を「不要」にすると不足素材のみで 0 になり選択が端末に `false` で残るテスト、未選択の夢火が「必要」で上限まで入るテストを足し、`pnpm vitest run components/events/EventHubClient.test.tsx` が通ることで確かめる

## 3. 確認

- [ ] 3.1 `pnpm type-check`、`pnpm lint`、`pnpm vitest run` が通ることを確かめる <!-- verify-only -->
