## 1. 準備

- [ ] 1.1 `pnpm dlx shadcn@latest add toggle-group` を実行し、`components/ui/toggle-group.tsx` が生成されることを確認する。
- [ ] 1.2 先の change で混入した `RecommendedQuest.tsx` の tier 1 統合変更を git で差し戻す（または下記 3.x の中で上書きする）。

## 2. 共有ロジック

- [ ] 2.1 `hooks/use-dashboard-sort-mode.ts` を新規作成し、`useDashboardSortMode(storageKey: string, campaigns: Campaign[] | undefined)` シグネチャで `'laps' | 'ap'` を返す hook を実装する。
- [ ] 2.2 LocalStorage に既存値が無い場合のみ、`useActiveCampaigns` の `activeCampaigns.length > 0` を判定して `'ap'` / `'laps'` を初期化する一度限りの effect を実装する。

## 3. RecommendedQuest

- [ ] 3.1 ヘッダ右側に `<ToggleGroup type="single" size="sm">` を追加し、`周回数` / `AP` の 2 項目を配置する。
- [ ] 3.2 `recommendations` メモの sort を、モードに応じて分岐:
  - `laps` モード: `冠位研鑽戦 → オーディール・コール → その他` の 3 層 + `b.lap - a.lap`（現状互換 = 改変前の挙動）。
  - `ap` モード: AP割引クエストを tier 1、その他を tier 2、同 tier 内は `b.lap - a.lap`。
- [ ] 3.3 ツールチップ文言をモードに応じて差し替える。

## 4. NearGoalSection

- [ ] 4.1 ヘッダ右側に `<ToggleGroup>` を追加し、`周回数` / `AP` を配置する。
- [ ] 4.2 `nearGoalEntries` のクエスト選定を、モードに応じて分岐:
  - `laps` モード: `lapsNeeded = Math.ceil(needed / drop_rate)` 最小のクエスト（現状互換）。
  - `ap` モード: `quest.ap / drop_rate` 最小のクエスト。同値の場合は `lapsNeeded` 最小をタイブレーク。
- [ ] 4.3 ツールチップ文言をモードに応じて差し替える。

## 5. 検証

- [ ] 5.1 `pnpm run type-check` が成功することを確認する。
- [ ] 5.2 `pnpm run lint` が成功することを確認する。
- [ ] 5.3 `openspec validate dashboard-sort-mode-toggle --strict` が成功することを確認する。
- [ ] 5.4 ローカル mock (campaign id 99001 = 半AP) で `pnpm dev` を立ち上げ、初回アクセス時に `AP` モードが選択され、AP割引対象クエストが上位に出ることをブラウザで確認する。トグルで `周回数` に切り替えた際に冠位研鑽戦が再び上位になることも確認する。
