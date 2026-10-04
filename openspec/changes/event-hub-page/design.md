# Design: イベント専用ハブページ（Phase 1: 水着2026料理作成・ロト型共用）

## Context

現在、ボックスガチャ（ロト型）イベントは `/events`（一覧）と `/events/[id]`（`EventPlannerClient`）で計画機能を提供している。一方、水着2026の料理作成アドバイザーは `/material/result`（素材計算結果画面）内の第2タブ（`summer-2026`）に同居しており、以下の問題がある。

1. **場所が不自然**: イベント期間限りの機能が恒常機能（素材計算）のタブに埋もれている。
2. **ボックス以外のイベントデータ未保持**: KV `event_data_json` は `hasLottery` かつ `lotteries.length > 0` のイベントしか取り込まず、水着2026（80614）はスキップされて KV に存在しない。
3. **need 源の乖離**: ボックス計画は「育成ロスター（`ChaldeaState`）＋周回目標（`STORAGE_KEYS.ITEMS`）」から算出しているが、料理作成は `/material/result` の計算結果（`amounts`・`possession` = `STORAGE_KEYS.POSSESSION`）を受け取っている。
4. **イベント画面の名称がボックス前提**: ナビが「ボックス」、一覧の見出しが「ボックスイベント一覧」など、ロト型限定の表現になっている。

## Goals / Non-Goals

**Goals**:
- `/events/[id]` を、イベントごとに機能（ボックス計画・料理作成など）を並べるハブページに改修する。
- 料理作成アドバイザーを `/material/result` からイベントページに移設する。
- KV に無いイベントでも最小限のメタ（名前・会期）と利用可能機能を宣言できる静的レジストリを用意する。
- 料理作成の need 算出を「永続ロスター＋実所持数（`STORAGE_KEYS.POSSESSION`）」起点に統一する。
- 一覧・ナビの名称を「ボックス」から「イベント」に一般化する。

**Non-Goals**:
- ボックス以外のイベントデータ（ポイント報酬・ミッション・交換所）のバッチ取り込み（Phase 2: #115）。
- 手持ちサーヴァントに基づく特攻ボーナス評価やイベント優先度スコア（Phase 3: #116）。
- 料理作成アドバイザーの配分計算アルゴリズム自体の変更（既存の `lib/event-craft-*.ts` をそのまま移設）。
- 新規の汎用プラグイン機構やセクション動的ローダーの導入。

## Decisions

### D1. 静的機能レジストリ（`data/event-features.ts`）
イベント ID ごとに利用可能な機能（`features: ('box' | 'craft')[]`）と、KV 未保持時の表示用メタ（`summary: { name, startedAt, endedAt }`）を定義する。
- 型: `Record<number, { features: EventFeature[]; meta?: { name: string; startedAt: number; endedAt: number } }>`
- 80614（水着2026）は `features: ['craft']`、meta は Atlas basic_event の値を静的定義（名前: `カルデア南海大決戦！ ～マジムンアイランドに謎の巨人の影を見た～`、会期は JST unix 秒: `startedAt: 1786532400`, `endedAt: 1788321599`）。
- 理由: KV のスキーマ変更やバッチ改修（#115）を待たずに、現行コードだけで水着2026のイベントページを成立させる。
- 公開データ境界: メタデータは Atlas API / ゲーム内で公開済みの値のみを用い、未公開・解析データは含めない。

### D2. 一覧合成（`lib/event-features.ts`）
`/events` 一覧は、KV にあるロト型イベントと、静的レジストリにあるイベントの和集合を表示する。
- 重複排除: KV に存在しレジストリにもある場合は KV の `EventSummary` を優先し、`features` は両者の和集合とする（ロト型は暗黙に `box` を持つ）。
- 純粋関数 `mergeEventList(kvEvents, registry): EventSummaryWithFeatures[]` として実装し、テスト容易性を担保する。

### D3. イベントページの構成
`app/events/[id]/page.tsx`（server）で KV イベントとレジストリを引き、どちらも無ければ `EventDataMissing`。あれば `EventHubClient`（新規）に `{ summary, boxEvent?, items? }` を渡す。
- ヘッダー（戻る導線・名前・会期・状態バッジ）は `EventPlannerClient` から切り出して `EventHubClient` に移す。
- `EventPlannerClient` は「ボックス計画セクション」として中身だけを残す（計算・入力・所持数キー `STORAGE_KEYS.ITEMS` は無変更）。
- 料理作成は `EventCraftSection`（新規の薄いラッパー）で描画する。`items` は server で `getItems()` を呼んで渡す（`/material/result` と同じ取り方）。
- セクションは `features` に応じた条件分岐で並べる。汎用レンダラは作らない。

### D4. 料理作成の need 算出と境界
`computeShortfall` の前半（ChaldeaState × materialsForServants → 総必要数）を純粋関数 `computeTotalNeed` として切り出し、`computeShortfall` はそれを使う形にする（挙動は不変、既存テストで担保）。

共通フック `useRosterNeed()` の責務を以下に限定する：
- 永続ロスター（`STORAGE_KEYS.MATERIAL`）の副作用なし読み取り
- 有効サーヴァント抽出と `getMaterialsForServantIds` の取得
- サーヴァント素材の完全性検証（要求した `enabledServantIds` の全件が取得結果に含まれているか）
- `computeTotalNeed` による総必要数集計
※ `useRosterNeed()` はドロップデータ（`/api/drops`）に依存させない。これによりボックス計画セクションはドロップ取得の成否に影響されず独立して稼働できる。

