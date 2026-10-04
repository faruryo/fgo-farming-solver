# Design

## Context

- `/events` と `/events/[id]` は KV `event_data_json`（ロト型イベントだけ）を読む。`app/events/[id]/page.tsx` は KV に無い ID を `EventDataMissing` にする。
- 料理作成アドバイザー（`components/material/event-craft-advisor.tsx`）は `items`・`fullNeed`・`stockEnabled` を props で受け取り、周回データは `useDrops()` で自前に取る。`fullNeed` は `/material/result` の `MaterialSelectionAdvisor` が、計算結果の `amounts` と所持数から `buildNeedByApiItemId`（`lib/quest-efficiency.ts`）で作っている。
- 料理作成の対象イベント 80614 は lotteries を持たないため、KV には入っていない（Atlas basic_event: `eventQuest`, 2026-08-12〜2026-09-02）。
- ボックス計画（`EventPlannerClient`）は永続ロスター（`STORAGE_KEYS.MATERIAL` の `ChaldeaState`＋`STORAGE_KEYS.ITEMS`）を読み、`getMaterialsForServantIds` → `computeShortfall`（`lib/event-plan.ts`）で不足を出している。
- ダッシュボードの `EventSection` は `DashboardEvent.hasLottery` のときだけ「ボックス計画」導線を出す。

## Goals / Non-Goals

**Goals:**
- イベントページを「ヘッダー＋機能セクションの並び」にし、新機能はセクション1個とレジストリ1行の追加で載せられるようにする。
- 料理作成アドバイザーをコード変更最小で移す（計算・Worker・永続化キーは触らない）。

**Non-Goals:**
- KV スキーマや取り込みワークフローの変更。
- セクションの汎用プラグイン機構（動的 import やレジストリ駆動の自動描画）。機能が3つ以上になってから考える。

## Decisions

### D1. 静的レジストリ `data/event-features.ts`
`EVENT_FEATURES: Record<number, { features: EventFeature[]; meta: { name; startedAt; endedAt } }>`、`EventFeature = 'craft'` から始める。ボックス計画は KV の有無で決まるのでレジストリに書かない（二重管理を避ける）。
- 代替案: 取り込みワークフローで 80614 の basic 情報も KV に入れる → データ側の変更になり今回のスコープ外。meta は Atlas の公開値の転記で、ライセンス上の問題は無い。
- `lib/event-features.ts` に純粋関数 `featuresFor(id, kvEvent?)` と `mergeEventList(kvEvents, registry)` を置く（一覧合成・導線判定・ページ構成で共有、テスト対象）。

### D2. 一覧は「サマリ型」に寄せる
`EventListClient` は現在 `EventPlannerEvent` 全体を受けるが、一覧に要るのは id・名前・会期・機能だけ。`EventSummary { id; name; startedAt; endedAt; features: ('box' | 'craft')[] }` をサーバー側（`app/events/page.tsx`）で合成して渡す。KV とレジストリの両方にある ID は KV の meta を優先し、features は和集合にする。

### D3. イベントページの構成
`app/events/[id]/page.tsx`（server）で KV イベントとレジストリを引き、どちらも無ければ `EventDataMissing`。あれば `EventHubClient`（新規）に `{ summary, boxEvent?, items? }` を渡す。
- ヘッダー（戻る導線・名前・会期・状態バッジ）は `EventPlannerClient` から切り出して `EventHubClient` に移す。
- `EventPlannerClient` は「ボックス計画セクション」として中身だけを残す（計算・入力は無変更）。
- 料理作成は `EventCraftSection`（新規の薄いラッパー）で描画する。`items` は server で `getItems()` を呼んで渡す（`/material/result` と同じ取り方）。
- セクションは `features` に応じた条件分岐で並べる。汎用レンダラは作らない。

### D4. 料理作成の need を永続ロスターから作る
`computeShortfall` の前半（ChaldeaState × materialsForServants → 総必要数）を純粋関数 `computeTotalNeed` として切り出し、`computeShortfall` はそれを使う形にする（挙動は不変、既存テストで担保）。`EventCraftSection` は
1. ロスター有無の判定と `getMaterialsForServantIds` の取得（`EventPlannerClient` と同じ）
2. `computeTotalNeed` → atlasId 文字列キーの `amounts`
3. `useStockTarget()` の `stockBuffer`・`purpose` と `useDrops()` で `buildNeedByApiItemId(amounts, possession, drops, stockBuffer, purpose)`
を行い、`EventCraftAdvisor` に `fullNeed`・`stockEnabled` を渡す。ロスター取得部分は `EventPlannerClient` と重複するので小さなフック `useRosterNeed()` に寄せ、両セクションで使う。
- 代替案: `/material/result` の `amounts` を URL や localStorage で受け渡す → 結果画面を経由しないと使えなくなる。ボックス計画と need 源が揃わない。
- 差分: `/material/result` は「今の計算画面の対象」、イベントページは「永続ロスター」が need 源になる。通常は同じ ChaldeaState なので一致するが、共有 URL 由来の計算結果を見ている場合は異なり得る。ボックス計画と同じ定義に揃えることを優先する。

### D5. 素材選択アドバイザーのタブを外す
`AdvisorTab` とタブ UI・`EventCraftAdvisor` の描画を削除し、交換券・配布の本体の上に `/events/80614` へのリンク（`Link`、i18n）を置く。リンク先は `EVENT_FEATURES` から `craft` を持つ最新イベントを引く（`latestCraftEventId()`）。`STORAGE_KEYS.MATERIAL_ADVISOR_TAB` はクラウド同期対象ではない（`lib/cloud-sync` から参照なし）。定数ごと削除し、端末に残った値は読まれずに放置される。

### D6. ダッシュボード導線
`EventSection` の導線条件を `event.hasLottery || featuresFor(event.id).includes('craft')` にし、ラベルを「ボックス計画」から「イベントページ」に変える。

### D7. 名称
ナビ `{ ja: 'イベント', en: 'Events' }`、一覧ヘッダー `イベント一覧 / Events`、説明文をボックス限定でない文言に変える。i18n キーは既存キーの値を変えるのではなく新キー（`event-list-title` 等、kebab-case）を追加し、`ja.json`/`en.json` 両方に入れる。

## Risks / Trade-offs

- [need 源の変更で `/material/result` と料理配分の結果が変わり得る] → D4 の差分を料理作成セクションの説明文で「育成ロスターの不足で計算」と明示する。
- [レジストリ meta の手書き誤り] → 80614 の値は Atlas basic_event の値をそのまま使い、テストで会期の大小関係（started < ended）を確認する。
- [`EventPlannerClient` の分割で挙動が変わる] → 計算部は動かさず、ヘッダー JSX の移動だけに留める。既存の `lib/event-plan.test.ts` と画面の実機確認で担保する。
- [料理作成の Worker がイベントページの bundle に入る] → 既存と同じ遅延生成（`new Worker(new URL(...))`）のままなので初期表示への影響は小さい。

## Migration Plan

- KV / D1 の移行なし。デプロイは main への push で自動。
- 料理作成の localStorage キー（`material/event-craft-advisor-config`）は据え置きなので、入力済みの食材数はそのまま引き継がれる。
- ロールバックは revert のみで足りる。
