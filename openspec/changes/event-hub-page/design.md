# Design: イベント専用ハブページ（Phase 1: 水着2026料理作成・ロト型共用）

## Context

現在、ボックスガチャ（ロト型）イベントは `/events`（一覧）と `/events/[id]`（`EventPlannerClient`）で計画機能を提供している。一方、水着2026の料理作成アドバイザーは `/material/result`（素材計算結果画面）内の第2タブ（`summer-2026`）に同居しており、以下の問題がある。

1. **場所が不自然**: イベント期間限りの機能が恒常機能（素材計算）のタブに埋もれている。
2. **ボックス以外のイベントデータ未保持**: KV `event_data_json` は `hasLottery` かつ `lotteries.length > 0` のイベントしか取り込まず、水着2026（80614）はスキップされて KV に存在しない。
3. **need 源の乖離**: ボックス計画は「育成ロスター（`ChaldeaState`）＋所持数」から総必要数を引くが、料理作成は `/material/result` の計算結果（`amounts`・`possession`）を受け取っている。
4. **イベント画面の名称がボックス前提**: ナビが「ボックス」、一覧の見出しが「ボックスイベント一覧」など、ロト型限定の表現になっている。

## Goals / Non-Goals

**Goals**:
- `/events/[id]` を、イベントごとに機能（ボックス計画・料理作成など）を並べるハブページに改修する。
- 料理作成アドバイザーを `/material/result` からイベントページに移設する。
- KV に無いイベントでも最小限のメタ（名前・会期）と利用可能機能を宣言できる静的レジストリを用意する。
- 料理作成の need 算出を「永続ロスター＋所持数」起点に統一する。
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
- 80614（水着2026）は `features: ['craft']`、meta は Atlas basic_event の値を静的定義（名前: `カルデア・サマーアドベンチャー` 等、会期は JST unix 秒）。
- 理由: KV のスキーマ変更やバッチ改修（#115）を待たずに、現行コードだけで水着2026のイベントページを成立させる。
- 公開データ境界: メタデータは Atlas API / ゲーム内で公開済みの値のみを用い、未公開・解析データは含めない。

### D2. 一覧合成（`lib/event-features.ts`）
`/events` 一覧は、KV にあるロト型イベントと、静的レジストリにあるイベントの和集合を表示する。
- 重複排除: KV に存在しレジストリにもある場合は KV の `EventSummary` を優先し、`features` は両者の和集合とする（ロト型は暗黙に `box` を持つ）。
- 純粋関数 `mergeEventList(kvEvents, registry): EventSummaryWithFeatures[]` として実装し、テスト容易性を担保する。

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
4. `EventCraftAdvisor` に `fullNeed`・`stockEnabled` を渡す。

このとき以下の不変条件と境界を厳守する：
- **読み取り専用（副作用なし）**: ロスター（`ChaldeaState`）および所持数の取得は `useLocalStorage` の初期値書き込み副作用を避け、未設定時でも `localStorage.setItem` を一切呼ばない読み取り専用（`readStoredJson` 等）とし、新規端末や未同期状態でもクラウド同期対象データを汚染・書き換えしない。
- **素材取得失敗・ローディングの防護**: `getMaterialsForServantIds` がロード中の間は配分計算を開始せずローディング表示とし、取得失敗やデータ欠落時は誤って過少・不足ゼロでの配分を計算・表示させず、エラー案内を表示する。
- **周回目的 `all` のフォールバックと表示**: `purpose === 'all'` の場合は `buildNeedByApiItemId` の仕様に従い有限目標を `training`（育成）としてフォールバック計算し、UI 上でも現行と同様に `FarmingPurposeSelector` の横に「配布評価は今の育成を使用」（`common:farming-purpose-advisor-fallback`）を表示する。

ロスター取得と素材読み取り部分は `EventPlannerClient` と重複するため、副作用のない小さなフック `useRosterNeed()` に寄せ、両セクションで使う。
- 代替案: `/material/result` の `amounts` を URL や localStorage で受け渡す → 結果画面を経由しないと使えなくなる。ボックス計画と need 源が揃わない。
- 差分: `/material/result` は「今の計算画面の対象」、イベントページは「永続ロスター」が need 源になる。通常は同じ ChaldeaState なので一致するが、共有 URL 由来の計算結果を見ている場合は異なり得る。ボックス計画と同じ定義に揃えることを優先する。

### D5. 素材選択アドバイザーのタブを外す
`AdvisorTab` とタブ UI・`EventCraftAdvisor` の描画を削除し、交換券・配布の本体の上に `/events/80614` へのリンク（`Link`、i18n）を置く。リンク先は `EVENT_FEATURES` から `craft` を持つ最新イベントを引く（`latestCraftEventId()`）。`STORAGE_KEYS.MATERIAL_ADVISOR_TAB` はクラウド同期対象ではない（`lib/cloud-sync` から参照なし）。定数ごと削除し、端末に残った値は読まれずに放置される。

### D6. ダッシュボード導線
`EventSection` の導線表示条件は、ハブ（`/events/[id]`）で実際に機能を提供できる条件（KV `event_data_json` に取り込み済みのロトイベント ID セットに含まれるか、または静的レジストリ `EVENT_FEATURES` に登録されていること）と完全に一致させる。Atlas 側の `hasLottery` フラグが立っていても KV 未取り込みかつレジストリ未登録のイベントには導線を出さず、リンク遷移先で `EventDataMissing` が露出する不整合を防ぐ。導線ラベルは「ボックス計画」から「イベントページ」に変える。

### D7. 名称
ナビ `{ ja: 'イベント', en: 'Events' }`、一覧ヘッダー `イベント一覧 / Events`、説明文をボックス限定でない文言に変える。i18n キーは既存キーの値を変えるのではなく新キー（`event-list-title` 等、kebab-case）を追加し、`ja.json`/`en.json` 両方に入れる。

## Risks / Trade-offs

- [need 源の変更で `/material/result` と料理配分の結果が変わり得る] → D4 の差分を料理作成セクションの説明文で「育成ロスターの不足で計算」と明示する。
- [レジストリ meta の手書き誤り] → 80614 の値は Atlas basic_event の値をそのまま使い、テストで会期の大小関係（started < ended）を確認する。
- [`EventPlannerClient` の分割で挙動が変わる] → 計算部は動かさず、ヘッダー JSX の移動だけに留める。既存の `lib/event-plan.test.ts` と画面の実機確認で担保する。
- [料理作成の Worker がイベントページの bundle に入る] → 既存と同じ遅延生成（`new Worker(new URL(...))`）のままなので初期表示への影響は小さい。
- [未同期端末でのロスター読み取り副作用] → `useLocalStorage` を使わず純粋な読み取り（read-only）に徹し、初期値書き込みによるデータ汚染を防ぐ。
- [素材データ取得失敗時の誤配分] → 取得失敗・欠落時に過少計算を行わない防御ガードを設ける。

## Migration Plan

- KV / D1 の移行なし。デプロイは main への push で自動。
- 料理作成の localStorage キー（`material/event-craft-advisor-config`）は据え置きなので、入力済みの食材数はそのまま引き継がれる。
- ロールバックは revert のみで足りる。
