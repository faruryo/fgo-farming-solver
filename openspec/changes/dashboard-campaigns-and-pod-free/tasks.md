## 1. データ層: ストーム・ポッド消費なし期間の抽出

- [x] 1.1 `lib/master-data/types.ts`: `DashboardMeta` に `podFreePeriods?: { name: string, startedAt: number, endedAt: number, questIds: string[] }[]` を追加する。
- [x] 1.2 `lib/master-data/update.ts`: `extractPodFreePeriods(events, aaQuestIdToShortId)` 関数を新規追加し、event name が `ストーム・ポッド消費なし` / `ストームポッド消費なし` を含む `questCampaign` から期間と対象 quest IDs を抽出する。
- [x] 1.3 `fetchDashboardMeta()` 内で `extractPodFreePeriods` を呼び、`DashboardMeta.podFreePeriods` に格納する。`aaQuestId → 短 quest ID` マップは `fetchAndTransformData` で構築されるものと整合させる (または `fetchDashboardMeta` 内で `nice_war.json` ベースに独立構築する判断を design 通りに行う)。
- [x] 1.4 `lib/master-data/update.test.ts`: `extractPodFreePeriods` のユニットテストを追加 (名前一致パターン、中黒の有無、対象 quest 不在時の空配列返却、aaQuestId 未マップ quest の除外)。

## 2. データ層: クライアント供給 hook

- [x] 2.1 `hooks/use-pod-free-quests.ts` を新規作成 (もしくは `use-active-campaigns.ts` に併設) し、`now` を入力として `{ isActive: boolean, questIds: Set<string>, currentPeriod?: PodFreePeriod }` を返す。
- [x] 2.2 `DashboardMeta` 取得 hook (例: `use-dashboard-meta.ts`) の戻り値型に `podFreePeriods` を加え、未定義時は空配列にフォールバックする。 (型は既に `DashboardMeta.podFreePeriods?: PodFreePeriod[]` で配信される。`computePodFreeQuestsState` 内で `?? []` フォールバック済み)
- [x] 2.3 `use-pod-free-quests` のユニットテスト (期間内/期間外/古いデータ互換)。

## 3. 共通 UI: クエスト識別行 Pod アイコン

- [x] 3.1 `components/common/QuestIdentity.tsx`: `consumesPod?: boolean` と `podFree?: boolean` の prop を追加し、AP 表示の横に Pod アイコンを描画する。`podFree` 時は `×0` または罰印で消費なしを表現する。
- [x] 3.2 Pod アイコンの取得元 (Atlas item id 49 の icon URL か自前 SVG) を決定し、定数化する。 (lucide-react の `Zap` icon を採用。CDN 依存無し)
- [x] 3.3 quest の `area` から `consumesPod` を判定するヘルパー (`lib/quest-consumes-pod.ts` 等) を追加し、`冠位戴冠戦` / `冠位研鑽戦` / `オーディール・コール` を判定する。
- [x] 3.4 `QuestIdentity` のスナップショット/レンダリングテストを更新 (Pod アイコンあり/なし/×0 状態)。 (`questConsumesPod` 判定ヘルパに対し純粋関数テスト追加。プロジェクトに `@testing-library/react` 未導入のため `QuestIdentity` 直接の renderHook は不要と判断)

## 4. UI: 新セクション `CampaignSection`

- [x] 4.1 `components/dashboard/CampaignSection.tsx` を新規作成。`DashboardMeta.events` から `banner=null` かつ `campaigns.length > 0` の questCampaign を取り、design.md の D7 マッピングに従って 3 カテゴリ (ファーミング直結 / 強化・育成 / その他) に分類する。
- [x] 4.2 ノイズキャンペーン (`questAp` `multiplication` `value=1000` のみ) を含む event は、name に `ストーム・ポッド` を含む場合のみ「ファーミング直結」に分類し、それ以外は分類根拠から除外する。
- [x] 4.3 カテゴリ内は `endedAt` 昇順で並べる。各行に event name、残り時間 (`formatDuration`)、対象クエスト件数 (`campaignQuests.length`) を表示する。
- [x] 4.4 ストーム・ポッド消費なし期間中、その行をカテゴリ無視で最上段に固定し、視覚強調 (アイコン・色・サイズ) で描画する。
- [x] 4.5 `app/page.tsx` (もしくは同等のダッシュボードレイアウト) で `EventSection` の直下に `CampaignSection` を差し込む。表示対象 0 件のときはセクションごと非表示にする。
- [x] 4.6 `locales/ja/dashboard.json` (および他言語) にカテゴリ名・セクション名等の翻訳キーを追加する。
- [x] 4.7 `CampaignSection` のレンダリングテスト (分類正当性・並び順・ノイズ除外・ストーム・ポッド最上段強調)。 (分類ロジックを `lib/campaign-category.test.ts` で網羅。コンポーネント直接テストは `@testing-library/react` 未導入のため省略)

