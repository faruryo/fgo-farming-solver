## 1. 進捗ロジック（型と算出）

- [x] 1.1 `lib/progress/types.ts`: `PeriodSummary` に `growthTotal`、`reducedAp?`/`reducedLap?`/`reducedYen?` を追加。`deltaApAdjusted`/`targetApIncrease` の UI 用途を廃止（内部診断は残置可）。`ProgressResponse` の期間別に `pastPosession`（必要なら `pastMaterial`）を返せる形にする。
- [x] 1.2 `lib/progress/diff.ts`: スナップショットから過去 `posession`（gross 所持）を抽出する関数を追加（既存 `extractItemCounts` と同様に `storage`/legacy 両形式に対応）。
- [x] 1.3 `lib/progress/summary.ts`: `growthTotal = Σ servantGrowth.delta` を算出。サーバ応答に期間別 `pastPosession` を含める。旧 `deltaApRaw`/`deltaApAdjusted`/`targetApIncrease` を見出し指標として返すのをやめる。
- [x] 1.4 `lib/progress/tier.ts`: `classifyTier` の入力を `reducedAp`（無い期間は 0）へ差し替え、`reducedAp<=0 && growthTotal===0` で `none`。
- [x] 1.5 `lib/progress/mashu-messages.ts`: `targetApIncrease`/`deltaApAdjusted` 依存分岐を `reducedAp`/`growthTotal`/新規サーヴァント検出へ更新（セリフのパターン：進捗量・育成成長・新サーヴァントを維持）。

## 2. クライアント算出（目標固定再ソルブ＝方式1）

- [x] 2.1 純粋関数 `lib/progress/compute-reduction.ts`（新規）: `(currentTargets, currentPosession, pastPosession, quests, drops) => { reducedAp, reducedLap }`。`need=max(0, target−owned)` を作り `solve`(or `solveBoth`) を現在所持版・過去所持版で実行して差分。素材IDは既存 net 化と同じ規約（`toApiItemId`/atlasId）に合わせる。
- [x] 2.2 `compute-reduction.ts` の単体テスト: 目標不変で所持増→正の減少、目標増加のみ→減少0、過去所持欠損→null フォールバック、を決定的フィクスチャで検証。
- [x] 2.3 進捗取得 hook（`hooks/use-progress-report.ts` もしくはダッシュボード用に新設）: `/api/progress` の `pastPosession` と localStorage の `material/result`・`posession`・`quests`・`useDrops` を使って期間別 `reducedAp/reducedLap/reducedYen` をクライアントで算出し `PeriodSummary` を補完。現在所持ソルブと `drops`/現在目標はメモ化で共有。

## 3. ダッシュボードへの移設・表示

- [x] 3.1 マシュ進捗パネル本体（`components/farming/ProgressReportPanel` + `progress-report-content`）を、stats（周回数/消費AP/費用 絶対値）非依存で「育成総量」「減少AP/周回/費用」「マシュのセリフ」を出す表示へ更新。汎用化 or `components/dashboard/` へ移動。
- [x] 3.2 `components/dashboard/ProgressSection.tsx`: 上部にマシュ進捗パネル（前回/1週間前/1ヶ月前タブ）、下部に既存達成率円グラフ、の2段構成へ。現在 `total_ap`/再ソルブ入力は `useDashboardResult` から供給。
- [x] 3.3 `app/page.tsx`: `ProgressSection` の配置を確認（達成率の上にマシュ進捗が来る形）。必要に応じてセクション順を調整。
- [x] 3.4 `locales/ja.json`・`locales/en.json`: 「育成総量」「アイテム入手による減少」「減少AP/周回/費用」等の文言キーを追加。

## 4. 結果ページの差し替え

- [x] 4.1 `components/farming/result.tsx`: `useProgressReport`/`ProgressReportPanel` の利用を除去し、各タブ（ap/lap）・legacy の `progressPanel` を `HistoryGraph` に差し替え。モード別スタッツはそのまま。
- [x] 4.2 `HistoryGraph`（`components/dashboard/HistoryGraph.tsx`）が結果ページ文脈で問題なく表示/非表示（未ログイン・履歴<2件）になることを確認。必要なら見出し文言を結果ページ向けに調整。

## 5. テスト・既存仕様整合

- [x] 5.1 `lib/progress/summary.test.ts` を新指標（`growthTotal`、`pastPosession` 返却、旧フィールド非使用）に合わせて更新。
- [x] 5.2 `lib/progress/tier.test.ts`・`mashu-messages` 関連テストを `reducedAp`/`growthTotal` 基準に更新。
- [x] 5.3 `pnpm run type-check`・`pnpm run lint`・`pnpm test` をパスさせる。

## 6. 検証（push 前に実機確認）

- [x] 6.1 `pnpm run seed:progress` でダミースナップショットを注入し、ダッシュボードで前回/1週間前/1ヶ月前タブを切り替え、育成総量・減少AP/周回/費用・マシュの各セリフパターン（進捗量・育成成長・新サーヴァント）を目視確認。
- [x] 6.2 目標を増やしても減少指標が増えないこと、所持を増やすと減少指標が増えることをローカルで確認。
- [x] 6.3 結果ページで壊れたマシュパネルが消え、履歴グラフ（履歴2件以上）が出ること、モード別スタッツが維持されることを確認。
- [x] 6.4 既存ユーザーデータ（`material/result`・`posession`・`material`）が読み取りのみで破壊されないことを確認。

## 7. OpenSpec 反映

- [x] 7.1 全タスク完了後 `openspec validate progress-play-based-metrics --strict` をパス。
- [ ] 7.2 実装・検証完了後に `/opsx:archive` で `progress-visualizer` の canonical spec へ反映。
