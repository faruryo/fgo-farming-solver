# Tasks

## 1. レジストリと一覧合成（純粋関数）

- [x] 1.1 `data/event-features.ts` に `EVENT_FEATURES`（80614: `craft`、表示用 `meta` は必須プロパティとして Atlas basic_event の名前「カルデア南海大決戦！ ～マジムンアイランドに謎の巨人の影を見た～」・startedAt=1786532400・endedAt=1788321599）を追加する。検証: 型チェックが通り、`meta` を欠いたエントリが型レベルで禁止されること。
- [x] 1.2 `lib/event-features.ts` に `featuresFor(id, hasKvBox)`、`mergeEventList(kvEvents, registry)`（KV meta 優先・features 和集合・ID 重複なし）、`latestCraftEventId()` を実装する。検証: `lib/event-features.test.ts` のケース表（KV のみ／レジストリのみ／両方／どちらも無し、registry meta の started < ended）が通り、優先順位を反転させると赤くなることを一度確認する。

## 2. need 源の共通化

- [x] 2.1 `lib/event-plan.ts` の `computeShortfall` から総必要数の集計を `computeTotalNeed` として切り出し、`computeShortfall` はそれを使う。検証: 既存 `lib/event-plan.test.ts` が無変更で通る＋`computeTotalNeed` の単体ケース（disabled サーヴァント／disabled ターゲット除外）を追加。
- [x] 2.2 `hooks/use-roster-need.ts` に、ドロップデータに依存しない形で、副作用なし（read-only、`localStorage.setItem` を呼ばない）での永続ロスター読み取り・有効サーヴァント抽出・`getMaterialsForServantIds` 取得・取得 ID 完全性確認（部分欠落ガード）・`computeTotalNeed` を行うフックを作り、`EventPlannerClient` の同等処理を置き換える。また `hooks/use-farming-purpose.ts` のマウント時自動書き込みを撤廃しつつ、旧キー（`QUEST_EFFICIENCY_SHORTAGE_ONLY`, `STOCK_ENABLED`）が残る端末では `migrateFarmingPurpose` による旧設定のメモリ上復元を維持し、明示選択時のみ保存する。検証: ボックス計画の育成インパクト表示がローカルで変更前と同じ値になること、未設定端末および旧キー保持端末でナビやフックを呼び出しても `localStorage.setItem` が呼ばれずに正しく `purpose` が解決されること、一部サーヴァントの素材取得欠落時に計算を中断する単体テストを追加。

## 3. イベントページ（ハブ）

- [ ] 3.1 `components/events/EventHubClient.tsx` を新設し、`EventPlannerClient` からヘッダー（戻る導線・名前・会期・状態バッジ）を移す。`EventPlannerClient` はボックス計画セクションの中身だけにする（所持数キー `STORAGE_KEYS.ITEMS` は無変更）。検証: KV モックのボックスイベントで画面が変更前と同じ入力・結果を出す。
- [ ] 3.2 `components/events/EventCraftSection.tsx` を新設し、`useRosterNeed` → 実所持数 `STORAGE_KEYS.POSSESSION` 読み取り → `buildNeedByApiItemId`（`readStockTargetReadOnly`・`useDrops`）で `fullNeed` を作って `EventCraftAdvisor` に渡す。ロスター未設定時は配分計算せず `/material` への導線付き案内、素材取得中・`drops.isLoading === true` 時はローディング表示、素材取得失敗・部分欠落・ドロップ取得完了後（`drops.isLoading === false`）に正の need に関与するカタログ・レート・クエストデータの欠落が検知された時は削減周回/APの過大評価を防ぐエラー案内を表示し、`purpose === 'all'` 時は育成フォールバック注記を出す。検証: 単体テストで実所持数 `STORAGE_KEYS.POSSESSION` が使われること（周回目標との乖離テスト）、正の need を持つ素材のドロップ率欠落時に計算が中断されること、ドロップ失敗時に永続ローディングにならずエラーになること、および画面マウント時に `localStorage.setItem` が呼ばれないことを確認する。
- [ ] 3.3 `app/events/[id]/page.tsx` を、KV とレジストリの両方を引いて `EventHubClient` を描画する形にする（どちらも無ければ `EventDataMissing`、`craft` があれば `getItems()` を渡す）。検証: `/events/80614`・KV モックのボックスイベント・存在しない ID の3通りをローカルで開いて確認する。

## 4. 一覧・導線・名称

- [ ] 4.1 `app/events/page.tsx` で `mergeEventList` の結果を `EventListClient` に渡し、一覧に機能バッジ（ボックス計画／料理作成）を出す。検証: ローカルで 80614 が終了済みに並び、モックのボックスイベントと重複なく出る。
- [ ] 4.2 ダッシュボードへの KV 取り込み済みイベント ID 集合の伝搬経路（`/api/dashboard-meta` または `app/page.tsx` での取得）を実装し、`components/dashboard/EventSection.tsx` の導線条件を「KV ロトデータ存在 または レジストリ登録」と一致させ、ラベルを「イベントページ」にする。検証: `EventSection.test.tsx` に KV ロトあり・craft 登録・KV 未取り込み・機能なしイベントのケースを追加し、条件を外すと赤くなることを確認する。
- [ ] 4.3 ナビ（`components/common/nav.tsx`）を「イベント / Events」に、一覧ヘッダーと説明文を新しい i18n キーで書き換える。キーは `locales/ja.json` と `locales/en.json` に同時追加し、`t('key', '日本語フォールバック')` 形式にする。検証: `pnpm run lint:ratchet` と目視。

## 5. 素材選択アドバイザーからの移設

- [ ] 5.1 `components/material/material-selection-advisor.tsx` からタブ UI・`AdvisorTab`・`EventCraftAdvisor` 描画を削除し、`latestCraftEventId()` のイベントページへのリンクを置く。`STORAGE_KEYS.MATERIAL_ADVISOR_TAB` を削除する。不要になった `advisor-tab-*` の i18n キーを整理する。検証: `material-selection-advisor.test.tsx` を更新（タブが無いこと・リンクが出ること・旧タブ値 `summer-2026` が保存されていてもクラッシュしないこと）。
- [ ] 5.2 料理作成の localStorage（`material/event-craft-advisor-config`）がイベントページで復元されることを確認する。検証: ローカルで `/material/result` 時代の入力が残った状態から `/events/80614` を開いて食材数とパターンが復元される。

## 6. 全体確認

- [ ] 6.1 `pnpm run type-check`・`pnpm test`・`pnpm run lint:ratchet` が通る。
- [ ] 6.2 ブラウザ実機確認（`pnpm dev`）: `/events`、`/events/80614`、ボックスイベント詳細、ダッシュボード導線、`/material/result` のリンクを、375px 幅とデスクトップで確認する。料理作成の計算が完了しパターンカードが出ること。
- [ ] 6.3 `openspec validate event-hub-page --strict` が通る。
