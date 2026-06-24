# quest-efficiency Specification

## Purpose
TBD - created by archiving change quest-efficiency-points. Update Purpose after archive.
## Requirements
### Requirement: 効率ポイントの算出

システムは各クエストの効率ポイントを「相対効率の合計」として算出 SHALL。各素材について `relativeEff(i,q) = (drop_rate(q,i) / effectiveAP(q)) / (その素材の全クエスト中の最大 drop_rate/effectiveAP)` を求め、対象素材に重みを掛けて合計する。effectiveAP はアクティブなキャンペーン(`computeEffectiveAp`)を反映 SHALL。

#### Scenario: 単一クエストのスコア
- **WHEN** あるクエストが複数素材をドロップし、各素材が他クエストより効率的である
- **THEN** 各素材の相対効率(0〜1)の合計がそのクエストの効率ポイントとして返る

#### Scenario: 最良クエストは相対効率1
- **WHEN** ある素材を最も効率的(drop_rate/effectiveAP 最大)に集められるクエストである
- **THEN** その素材の relativeEff は 1 として計上される

#### Scenario: キャンペーン AP の反映
- **WHEN** AP 半減などのアクティブキャンペーンが対象クエストに適用されている
- **THEN** effectiveAP が割引後の値で計算され、効率ポイントが上昇する

### Requirement: 効率の分母(AP効率 / 周回効率)

システムは効率の分母をユーザーが切り替えられる SHALL。「AP効率」は実効AP1あたりのドロップ、「周回効率」はターン数(wave数)1あたりのドロップで評価する。周回効率は1ターンで終わる速いクエストほど高評価となる(3ターンの修練場より1ターンの冠位研鑽戦が有利)。wave数が不明なクエストは1ターン扱いにフォールバック SHALL。クエストの wave数(`waveCount`)は master-data に保持し、ポッドクエストは単一 wave のため1固定、その他は aaQuestId が一意なものを Atlas Academy から取得する SHALL。

#### Scenario: AP効率
- **WHEN** 「AP効率」が選択されている
- **THEN** 各クエストは実効AP1あたりのドロップで評価される

#### Scenario: 周回効率は1ターンクエストを高評価
- **WHEN** 「周回効率」が選択され、3ターンのクエストと1ターンのクエストが同じ素材を同率でドロップする
- **THEN** 1ターンのクエストの方が効率ポイントが高くなる

#### Scenario: wave数不明はフォールバック
- **WHEN** 「周回効率」で wave数が不明なクエストがある
- **THEN** そのクエストは1ターン扱いで評価される

### Requirement: モニュピ除くフィルタ

システムは「モニュピ除く」ビューにおいて、霊基再臨素材(largeCategory が モニュピ/Monuments and Pieces = ピースとモニュメント)の重みを0とする SHALL(スキル石の「石除く」と同様)。ピースとモニュメントは1つのトグルでまとめて除外される。

#### Scenario: モニュピ除く
- **WHEN** 「モニュピ除く」が選択されている
- **THEN** ピース(銀)とモニュメント(金)はどちらも効率ポイントに寄与しない

### Requirement: 所持数・必要数を育成計算機と連動(Atlas ID 統一)

システムは所持数(`posession`)と必要数を、育成計算機と同じ **Atlas ID** 空間で扱う SHALL。所持数は育成計算機の所持数と同一の `posession`(Atlas ID キー)を共有し、必要数は育成計算機の `material/result`(Atlas ID)を主ソース、周回ソルバー目標 `items`(短縮ID)を `atlasId` に変換して補完する。drops のアイテムは `atlasId` を保持する SHALL。

#### Scenario: 所持数の共有
- **WHEN** クエスト効率の所持数モーダルで素材の所持数を入力する
- **THEN** 育成計算機(material/result)と同じ Atlas ID キーで保存され、双方に反映される

#### Scenario: 必要数は material/result が主
- **WHEN** 育成計算機で必要数(material/result)が計算されている
- **THEN** クエスト効率の不足判定は material/result の必要数 − 所持数 で行われる

