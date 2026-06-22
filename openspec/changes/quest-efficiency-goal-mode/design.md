## Context

クエスト効率(`lib/quest-efficiency.ts`)の重み決定 `computeItemWeight` は現在2段階:

```
不足のみ(shortageOnly=true):
  owned < goal           → 1   (不足=主優先)
  owned ≥ goal & 余剰 ≤ threshold[rarity] → 0.3 (次点)
  余剰 > threshold        → 0
全部(shortageOnly=false): 常に 1
```

- `threshold` = `efficiency/surplusThreshold`(金50/銀100/銅200、クラウド同期)。
- `goal` = `mergeGoals(material/result, items, dropItems)`(育成計算機の必要数が主、周回ソルバー目標で補完)。
- 対象モードは `quests/efficiency/shortageOnly`(boolean, localStorage)で2値。
- 周回ソルバー連携: `components/material/result.tsx` の `goSolver` が `deficiency = max(0, required − owned)` を計算し `/farming?items=短縮ID:個数,...` へ push。

タイプB(育成必要数 + レア別余剰ストックを目標にする)プレイヤーは、この「余剰ストックぶん」を次点0.3ではなく目標そのものとして扱いたい。クエスト効率と周回ソルバーの双方で同じ目標解釈にする必要がある。

**位置づけ**: 本機能は育成目標の達成が近いプレイヤー(主要素材は概ね充足し、あとは余剰ストックの積み増しが関心事)向けの**上級者向けニッチ機能**である。一般ユーザーの導線・既定挙動を変えないことを最優先とし、対象モードはオプトイン(既定は現状の `shortage`)、UI はフィルターポップオーバー内に留めて主行を増やさない。

## Goals / Non-Goals

**Goals:**
- レア別余剰ストック個数を目標に上乗せする第3モード `不足+余剰ストック` を `computeItemWeight` に追加。
- クエスト効率ランキングと周回ソルバー取り込みの双方で、同一の「実効目標 = 育成必要数 + 余剰ストック個数[レア]」を使えるようにする。
- 既存ストレージ(`surplusThreshold` 流用、`shortageOnly` 後方互換移行)を壊さない。

**Non-Goals:**
- 余剰ストック個数の新規 UI 設定追加(既存 `surplusThreshold` の値を流用する。別軸の設定は導入しない)。
- 報酬(QP/絆/EXP)加算ロジックの変更。
- ソルバー(`lib/solver.ts`)本体の最適化アルゴリズム変更(目標 `items` の入力値を変えるのみ)。
- イベント周回プランナー(`event-planner`)への展開。

## Decisions

### D1: 対象モードを2値 boolean → 3値へ拡張
`quests/efficiency/shortageOnly`(boolean)を `quests/efficiency/targetMode`(`'all' | 'shortage' | 'shortage-plus-stock'`)へ移行する。
- 移行読み替え: 旧 `shortageOnly===true → 'shortage'`、`false → 'all'`。新キーが未設定なら旧キーを読んで初期化する(片方向移行、旧キーは削除しても残してもよい)。
- 理由: ユーザーは「モードを追加」と表現しており、独立トグルの重ね掛けより3択セグメントが意図に合う。`computeItemWeight` も `shortageOnly: boolean` を `mode` 受け取りに変更し分岐を一本化できる。
- 代替案: `shortageOnly` を残し別途 `includeSurplusStock` boolean を追加 → 「全部モード時に余剰ストック」という無意味な組合せが生じ状態が直交しないため却下。

### D2: 目標モードの重み式
`mode === 'shortage-plus-stock'` のとき:
```
effGoal = goal + stock[rarity]      (stock = surplusThreshold の値)
owned < effGoal → 1
owned ≥ effGoal → 0
```
- 次点0.3バンドは使わない(ストックぶんが既に目標に入っており、その先をさらに拾う動機が薄い)。レアリティ不明素材は従来どおり該当時0扱い。
- 代替案: padded goal の先にさらに0.3バンドを残す → 二重しきい値で説明が難しく、ストックを「目標」と捉えるモードの趣旨に反するため却下(将来必要なら別途)。

