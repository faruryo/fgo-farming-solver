## Context

既存の「配布・交換券アドバイザー」（`lib/material-selection-advisor.ts`）は、単一の「獲得可能総数」に対して1:1交換で限界削減量（シャドウプライス）の大きい素材を貪欲法で割り当てています。
今回のイベントクラフト（水着2026料理作成）では、3種類のイベント食材（海鮮・肉・野菜）を異なる比率で消費して12種類の料理を作成するため、**フリクエ周回とクラフト作成を同時に最適化する混合整数線形計画法（MILP）** として定式化します。

## Goals / Non-Goals

**Goals:**
- 3つのイベント食材（海鮮・肉・野菜）の所持数制約のもとで、ユーザーの育成不足に対する実質的なAP/周回数削減量（残余周回コストの最小化）を厳密に最大化する料理作成配分を算出する。
- 複数素材の同時獲得による共通フリクエの完全消去やドロップ相互作用を100%正確にモデルへ反映する。
- 「食材を使い切る」オプションにより、不足枠を満たした後も余った食材で単体価値の高い料理を作成して食材の余剰を最小化する。
- 各料理カードには単体限界価値に基づく推定削減量を表示し、全体の合計削減量はMILPで算出した厳密な削減コストを可視化する。
- 既存の「配布・交換券アドバイザー」内にタブ切り替えUIとして統合し、マシュ・キリエライトからの親しみやすいアドバイス文章を表示する。
- 独立した純粋関数モジュールとして設計し、堅牢なユニットテストを作成する。

**Non-Goals:**
- 料理ごとの個別作成数下限指定や個別除外チェック（UIの複雑化を避け、全自動で最適解を導く）。
- 汎用的なユーザー定義レシピ作成エディタ（今回は水着2026料理プリセットを提供し、データ構造として将来のイベント追加に対応できる設計とする）。

## Decisions

### 1. フリクエ周回とクラフトの同時最適化（MILP）と厳密な辞書式順序

各素材の1個あたり限界価値（固定シャドウプライス）を線形結合する近似や固定ペナルティ係数では、共通ドロップの相互作用や大規模インベントリ時の最適解の歪みを防げません。
そこで、**フリクエ周回ソルバーとクラフト選択を1つの混合整数線形計画法（MILP）モデルに統合し、余剰使い切りと残余食材最小化も完全な辞書式順序（Lexicographic multi-stage）** で解きます。

- **アイテムとレシピの定義**:
  - 各料理 $j$ の消費食材数を $\text{cost}_{j,k}$ （$k \in \{\text{seafood}, \text{meat}, \text{vegetable}\}$）とする。
  - 各料理 $j$ の作成により得られる素材 $i$ の個数を $\text{yield}_{j,i}$ とする（水着2026では1料理あたり1個の特定素材）。
  - 各素材 $i$ の不足数を $\text{deficiency}_i = \text{fullNeed}_i$ とする（`fullNeed` は既存アドバイザーと同じく、すでに所持数を引いた実効不足）。
  - 所持数 $\text{owned}_k$ はイベント食材（海鮮・肉・野菜）の所持数のみを指す。

- **対象アイテムのフィルタリング (Infeasible 回避)**:
  - `continuousOptimalCost`（`lib/material-selection-advisor.ts`）と同様に、許可クエストに恒常ドロップが存在するアイテム、またはクラフトレシピの獲得対象アイテムのみを制約対象 $i \in \text{farmableOrCraftableItems}$ とします。QPやドロップのないアイテムは制約から除外し、モデルが Infeasible になることを防ぎます。

- **数値計算上の許容誤差 ($\varepsilon = 10^{-6}$)**:
  - 浮動小数点丸め誤差により後続ステージが Infeasible になるのを防ぐため、先行ステージの最適値制約には $\varepsilon = 10^{-6}$ のマージンを設けます。

