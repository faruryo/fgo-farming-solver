## 1. コアエンジン

- [x] 1.1 `lib/quest-efficiency.ts` を新規作成し、`computeQuestEfficiency(drops, opts)` を実装(`opts`: possession, goals, activeCampaigns, nowSec, shortageOnly, includeSkillStones, lowStockThreshold?)
- [x] 1.2 `computeEffectiveAp`(`lib/solver.ts`)を用いた effectiveAP・bestEff・relativeEff の前計算(`item → rates` Map)を実装
- [x] 1.3 2段階重み(不足=1 / 余剰≤レア別しきい値=0.3 / 余剰超=0、QP等 zero は次点なし)・全部モード・石含む/除くを実装し、スコア合計 `{ questId, score, contributions[] }[]` を score 降順で返す
- [x] 1.4 レア別余剰しきい値のデフォルト(例 gold:50/silver:100/bronze:200)と上書きマージを実装(`category` でレア判定。QP/絆はドロップデータに無いため対象外)
- [x] 1.5 `lib/quest-efficiency.test.ts` を追加(bestEff 正規化、不足=1/余剰小=0.3/余剰大=0、しきい値変更で再計算、石含む/除く、キャンペーン AP 反映)

## 2. クエスト一覧/検索ページ

- [x] 2.1 `app/quests/page.tsx` を新規作成(`use-drops` / `use-active-campaigns` で読み込み、`computeQuestEfficiency` を呼ぶ)
- [x] 2.2 `components/quests/QuestEfficiencyList.tsx` を作成(エリア・名前・AP・効率ポイント列、効率ポイント降順ソート)
- [x] 2.3 検索ボックス(エリア/名前フィルタ)を実装
- [x] 2.4 「石含む/除く」「不足のみ/全部」トグル(`ToggleGroup`、`NearGoalSection` 参照)を実装し、切替で再計算
- [x] 2.5 ポッド消費/無料バッジを `lib/quest-consumes-pod.ts` と `hooks/use-pod-free-quests.ts` で表示
- [x] 2.6 各行から `/quests/[id]` への遷移リンクを実装
- [x] 2.7 トグルの意味とデータ範囲を説明する Tooltip を追加
- [x] 2.8 文言を `locales/` の翻訳キーで定義(i18n)

## 3. 所持数入力モーダル

- [x] 3.1 `components/quests/PossessionModal.tsx` を作成(`useLocalStorage('posession')` 読み書き)。可能なら `components/material/result-table.tsx` の入力 UI を抽出/流用
- [x] 3.2 一覧ページ表示近くにモーダルへの導線を配置
- [x] 3.3 効率に効く素材で所持数未入力のものを検知し、入力を促すナッジを表示
- [x] 3.4 レア別余剰しきい値(金/銀/銅)の数値入力 UI を追加(localStorage キー新設、`hooks/use-cloud-sync.ts` の `KEYS` に登録してクラウド同期)。デフォルト値で動き、上書き可能にする

## 4. クエスト詳細の拡張

- [x] 4.1 `app/quests/[id]/page.tsx` に効率ポイント合計と素材別 contribution 内訳を表示(`computeQuestEfficiency` を1クエスト分で利用)

## 5. ダッシュボード「達成間近の素材」拡張

- [x] 5.1 `components/dashboard/NearGoalSection.tsx` の `needed` を所持数加味の不足度 `max(0, goal - owned)` に変更
- [x] 5.2 目標未設定の低所持素材の発見はクエスト一覧(不足のみモード)に委ねる方針に決定。NearGoalSection は目標素材のみのまま据え置き(ユーザー決定)

## 6. 検証

- [x] 6.1 `pnpm run type-check` / `pnpm run lint` / `pnpm test`(新テスト含む)が通る
- [x] 6.2 稼働中の `pnpm dev` にブラウザ(browser-use / chrome-devtools)で接続し、一覧の効率ポイント順・検索・トグル・ポッド無料バッジを確認(dev server は起動しない)
- [x] 6.3 所持数モーダルで金素材を余剰十分にし、不足のみモードでそれを多く落とすクエストの効率ポイントが下がることを確認
- [x] 6.4 充足済みだが余剰がしきい値以下の素材が次点(0.3)で残ること、しきい値を下げると外れることを確認
- [x] 6.5 `/quests/[id]` の効率ポイント内訳と、ダッシュボード「達成間近」の所持数加味を確認
- [x] 6.6 `openspec validate quest-efficiency-points --strict` が通る
