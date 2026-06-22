## Context

クエスト効率(`lib/quest-efficiency.ts`)の `computeItemWeight` は現在2段階(不足のみ時): `owned<goal→1` / 余剰 `owned-goal` ≤ `threshold[rarity]`→0.3 / 超→0。`threshold` は `efficiency/surplusThreshold`(金50/銀100/銅200、クラウド同期)。

「不足/必要数」から不足を出す計算は5画面に分散して存在する:

| 画面 | 不足の出し方 | ファイル |
|---|---|---|
| クエスト効率 | 重み判定(2段階) | `lib/quest-efficiency.ts` `computeItemWeight` |
| 育成計算機 result | `max(0, 必要数−所持)` 表示 | `components/material/result.tsx` |
| 周回ソルバー取り込み | `goSolver`: `max(0, 必要数−所持)` → `/farming?items=` | `components/material/result.tsx` |
| 配布アドバイザー | `buildNeedByApiItemId`: `max(0, 必要数−所持)` | `components/material/material-selection-advisor.tsx` |
| 計算履歴 | 解いた `params.items` を保存・表示(as-solved) | `interfaces/api.ts` `Params`, `lib/get-result.ts` |

余剰ストックは「育成必要数(`goal`)に +レア別バッファ」するだけで全画面に効く。設計の肝は **実効目標を出す関数を1つに集約し、全画面が参照する**こと。これにより「今どちらの目標で見ているか」の不整合を構造的に防ぐ。

## Goals / Non-Goals

**Goals:**
- 余剰ストックを「育成必要数 + レア別バッファ」の実効目標として定義し、共有純関数に集約。
- グローバル単一トグル `stockEnabled` で farming 方向の全画面を一括切替。
- クエスト効率・周回ソルバー取り込み・配布アドバイザーが同一の実効不足を使い、整合する。
- 既定OFF・一般ユーザーの既定挙動/導線/保存値を変えない(上級者向けオプトイン)。

**Non-Goals:**
- クエスト効率の対象モードの3値化(2値=全部/不足のみ のまま)。
- ストック設定のアイテム個別上書き(MVP はレア別バッファのみ。将来拡張)。
- 計算履歴での「育成目標/ストック目標」の並列保存・並列表示(as-solved + badge のみ)。
- ソルバー(`lib/solver.ts`)本体の最適化アルゴリズム変更(目標入力値を変えるのみ)。
- ダッシュボード「達成間近の素材」への波及(育成目標のまま)。

## Decisions

### D1: 切替はグローバル単一トグル(所持数モーダルの専用セクション)
`efficiency/stockEnabled`(boolean, 既定false, クラウド同期)を新設し、所持数モーダル内の「ストック目標設定」専用セクションに `stockBuffer` 編集とまとめて1つだけ置く。
- 理由: 「私はストックする人」はペルソナ単位の持続的スタンスで、画面ごとに切替える対象ではない。1スイッチで farming 方向の全画面(クエスト効率・取り込み・アドバイザー)が一括追従し、「どちらの目標で見ているか」が常に一意になる。「どこにトグルを置くか」問題も解消する。設定の置き場所は所持数モーダル内専用セクション(ユーザー確認済み)。`stockBuffer` がカテゴリ群×レアで最大8値になるため、所持数入力の主部とは分けた折りたたみ/サブセクションにする。
- 代替案: クエスト効率3値モード+画面個別トグル → 画面間で状態が直交せず不整合・説明困難なため却下(ユーザー確認済み)。専用設定ページ/モーダルやクエスト効率フィルター内も候補だったが、所持数(=不足判定の入力)と同じ場所が文脈的に近いため所持数モーダルを採用。

### D7: `stockBuffer` はカテゴリ群×レア(最大8区分)
`getRarityByCategory` は秘石/モニュメント等も金銀銅に丸めるため、レア単独だと「竜の逆鱗も秘石もモニュメントも金=同値」となり、育成で大量消費するスキル石/モニュメントを多めにストックできない。そこで `stockBuffer` を **カテゴリ群 × レア** のネストで保持する:
```
group(item) = isSkillStone(largeCategory) ? 'skillStone'
            : isMonumentOrPiece(largeCategory) ? 'monumentPiece'
            : 'normal'
stockBuffer = {
  normal:        { gold, silver, bronze },   // 通常ドロップ素材(既定 50/100/200 = 既存踏襲)
  skillStone:    { gold, silver, bronze },   // 秘石/魔石/輝石(育成で大量消費 → 多めの既定)
  monumentPiece: { gold, silver },           // モニュメント/ピース(銅は存在しない)
}
buffer(item) = stockBuffer[group(item)][rarity(item)]   // レア不明は 0
```
- 分類は既存 `isSkillStone`/`isMonumentOrPiece`(largeCategory)を流用。`monumentPiece` に bronze は無いため設定UIでも非表示。
- 既存 `efficiency/surplusThreshold`(flat 金銀銅)は `normal` 群へ移行し、`skillStone`/`monumentPiece` 未設定群はデフォルト。通常素材のデフォルトを既存値に揃えることで、OFF時の次点バンド挙動を通常素材については不変に保つ。
- 代替案: レアのみ(粗すぎ)/通常素材のみ対象(スキル石を狙えない)/カテゴリ群別単一値(レア差が出せない) → いずれも上級者のきめ細かな制御要求に対して不足(ユーザー確認済み)。