- **Stage 1: 不足素材に対するフリクエ周回コスト最小化 (MILP)**
  - **Stage 1a: 最小周回コストの算出**
    - **決定変数**:
      - $y_q \ge 0$ （各許可クエスト $q$ の周回数、連続変数）
      - $x_{j,\text{deficit}} \in \mathbb{Z}_{\ge 0}$ （各料理 $j$ の不足枠作成数、一般整数変数）
    - **制約条件**:
      - 素材必要数充足: $\sum_{q} (\text{drop}_{q,i} \cdot y_q) + \sum_{j} (\text{yield}_{j,i} \cdot x_{j,\text{deficit}}) \ge \text{fullNeed}_i \quad (\forall i \in \text{farmableOrCraftableItems})$
      - 食材所持上限: $\sum_j (\text{cost}_{j,k} \cdot x_{j,\text{deficit}}) \le \text{owned}_k \quad (\forall k)$
      - 生成物不足数上限: $\sum_j (\text{yield}_{j,i} \cdot x_{j,\text{deficit}}) \le \text{deficiency}_i \quad (\forall i)$
    - **目的関数 (最小化)**:
      - $\text{Minimize: } \sum_q (\text{cost}_q \cdot y_q)$
      - （周回数節約優先: $\text{cost}_q = 1$、AP節約優先: $\text{cost}_q = \text{ap}_q$）
    - クラフト前のベースライン最適コストを $C_{\text{base}}$、本最適解の目的関数値を $C^*_{\text{opt}}$ とします。
  
  - **Stage 1b: 最小周回コストを維持した消費食材の最小化タイブレーク**
    - 他素材集めのついでに揃う素材など、クラフトしても周回コストが変わらないゼロ効果クラフトによる食材浪費を完全に防ぐため、最小周回コスト制約のもとで総消費食材数を最小化します。
    - **制約条件**:
      - $\sum_q (\text{cost}_q \cdot y_q) \le C^*_{\text{opt}} + \varepsilon$ （最小周回コストを厳格に維持）
      - 素材必要数充足・食材所持上限・生成物不足数上限は Stage 1a と同一
    - **目的関数 (最小化)**:
      - $\text{Minimize: } \sum_j \left( \sum_k \text{cost}_{j,k} \right) \cdot x_{j,\text{deficit}}$
    - 得られた解を不足枠の最適作成数 $x^*_{j,\text{deficit}}$ とします。真の総削減量は $C_{\text{base}} - C^*_{\text{opt}}$ となります。
    - ※「食材を使い切る」が OFF の場合は、この Stage 1 の最適解で終了します。

- **Stage 2: 余剰食材の使い切り（「食材を使い切る」ON時のみ実行）**
  - Stage 1 で確定した不足枠作成数 $x^*_{j,\text{deficit}}$ を固定し、残った食材 $\text{remaining}_k = \text{owned}_k - \sum_j \text{cost}_{j,k} x^*_{j,\text{deficit}}$ を用いて、余剰素材価値の最大化と残余食材の最小化を**2段階の辞書式最適化**で解きます。
  
  - **Stage 2a: 余剰素材単体価値の最大化 (ILP)**
    - **決定変数**: $x_{j,\text{surplus}} \in \mathbb{Z}_{\ge 0}$ （各料理 $j$ の余剰枠作成数、一般整数変数）
    - **制約条件**: $\sum_j \text{cost}_{j,k} \cdot x_{j,\text{surplus}} \le \text{remaining}_k \quad (\forall k)$
    - **目的関数 (最大化)**: $\text{Maximize: } \sum_j (V_{\text{base},j} \cdot x_{j,\text{surplus}})$
    - ここで $V_{\text{base},j}$ は通常フリクエ最効率の単体AP/周回価値。最適目的関数値を $V^*_{\text{surplus}}$ とします。
  
  - **Stage 2b: 残余食材の最小化タイブレーク (ILP)**
    - **決定変数**: $x_{j,\text{surplus}} \in \mathbb{Z}_{\ge 0}$, $\text{leftover}_k \ge 0$
    - **制約条件**:
      - $\sum_j (V_{\text{base},j} \cdot x_{j,\text{surplus}}) \ge V^*_{\text{surplus}} - \varepsilon$ （最適余剰価値を厳格に保証）
      - $\sum_j \text{cost}_{j,k} \cdot x_{j,\text{surplus}} + \text{leftover}_k = \text{remaining}_k \quad (\forall k)$
    - **目的関数 (最小化)**: $\text{Minimize: } \sum_k \text{leftover}_k$

