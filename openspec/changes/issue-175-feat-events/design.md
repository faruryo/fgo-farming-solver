# Design

## Context

### 交換所から育成計画と所持数を使えるか（確認済み）

ロトの無い交換所イベントでは、`app/events/[id]/page.tsx`（サーバー）が KV のイベントを読み、`components/events/EventHubClient.tsx`（`'use client'`）が `EventShopList` を出す。育成計画と所持数は、どちらもブラウザの localStorage にあり、クライアントの部品から読める。サーバーや D1 を新しく読む必要は無い。

- 育成計画: `hooks/use-roster-need.ts` の `useRosterNeed()`。`STORAGE_KEYS.MATERIAL` の育成対象から `getMaterialsForServantIds` で素材を取り、`computeTotalNeed` で素材ごとの総必要数（atlasId → 個数）を返す。状態は `empty`（育成対象なし）・`loading`・`error`（一部の取得に失敗）・`ready` の4つ。localStorage には書かない
- 所持数: `useLocalStorage(STORAGE_KEYS.POSSESSION, {}, { lazyWrite: true })`。所持数のページ（`PossessionModal` など）が保存する実所持数で、atlasId の文字列 → 個数（`number | undefined`）。`STORAGE_KEYS.ITEMS` は周回目標で、キーも drops の `item.id` と体系が違う。箱計画（`EventPlannerClient`）は既存の挙動を保つために `ITEMS` を読んでいるが（`openspec/specs/event-planner/spec.md`）、`EventCraftSection` は `POSSESSION` を読んでおり（event-hub-page の design で実所持数と周回目標を分けると決めた）、この change はそちらに合わせる
- 箱計画（`EventPlannerClient` の roster モード）は、この2つから `computeShortfall`（必要数 − 所持数、0 以下は除く）を出している。`EventCraftSection` も `useRosterNeed` を使い、`empty` のときに「育成対象を設定する」（`/material`）のリンクを出している
- 交換所の品目の `itemId` は atlasId で、`computeShortfall` のキーと同じ ID 体系（`computeRosterImpact` が `shopItem.itemId` で突き合わせている）

`useRosterNeed` は、hook を呼ぶ部品ごとに `getMaterialsForServantIds` で素材を取得する（`lib/get-materials.ts` にキャッシュは無い）。交換所だけのイベントでは `EventPlannerClient` は出ないが、`isShopOnlyEvent` は craft との組み合わせを除外しないので、shop と craft が両方あるイベントでは `EventShopList` と `EventCraftSection` が二重に取得する。今のレジストリ（`data/event-features.ts`）に該当するイベントは無いので、この change では取得を共有せず、許容する。

### 今の交換所の画面（#168・#176 の後）

- 上部: 周回の合計の1行、「全部交換」の操作（#176 で「効率の良いところまで交換」は消える）
- 通貨ごとのカード: 品目の行（順位・品目・1回の個数・在庫上限・1回の対価・回数・効率）、所持数（通貨）、必要量
- 周回の内訳、AP 予算

## Goals / Non-Goals

**Goals:**
- 品目の行に、育成計画から見た要る・要らないを出す
- 要る分だけを交換回数に入れる操作と、そのときに交換所で埋まらない不足の要約を出す

**Non-Goals:**
- 周回で落ちる素材（イベントの周回クエストのドロップ）で不足が埋まる分。周回の内訳はイベント通貨を集める周回で、素材のドロップを不足に充てると、要る分の計算と周回の計算が互いに依存する。まず交換所だけで埋まる分を出し、ドロップで埋まる分は別 issue にする
- 通貨（イベントアイテム）の所持数を、所持数のページの値から自動で入れること。今の通貨の所持数の入力のまま
- 交換回数の保存（epic #129 の「やらないこと」E2）
- 箱計画（ロトのあるイベント）の roster モードの変更

## Decisions

### 1. 不足は `computeShortfall` と同じ定義で、`EventShopList` で求める

`EventShopList` で `useRosterNeed()` と所持数（`STORAGE_KEYS.POSSESSION`、`lazyWrite: true`）を読む。`ready` のときだけ、`computeShortfall` と同じ「総必要数 − 所持数（0 未満は 0）」を求める。`useRosterNeed` が返す `totalNeed` をそのまま使い、所持数を引くだけの純粋関数を `lib/event-shop-summary.ts` に置く。`computeShortfall` を呼ぶと総必要数を作り直すため、使わない。品目の状態は、総必要数が 0 なら「育成計画で使わない」、不足が 0 なら「足りている」、それ以外は「あと N 個」とする。礼装・サーヴァントは総必要数に現れないので、「育成計画で使わない」になる。QP（atlasId 1）は `computeTotalNeed` が総必要数に足しているが、交換所の QP の品目で育成計画の QP を埋める使い方は想定せず、桁も他の素材と合わないので、対象から外す。QP の品目にはラベルを出さず、要るものだけ交換では 0 回にし、要約に数えない。所持数の正規化は `EventPlannerClient` と同じく `Number(v) || 0` とする。