### D3: 余剰ストック個数のソースは `surplusThreshold` を流用
新しい設定キーを足さず、`efficiency/surplusThreshold` の数値をモードによって解釈し分ける:
- `shortage`: 「次点0.3で拾う余剰の上限」
- `shortage-plus-stock`: 「目標に上乗せするストック個数」
- 理由: 同一の数値(レア別に何個まで持っておきたいか)を2つの用途が共有でき、設定が一箇所で済む。クラウド同期も既存のまま。
- リスク: 同じ数値が文脈で意味を変えるため、UI で誤解されうる(→ D5 で説明文をモード連動)。

### D4: 周回ソルバー取り込みの上乗せ
`material/result.tsx` の `goSolver` に「余剰ストックも目標に含める」トグルを追加し、ON 時のデフィシットを
```
deficiency = max(0, (required + stock[rarity]) − owned)
```
で算出して `/farming?items=` に渡す。`stock` は同じ `surplusThreshold`、レアリティは `getRarityByCategory`(quest-efficiency と同一関数)で判定。
- これによりクエスト効率の目標モードと周回計画が同じ目標で一致する。
- 注意: `goSolver` の対象は `requiredItems`(育成必要数がある素材)。余剰ストックは「育成目標がある素材に上乗せ」する形で、育成目標ゼロの素材を新たに目標化はしない(クエスト効率も `goal` ベースのため整合)。

### D5: UI(フィルターポップオーバー & 所持数モーダル)
- `/quests` フィルターポップオーバーの対象モードを3択に。`不足+余剰ストック` 選択時はバッジ/説明で「育成目標+レア別ストックを目標に」と示す。
- `PossessionModal` の余剰しきい値説明文を現在の対象モードに応じて出し分ける(次点上限 / 目標上乗せ個数)。
- i18n キーを `locales/` に追加。

## Risks / Trade-offs

- [余剰しきい値のデュアルセマンティクスで混乱] → D5 の説明文出し分けと、モードラベルを明確化(「不足+余剰ストック」)。値そのものは不変なので破壊的影響はない。
- [`shortageOnly` 移行の取りこぼし] → 新キー未設定時に旧 boolean を読む読み替えで既存ユーザーの選択を保持。`lib/quest-efficiency.test.ts` で移行と境界(owned == effGoal、stock=0、レア不明)を回帰テスト。
- [クエスト効率の目標モードとソルバー取り込みの不一致] → どちらも `goal + stock[rarity]`、`getRarityByCategory` を共有する純関数として実装し、ストック上乗せの算出を1関数に集約して両者から呼ぶ。
- [ダッシュボード「達成間近」への波及懸念] → 本変更は対象外(達成間近は `goal − owned` のまま)。目標モードはクエスト効率ランキングとソルバー取り込みに限定。

## Migration Plan

1. `lib/quest-efficiency.ts`: `computeItemWeight` / `QuestEfficiencyOptions` を mode 対応に拡張(`shortageOnly` 互換は呼び出し側で吸収 or オーバーロード)。ストック上乗せの純関数を切り出す。
2. `QuestEfficiencyList.tsx`: `targetMode` state と旧 `shortageOnly` 読み替え、UI 3択化。
3. `material/result.tsx`: `goSolver` にストック上乗せトグル。
4. テスト追加 → `pnpm test` / type-check。
5. `pnpm dev` で `/quests` のモード切替と `/farming` 取り込みを実機確認(push 前の視認)。

ロールバック: localStorage 移行は加算的(旧キーを破壊しない)ため、コード revert で旧2モードに戻る。

## Open Questions

- `不足+余剰ストック` を `/quests` の既定にはしない(既定は現状維持 `shortage`)で良いか — 既定変更は別途判断。
- ソルバー取り込みトグルの状態を localStorage 永続化するか、その場限りにするか(初期は永続化なしの素朴実装で可)。
