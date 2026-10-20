# Proposal

## Why

絆トラッカーの見積もり（サーヴァント別とクエスト別のストームポッド数、到達見込みのボトルネック判定）は、ポッド無料期間でも冠位研鑽戦とオーディール・コールを「1周1個」として数えている。周回クエストの候補にも、ダッシュボードやクエスト効率ページにあるポッド無料の印が出ない。無料期間に絆上げを計画すると、ポッドが律速と表示されて実態より遅い到達見込みになる（issue #105）。

## What Changes

- 周回クエストの候補に、ポッド無料期間中のクエストであることを、ダッシュボードと同じ印（`QuestIdentity` の `podFree`）で示す
- 必要ポッド数を、無料期間中に回せる周回だけ0個として数える。無料期間は途中で終わるので、無料と数える周回は「期間の終わりまでに AP の自然回復（1日288）で回せる周回数」までにし、残りは従来どおり1周1個とする（オーナーの判断で既定の数え方。design の決定 1）
- 「りんご・石を使う」切り替えを足す。初期はオフで、オンにすると無料期間中の周回をすべて0個と数える。どれだけ周回したいかは人によって違うため（オーナーの判断。design の決定 5）
- 到達見込みのボトルネック判定は、上の必要ポッド数を使う
- 期間のデータは、ダッシュボードで使っている `dashboardMeta.podFreePeriods` と `usePodFreeQuests` をそのまま使う。新しいデータの取り込みはしない

## Capabilities

### New Capabilities
（なし）

### Modified Capabilities
- `bond-tracker`: 候補のポッド無料表示と「りんご・石を使う」切り替えを足し、「残り周回数と必要AP」「クエスト別の集計」「到達見込み」のストームポッドの数え方に、無料期間を反映する。切り替えを「入力内容の保存」に加える

## Impact

- `lib/bond/estimate.ts`（`groupByQuest` の `pods`）、`lib/bond/entry-estimate.ts`（`pods`）、`lib/bond/progress.ts`（定数の共有）
- `lib/bond/state.ts`（切り替えの保存と復元）、`components/bond/index.tsx`（切り替えの表示）、`locales/ja.json`・`locales/en.json`（切り替えのラベルと注記の文言）
- `components/bond/use-bond-tracker.ts`（`useDashboardMeta` と `usePodFreeQuests` の取り込み）、`components/bond/servant-card.tsx`（候補の印、ポッド数の表示）、`components/bond/estimate-table.tsx`（無料と数えた周回の注記）
- 各ユニットテストと、画面の確認（375px と desktop）