#### Scenario: 本番マスターデータにも atlasId を保持
- **WHEN** マスターデータ更新パイプライン(`lib/master-data/update.ts`)が drops の `items` を構築する
- **THEN** 各アイテムに対応する Atlas ID(`atlasId`)を付与する(モックだけでなく本番データでも保持)

#### Scenario: 旧データの atlasId 実行時補完
- **WHEN** `getDrops` が取得した `items` に `atlasId` が欠けている(再生成前の旧マスターデータ)
- **THEN** 短縮ID → Atlas ID の対応(`toApiItemId`)で欠損分のみ補完し、既存フィールドや所持数キーは変更しない
- **THEN** Atlas Academy が利用不可なら items は素のまま返し、リクエスト全体は失敗させない

### Requirement: 所持数モーダルの体裁

システムは所持数モーダルに各素材のアイコンを表示し、余剰しきい値の意味を平易に説明する SHALL。

#### Scenario: アイコンと説明
- **WHEN** 所持数モーダルを開く
- **THEN** 各素材にアイコンが表示され、余剰しきい値の説明文が表示される

### Requirement: 報酬(QP/絆/EXP)の効率ポイント加算

システムは QP・基本絆P・マスターEXP を効率ポイントに任意で加算できる SHALL(各々トグル、既定OFF)。トグルON時、その報酬を擬似アイテムとして「報酬量/分母」を最良クエストで正規化し weight=1 で加算する。これらの報酬値は元CSVの列(基本絆P/EXP/QP)から `Quest.qp` / `bondPoints` / `exp` として抽出する SHALL。QP・絆が不要なユーザーはOFFのまま、欲しいユーザーだけONにする。

#### Scenario: 既定では加算しない
- **WHEN** 報酬トグルがすべてOFF
- **THEN** QP・絆・EXP は効率ポイントに寄与しない

#### Scenario: QP を加算
- **WHEN** QP加算をONにする
- **THEN** QP が擬似アイテムとして正規化・加算され、QP報酬の多いクエストの効率ポイントが上がる

### Requirement: 冠位研鑽戦の低段位フィルタ

システムは冠位研鑽戦の VI 以下(段位ローマ数字)のクエストを既定で一覧から除外する SHALL。「VI以下を表示」トグルで含められる。

#### Scenario: 既定で VI以下を隠す
- **WHEN** 「冠位研鑽戦 VI以下を表示」がOFF(既定)
- **THEN** 冠位研鑽戦の段位 VI 以下のクエストは一覧に表示されない

#### Scenario: VI以下を表示
- **WHEN** トグルをONにする
- **THEN** 冠位研鑽戦の VI 以下も一覧に表示される

### Requirement: フィルターのポップオーバー集約

システムは増加したフィルター(素材対象・スキル石・報酬加算・表示)をフィルターボタンのポップオーバーに集約 SHALL。メイン行は検索・分母(AP効率/周回効率)・フィルターボタン・所持数入力に保ち、アクティブなフィルター数をバッジ表示する SHALL。

#### Scenario: フィルター集約とバッジ
- **WHEN** 既定以外のフィルターが有効になっている
- **THEN** フィルターボタンに有効数がバッジ表示され、ポップオーバーで各フィルターを切り替えられる

### Requirement: クエスト一覧の入手アイテム表示

システムはクエスト一覧の各行に、そのクエストで入手できる素材アイコン(ドロップ率上位)を表示 SHALL。

#### Scenario: 入手アイテムのアイコン表示
- **WHEN** ユーザーがクエスト一覧を見る
- **THEN** 各クエスト行にドロップ素材のアイコンが(ドロップ率の高い順に)表示される

### Requirement: 所持数と目標による個人最適化(2段階重み)

システムは各素材の重みを所持数(`posession`)・目標(`items`)・カテゴリ群×レア別余剰ストック(`stockBuffer`)・グローバル設定 `stockEnabled` から決定 SHALL。対象モードは「全部」「不足のみ」の2値を維持する。