`EventCraftSection` では以下を行う：
1. `useRosterNeed()` から総必要数 `amounts` を受け取る（未設定時は案内表示、ロード中はスケルトン表示、サーヴァント素材欠落時はエラー表示）。
2. 所持数として実所持数 `STORAGE_KEYS.POSSESSION`（`'posession'`）を副作用なしで読み取る（ボックス計画が読む周回目標 `STORAGE_KEYS.ITEMS` とは分離）。
3. ドロップデータ `useDrops()` の状態を検証する：
   - `drops.isLoading` が true の間はローディング表示。
   - `drops.isLoading` が false で `drops.items` が空、または料理対象素材（レシピ対象素材集合）が `drops.items` に見つからない場合は、過少計算を防ぐため配分計算を行わずエラー案内と再試行導線を表示する（全必要数の QP 等を除外し、照合対象を料理対象素材に限定）。
4. 設定値（`stockBuffer`, `purpose`）を副作用なし読み取り（`readStockTargetReadOnly`）で解決し、`buildNeedByApiItemId(amounts, possession, drops, stockBuffer, purpose)` を呼ぶ。
   - `purpose === 'all'` の場合は `training`（育成）としてフォールバック計算し、UI に `common:farming-purpose-advisor-fallback`（「配布評価は今の育成を使用」）を表示する。
5. `EventCraftAdvisor` に `fullNeed`・`stockEnabled` を渡す。

不変条件と境界の厳守：
- **読み取り専用（副作用なし）**: 未設定端末でページやナビを表示するだけで `localStorage.setItem` が走ることを根絶するため、`useFarmingPurpose` フックおよびセレクタのマウント時自動初期化書き込みを廃止し、未設定時はデフォルト値（`'training'`）をメモリ上だけで扱い、ユーザーが明示的に目的を切り替えた時のみ `localStorage.setItem` を実行する（遅延保存）。所持数・ストック目標・ロスターの読み取りもすべて副作用なしとする。
- **入力源による差異と計算アルゴリズムの同一性**: 同一の入力データに対しては既存と全く同一のアルゴリズム・算出結果を維持するが、料理作成は永続ロスターと実所持数（`STORAGE_KEYS.POSSESSION`）を need 源とするため、共有 URL や周回画面の一時入力とは結果が異なり得る。この差分はセクション説明文で「育成ロスターの不足で計算」と明示する。

### D5. 素材選択アドバイザーのタブを外す
`AdvisorTab` とタブ UI・`EventCraftAdvisor` の描画を削除し、交換券・配布の本体の上に `/events/80614` へのリンク（`Link`、i18n）を置く。リンク先は `EVENT_FEATURES` から `craft` を持つ最新イベントを引く（`latestCraftEventId()`）。`STORAGE_KEYS.MATERIAL_ADVISOR_TAB` はクラウド同期対象ではない（`lib/cloud-sync` から参照なし）。定数ごと削除し、端末に残った値は読まれずに放置される。

### D6. ダッシュボード導線
ダッシュボード（`app/page.tsx` および `EventSection`）において、ハブ（`/events/[id]`）で実際に機能を提供できる条件（KV `event_data_json` に取り込み済みのロトイベント ID 集合に含まれるか、または静的レジストリ `EVENT_FEATURES` に登録されていること）を満たすイベントにのみ「イベントページ」への導線を表示する。
- 伝搬経路: `/api/dashboard-meta`（または `app/page.tsx`）から KV 取り込み済みイベント ID 集合（`availableLotteryEventIds: number[]`）を返し、`EventSection` に渡す。
- 判定条件: `availableLotteryEventIds.includes(event.id) || featuresFor(event.id).length > 0`
- Atlas 側の `hasLottery` フラグが立っていても KV 未取り込みかつレジストリ未登録のイベントには導線を出さず、リンク遷移先で `EventDataMissing` が露出する不整合を防ぐ。導線ラベルは「ボックス計画」から「イベントページ」に変える。

### D7. 名称
ナビ `{ ja: 'イベント', en: 'Events' }`、一覧ヘッダー `イベント一覧 / Events`、説明文をボックス限定でない文言に変える。i18n キーは既存キーの値を変えるのではなく新キー（`event-list-title` 等、kebab-case）を追加し、`ja.json`/`en.json` 両方に入れる。

## Risks / Trade-offs

- [need 源の変更で `/material/result` と料理配分の結果が変わり得る] → 入力元が異なる（永続ロスター＋実所持数）ことによる差分であり、料理作成セクションの説明文で「育成ロスターの不足で計算」と明示する。同一入力に対する計算アルゴリズム自体の同一性は維持する。
- [レジストリ meta の手書き誤り] → 80614 の値は Atlas basic_event の値をそのまま使い、テストで会期の大小関係（started < ended）を確認する。
- [`EventPlannerClient` の分割で挙動が変わる] → 計算部は動かさず、ヘッダー JSX の移動だけに留める。既存の `lib/event-plan.test.ts` と画面の実機確認で担保する。
- [料理作成の Worker がイベントページの bundle に入る] → 既存と同じ遅延生成（`new Worker(new URL(...))`）のままなので初期表示への影響は小さい。
- [未同期端末での設定読み取り副作用] → `readStockTargetReadOnly` およびセレクタ・フックの遅延書き込みにより、閲覧時の自動保存副作用を排除しクラウド同期データを汚染しない。
- [素材データ取得失敗・部分欠落およびドロップ欠落時の誤配分] → `enabledServantIds` 全件の完全性検証と、料理対象素材に限定したドロップカタログ照合を行い、欠落時に過少計算を行わない防御ガードを設ける。ボックス計画はドロップ依存から分離して安全を維持する。

## Migration Plan

- KV / D1 の移行なし。デプロイは main への push で自動。
- 料理作成の localStorage キー（`material/event-craft-advisor-config`）は据え置きなので、入力済みの食材数はそのまま引き継がれる。
- ロールバックは revert のみで足りる。
