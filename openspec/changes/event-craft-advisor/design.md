## Context

既存の「配布・交換券アドバイザー」（`lib/material-selection-advisor.ts`）は、単一の「獲得可能総数」に対して1:1交換で限界削減量（シャドウプライス）の大きい素材を貪欲法で割り当てています。
今回のイベントクラフト（水着2026料理作成）では、3種類のイベント食材（海鮮・肉・野菜）を異なる比率で消費して12種類の料理を作成するため、**多次元ナップサック問題（整数線形計画法 / ILP）** として定式化します。

## Goals / Non-Goals

**Goals:**
- 3つのイベント食材（海鮮・肉・野菜）の所持数制約のもとで、ユーザーの育成不足に対するAP/周回数削減量を最大化する料理作成配分を瞬時に算出する。
- 「食材を使い切る」オプションにより、不足枠を満たした後も余った食材で単体価値の高い料理を作成して食材の余剰を最小化する。
- 既存の「配布・交換券アドバイザー」内にタブ切り替えUIとして統合し、マシュ・キリエライトからの親しみやすいアドバイス文章を表示する。
- 独立した純粋関数モジュールとして設計し、堅牢なユニットテストを作成する。

**Non-Goals:**
- 料理ごとの個別作成数下限指定や個別除外チェック（UIの複雑化を避け、全自動で最適解を導く）。
- 汎用的なユーザー定義レシピ作成エディタ（今回は水着2026料理プリセットを提供し、データ構造として将来のイベント追加に対応できる設計とする）。

## Decisions

### 1. ILP（整数線形計画法）の定式化と2段階価値付け

各料理 $j$ の作成回数を整数変数 $x_j \ge 0$ とします。
不足素材の優先と余剰食材の使い切りを両立させるため、作成数を「不足枠内 $x_{j,\text{deficit}}$」と「不足超過・余剰枠 $x_{j,\text{surplus}}$」の2つの変数に分割します。

- **制約条件**:
  - $x_j = x_{j,\text{deficit}} + x_{j,\text{surplus}}$
  - $x_{j,\text{deficit}} \le \text{deficiency}_j$ （不足数上限）
  - $\sum_j (\text{cost}_{j,\text{seafood}} \cdot x_j) + \text{leftover}_{\text{seafood}} = \text{owned}_{\text{seafood}}$
  - $\sum_j (\text{cost}_{j,\text{meat}} \cdot x_j) + \text{leftover}_{\text{meat}} = \text{owned}_{\text{meat}}$
  - $\sum_j (\text{cost}_{j,\text{vegetable}} \cdot x_j) + \text{leftover}_{\text{vegetable}} = \text{owned}_{\text{vegetable}}$
- **目的関数 (最大化)**:
  - $\text{Maximize: } \sum_j (V_{\text{shadow},j} \cdot x_{j,\text{deficit}} + W_{\text{surplus}} \cdot V_{\text{base},j} \cdot x_{j,\text{surplus}}) - W_{\text{leftover}} \cdot (\text{leftover}_{\text{seafood}} + \text{leftover}_{\text{meat}} + \text{leftover}_{\text{vegetable}})$
  - ここで $V_{\text{shadow},j}$ は `priceCandidates` で求めた限界削減量（周回ソルバーのシャドウプライス）、$V_{\text{base},j}$ は通常フリクエ最効率の単体AP/周回価値。
  - 重み係数 $W_{\text{surplus}} = 0.001$（不足枠の優先を絶対に阻害しない）、$W_{\text{leftover}} = 0.00001$（同点時の食材余剰最小化タイブレーク）。
  - 「食材を使い切る」がOFFの場合は $x_{j,\text{surplus}} = 0$ と制約します。

### 2. モジュール構成と責務分離

- `data/event-craft-recipes.ts`:
  - 水着2026「料理作成」の12品目（ゴーヤーチャンプルー、マース煮、目玉ぜんざい等）の消費食材、獲得素材、レアリティ等の静的マスタ定義。
- `lib/event-craft-advisor.ts`:
  - `solveEventCraftAllocation`: ILPモデルを構築し、`javascript-lp-solver` で厳密解を計算する純粋関数。
  - `generateCraftAdvice`: 計算結果と削減効果からマシュのセリフ文章を生成する純粋関数。
- `components/material/event-craft-advisor.tsx`:
  - 食材入力フィールド（海鮮・肉・野菜）、設定トグル、結果一覧カード、残余食材インジケータ。
- `components/material/material-selection-advisor.tsx`:
  - 親コンポーネント。タブヘッダー（「毎月の交換券・配布」/「水着2026 料理作成」）で表示を切り替え。

### 3. localStorage による永続化

- ストレージキー `STORAGE_KEYS.MATERIAL_SELECTION_ADVISOR` のスキーマを拡張、または専用キー `STORAGE_KEYS.EVENT_CRAFT_ADVISOR` を追加して独立管理。
- 最後に開いていたタブも記憶し、次回訪問時にも同じタブが表示されるようにします。

## Risks / Trade-offs

- **[計算パフォーマンス]** 整数線形計画法（ILP）は一般にNP困難だが、今回は変数12個・制約3〜15本程度の超小規模な問題であるため、ブラウザ上で1ミリ秒未満で解が求まり、入力時のラグは一切発生しない。
- **[ついでドロップ素材の扱い]** フリクエ周回でついでに揃う素材（シャドウプライス=0）は不足枠では作成されないが、「使い切る」ON時は余剰食材で作成されうる（無駄なく使い切る観点と整合）。
