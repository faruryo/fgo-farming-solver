## Context

ダッシュボードの 2 セクション (`RecommendedQuest`, `NearGoalSection`) は別々のロジックで「上位 4 件」を選んでいる:

- `RecommendedQuest`: ソルバー結果のクエスト集合を area 名で固定優先度ソート (`冠位研鑽戦 → オーディール・コール → その他`) + `b.lap - a.lap`。
- `NearGoalSection`: 残目標がある target item ごとに `Math.ceil(needed / drop_rate)` 最小のクエストを 1 つ選び、全 item を `lapsNeeded` 昇順で並べ Top 4。

両者とも結果はストームポッド消費系クエストに偏りやすい。ストームポッド消費系を上位固定する設計は「ポッド上限 9 個 / 入手 3 個/日」の溢れ対策として既に project memory `project-stormpod-priority` に記録済み。

`useDashboardResult` / `useActiveCampaigns` はキャンペーン適用後の `displayResult` と現在時刻で有効な `activeCampaigns` を提供する。AP 割引判定はこれらと `drops.quests` 内の元 `ap` の差で行える (追加 fetch 不要)。

## Goals / Non-Goals

**Goals:**
- ユーザーが `周回数優先 (現状互換)` と `AP優先 (キャンペーン活用)` を 1 タップで切り替えられる。
- セクションごとに独立した状態を持ち、LocalStorage で永続化する。
- 初回アクセス時はアクティブな AP キャンペーン有無に応じて既定を自動判定する。
- ストームポッド消費リマインダ機能 (周回数モード) は手を加えない。

**Non-Goals:**
- ソルバー本体 (`lib/solver.ts`) の挙動変更。
- キャンペーン取得・適用フロー (`useActiveCampaigns` / `useDashboardResult`) の変更。
- 冠位研鑽戦への AP 割引伝播 (`aaQuestId` マッピング不足は別課題)。
- 「ストームポッド残量」「今日の消化済み件数」などゲームステート連携 (アプリは保有データを持たない)。
- セクション横断のグローバルモード切替 (個別保存で十分)。

## Decisions

**Decision: UI は shadcn `ToggleGroup` (`type="single"`, `size="sm"`) を用いる**
- 採用案: ヘッダ右端 (`u-section-header` 内の Tooltip と Line の間) に `<ToggleGroup>` を配置し、`周回数 | AP` の 2 アイテムを並べる。`Tabs` と異なり `TabsContent` を必要としない (リスト本体は同位置で描画されるため)。
- 代替案 A (`Tabs`): セクションヘッダで使う TabsList は装飾が重く、`TabsContent` を組まないと冗長。
- 代替案 B (`Switch`): "ON/OFF" 用語感が「周回数 vs AP」と噛み合わない。
- 代替案 C (`Select`): オーバーレイが発生し操作コストが増える。ユーザー指示で除外。

**Decision: モード状態はセクション単位で `useLocalStorage<'laps' | 'ap'>` 保存**
- LS キー: `dashboard.recommendedQuest.sortMode` / `dashboard.nearGoal.sortMode`。
- 採用理由: 2 セクションの最適モードは独立する可能性があるため (例: 周回予定は AP重視、達成間近は周回数重視)。
- 代替案 (グローバル 1 キー): 単純だが将来「片方だけ AP モードに固定したい」要求が出やすい。

**Decision: 既定値の自動判定は『LocalStorage に値が無いとき』のみ作用**
- 採用案: 初期化時に `useActiveCampaigns(drops?.campaigns).activeCampaigns.length > 0` を評価し、`ap` / `laps` を `useLocalStorage` の初期値に与える。ユーザーが一度操作したら以降は LS 値を優先。
- 代替案 (毎レンダー自動切替): キャンペーン境界で勝手にタブが動くと混乱する。`useActiveCampaigns` の `digest` 変化のたびに UI が変わるのは期待を裏切る。
- 副作用: 既存ユーザーは初回アクセス時に既定が変わる可能性があるが、トグルで即時戻せる。

