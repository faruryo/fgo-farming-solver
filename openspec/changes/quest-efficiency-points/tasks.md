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

## 7. 効率の分母切替・入手アイテム表示・UI 調整

- [x] 7.1 エンジンに `denominator: 'ap' | 'turn'` を追加(turn は `waveCount` で割る、未設定は1ターン扱い)
- [x] 7.2 `Quest.waveCount` を追加し `lib/master-data/wave-count.ts` の `populateWaveCounts`(ポッド=1固定、一意 aaQuestId は Atlas 取得)を実装
- [x] 7.3 `scripts/populate-wave-count.ts` でローカル mock に付与、`update.ts` パイプラインに組込み
- [x] 7.4 一覧/詳細に「AP効率 / 周回効率」トグルを追加(再計算)、i18n 追加。consume 案は不採用
- [x] 7.5 クエスト一覧の各行に入手アイテムのアイコン(ドロップ率上位)を表示
- [x] 7.6 インフォメーションのツールチップを簡潔化(長文4段組 → 1行要約)
- [x] 7.7 ブラウザ確認: 周回効率で冠位研鑽戦が最上位・修練場が下降、アイコン・ツールチップ反映

## 8. 報酬加算・冠位フィルタ・フィルターUI集約

- [x] 8.1 元CSVの 基本絆P/EXP/QP 列を `update.ts` で抽出し `Quest.qp`/`bondPoints`/`exp` に格納。`scripts/populate-rewards.ts` で mock に付与
- [x] 8.2 エンジンに `includeQp`/`includeBond`/`includeExp`(既定OFF)を追加。報酬を擬似アイテムとして正規化・weight=1 で加算(`reward:` 接頭辞)
- [x] 8.3 冠位研鑽戦の VI以下 を既定で除外し「VI以下を表示」トグルで含める(段位ローマ数字をパース、ASCII/全角対応)
- [x] 8.4 フィルターをポップオーバーに集約(素材対象・スキル石・報酬加算・表示)。メイン行は検索・分母・フィルターボタン(バッジ)・所持数入力
- [x] 8.5 詳細の効率内訳に報酬(QP/絆P/EXP)を表示。i18n 追加。ツールチップ簡潔化
- [x] 8.6 報酬加算テスト(includeQp で擬似アイテム加算・既定は非加算)
- [x] 8.7 ブラウザ確認: 報酬トグル・冠位VI以下表示・ポップオーバー・詳細の報酬行

## 9. モーダル刷新・ピース除く・ID統一(育成計算機連動)

- [x] 9.1 所持数モーダルを刷新(各素材アイコン表示、2カラム、余剰しきい値の平易な説明)
- [x] 9.2 「ピース除く」フィルタを追加(`isPiece`、エンジン `includePieces`、ポップオーバーにトグル)
- [x] 9.3 drops アイテムに `atlasId` を付与(`get-local-items` + `scripts/populate-atlas-id.ts` で mock)
- [x] 9.4 所持数(`posession`)を Atlas ID 空間に統一し育成計算機と共有。エンジンは `atlasId` で所持数・必要数を参照
- [x] 9.5 必要数(目標)の主ソースを `material/result`(Atlas ID)に変更、`items`(短縮ID)は `atlasId` 変換で補完(`mergeGoals`)
- [x] 9.6 atlasId 参照テスト追加。ブラウザで所持数が Atlas ID キー("6503")で書かれることを確認

## 6. 検証

- [x] 6.1 `pnpm run type-check` / `pnpm run lint` / `pnpm test`(新テスト含む)が通る
- [x] 6.2 稼働中の `pnpm dev` にブラウザ(browser-use / chrome-devtools)で接続し、一覧の効率ポイント順・検索・トグル・ポッド無料バッジを確認(dev server は起動しない)
- [x] 6.3 所持数モーダルで金素材を余剰十分にし、不足のみモードでそれを多く落とすクエストの効率ポイントが下がることを確認
- [x] 6.4 充足済みだが余剰がしきい値以下の素材が次点(0.3)で残ること、しきい値を下げると外れることを確認
- [x] 6.5 `/quests/[id]` の効率ポイント内訳と、ダッシュボード「達成間近」の所持数加味を確認
- [x] 6.6 `openspec validate quest-efficiency-points --strict` が通る