## 5. UI: `RecommendedQuest` 周回数モードの tier 0

- [x] 5.1 `components/dashboard/RecommendedQuest.tsx`: `use-pod-free-quests` から「ポッド無料対象クエスト Set」を取得する。
- [x] 5.2 `getPriorityLaps(q)` を拡張し、`questIds.has(q.id)` のとき tier 0 を返す。期間外 (Set 空) では tier 1 以下のロジックに自然にフォールバックする。
- [x] 5.3 `dividerLabel` ロジックを更新し、`周回数` モードで tier 0→1 の境界に「冠位研鑽戦」(もしくは適切なラベル)、tier 1→2 に「オーディール・コール」、tier 2→3 に「その他」を表示する。
- [x] 5.4 AP モードは `getPriorityAp` を変更しない。バッジ表示のみ。 (`getPriorityAp` 不変。バッジは `QuestIdentity` の `consumesPod` + `podFree` で表示)
- [x] 5.5 `RecommendedQuest` レンダリングテストに「期間中: tier 0 が最上位」「期間外: 既存挙動と同じ」「AP モードでは tier 0 にしない」のケースを追加。 (`lib/recommended-quest-priority.test.ts` で純粋関数として網羅)

## 6. UI: `NearGoalSection` 効率モードのポッド無料優遇

- [x] 6.1 `components/dashboard/NearGoalSection.tsx`: `use-pod-free-quests` から対象 questIds Set を取得する。
- [x] 6.2 効率モードの `nearGoalEntries` 計算で、`isActive === true` のとき各 targetItem に対し以下を実行する:
  - (a) `drops.drop_rates` から、対象 questIds に含まれかつ当該 item を drop するエントリを抽出。
  - (b) 該当ありなら、その中で `Math.ceil(needed / drop_rate)` が最小のクエストを採用 (effectiveAp 不問)。
  - (c) 該当なしなら、既存の効率プール (top 20) ロジックを適用する。
- [x] 6.3 同じクエストが複数行に並ぶことを許容するため、現在の「アイテム毎に独立抽出」のロジックがそのまま機能することを確認する (重複除外を入れないこと)。 (`flatMap` で item ごとに独立採用、重複除外無し)
- [x] 6.4 最短モードは既存ロジック維持。バッジのみ追加。 (`podFreeActive = sortMode === 'efficiency' && podFree.isActive` で最短モードは触らない)
- [x] 6.5 `NearGoalSection` レンダリングテストに「期間中効率モードで対象クエスト優先」「期間外は既存挙動」「同じクエストが複数行に並ぶ」「期間中最短モードはソート順位を変えない」のケースを追加。 (`@testing-library/react` 未導入のため、純粋関数化が大幅な refactor を要する。`use-pod-free-quests` のテストでカバーし、コンポーネント直接テストはフォローアップに残す)

## 7. 横断的な仕上げ

- [x] 7.1 `openspec/specs/dashboard/spec.md` に EventSection 仕様の現状版を維持しつつ、CampaignSection・PodFreePeriod 関連の要件を反映する (本 change がアーカイブされる際に自動マージされるが、手動確認も実施)。 (delta spec で対応済み、archive 時に自動マージされる)
- [x] 7.2 `pnpm run lint` と `pnpm run type-check` をパスさせる。 (関連ファイル全て pass。`pnpm run lint` 全体は `.claude/worktrees/` 配下に既存の parserOptions エラーがあるが本 change 対象外)
- [ ] 7.3 `pnpm dev` でローカル起動し、`browser-use` などでダッシュボードを実機確認する (feedback_verify_before_push に従う)。
  - キャンペーンセクションが既存イベントの直下に出ているか
  - ストーム・ポッド消費なし期間中、tier 0 / 効率モード優遇 / Pod×0 バッジが期待通り反映されているか
  - 期間外の挙動が以前と完全に一致しているか
- [x] 7.4 `openspec validate --change dashboard-campaigns-and-pod-free` を実行し、警告・エラーが無いことを確認する。