素材のストック個数を `buffer(item) = stockBuffer[group(item)][rarity(item)]` と定義 SHALL。`group` は `isSkillStone`/`isMonumentOrPiece`(largeCategory)で「スキル石 / モニュピ / 通常素材」を判定し、`rarity` は `getRarityByCategory`(category)で金銀銅を判定する。実効目標を `effGoal = goal + (stockEnabled ? buffer(item) : 0)` と定義 SHALL。「不足のみ」モードでは:
- `owned < goal`(育成不足) → 重み **1**(主優先)
- `goal ≤ owned < effGoal`(余剰ストック範囲) → `stockEnabled=OFF` なら重み **0.3**(次点)、`stockEnabled=ON` なら重み **1**(目標に昇格)
- `owned ≥ effGoal`(ストック込み目標達成 / レア不明) → 重み **0**

`goal=0`(育成目標なし)の素材は `effGoal = stockEnabled ? buffer(item) : 0` となる。レアリティ不明素材はストック対象外(`buffer=0` 相当)とする SHALL。QP・絆はドロップデータに存在しないため寄与しない。「全部」モードでは `stockEnabled` に関わらず全対象素材を重み1とする SHALL。

#### Scenario: 育成不足は主優先
- **WHEN** ある素材の所持数が育成必要数未満で、不足のみモード
- **THEN** その素材は重み1で効率ポイントに寄与する

#### Scenario: ストックOFFは余剰を次点で拾う
- **WHEN** `stockEnabled=OFF`・不足のみモードで、所持数が育成必要数以上だが余剰がレア別 `stockBuffer` 以下
- **THEN** その素材は重み0.3(次点)で寄与する

#### Scenario: ストックONは余剰を目標に昇格
- **WHEN** `stockEnabled=ON`・不足のみモードで、所持数が `育成必要数 + buffer(item)` 未満
- **THEN** その素材は重み1(主優先)で寄与する(次点0.3にはならない)

#### Scenario: ストック込み目標に到達したら除外
- **WHEN** 不足のみモードで、所持数が `育成必要数 + (stockEnabled ? buffer(item) : 0)` 以上
- **THEN** その素材の重みは0となり寄与しない

#### Scenario: カテゴリ群でストック個数が異なる
- **WHEN** `stockEnabled=ON` で、金レアの通常素材(例: 竜の逆鱗)と金レアのスキル石(秘石)が同じ所持数である
- **THEN** それぞれ `stockBuffer['normal']['gold']` と `stockBuffer['skillStone']['gold']` の別個の上乗せで実効目標が判定される

#### Scenario: 育成目標ゼロ素材もONなら一定数狙う
- **WHEN** `stockEnabled=ON`・不足のみモードで、育成目標が無く所持数が `buffer(item)` 未満の素材がある
- **THEN** その素材は重み1で寄与する(全素材を一定数ストックする意図)

#### Scenario: 全部モード
- **WHEN** 全部モードが有効
- **THEN** 所持数・目標・`stockEnabled` に関わらず、ドロップする全素材が寄与する

### Requirement: レア別余剰しきい値

システムは余剰ストック(`stockBuffer`)を **カテゴリ群(通常素材 / スキル石 / モニュピ)× レア(金銀銅、モニュピは金銀のみ)** で保持 SHALL(ストレージキー `efficiency/stockBuffer`)。各群×レアに妥当なデフォルト値を持ち(通常素材は既存の金50/銀100/銅200を踏襲、スキル石/モニュピは大量消費を見込んだ既定)、ユーザーが数値で上書きでき、上書き値はクラウド同期される SHALL。既存 `efficiency/surplusThreshold`(flat 金銀銅)が存在する場合は通常素材群へ移行する SHALL。この値は `stockEnabled` によって強度が切り替わる: `OFF` では「次点(重み0.3)で拾う余剰の上限」、`ON` では「目標(重み1)に上乗せするストック個数」として解釈される。

