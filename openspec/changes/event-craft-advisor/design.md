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

### 1. 2段階 ILP（整数線形計画法）による厳密最適化

固定係数による単一目的関数ではなく、**2段階の辞書式多目的最適化（2-stage ILP）** を採用します。これにより、食材が大量にある場合でも余剰枠が不足枠の最適解を歪めることがなく、また「ついでドロップ（シャドウプライス=0）」素材が余剰食材削減目的で誤って不足枠に選ばれることを完全に防ぎます。

- **Stage 1: 不足枠の削減価値最大化**
  - **変数**: $x_{j,\text{deficit}} \ge 0$ （各料理 $j$ の不足枠作成数、整数）
  - **制約条件**:
    - $x_{j,\text{deficit}} \le \text{deficiency}_j$ （$V_{\text{shadow},j} > 0$ の素材のみ許可、$V_{\text{shadow},j} \le 0$ の素材は $x_{j,\text{deficit}} = 0$ に固定）
    - $\sum_j \text{cost}_{j,k} \cdot x_{j,\text{deficit}} \le \text{owned}_k$ （各食材 $k \in \{\text{seafood}, \text{meat}, \text{vegetable}\}$）
  - **目的関数 (最大化)**:
    - $\text{Maximize: } \sum_j V_{\text{shadow},j} \cdot x_{j,\text{deficit}}$
  - 最適値を $Z^*_{\text{deficit}}$ とします。
  - ※「食材を使い切る」オプションが OFF の場合は、Stage 1 の最適解で終了します。

- **Stage 2: 余剰食材の使い切り（「食材を使い切る」ON時のみ実行）**
  - Stage 1 で求めた不足削減価値 $Z^*_{\text{deficit}}$ を維持したまま、残余食材で単体効率の高い料理を作成し、余剰食材を最小化します。
  - **変数**: $x_{j,\text{deficit}} \ge 0$, $x_{j,\text{surplus}} \ge 0$ （整数）
  - **制約条件**:
    - $\sum_j V_{\text{shadow},j} \cdot x_{j,\text{deficit}} \ge Z^*_{\text{deficit}}$ （不足削減価値の完全保証）
    - $x_{j,\text{deficit}} \le \text{deficiency}_j$ （$V_{\text{shadow},j} > 0$ のみ）
    - $\sum_j \text{cost}_{j,k} \cdot (x_{j,\text{deficit}} + x_{j,\text{surplus}}) + \text{leftover}_k = \text{owned}_k$
  - **目的関数 (最大化)**:
    - $\text{Maximize: } \sum_j V_{\text{base},j} \cdot x_{j,\text{surplus}} - 0.00001 \cdot (\text{leftover}_{\text{seafood}} + \text{leftover}_{\text{meat}} + \text{leftover}_{\text{vegetable}})$
    - ここで $V_{\text{base},j}$ は通常フリクエ最効率の単体AP/周回価値。同点時は残余食材数の最小化が働きます。

- **計算パフォーマンス**:
  - 各ステージの変数は 12〜24 個、制約は 4〜16 本程度です。
  - 2回解いてもブラウザ上で合計 5ms 未満で完了するため、UIのレスポンスを損なうことなく、数学的に厳密な優先順位が保証されます。

### 2. モジュール構成と責務分離

- `data/event-craft-recipes.ts`:
  - 水着2026「料理作成」の12品目（ゴーヤーチャンプルー、マース煮、目玉ぜんざい等）の消費食材、獲得素材、レアリティ等の静的マスタ定義。
- `lib/event-craft-advisor.ts`:
  - `solveEventCraftAllocation`: 2-stage ILP モデルを構築し、`javascript-lp-solver` で厳密解を計算する純粋関数。
  - `generateCraftAdvice`: 計算結果と削減効果からマシュのセリフ文章を生成する純粋関数。
- `components/material/event-craft-advisor.tsx`:
  - 食材入力フィールド（海鮮・肉・野菜）、設定トグル、結果一覧カード、残余食材インジケータ。
- `components/material/material-selection-advisor.tsx`:
  - 親コンポーネント。タブヘッダー（「毎月の交換券・配布」/「水着2026 料理作成」）で表示を切り替え。

### 3. localStorage による永続化

- ストレージキー `STORAGE_KEYS.MATERIAL_SELECTION_ADVISOR` のスキーマを拡張、または専用キー `STORAGE_KEYS.EVENT_CRAFT_ADVISOR` を追加して独立管理。
- 最後に開いていたタブも記憶し、次回訪問時にも同じタブが表示されるようにします。

## Risks / Trade-offs

- **[計算パフォーマンス]** 整数線形計画法（ILP）は一般にNP困難だが、今回は変数12〜24個・制約4〜16本程度の超小規模な問題であるため、2段階で解いてもブラウザ上で数ミリ秒で解が求まり、入力時のラグは一切発生しない。
- **[ついでドロップ素材の扱い]** フリクエ周回でついでに揃う素材（シャドウプライス=0）は Stage 1 の不足枠では作成されないが、「使い切る」ON時は余剰食材で作成されうる（無駄なく使い切る観点と整合）。
