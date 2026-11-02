# Design

## Context

`components/events/EventShopList.tsx` の `EventShopList` は、交換回数（`counts`、キーは交換所の配列の添字）・通貨の所持数（`owned`、キーは対価の通貨の番号）・ボーナス（`bonus`、キーは通貨かイベントポイントの品目の番号）を `useState` で持つ。計算の関数（`computeShopCurrencyNeeds`・`selectAllCurrenciesUpToLimit`・`allocateShortfallOnly` など、`lib/event-shop-summary.ts`）は添字のキーの `ShopExchangeCounts` を受け取る。端末の保存は `hooks/use-local-storage.ts` の `useLocalStorage` を使い、計画の対象外の品目の「要る」（`STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS`）は `lazyWrite` と `onGet: recordOrEmpty` で読み書きしている。`useLocalStorage` はマウント後に保存値を読み、`JSON.parse` の失敗は握りつぶして初期値のまま進む。クラウド同期は `CLOUD_SYNC_KEYS` に並べたキーだけを送る。

箱計画（`components/events/EventPlannerClient.tsx`）の所持通貨・箱数・ボーナスなども `useState` だが、この change では触らない。

`openspec/specs/event-planner/spec.md` の「ロトの無い交換所イベントの周回計画」は「回数の初期値は0」と書く。この change では、それを「保存値の無い欄の初期値」と読み、event-planner の要件は書き換えない（event-planner の spec には未 archive の change `issue-127-bug-events` の delta があり、同じ capability を MODIFIED にすると archive の順で要件が消えるため）。保存値を戻すことは新しい capability `event-shop-saved-inputs` に書く。同じ要件のシナリオ「上限まで選ぶ」の「在庫上限の無い品目は0のままになる」も、保存値の無い品目についての記述と読み、保存値のある品目は操作の前の回数のままになる（`event-shop-saved-inputs` の「全部交換の後に開き直す」）。

## Goals / Non-Goals

**Goals:**
- 交換所の3つの入力を、イベントごとの端末の保存に置き換える（specs の `event-shop-saved-inputs`）
- 交換回数を品目を見分ける組で保存し、取り込み直しで並びが変わっても別の品目に当たらないようにする

**Non-Goals:**
- 箱計画の入力の保存（#212 の決めること③。箱計画は入力の種類と入力モードが多く、別の issue で扱う）
- クラウド同期（決めること②。まずは端末だけ）
- 終わったイベントの保存値の掃除（決めること①。下の Decisions 4）
- 計算の関数の引数（添字のキーの `ShopExchangeCounts`）の変更

## Decisions

1. **イベントごとに1つのキーに3つをまとめて保存する。** キーは `events/shopInputs/<イベント ID>`（`STORAGE_KEYS` に接頭辞の定数と、イベント ID からキーを作る関数を足す）。中身は `{ counts: Record<品目キー, number>, owned: Record<通貨番号, number>, bonus: Record<番号, number> }`。`useLocalStorage` を `lazyWrite: true`（開いただけで書かない）と、下の `onGet` で使う。`CLOUD_SYNC_KEYS` には入れない。
   - 代わりの案: 全イベントを1つのキーにまとめる。イベントが増えるほど毎回の書き込みが大きくなり、1つのイベントの壊れた値が他のイベントの読み込みに巻き込まれるので採らない。
   - 代わりの案: 3つを別のキーにする。キーが3倍になり、壊れた値の扱いを3か所に書くことになるので採らない。
2. **交換回数の品目キー。** `lib/event-shop-summary.ts` に、交換所の配列から品目キーを作る関数を足す。キーは `<種類>:<獲得物の番号>:<1回の個数>:<対価の通貨の番号>:<1回の対価の個数>:<同じ組での出現順>`（種類はアイテムなら `item`、サーヴァント扱いなら `svt`、出現順は交換所の元の順で同じ前5つを持つ品目に 0 から振る）。個数と対価を組に入れるのは、同じ獲得物・同じ通貨で個数や対価の違う品目が前に加わったときに、出現順だけで結び付けると回数がその品目へずれるため。保存するときは添字のキーの `counts` を品目キーの表に変え、読むときは今の交換所の品目キーから添字に戻す。今の交換所に無い品目キーは捨てる。在庫上限は組に入れない（取り込み直しで上限だけが変わっても回数を残し、`clampExchangeCount` で今の上限に頭打ちにする）。
   - 代わりの案: 在庫上限も組に入れる。上限の変更で回数が消えるうえ、同じ獲得物・同じ通貨で上限だけが違う品目の区別は出現順で足りるので採らない。
3. **壊れた値の読み方。** `onGet` に、保存値を3つの表に直す関数を渡す。全体が表でなければ空の3つの表、各表は表でなければ空、各値は有限の数でなければ捨て、小数は切り捨て、負の数は 0 にする（`clampExchangeCount` と同じ規則）。`JSON.parse` の失敗は `useLocalStorage` が初期値（空）のまま進むので、追加の処理は要らない。`repairOnGet` は使わない（読むだけで書かない）。
4. **終わったイベントの保存値は消さない。** 1イベントの保存値は品目と通貨の数だけの数値で数 KB に収まり、イベントは年に数十件なので、掃除の仕組み（会期の判定・最後に使った日の記録）を持つ方が重い。終わったイベントもページで計画を試せる（event-planner の「終了済みイベントのシミュレート」）ので、残っていても害はない。
5. **状態の持ち方。** `EventShopList` の3つの `useState` を、1つの `useLocalStorage` と、それを添字のキーの `counts`・`owned`・`bonus` に直す `useMemo` に置き換える。書き込みはすべて関数形の setter（`setInputs(prev => ...)`）で行い、マウント後の読み込みと競合して入れた値が消えないようにする。「全部交換」「不足素材のみ」は今の計算の関数で添字のキーの回数を作り、品目キーの表に直して保存する。`useShopRosterPlan` が受け取る `setCounts` は、添字のキーの回数を受けて保存する関数にする。 呼び出し側（`EventHubClient`）は `EventShopList` に `key={event.id}` を渡し、イベントが変わったら作り直す。`useLocalStorage` はキーが変わっても状態と「変えた」印を初期化しないので、同じインスタンスのままイベントが変わると前のイベントの値が新しいイベントのキーに書かれうるため。

## Risks / Trade-offs

- [獲得物・個数・通貨・対価がすべて同じで在庫上限だけが違う品目の並びが取り込み直しで入れ替わると、出現順で結び付けた回数も入れ替わる] → 必要量は個数と対価が同じなので、変わるのは在庫上限での頭打ちだけで、画面は落ちない
- [マウント直後、保存値を読む前に利用者が操作すると、その操作が保存値で上書きされうる] → 読み込みはマウント直後の effect で、利用者の操作より先に終わる。setter はすべて関数形にする
- [保存値が端末に残り続ける] → Decisions 4 のとおり量は小さい。必要になったら掃除を別の change で足す

## Migration Plan

今までは保存していないので、移す保存値は無い。戻すときはコードを戻すだけで、残った `events/shopInputs/<イベント ID>` のキーは読まれなくなる。