#### Scenario: デフォルトで動作
- **WHEN** ユーザーが `stockBuffer` 未設定のまま一覧を開く
- **THEN** 各カテゴリ群×レアのデフォルト値で、`stockEnabled` に応じて次点(OFF)または目標上乗せ(ON)が行われる

#### Scenario: カテゴリ群ごとの調整
- **WHEN** ユーザーがスキル石(秘石/魔石/輝石)のストック個数を通常素材と別に設定する
- **THEN** スキル石はその群の値で、通常素材は通常素材群の値で、それぞれ独立に判定される

#### Scenario: 旧 surplusThreshold の移行
- **WHEN** 旧 `efficiency/surplusThreshold`(flat 金銀銅)のみが保存された状態でページを開く
- **THEN** その値が通常素材群へ移行され、通常素材の OFF 時(次点)挙動は従来と変わらない

### Requirement: スキル石フィルタ

システムは「石除く」ビューにおいて、スキル石(`largeCategory === 'スキル石'`)の重みを0とする SHALL。

#### Scenario: 石除く
- **WHEN** 「石除く」が選択されている
- **THEN** 秘石・魔石・輝石は効率ポイントに寄与しない

#### Scenario: 石含む
- **WHEN** 「石含む」が選択されている
- **THEN** スキル石も他素材と同様に効率ポイントへ寄与する

### Requirement: クエスト一覧/検索ページ

システムは `/quests` にクエスト一覧/検索ページを提供 SHALL。各クエストのエリア・名前・AP(effectiveAP と元 AP)・効率ポイントを表示し、名前/エリアでの検索、効率ポイント降順ソート、「石含む/除く」「不足のみ/全部」トグルを提供 SHALL。ストームポッド消費クエストとポッド無料中クエストにはバッジを表示 SHALL。

#### Scenario: 効率ポイント順の表示
- **WHEN** ユーザーが一覧ページを開く
- **THEN** クエストが効率ポイント降順で表示される

#### Scenario: 検索
- **WHEN** ユーザーがエリア名またはクエスト名で検索する
- **THEN** 一致するクエストのみが表示される

#### Scenario: トグルでスコア再計算
- **WHEN** ユーザーが「石含む/除く」または「不足のみ/全部」を切り替える
- **THEN** 効率ポイントとランキングが即座に再計算される

#### Scenario: ストームポッド無料判定
- **WHEN** 今ストームポッド無料期間中のポッド消費クエスト(例: 冠位研鑽戦)が存在する
- **THEN** そのクエストに「ポッド無料中」バッジが付き、効率ポイントの高低でやる/見送りが読める

#### Scenario: 詳細への遷移
- **WHEN** ユーザーが一覧の行を選択する
- **THEN** そのクエストの `/quests/[id]` 詳細へ遷移する

#### Scenario: 効率ポイントの右寄せと狭幅でのクエスト名確保
- **WHEN** 入手アイテムアイコン列が非表示になる狭い画面幅(SP)で一覧を表示する
- **THEN** クエスト名が余白を吸収して幅を確保し、効率ポイントは行の右端に右寄せされる
- **THEN** 広い画面幅(sm 以上)では「名前 | 入手アイテムアイコン | 効率ポイント」のレイアウトを維持する

### Requirement: 所持数入力導線

システムは一覧ページの表示近くに所持数入力モーダルへの導線を提供 SHALL。モーダルは既存 `posession`(localStorage)を読み書きし、クラウド同期される。効率計算に効く素材で所持数が未入力のものがある場合、入力を促すナッジを表示 SHALL。

#### Scenario: 所持数の編集
- **WHEN** ユーザーが所持数入力モーダルで素材の所持数を変更し保存する
- **THEN** `posession` が更新され、効率ポイントが再計算される

#### Scenario: 未入力の促し
- **WHEN** 効率計算に効く素材で所持数が未入力のものがある
- **THEN** 入力を促すナッジが表示され、モーダルを開ける

### Requirement: クエスト詳細の効率ポイント表示