### 2. 削減量表示とマシュのアドバイス帰属規則

MILPによる統合最適化では複数素材の相互作用により個々の料理の削減効果を一意に分解できないため、表示規則を以下のように定めます。

- **各料理カードの削減量表示**:
  - 各料理 $j$ の獲得素材に対する単体限界削減価値（`priceCandidates` のシャドウプライス、余剰分は $V_{\text{base}}$）$\times$ 作成個数 を推定削減量として表示します。
- **全体の合計削減量**:
  - MILP で得られた厳密な差分 $C_{\text{base}} - C^*_{\text{opt}}$ を表示します。
- **マシュのセリフ（最優先料理の選定）**:
  - 作成数 $x_j > 0$ かつ単体限界削減価値が最も高い料理を「最優先料理」としてアドバイス文に選定します。

### 3. モジュール構成と責務分離

- `data/event-craft-recipes.ts`:
  - 水着2026「料理作成」の12品目（ゴーヤーチャンプルー、マース煮、目玉ぜんざい等）の消費食材、獲得素材、レアリティ等の静的マスタ定義。
- `lib/event-craft-advisor.ts`:
  - `solveEventCraftAllocation`: drops（フリクエデータ）、全不足数、食材所持数から MILP モデルを構築して最適配分を算出する純粋関数。
  - `generateCraftAdvice`: 計算結果と削減効果からマシュのセリフ文章を生成する純粋関数。
- `components/material/event-craft-advisor.tsx`:
  - 食材入力フィールド（海鮮・肉・野菜）、設定トグル、結果一覧カード、残余食材インジケータ。
- `components/material/material-selection-advisor.tsx`:
  - 親コンポーネント。タブヘッダー（「毎月の交換券・配布」/「水着2026 料理作成」）で表示を切り替え。

### 4. localStorage による永続化

- ストレージキー `STORAGE_KEYS.MATERIAL_SELECTION_ADVISOR` のスキーマを拡張、または専用キー `STORAGE_KEYS.EVENT_CRAFT_ADVISOR` を追加して独立管理。
- 最後に開いていたタブも記憶し、次回訪問時にも同じタブが表示されるようにします。

## Risks / Trade-offs

- **[計算パフォーマンスとメインスレッド負荷]**
  - Stage 1 は許可クエスト約300個の連続変数 $y_q$、制約約60個、およびクラフト整数変数12個（$x_j \in [0, \text{deficiency}]$）を含む MILP となります。
  - 連続LP単体でも中央値 ~20ms を要するため、MILP の分枝限定法（Branch and Bound）による計算時間は入力値の組み合わせによって変動し、数十ミリ秒〜数百ミリ秒となる可能性があります（未実測）。
  - **緩和策**:
    - まずは非同期/同期実行で実測ベンチマークを実施。
    - メインスレッドのブロッキングや体感遅延が発生する場合は、Web Worker への計算オフロード、または分枝限定法のタイムアウト時に「シャドウプライスに基づく貪欲 ILP」へのフォールバックを導入します。
- **[ついでドロップ素材の厳密な扱い]**
  - フリクエ周回全体を直接目的関数とし、かつ Stage 1b で消費食材を最小化するため、「他素材のついでに自然に集まる素材」に対して料理を作成しても周回コストが下がらない場合は自動的に作成数0となり、真に周回を減らせる料理だけが選ばれます。
