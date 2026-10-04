# Tasks

## 1. レジストリと一覧合成（純粋関数）

- [ ] 1.1 `data/event-features.ts` に `EVENT_FEATURES`（80614: `craft`、meta は Atlas basic_event の名前・startedAt=1786532400・endedAt=1788321599）を追加する。検証: 型チェックが通る。
- [ ] 1.2 `lib/event-features.ts` に `featuresFor(id, hasKvBox)`、`mergeEventList(kvEvents, registry)`（KV meta 優先・features 和集合・ID 重複なし）、`latestCraftEventId()` を実装する。検証: `lib/event-features.test.ts` のケース表（KV のみ／レジストリのみ／両方／どちらも無し、registry meta の started < ended）が通り、優先順位を反転させると赤くなることを一度確認する。

## 2. need 源の共通化

- [ ] 2.1 `lib/event-plan.ts` の `computeShortfall` から総必要数の集計を `computeTotalNeed` として切り出し、`computeShortfall` はそれを使う。検証: 既存 `lib/event-plan.test.ts` が無変更で通る＋`computeTotalNeed` の単体ケース（disabled サーヴァント／disabled ターゲット除外）を追加。
- [ ] 2.2 `hooks/use-roster-need.ts` に、永続ロスターの読み取り・有効サーヴァント抽出・`getMaterialsForServantIds` 取得・`computeTotalNeed` を行うフックを作り、`EventPlannerClient` の同等処理を置き換える。検証: ボックス計画の育成インパクト表示がローカルで変更前と同じ値になる。

## 3. イベントページ（ハブ）

- [ ] 3.1 `components/events/EventHubClient.tsx` を新設し、`EventPlannerClient` からヘッダー（戻る導線・名前・会期・状態バッジ）を移す。`EventPlannerClient` はボックス計画セクションの中身だけにする。検証: KV モックのボックスイベントで画面が変更前と同じ入力・結果を出す。
- [ ] 3.2 `components/events/EventCraftSection.tsx` を新設し、`useRosterNeed` → `buildNeedByApiItemId`（`useStockTarget`・`useDrops`）で `fullNeed` を作って `EventCraftAdvisor` に渡す。ロスター未設定時は配分計算せず、`/material` への導線付きの案内を出す。検証: コンポーネントテストでロスター有／無の表示分岐を確認する。
- [ ] 3.3 `app/events/[id]/page.tsx` を、KV とレジストリの両方を引いて `EventHubClient` を描画する形にする（どちらも無ければ `EventDataMissing`、`craft` があれば `getItems()` を渡す）。検証: `/events/80614`・KV モックのボックスイベント・存在しない ID の3通りをローカルで開いて確認する。

## 4. 一覧・導線・名称

- [ ] 4.1 `app/events/page.tsx` で `mergeEventList` の結果を `EventListClient` に渡し、一覧に機能バッジ（ボックス計画／料理作成）を出す。検証: ローカルで 80614 が終了済みに並び、モックのボックスイベントと重複なく出る。
- [ ] 4.2 `components/dashboard/EventSection.tsx` の導線条件を `hasLottery || craft 登録` にし、ラベルを「イベントページ」にする。検証: `EventSection.test.tsx` に craft 登録イベント・機能なしイベントのケースを追加し、条件を外すと赤くなることを確認する。
- [ ] 4.3 ナビ（`components/common/nav.tsx`）を「イベント / Events」に、一覧ヘッダーと説明文を新しい i18n キーで書き換える。キーは `locales/ja.json` と `locales/en.json` に同時追加し、`t('key', '日本語フォールバック')` 形式にする。検証: `pnpm run lint:ratchet` と目視。

## 5. 素材選択アドバイザーからの移設

- [ ] 5.1 `components/material/material-selection-advisor.tsx` からタブ UI・`AdvisorTab`・`EventCraftAdvisor` 描画を削除し、`latestCraftEventId()` のイベントページへのリンクを置く。`STORAGE_KEYS.MATERIAL_ADVISOR_TAB` を削除する。不要になった `advisor-tab-*` の i18n キーを整理する。検証: `material-selection-advisor.test.tsx` を更新（タブが無いこと・リンクが出ること・旧タブ値 `summer-2026` が保存されていてもクラッシュしないこと）。
- [ ] 5.2 料理作成の localStorage（`material/event-craft-advisor-config`）がイベントページで復元されることを確認する。検証: ローカルで `/material/result` 時代の入力が残った状態から `/events/80614` を開いて食材数とパターンが復元される。

## 6. 全体確認

- [ ] 6.1 `pnpm run type-check`・`pnpm test`・`pnpm run lint:ratchet` が通る。
- [ ] 6.2 ブラウザ実機確認（`pnpm dev`）: `/events`、`/events/80614`、ボックスイベント詳細、ダッシュボード導線、`/material/result` のリンクを、375px 幅とデスクトップで確認する。料理作成の計算が完了しパターンカードが出ること。
- [ ] 6.3 `openspec validate event-hub-page --strict` が通る。