システムは `/quests/[id]` 詳細に当該クエストの効率ポイントと素材別 contribution(relativeEff × 重み)の内訳を表示 SHALL。

#### Scenario: 内訳表示
- **WHEN** ユーザーがクエスト詳細を開く
- **THEN** 効率ポイントの合計と、寄与した素材ごとの内訳が表示される

### Requirement: クエスト詳細のクエスト報酬表示

システムは `/quests/[id]` 詳細に、当該クエストのクエスト報酬(QP / 基本絆P / EXP)を、効率ポイント加算トグルの ON/OFF に関わらず常に表示 SHALL。値は元 CSV 由来の `Quest.qp` / `Quest.bondPoints` / `Quest.exp` を用いる。

#### Scenario: 報酬の表示
- **WHEN** ユーザーがクエスト詳細を開き、当該クエストに報酬値(QP/基本絆P/EXP)が存在する
- **THEN** 存在する報酬項目のみがクエスト報酬として表示される

#### Scenario: 報酬データが無い場合
- **WHEN** 当該クエストに報酬値が一つも無い
- **THEN** 「報酬データがありません」と表示される

### Requirement: 達成間近の素材の所持数加味

システムはダッシュボードの「達成間近の素材」を、所持数を加味した不足度 `max(0, goal - owned)` で評価 SHALL。本セクションは目標達成(「あと◯個で達成」)に焦点を当てるため目標素材のみを対象とし、目標未設定の低所持素材の発見はクエスト一覧(不足のみモード)に委ねる。

#### Scenario: 所持数による不足度
- **WHEN** ある素材の目標に対し所持数が一部を満たしている
- **THEN** 残必要数は `max(0, goal - owned)` で評価される

#### Scenario: 所持十分なら達成間近から外れる
- **WHEN** ある目標素材の所持数が目標以上になった
- **THEN** その素材は達成間近の候補から外れる

### Requirement: 余剰ストックを目標に含めるグローバル設定(stockEnabled)

システムは「余剰ストックを目標に含める」グローバルトグル `stockEnabled`(boolean, 既定 OFF, クラウド同期, ストレージキー `efficiency/stockEnabled`)を提供 SHALL。トグルは所持数モーダル内の「ストック目標設定」専用セクションに、カテゴリ群×レアの `stockBuffer` 編集とまとめて1つだけ置き、画面ごとの個別トグルは設けない SHALL。`stockEnabled=ON` のとき、farming 方向の各機能(クエスト効率の重み、周回ソルバー取り込み、配布アドバイザー)が一括して実効目標 `育成必要数 + buffer(item)`(`buffer(item) = stockBuffer[group(item)][rarity(item)]`)を参照する。実効必要数・実効不足は共有の純関数で算出し、各機能が同一定義を用いる SHALL。育成達成が近い上級者向けのオプトインであり、既定では一般ユーザーの挙動・保存値を変えない。

#### Scenario: グローバルトグルの一括反映
- **WHEN** ユーザーが所持数モーダルで `stockEnabled` を ON にする
- **THEN** クエスト効率ランキング・周回ソルバー取り込み・配布アドバイザーが、いずれもストック込み実効目標で再計算される

#### Scenario: 既定はOFFで従来挙動
- **WHEN** ユーザーが `stockEnabled` を一度も設定していない
- **THEN** `stockEnabled=OFF` として、従来どおり育成目標(次点0.3バンド含む)で動作する

#### Scenario: 説明文のモード連動
- **WHEN** `stockEnabled=ON` で所持数モーダルを開く
- **THEN** `stockBuffer` が「目標へ上乗せするストック個数」として説明される

#### Scenario: 実効目標の共有
- **WHEN** 同一の `stockBuffer`・所持数・育成必要数で、クエスト効率が不足と判定する量と周回ソルバー取り込みが渡す量を比較する
- **THEN** 両者は同じ共有純関数(`実効不足 = max(0, 育成必要数 + buffer(item) − 所持)`)に基づき一致する

