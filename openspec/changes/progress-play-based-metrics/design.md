## Context

進捗ロジック(`lib/progress/`)は `state_snapshots`(`user:YYYY-MM-DD` の日次 upsert、full state: `material`/`items`/`quests`/`posession`/`material/result`)を読み、現在状態(クライアント送信)と前回/1週間前/1ヶ月前を比較する。現状の見出し指標 `deltaApAdjusted = deltaApRaw + newServantOffsetAp` は破綻している(`deltaApRaw` は net `items` の個数差で farming と目標変更が混在、`newServantOffsetAp` は実AP、単位不一致、モード非依存)。マシュ進捗パネル(`ProgressReportPanel` + `progress-report-content`)は結果ページにのみ表示。

ソルバー `lib/solver.ts`(`solve`/`solveBoth`)はクライアント/サーバ両方で利用可能で、ダッシュボードは `useDashboardResult` が既にクライアントで再ソルブしている。`items`(ソルバー入力)は net = `max(0, material/result − posession)`(`components/material/result.tsx:144-149`)。

## Goals / Non-Goals

**Goals:**
- 「ユーザーが実際にプレイして進んだ量」を表す2指標を出す: (1) 育成総量、(2) アイテム入手による残りAP/周回数の減少。
- 目標を増やしても (2) の値がブレない(目標固定の再ソルブ)。
- マシュ進捗をダッシュボードへ移設。期間タブは廃止し、存在する最古のスナップショット(古い順に 1ヶ月前→1週間前→前回)を1つだけ基準とする単一比較に変更。マシュのセリフ演出は維持。
- 結果ページの破綻表示を撤去し、履歴グラフで進捗を見せる。
- DB スキーマ変更なし。既存 localStorage / クラウド同期データを破壊しない。

**Non-Goals:**
- DB スキーマ変更(過去ソルブ結果の保存=方式2は採らない)。
- 結果ページへのモード別「前回計算比」追加(履歴グラフで代替)。
- ソルバーアルゴリズム自体の変更。

## Decisions

### D1: (2) は「目標を現在で固定して再ソルブ」(方式1)
```
減少AP   = solve(現在目標 − 過去所持).total_ap  − solve(現在目標 − 現在所持).total_ap
減少周回 = 同上の total_lap
減少費用 = round(減少AP / 144 / 168 * 10000)
```
- 目標を両辺「現在」に固定し、所持だけ過去→現在へ動かす。目標増加の影響は構造的にゼロ → `deltaApRaw` 補正不要。
- **代替案(方式2: 過去残りAP保存 + gross目標差で補正)を不採用**: スキーマ追加が必要で補正が近似。方式1はスキーマ変更なし・厳密。
- 入力素材は net 化して solve に渡す: `need(item) = max(0, 現在目標(material/result)[item] − 所持[item])`。現在所持版 = 既存の現在 net、過去所持版 = 現在目標 − 過去 `posession`。`quests` は現在の許可クエスト(`checkedQuests`)を使用。

### D2: 算出はクライアント側で実行
- ダッシュボードは `material/result`・`posession`・`quests`・`drops`(`useDrops`)・`solve` を既に持つ。`/api/progress` は**過去 `posession`(と育成総量に必要な過去 `material`)を期間別に返すだけ**にし、2回ソルブ(現在目標×現在所持/過去所持)はクライアントで行う。
- **代替案(サーバ側で全算出)を不採用**: 現在の gross 目標・所持・quests をサーバへ送る必要があり、サーバ CPU も増える。クライアント再ソルブは既存パターン(`useDashboardResult`)の踏襲。
- 1回の現在ソルブ + 期間ごとに過去所持ソルブ(最大3回)。`drops` と現在目標は共有しメモ化。

### D3: `PeriodSummary` のフィールド再設計
- 廃止/置換: 見出しの実AP表示としての `deltaApAdjusted`。
- 追加: `growthTotal`(育成総量 = `Σ servantGrowth.delta`)、`reducedAp` / `reducedLap` / `reducedYen`(アイテム入手による減少)。
- `deltaApRaw` は内部診断としては残してよいが UI から外す。`targetApIncrease` は目標固定により不要になるため UI から外す(算出は撤去 or 残置のうち UI 非表示)。
- サーバが算出できない部分(reduced*)は型上 optional とし、クライアント算出値で埋める。サーバ応答には期間別 `pastPosession`(と必要なら `pastMaterial`)を含める。

### D4: tier 判定とマシュのセリフ
- `classifyTier` の入力を「進捗の大きさ」を表す新指標へ差し替える(減少AP を主軸に、育成総量も考慮)。`mashu-messages` の `targetApIncrease`/`deltaApAdjusted` 依存分岐を新指標に更新。
- セリフのパターン(進捗量・育成成長・新サーヴァント)を維持し、`pnpm run seed:progress` の検証が引き続き機能すること。

### D5: 配置(ダッシュボード)
- `components/dashboard/ProgressSection.tsx` を、上部にマシュ進捗パネル、下部に既存達成率円グラフ、の2段構成へ。1つの「あなたの育成進捗」見出し配下にまとめる。
- マシュ進捗パネル本体は `components/farming/ProgressReportPanel` から汎用化して再利用 or `components/dashboard/` へ移動。現在 `total_ap` は `useDashboardResult` から供給。

### D6: 結果ページ
- `components/farming/result.tsx` から `useProgressReport` / `ProgressReportPanel` 利用を除去。各タブ(ap/lap)・legacy の `progressPanel` を `HistoryGraph` に差し替え。モード別スタッツ(周回数/消費AP/費用)はそのまま。
- `HistoryGraph` はログイン+履歴2件以上で表示、それ以外は自動 null。

## Risks / Trade-offs

- [クライアント再ソルブのコスト(期間×ソルブ)] → `drops`/現在目標をメモ化し、現在所持ソルブは共有。期間は最大3。`useDashboardResult` 同等の負荷に収める。
- [過去 `posession` が欠損のスナップショット(初期データ)] → 減少指標は算出不能。育成総量・新サーヴァントのみ表示し、減少はフォールバック(非表示)。後方互換を維持。
- [現在目標(`material/result`)と過去 `posession` の素材ID空間の不一致] → 既存 net 化と同じ ID 規約(`toApiItemId`/atlasId)に合わせる。`[[project_item_id_systems]]` の2系統に注意。
- [結果ページの履歴グラフは「見ている本人」の履歴] → 共有URLを他人が見ると自分の履歴になるが無害。未ログイン/履歴不足では非表示。
- [マシュのセリフ分岐の回帰] → `seed:progress` で各パターンを目視確認(`feedback_verify_before_push`)。

## Migration Plan

1. ロジック更新(`summary.ts`/`types.ts`/`mashu-messages.ts`/`diff.ts`)+ テスト更新を先行。
2. `/api/progress` 応答に期間別 `pastPosession`(必要なら `pastMaterial`)を追加(後方互換: 既存フィールドは維持)。
3. クライアント側で2回ソルブして reduced* を算出する hook 更新(`use-progress-report` もしくはダッシュボード用 hook)。
4. ダッシュボード `ProgressSection` にマシュ進捗パネルを統合、結果ページから撤去し履歴グラフへ。
5. `seed:progress` で目視確認 → push(自動デプロイ)。ロールバックは revert で可(スキーマ非依存)。
