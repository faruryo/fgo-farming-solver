## Context

スプレッドシートの「効率ポイント」は、既存 `lib/master-data/update.ts:384-407` が計算する Relative Efficiency Score と同式(各素材を「その素材の最良クエスト」に対する比に正規化して合計)。現状は上位100クエストを選ぶフィルタにしか使われず UI 露出が無い。所持数は既に localStorage `posession`(`Record<itemId, number>`)として存在し、`components/material/` で入力 UI があり `hooks/use-cloud-sync.ts` の `KEYS` でクラウド同期済み。目標は `items`、QP は item id `01` としてドロップデータに含まれる。クエストは `/quests/[id]` 詳細のみで一覧/検索ページは無い。

## Goals / Non-Goals

**Goals:**
- クエストごとの効率ポイント(相対効率の合計、キャンペーン AP 反映)を算出する純粋関数を提供する。
- 所持数 + 目標で効率ポイントを個人最適化する(設定パネル不要、所持数登録で価値を表現)。
- 一覧/検索ページ・詳細・ダッシュボードに効率ポイントを露出し、ストームポッド無料クエストの「やる/見送り」がランキングで読めるようにする。

**Non-Goals:**
- 絆(ボンド)・夢火の効率反映(ドロップデータに無いため follow-up)。
- カテゴリ別重み設定パネル(所持数 + レア別余剰しきい値で代替)。なおレア別余剰しきい値(金/銀/銅の3値)は小さな調整入力として例外的に提供する。
- ソルバー本体(LP)の変更。効率ポイントは表示用の独立指標。

## Decisions

### D1. スコア定義 = 相対効率の合計(スプレッドシート踏襲)
```
effAp(q)         = computeEffectiveAp(q.ap, q.id, activeCampaigns)   // lib/solver.ts 再利用
bestEff(i)       = max over q of  drop_rate(q,i) / effAp(q)
relativeEff(i,q) = (drop_rate(q,i) / effAp(q)) / bestEff(i)          // 0〜1
score(q)         = Σ_i  relativeEff(i,q) × weight[i]
```
- 代替案: 絶対効率(価値×ドロップ/AP)。却下 — 数値スケールが直感的でなく、ユーザーは相対効率の合計を希望。
- `bestEff` はクライアントで `drop_rates` から前計算(`item → rates` Map)。規模は数百クエスト × ~95素材で軽量。

### D2. 個人価値 = 所持数 + 目標 + 余剰しきい値(2段階の重み)
- `goal`=`items`, `owned`=`posession`。素材のレアリティ `r(i)` は item の `category` から判定(`gold`/`silver`/`bronze`)。**localized item に `background` は無い**ため、`category`(銅素材/銀素材/金素材・輝石/魔石/秘石・ピース/モニュメント、英 locale も同様)→ レアの対応表(get-items の taxonomy を反転)を使う。
- **QP・絆はドロップデータに存在しない**(`drop_rates`/`items` は 強化素材/スキル石/モニュピ のみ)。したがって効率ポイントに本質的に寄与せず、「QP 不要」は自動的に成立する(特別な zero 処理は不要)。
- **不足のみモードの重み**(2段階。「それ以下か以上か」で次点を拾う):
  - `owned < goal` (不足) → **1**(主優先)
  - 上記以外で余剰 `surplus = owned - goal` が `surplusThreshold[r] >= surplus` → **0.3**(次点)
  - それ以外(余剰が大きい) → **0**
- **全部モード**: `weight[i] = 1`。
- 「石除く」: `largeCategory === 'スキル石'` の `weight[i]=0`(ビューフィルタ)。
- **目標未設定素材の統一**: `goal=0` のとき `surplus = owned` なので、同じ `surplusThreshold[r]` が「所持数が少なめの素材を次点で拾う」しきい値も兼ねる(ダッシュボード「達成間近」拡張と共通)。別の `lowStockThreshold` は不要。
- **余剰しきい値の保持**: レア別デフォルト(例 `gold:50 / silver:100 / bronze:200`)を持ち、ユーザーが localStorage で数値上書き可。`hooks/use-cloud-sync.ts` の `KEYS` に追加してクラウド同期。
- 代替案: カテゴリ別重みパネル / 連続減衰。却下 — ユーザーは所持数登録 + レア別余剰しきい値(2段階)を希望。

### D2.5 効率の分母を AP / ターン数 で切替
- `denominator: 'ap' | 'turn'`。`eff(i,q) = drop_rate / denom(q)`、`denom = 'ap' ? effAp : waveCount(q)`。
- 「周回効率」(turn)はターン数で割るため、1ターンで終わるクエスト(冠位研鑽戦)が3ターン(修練場)より高評価。AP当たり/手間(ターン)当たりの2観点を提供。
- wave数は新規 `Quest.waveCount`。`lib/master-data/wave-count.ts` の `populateWaveCounts` で付与し、パイプライン(`update.ts`)とローカル mock 生成(`scripts/populate-wave-count.ts`)で共有。
- **aaQuestId 衝突対策**: 冠位研鑽戦等は aaQuestId が修練場と衝突し Atlas 取得が不正確。ポッドクエストは単一 wave 確定なので1固定、それ以外は一意 aaQuestId のみ取得。残りは未設定(=1ターン扱い)。
- 消費数(AP or ポッド数)案はユーザー判断で却下(分かりにくい)。

### D3. エンジンは純粋関数 `lib/quest-efficiency.ts`
- `computeQuestEfficiency(drops, { possession, goals, activeCampaigns, nowSec, shortageOnly, includeSkillStones, surplusThreshold })`(`surplusThreshold`: `{ gold, silver, bronze }`、レア別デフォルトをマージ)。
- 返り値: `{ questId, score, contributions: { itemId, drop_rate, relativeEff, weighted }[] }[]`(score 降順)。
- テスト容易性とサーバ/クライアント両用のため副作用なし。詳細1クエスト分にも同関数を使う。

### D4. 表示面の再利用
- 一覧: `ToggleGroup`(`NearGoalSection` 既存パターン)、ポッドは `lib/quest-consumes-pod.ts` + `hooks/use-pod-free-quests.ts`、データは `hooks/use-drops.ts` / `hooks/use-active-campaigns.ts`。
- 所持数モーダル: `useLocalStorage('posession')` を読み書き(同期は KEYS 既存登録で自動)。可能なら `components/material/result-table.tsx` の入力 UI を抽出/流用。
- 詳細: `app/quests/[id]/page.tsx` の `QuestDropInfo` 付近に効率ポイント + 内訳。
- ダッシュボード: `NearGoalSection` の `needed` を所持数加味の不足度へ変更。

## Risks / Trade-offs

- [効率ポイントが「不足のみ」と「全部」で大きく変わり混乱] → トグルに説明 Tooltip を付け、デフォルトと意味を明示。
- [所持数未入力だと不足のみモードが空/誤解] → 未入力素材を検知して入力モーダルへのナッジを表示。
- [`bestEff` をフィルタ済み上位クエスト群から計算するため厳密な全体最良ではない] → 既存データはアイテム別 Top5 + 効率上位100を含むため実用上問題なし。説明 Tooltip で「コミュニティデータ範囲」と明記。
- [絆/夢火を価値に入れられない] → v1 スコープ外と UI に明記。将来 Atlas のクエスト報酬抽出で対応。
- [`posession` のキー名タイプミス] → 既存仕様に合わせ `posession` のまま使用(改名は別タスク)。