### D2: `stockBuffer` のデュアル強度(次点0.3 ↔ 目標1.0)
同じ `buffer = stockBuffer[group][rarity]`(D7)の数値を、`stockEnabled` で強度切替する:
```
不足のみモード:
  owned < goal                         → 1
  stockEnabled=OFF & goal ≤ owned < goal+buffer  → 0.3 (次点・従来)
  stockEnabled=ON  & goal ≤ owned < goal+buffer  → 1   (目標に昇格)
  それ以外(buffer 超 / レア不明)        → 0
```
- 実効目標 `effGoal = goal + (stockEnabled ? buffer : 0)` を導入し、`stockEnabled=ON` 時は `owned < effGoal → 1` の1段階に帰着(次点バンドなし)。
- `goal=0`(育成目標なし)の素材は `effGoal = buffer` となり、ON 時は所持がバッファ未満なら重み1。「全素材を一定数ストック」の意図に合致。
- 理由: 「次点で拾う」と「目標にする」は同じバッファを弱く/強く狙う関係。3値モードを足さず既存の2値モードに直交させられる。
- 代替案: 目標1.0の先にさらに0.3バンドを残す → 二重しきい値で説明が複雑なため却下(ユーザー確認済み)。

### D3: 共有実効不足を全 farming 画面で使用
`lib/quest-efficiency.ts` に純関数を切り出し、クエスト効率・`goSolver`・配布アドバイザーの3者が呼ぶ:
```
buffer(item, stockBuffer)  = stockBuffer[group(item)][rarity(item)]   // レア不明は 0
effectiveRequired(item, trainingRequired, stockBuffer, stockEnabled)  = trainingRequired + (stockEnabled ? buffer(item, stockBuffer) : 0)
effectiveDeficiency(...)   = max(0, effectiveRequired − owned)
```
カテゴリ群判定(`group`)とレアリティ判定(`getRarityByCategory`)は既存 `lib/item-rarity.ts` を共有。これによりクエスト効率の重み判定と取り込み個数・アドバイザー評価が必ず一致する(ユーザーの「整合」要件)。

### D4: 配布アドバイザーは `stockEnabled` に追従
`buildNeedByApiItemId(amounts, possession, drops)` の need を `effectiveDeficiency` に置換。
- 理由: ストックを狙うユーザーはアドバイザーの推奨もストック込みで評価してほしい(全画面一貫)。
- リスク: 希少な配布/交換枠をストックに使う推奨が出うる → アドバイザーUIで現在 `stockEnabled=ON` であることを示し、ユーザーが意図して有効化している前提に立つ。育成目標固定にしたい場合はトグルOFFで足りる。

### D5: 育成計算機は育成目標が主、ストックは控えめ副表示
`material/result` の表示は育成必要数/不足が主。保存値 `material/result`(育成必要数)はストックで**書き換えない**(stock は表示/取り込み時に計算)。`stockEnabled=ON` のときだけ各素材に「+ストック分」を控えめに併記。`goSolver` の取り込みは実効不足(D3)。

### D6: 計算履歴は as-solved + badge
`Params` に `stockIncluded?: boolean` を追加し、`goSolver` がストック込みで遷移したら true をセット。履歴/結果は解いた `params.items` をそのまま表示し、`stockIncluded` の履歴に「ストック込み」badge を出す。
- 後方互換: 既存履歴は `stockIncluded` 未設定 → false 扱い(badge なし)。
- 理由: 履歴は「実際に解いた目標」の忠実な記録。育成/ストックの並列保存は複雑でメリット薄。

## Risks / Trade-offs

- [グローバルトグルで複数画面が一斉に変わり驚く] → 既定OFF・上級者オプトイン。トグルは所持数モーダルに集約し、ON 中はクエスト効率/アドバイザーに「ストック込み」表示を出して状態を明示。
- [`stockBuffer` のデュアル強度で混乱] → 所持数モーダルの説明文を `stockEnabled` で出し分け(次点上限 / 目標個数)。値は不変。
- [画面間の不整合(ユーザーの主懸念)] → 実効不足を単一純関数(D3)に集約し3者が共有。`lib/quest-efficiency.test.ts` で境界(owned==effGoal、buffer=0、goal=0、レア不明、stockEnabled の ON/OFF)を回帰テスト。
- [`Params` 拡張の互換] → optional フィールドで追加、既存履歴は未設定=false。型と保存/読込の双方を確認。

## Migration Plan

1. `lib/item-rarity.ts`: `categoryGroup(item)` を追加(`isSkillStone`/`isMonumentOrPiece` 流用)。`lib/quest-efficiency.ts`: `stockBuffer`(群×レア)型・`buffer()`/`effectiveRequired`/`effectiveDeficiency` 切り出し、`computeItemWeight` を `stockEnabled`+群×レア対応、`QuestEfficiencyOptions` に `stockEnabled`/`stockBuffer`。
2. `interfaces/api.ts`: `Params.stockIncluded?: boolean`。
3. `PossessionModal.tsx`: 「ストック目標設定」セクション(`stockEnabled` トグル + 群×レアの `stockBuffer` 編集、`surplusThreshold` → `normal` 群移行、説明出し分け)。`QuestEfficiencyList.tsx`: `stockEnabled`/`stockBuffer` を読み反映。
4. `material/result.tsx`: `goSolver` 実効不足 + `stockIncluded` 付与、ON時副表示。
5. `material-selection-advisor.tsx`: need を実効不足に。
6. 計算履歴(結果/履歴ページ): `stockIncluded` badge。
7. テスト → type-check → `pnpm dev` で全画面の整合を実機確認(push 前視認)。

ロールバック: `stockEnabled` 既定OFF・`Params` 追加は加算的なので、コード revert で従来挙動に戻る(保存データ破壊なし)。

## Open Questions

- farming 画面で目標の内訳(育成X+ストックY)を補助表示するか — 初期は合算のみで可、余力で内訳。
- `stockEnabled=ON` 中にクエスト効率「全部」モードを選んだ場合は従来どおり全素材重み1(stock 無関係)で問題ないか — 想定どおりで可。
