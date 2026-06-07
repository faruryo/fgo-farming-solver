## Why

ダッシュボードの「開催中のイベント」(EventSection) は banner つきイベントしか拾えず、`type=questCampaign` で配信される **AP半減** や **ストーム・ポッド消費なし** などの「対象クエストを今のうちに回るべきキャンペーン」は banner が null のため一切表示されない。結果、ユーザーは Atlas に存在する重要な機会情報を視認できず、ファーミング判断に活かせていない。

特に「期間限定 ストーム・ポッド消費なし！」は冠位戴冠戦が開催されてから 1 週間限定で発動する **ポッド上限 (9個) を気にせず冠位研鑽戦を回し放題** の特別期間であり、project memory `project-stormpod-priority` で定めた「ストームポッド消費系を最上位表示する」設計の **意義が最も強くなる瞬間** にもかかわらず、現状の UI はこの状態を一切区別しない。

## What Changes

- **NEW**: ダッシュボードに「開催中のキャンペーン」セクションを追加し、`banner=null` の `questCampaign` イベントを 3 カテゴリ (ファーミング直結 / 強化・育成 / その他) に分類して集約表示する。
- **NEW**: マスターデータ更新パイプラインに「ストーム・ポッド消費なし期間」抽出ロジックを追加し、`dashboard_meta` に `podFreePeriods: { name, startedAt, endedAt, questIds[] }[]` を配信する。
- **NEW**: ストーム・ポッド消費なし期間中、キャンペーンセクション最上段にその行を強調表示する。
- **MODIFIED**: `RecommendedQuest` の周回数モードに **tier 0 (ポッド無料対象クエスト最優先)** を追加する。期間外は既存挙動 (冠位研鑽戦 → オーディール・コール → その他) を維持。
- **MODIFIED**: `NearGoalSection` の効率モードを拡張し、期間中はポッド無料対象クエストが drop するアイテムを **そのクエストで集める想定の周回数** で評価・表示する。同じクエストが複数行に並ぶことを許容。
- **NEW**: ストーム・ポッド消費系クエスト (冠位戴冠戦・オーディール・コール フリクエ) のクエスト識別行に **Pod アイコン** を表示し、期間中は `×0` バッジで「消費なし」を可視化する。
- **MODIFIED**: `RecommendedQuest` AP モードおよび `NearGoalSection` 最短モードはソートロジックを変更せず、対象クエストに視覚バッジのみ追加する。

## Capabilities

### New Capabilities
- なし (既存 capability の拡張のみ)

### Modified Capabilities
- `dashboard`: 「開催中のキャンペーン」セクションの追加、`RecommendedQuest` 周回数モードへの tier 0 追加、`NearGoalSection` 効率モードのポッド無料優遇拡張、ストーム・ポッド系クエスト識別行の Pod バッジ表示。
- `master-data`: `dashboard_meta` に「ストーム・ポッド消費なし期間」 (`podFreePeriods`) を含める要求の追加。

## Impact

- **データ層**:
  - `lib/master-data/types.ts`: `DashboardMeta` に `podFreePeriods` フィールドを追加。
  - `lib/master-data/update.ts`: `fetchDashboardMeta()` 内で event name 一致 + `campaignQuests` の短 quest ID への射影を実装。
  - `hooks/use-dashboard-meta.ts` (もしくは同等の hook): podFreePeriods を読み取れるようにする。
  - `hooks/use-active-campaigns.ts`: 「現在ポッド無料期間中か」「対象 quest ID Set」を返す API を追加。

- **UI 層**:
  - `components/dashboard/CampaignSection.tsx`: 新規。banner なし questCampaign の集約表示。
  - `components/dashboard/RecommendedQuest.tsx`: tier 0 ロジック追加、Pod バッジ表示。
  - `components/dashboard/NearGoalSection.tsx`: 効率モードで対象アイテムをポッド無料クエスト基準で評価。
  - `components/common/QuestIdentity.tsx`: Pod アイコン (×0 状態含む) を AP 表示横に出すバリアント追加。
  - `app/page.tsx` (または同等): 新セクションの差し込み位置調整。

- **i18n**:
  - `locales/ja/dashboard.json` 等に「開催中のキャンペーン」「ストーム・ポッド消費なし期間中」等の新規キーを追加。

- **テスト**:
  - `lib/master-data/update.test.ts`: `extractPodFreePeriods` (新規関数) のユニットテスト。
  - `components/dashboard/RecommendedQuest.test.tsx` 等の振る舞いテスト更新。

- **影響を受ける既存ファイル数**: 約 10 〜 12 ファイル。
- **後方互換**: `DashboardMeta` フィールド追加のみ。古い `dashboard_meta` (podFreePeriods 不在) は空配列扱いでフォールバック。
