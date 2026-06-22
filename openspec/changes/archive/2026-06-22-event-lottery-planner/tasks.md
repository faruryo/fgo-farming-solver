# Tasks

## Phase 0: 事前調査（spec 確定の前提）
- [x] Atlas `nice_event/{eventId}` の `lotteries` / `shop` 形状を実イベント(80586「最終物資補給作戦」)で確認・型確定。
  - lottery: `cost.item`(通貨アイテム) + `cost.amount`(1抽選あたり通貨数)。`boxes[]` は `boxIndex`(箱ラウンド) でグルーピング、各 box は `gifts[].objectId`/`gifts[].num`、`maxNum`(その内容の箱内個数)、`isRare`。1箱の通貨コスト = Σ`maxNum` × `cost.amount`、1箱の中身 = `gifts` を `num`×`maxNum` で集計。実例: 1箱=300抽選×amount2=600通貨、全11箱(boxIndex 0-10)。
  - shop: `purchaseType`('item'/'servant'/'commandCode' — 素材は 'item')、報酬 = `targetIds` × `setNum`(gifts が空のとき)、対価 = `cost.item`+`cost.amount`、在庫 = `limitNum`、`payType`='eventItem'。
- [x] イベント周回クエストの `drops` データ実在性を確認(Risk 1 裏取り)。**結論: 取れる。** 周回ノードは type='event' / afterClear='repeatLast'。`/nice/JP/quest/{id}/{phase}` の `drops[]` に `objectId`/`num`/`runs`/`dropCount` があり、1周あたり期待値 = `dropCount/runs × num`。実例: 通貨≈54個/周(AP40)。新規イベント序盤はデータ遅延しうるため手入力フォールバック(US-5)は維持。
- [x] design.md の Open Questions を決定し spec に反映（レア=素材は充当/鯖礼装CCは別表示、在庫上限まで充当し超過は警告→ソルバ、主=ロスター不足素材/副=直接指定）。

## Phase 1: データ取り込み
- [x] `lib/master-data/types.ts` にイベント型（`EventCurrency`/`EventLotteryBox`/`EventShopItem`/`EventFarmingNode`/`EventPlannerEvent`/`EventData`）を追加。
- [x] `scripts/refresh-event-data.ts`: 開催中＋直近終了(30日)イベントを対象に `nice_event` 取得 → 手動バリデーション(Zod未導入のため) → コンパクト化 → `event_data_json` 生成。lottery 無しはスキップ。
- [x] GH Actions ワークフロー `refresh-event-data.yml`（日次 02:17 UTC）。`wrangler kv key put event_data_json`。`refresh-nice-war.yml` 雛形・同 namespace。
- [x] `lib/get-events.ts`: `fetchData('event_data_json','mocks/events.json')` で KV 読み出し＋dev フォールバック。`getEvents`/`getActiveEvents`/`getEventById`。
- [x] `mocks/events.json` に実イベント(80586「最終物資補給作戦」: 11箱・周回ノード5)を追加。

## Phase 2: 算出ロジック
- [x] `lib/event-plan.ts` `calcBoxLayer`: ボックス層（箱数⇄通貨⇄確定報酬の決定論計算、所持通貨差し引き）。
- [x] `allocateShop`: 在庫上限(`limitNum`)を考慮した通貨→素材配分、超過は overflow 警告。
- [x] `buildEventDrops`/`runEventSolver`: 自己完結 `Drops`(Atlas ID 文字列) に合成し `solve()` を呼ぶアダプタ（ソルバ無改修）。
- [x] `reverseCalcBoxes`: 「欲しいアイテム数 → 最小箱数逆算」（交換所 limitNum 考慮）。
- [x] `computeShortfall`/`computeRosterImpact`: 既存 `ChaldeaState`＋`get-materials` を **pure/read-only** で受け、不足素材→充当率→残需要を算出（UI が async データを注入）。
- [x] 単体テスト `lib/event-plan.test.ts`（31件）: 箱計算・在庫上限警告・確定/周回分離・ソルバ連携・充当率。全 965 件緑。

## Phase 3: UI
- [x] `app/events/page.tsx`(server)+`components/events/EventListClient.tsx`: イベント一覧（開催中/予定/終了の区分・会期表示）。
- [x] `app/events/[id]/page.tsx`(server)+`components/events/EventPlannerClient.tsx`: 3入力モード（ロスター不足素材[主]/箱数指定/欲しい素材→逆算）＋育成インパクト・所持通貨・周回ノード・手入力ドロップ。ロスター未設定はフォールバック。read-only 厳守。
- [x] `components/events/EventPlanResultCard.tsx`: 必要通貨・箱数・周回数・消費AP・果実換算・確定/周回内訳・レアボックス別表示・データソース(atlas/manual/none)明示。
- [x] `components/events/EventDataMissing.tsx`: データ未取得プレースホルダ（クラッシュなし）。
- [x] `components/dashboard/EventSection.tsx`: 各イベントカードに「ロト計画」導線追加。
- [x] `components/common/nav.tsx`: `/events` 一覧への常設ナビエントリ追加（Tools グループ・Gift アイコン・「ロトイベント」）。ブラウザ確認済（2026-06-21, ドロワー内に表示）。
- [x] `locales/{ja,en}.json`: `events` 名前空間 + `dashboard.ロト計画` 追加。