**Decision: AP モードのソート規約 (RecommendedQuest)**
- area による固定優先度を外す。
- `isApDiscounted(q)`: `drops.quests.find(qq => qq.id === q.id)?.ap` が存在し、`displayResult.quest.ap` がそれより小さいなら true。
- tier 1: AP 割引クエスト / tier 2: その他。同 tier 内は `b.lap - a.lap` 降順 (周回数モードと同じ二次キー)。
- 同 tier 内を AP 昇順にすると「lap=1 の超効率クエスト」が下に落ちうるため、二次キーは lap を維持する。

**Decision: AP モードのソート規約 (NearGoalSection)**
- 各 item に対しクエスト選定基準を「`quest.ap / dr.drop_rate` 最小」に切り替える (= 1個あたりの実効 AP が最小)。
- item 間の並びは従来どおり `lapsNeeded` 昇順 (達成が近い順) を維持する。
- 代替案 (item 並びを「AP 合計が最小」順に変える): 「達成間近の素材」というセクション名称と一致しなくなるため不採用。あくまで「同じ item に対するクエスト選択を AP 効率寄りに切り替える」スコープ。

**Decision: 共有 hook `useDashboardSortMode` を切り出す**
- LocalStorage 読み書き + 既定値計算 + アクティブキャンペーン購読をまとめた小さな hook を `hooks/use-dashboard-sort-mode.ts` に置く。
- 2 セクションから呼べる形にし、引数で LS キーと `campaigns` を受ける。
- 代替案 (各セクション内インライン): 既定値ロジックが重複し、テストもしづらい。

## Risks / Trade-offs

- [Risk] AP モードで NearGoalSection のクエスト推奨が頻繁に変わる → Mitigation: ツールチップに「AP モードでは 1 個あたり実効 AP が最小のクエストを表示します」と明記。
- [Risk] LocalStorage 移行ユーザーが「今日からタブが出てびっくり」 → Mitigation: tooltip / 自動既定の挙動を文言で説明。デプロイ後 README/CHANGELOG (該当があれば) に追記は別タスク。
- [Risk] `displayResult` のクエストが drops 側に存在しない (`originalAp` が `undefined`) → Mitigation: 関数内で `original == null` の場合は AP 割引なしと判定し tier 2 に倒す。NearGoalSection 側でも同様に `quest.ap` が 0/負のクエストは AP モードで除外せず、`dr.drop_rate > 0` の従来フィルタのみ維持。
- [Risk] `ToggleGroup` の Radix 由来パッケージが現状未インストール → Mitigation: タスクで `pnpm dlx shadcn@latest add toggle-group` を明示。
- [Risk] 自動既定が「初回 render は `laps` で次の render で `ap` に切り替わる」フラッシュを起こす → Mitigation: `useLocalStorage` の lazy initializer 内で `useActiveCampaigns` を直接呼べないため、`useDashboardSortMode` 側で「LS に値が無い & `activeCampaigns` が変化したら 1 度だけセットする」一回限りの effect を入れる。SSR は `useLocalStorage` が既定値を返すため hydration 後の 1 tick 内で確定。

## Migration Plan

- ロールフォワード: コード変更とコンポーネント追加のみ。永続データ・API・solver 結果に変更なし。
- ロールバック: `RecommendedQuest.tsx` / `NearGoalSection.tsx` を Git で戻し、`hooks/use-dashboard-sort-mode.ts` と `components/ui/toggle-group.tsx` を削除すれば完結する。LS の値は孤立しても害なし (使われないだけ)。
- フィーチャーフラグ不要。

## Open Questions

- 将来「ストームポッド残量を手入力 → 残量に応じて自動でモードを変える」機能を考えるか? → 本 change の範囲外。明示的に Non-Goal。
- AP モードの NearGoalSection で、`quest.ap` が 0 の特殊クエスト (デイリーチケット等) が紛れ込んだ場合の挙動は要観察。実データに混入し始めたら個別 fix。