### 2. 要る分の回数は新しい純粋関数で出し、`allocateShop` は使わない

`lib/event-shop-summary.ts` に、交換所と不足（atlasId → 個数）から、品目ごとの交換回数（`ShopExchangeCounts`、キーは交換所の配列の添字）と、素材ごとに交換所で埋まらない残りを返す純粋関数を置く。交換所の元の順に品目を見て、まだ埋まっていない不足を `qty` で割って切り上げ、`limitNum > 0` なら `limitNum` で打ち切り、得る個数を差し引く。

採らなかった案: 箱計画の `allocateShop` を使う。`allocateShop` は品目ごとに同じ需要を丸ごと当てるので、同じ素材の品目が複数あると二重に数える。また `limitNum` が 0（在庫上限なし）の品目を `Math.min(..., 0)` で 0 回にしてしまう。直すと箱計画の結果が変わるので、この change では触れない。

### 3. 操作は交換回数を置き換えるだけで、計算は既存の流れに乗せる

「要るものだけ交換」は、2 の交換回数で `counts` を置き換える（`setCounts`）。必要量・周回の内訳・合計・AP 予算は、今の `computeShopCurrencyNeeds` → `planShopCurrencies` の流れでそのまま出る。育成計画や所持数が変わっても `counts` は変えない。操作は「全部交換」の隣に置き、説明の1行（例:「育成計画で足りない分だけ」）を添える。

### 4. 交換所で埋まらない不足と要約

2 の関数が返す残りから、在庫上限まで交換しても残る素材の品目に「交換所では N 個足りない」を出す。同じ素材の品目が複数あるときは、その素材の最後の品目の行に出す。要約は、交換所に品目のある素材のうち不足が 1 以上のものの数と、残りが 0 になるものの数を、上部の操作の近くに1行で出す。要約と「交換所では N 個足りない」は、操作を押す前から、要る分を全部交換したと仮定して出す。押す前と後で変わらないので、利用者が回数を手で変えても要約は変えない。

### 5. 育成計画が使えないとき

`empty` のときは、`EventCraftSection` と同じ文言の型で「育成対象を設定すると、足りている品目と要る分が分かります」と `/material` へのリンクを出し、操作を `disabled` にする。`loading` は読み込み中の1行、`error` は既存の `event-roster-material-error` の文言を出し、どちらも操作を `disabled` にする。どの状態でも、品目の行・全部交換・交換回数の入力・周回の内訳は今のまま出す。

### 6. 画面

- 品目の行: 品目名の下に小さなラベルで「足りている（交換不要）」「あと N 個」「育成計画で使わない」を出す。「足りている」は行の文字を薄くして、交換不要がひと目で分かるようにする。「交換所では N 個足りない」は「あと N 個」の横に出す
- 上部: 「全部交換」の隣に「要るものだけ交換」と説明の1行。その下に要約の1行、または未設定・読み込み中・失敗の1行
- 375px で横スクロールを出さない。ラベルは品目名の下に折り返す
- 文言は `locales/ja.json` と `locales/en.json` に足す

## Risks / Trade-offs

- [同じ素材が通貨の違う複数の品目にあるとき、交換所の元の順に割り当てるので、対価の安い品目が後回しになり、周回数が最小にならないことがある] → 交換所で埋まるか・埋まらないかの判定は変わらない。最小の周回にはしないと決めて、利用者は回数を手で変えられる
- [#176 と同じ `EventShopList.tsx` の上部の操作と品目の行に触れる] → 実装（ops-graph）は #176 のマージ後に main から始める
- [周回で落ちる素材を数えないので、要る分を多めに交換させる] → Non-Goals に書き、別 issue にする。要約の文言は「交換所で埋まる」とし、周回のドロップを含むと読めないようにする
- [育成計画の素材の取得は通信が要る] → `useRosterNeed` の既存の取得をそのまま使う。失敗しても交換所の既存の機能は使える（決定 5）

## Migration Plan

保存先のキーと KV のデータの形は変えない。育成計画と所持数は読むだけ。実装 PR を戻せば、元の表示に戻る。