## Phase 4: 検証
- [x] `pnpm run type-check` / `pnpm run lint` クリーン・全 979 テスト緑（独立再走で監査）。
- [x] `pnpm dev` + ブラウザ実物確認完了（browser-use, 2026-06-21）。HTTP 200 に加え、対話部分も実機で確認: モード切替・開催中バッジ（残り日数）・箱数スライダー→ソルバ再計算（5箱→3,000通貨/67周/2,680AP）・所持通貨減算（1000→必要2,000/45周）・交換所在庫上限警告（超過で「在庫上限に達したアイテムがあります」＋⚠）すべて緑。コンソールクラッシュ/500 なし。
  - 検証で判明した2件はいずれも対応済み: ①`/events` 一覧をグローバルナビに配線（上記 nav.tsx タスク, ブラウザ確認済）。②アイテム名解決を実装（下記）。
- [x] ギフト分類バグ修正＋レア報酬の非表示化: `compactLotteries` が `box.isRare` だけで振り分け `gift.type` を見ず、非レア箱のサーヴァント(例 9770400)が contents(素材)に漏れて生ID誤表示されていた問題を、`gift.type` で振り分け（非アイテムは isRare 問わず contents に入れない）て解消。あわせてユーザー決定により「レアボックス報酬」セクションを非表示化、「欲しい素材で指定」候補を contents素材＋交換所のみに（rareRewards=サーヴァント/聖杯/伝承結晶/獣の足跡 を候補から除外）。`scripts/refresh-event-data.ts`・`mocks/events.json`(servant を contents から除去)・`EventPlannerClient.tsx`。ブラウザ確認済（生ID残存なし・レア箱セクションなし・候補はbulk素材のみ）。type-check/lint/31テスト緑。
- [x] 用語変更 ロト→ボックス: ファン用語に合わせ UI 表示を「ボックスイベント/ボックス計画」に統一（i18nキーは内部名のまま、ja 値とnavラベルを変更。en は Box Events）。`locales/ja.json`・`nav.tsx`。ブラウザ確認済。
- [x] 会期途中の「今開けた箱数」入力（US-4 拡張）: 所持通貨だけだと既開封箱のコストまで二重に周回させてしまうため、`openedBoxes` 入力を追加。`calcBoxLayer` は [openedBoxes, targetBoxes) の範囲でコスト/報酬を集計し、`boxesToOpen`(残り箱数) を返す。必要箱数表示を boxesToOpen に変更。i18n 追加。単体テスト2本追加。ブラウザ確認（目標30・開封10→残り20箱=12,000通貨/268周、所持5,000併用で7,000/157周）。
- [x] 目標箱数の11上限解放（無限ループロト対応）: `maxBoxes=lotteries.length` で箱数を11上限にしていたが、実ロトは `limited:false`＝最終箱が無限ループするため看板用途(あと何箱割れるか)が頭打ちだった。Atlas `lottery.limited` を `EventPlannerEvent.unlimitedBoxes` として取込(`types.ts`/`refresh-event-data.ts`/`mocks`)、`calcBoxLayer` で箱種類数超過分を最終箱の繰り返しとして計算、UI は数値入力の上限を解放しスライダーは削除（ユーザー要望）、必要箱数の `/11` 分母も unlimited 時は非表示。単体テスト2本追加(33緑)。ブラウザで30箱=18,000通貨/402周を確認。
- [x] アイテム名解決: イベントデータが名前を持たず生ID(`#{itemId}`)表示だった問題を、取込時に Atlas nice_item を join して `name`/`icon` を埋める方式で解消。`lib/master-data/types.ts`（contents/rareRewards/shop/drops に name・icon 追加）/ `scripts/refresh-event-data.ts`（nice_item マップで enrich）/ `mocks/events.json`（実名で更新）/ `EventPlanResultCard.tsx`・`EventPlannerClient.tsx`（name+icon 表示、name 無しは `#id` フォールバックで旧 KV 後方互換）。ブラウザ確認済（QP/マナプリズム/黄金の果実/各種輝石…名前+アイコン表示、生ID残存なし。nice_item 未収録の特殊3 ID のみ意図通り `#id` フォールバック）。type-check/lint/31テスト緑。本番 KV は refresh-event-data の GH Actions 再実行で名前が入る。
- [x] `openspec validate event-lottery-planner --strict` → valid。
