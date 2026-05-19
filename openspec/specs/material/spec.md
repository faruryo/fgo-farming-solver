# 仕様書: 育成素材計算機 (Material)

## Purpose
ユーザーが目標とするサーヴァントの育成に必要な素材を計算し、現在の所持数との差分を一覧表示する機能。

## Requirements

### Requirement: ServantCard ポートレートからサーヴァント詳細への遷移
育成素材計算機のサーヴァントカードにおいて、ポートレート（アイコン画像）をクリックするとサーヴァント詳細ページへ遷移できなければならない (SHALL)。

#### Scenario: ポートレートクリックによる詳細ページ遷移
- **WHEN** ServantCard のポートレート（`c-servant-portrait` 領域）をクリックしたとき
- **THEN** `/servants/{servant.id}` へ遷移する。
- **THEN** ポートレート領域のレイアウト（flex センタリング）および hover アニメーションは維持される。

### Requirement: URLハッシュによる特定サーヴァントへのスクロールと強調表示
特定のサーヴァントを指定するURLハッシュ（`#svt-{id}`）が存在する場合、対象のサーヴァントが画面内に表示されるようスクロールし、強調表示を行わなければならない (SHALL)。

#### Scenario: ハッシュ指定による初回強調表示
- **GIVEN** URLに `#svt-302000` が含まれている
- **WHEN** ページが表示されたとき
- **THEN** ID `302000` のサーヴァントまでスクロールする
- **THEN** 強調表示アニメーション（`u-highlight`）が適用される

#### Scenario: 状態変更による不要な強調表示の抑制
- **GIVEN** URLに `#svt-302000` が含まれており、すでに強調表示が完了している
- **WHEN** サーヴァントの所持状態やスキルレベルを変更（`chaldeaState` が更新）されたとき
- **THEN** 強調表示アニメーションは**再実行されない** (SHALL NOT)。
- **THEN** スクロール位置も**移動しない** (SHALL NOT)。

### Requirement: サーヴァント状態管理 (Chaldea State)
育成素材計算機は、各サーヴァントの所持状況、霊基再臨レベル、スキルレベル（3 種）、アペンドスキルレベル（5 種）、および育成目標（範囲の `start` / `end`）を管理しなければならない (SHALL)。

#### Scenario: 所持状態のトグル
- **WHEN** ユーザーがサーヴァントカードの「所持/未所持」ボタンをクリックしたとき
- **THEN** そのサーヴァントの `disabled` 状態が反転し、表示も「✓ 所持」「未所持」に切り替わる。
- **THEN** 未所持状態のサーヴァントは育成完了判定および所持数カウントの対象外となる。

#### Scenario: 霊基再臨レベルの編集
- **WHEN** 所持済みサーヴァントの霊基再臨ピップをクリックしたとき
- **THEN** クリック対象と現在値が同じ場合は 1 段階下げる、それ以外の場合はクリックした段階に設定する（範囲: 0〜4）。

#### Scenario: スキルレベルの編集
- **WHEN** 所持済みサーヴァントのスキルカード（1〜3）をクリックしたとき
- **THEN** スキルレベルが 1 上昇し、10 に達した次のクリックで 1 に戻る（範囲: 1〜10、サイクル動作）。

#### Scenario: アペンドスキルレベルの編集
- **WHEN** 所持済みサーヴァントのアペンドカード（1〜5）をクリックしたとき
- **THEN** アペンドスキルレベルが 1 上昇し、10 に達した次のクリックで 0 に戻る（範囲: 0〜10、0 はロック状態、サイクル動作）。

### Requirement: 共通目標設定
ユーザーは、全サーヴァントに対する育成目標（霊基再臨、スキル、アペンド）を一括で設定できなければならない (SHALL)。

#### Scenario: 共通目標の一括適用
- **WHEN** 共通目標パネルで霊基再臨/スキル/アペンドの目標値を変更したとき
- **THEN** 全サーヴァントの該当目標値（`ranges[].end`）がただちに更新される。
- **THEN** 各サーヴァントの育成完了判定はこの共通目標値を基準として行われる。

### Requirement: フィルタリングとソート
育成素材計算機は、サーヴァント一覧をクラス・レアリティ・育成状態でフィルタリングし、複数のソート順を切り替えられなければならない (SHALL)。

#### Scenario: クラスフィルタ
- **WHEN** ユーザーが特定のクラスタブを選択したとき
- **THEN** そのクラスに該当するサーヴァントのみが表示される（`all` 選択時は制限なし）。
- **THEN** クラス名が `beast` を含むものは `beast` クラスとしてまとめて扱われる。

#### Scenario: レアリティフィルタ
- **WHEN** ユーザーがレアリティボタン（1〜5★）を選択したとき
- **THEN** 選択されたレアリティのサーヴァントのみが表示される（複数選択可能、未選択時は制限なし）。

#### Scenario: 育成状態フィルタ
- **WHEN** ユーザーが「全表示」「未所持を隠す」「未所持のみ」「育成完了を隠す」「育成完了のみ」のいずれかを選択したとき
- **THEN** 該当条件のサーヴァントのみが表示される。

#### Scenario: ソート順の切替
- **WHEN** ユーザーがソートモードを「図鑑No.順」「新しい順」「レアリティ↓」「レアリティ↑」のいずれかに変更したとき
- **THEN** サーヴァント一覧が選択された順序で並び替えられる。

### Requirement: 育成完了判定
システムは、サーヴァントの現在の霊基再臨/スキル/アペンドレベルが全て共通目標値以上に到達しているとき、該当サーヴァントを「育成完了」として識別しなければならない (SHALL)。

#### Scenario: 完全育成完了
- **WHEN** 所持サーヴァントの霊基再臨が `gtAsc` 以上、全スキルが `gtSkill` 以上、全アペンドが `gtAppend` 以上に達したとき
- **THEN** サーヴァントカードに `tier-full` クラスが適用される。

#### Scenario: 部分的な育成完了
- **WHEN** 所持サーヴァントが霊基再臨のみ目標到達したとき
- **THEN** `tier-asc` クラスが適用される。
- **WHEN** 霊基再臨に加えて全スキルも目標到達したとき
- **THEN** `tier-skill` クラスが適用される。

### Requirement: 永続化とクラウド同期
Chaldea state はブラウザの localStorage（キー `material`）に保存され、クラウド同期の対象となる (SHALL)。

#### Scenario: ローカル保存
- **WHEN** いずれかのサーヴァント状態（所持/再臨/スキル/アペンド/目標）が変更されたとき
- **THEN** 即座に `localStorage['material']` にシリアライズされて保存される。

#### Scenario: クラウド同期への参加
- **WHEN** クラウド同期処理（`/api/cloud`）が実行されたとき
- **THEN** `material` キーは同期対象 `KEYS` に含まれ、Cloudflare KV へ送信される。
- **THEN** 進捗比較用の `state_snapshots` にも、他のキーと併せて保存される。

### Requirement: 育成記録モード（Tracking Mode）のトグル
育成素材計算機は、ユーザーが「育成記録モード」を ON / OFF に切り替えられる UI を提供しなければならない (SHALL)。モードの初期値は OFF とし、ブラウザの localStorage（キー `material/tracking-mode`）に永続化する (SHALL)。

#### Scenario: モードトグルの表示位置
- **WHEN** ユーザーが共通目標パネル（`COMMON TARGET — 共通目標設定`）を展開したとき
- **THEN** パネル下部に「育成を記録する」トグルが表示される。
- **THEN** トグル横に `?` ツールチップで挙動の説明（「タップ: +1 ／ 長押し: -1。ON 時、現在値を変更すると所持数を増減します」）が表示される。

#### Scenario: 折りたたみ時の状態インジケータ
- **GIVEN** 育成記録モードが ON である
- **WHEN** 共通目標パネルが折りたたみ表示のとき
- **THEN** パネルヘッダ内に `● REC` のインジケータ（赤系の色）が表示される。
- **GIVEN** 育成記録モードが OFF である
- **WHEN** 共通目標パネルが折りたたみ表示のとき
- **THEN** インジケータは表示されない。

#### Scenario: 初期値と永続化
- **GIVEN** ユーザーが初めてページを訪れる（`material/tracking-mode` 未設定）
- **WHEN** `/material` ページを開いたとき
- **THEN** モードは OFF として表示される。
- **WHEN** ユーザーがトグルを切り替えたとき
- **THEN** 即座に `localStorage['material/tracking-mode']` に保存される。

### Requirement: 現在値変更時の所持数自動増減
育成記録モードが ON のとき、サーヴァントカード上で `start`（霊基再臨/スキル/アペンドの現在値）が変更されたら、システムは変更差分に対応する素材を `localStorage['posession']` から増減しなければならない (SHALL)。

#### Scenario: 再臨レベル上昇による消費
- **GIVEN** 育成記録モードが ON、サーヴァントAの再臨 `start` が 1
- **WHEN** ユーザーが再臨ピップをクリックして `start` を 2 にしたとき
- **THEN** サーヴァントAの `ascensionMaterials['1']` に含まれる各素材 `amount` 分、`possession[itemId]` から減算される。
- **THEN** QP も `possession['1']` から減算される。

#### Scenario: 再臨レベル下降による返還
- **GIVEN** 育成記録モードが ON、サーヴァントAの再臨 `start` が 2
- **WHEN** ユーザーがピップを操作して `start` を 1 にしたとき
- **THEN** サーヴァントAの `ascensionMaterials['1']` に含まれる各素材 `amount` 分、`possession[itemId]` に加算される。

#### Scenario: 複数段階の同時変更
- **GIVEN** 育成記録モードが ON、サーヴァントAの再臨 `start` が 1
- **WHEN** ユーザーがピップ4をクリックして `start` を 4 にしたとき
- **THEN** `ascensionMaterials['1']`, `['2']`, `['3']` の素材が合算されて `possession` から減算される。

#### Scenario: スキル/アペンドの現在値変更
- **GIVEN** 育成記録モードが ON、サーヴァントAのスキル1 `start` が 4
- **WHEN** ユーザーがスキル1チップをクリックして `start` を 5 にしたとき
- **THEN** `skillMaterials['4']` の素材が `possession` から減算される。
- **GIVEN** 育成記録モードが ON、サーヴァントAのアペンド2 `start` が 0
- **WHEN** ユーザーがアペンド2チップをクリックして `start` を 1 にしたとき
- **THEN** `appendSkillMaterials['0']` の素材が `possession` から減算される。

#### Scenario: モード OFF 時は所持数を変更しない
- **GIVEN** 育成記録モードが OFF
- **WHEN** ユーザーがピップやチップを操作して `start` を変更したとき
- **THEN** `chaldeaState` の値は更新されるが、`possession` は変更されない。
- **THEN** トーストは表示されない。

#### Scenario: 対象外の変更
- **WHEN** ユーザーがサーヴァントの所持トグル（`disabled`）を切り替えたとき
- **THEN** モード ON/OFF に関わらず `possession` は変更されない。
- **WHEN** 共通目標パネルから `end`（目標値）が変更されたとき
- **THEN** モード ON/OFF に関わらず `possession` は変更されない。

#### Scenario: 「all」キー（共通目標）は対象外
- **WHEN** `chaldeaState.all` の `start` が技術的に変更された場合
- **THEN** `possession` は変更されない（共通目標は実在サーヴァントではないため）。

### Requirement: 所持数の 0 クランプと不足通知
所持数の自動減算で `possession[itemId]` がマイナスになる場合、システムは 0 にクランプしなければならない (SHALL)。クランプ発生時はトースト UI で不足を通知し、ユーザーが「消費前の所持数」をインラインで入力して整合性を回復できる手段を提供しなければならない (SHALL)。

#### Scenario: 0 クランプ
- **GIVEN** `possession['fire_stone'] = 1`、再臨で `fire_stone × 3` を消費するイベント
- **WHEN** 消費処理が走ったとき
- **THEN** `possession['fire_stone']` は `0` になる。

#### Scenario: 不足アイテムのインライン入力
- **GIVEN** 上記クランプが発生した
- **WHEN** トーストが表示されたとき
- **THEN** 不足アイテムごとに「消費前の所持数」を入力する数値フィールドと「更新」ボタンが表示される。
- **WHEN** ユーザーが値 `V` を入力して更新したとき
- **THEN** `possession[itemId] = max(0, V − 消費量)` に設定される。

#### Scenario: 不足なし時はインライン入力を表示しない
- **WHEN** すべての消費アイテムについて 0 クランプが発生しなかったとき
- **THEN** トーストにはインライン入力は含まれず、消費アイテムの一覧のみ表示される。

### Requirement: 素材増減トースト通知
育成記録モードが ON のとき、`start` 変更に伴う素材の消費/返還を毎回トーストで通知しなければならない (SHALL)。1 秒以内に発生した同サーヴァント・同 target の連続変更は、同一のトースト ID を再利用して内容（合計差分）を上書きし、トーストが乱立しないようにしなければならない (SHALL)。

#### Scenario: 消費トーストの内容
- **WHEN** `start` 上昇による消費イベントが発生したとき
- **THEN** トーストにヘッダ「サーヴァント名・ステップ表記（例: `アルトリア 再臨 1→2`）」が表示される。
- **THEN** トースト本文にアイテムアイコン、アイテム名、消費数量が縦に並ぶ。

#### Scenario: 返還トーストの内容
- **WHEN** `start` 下降による返還イベントが発生したとき
- **THEN** トーストに「返還」を示すラベルとアイテム一覧が表示される。

#### Scenario: 連続変更のマージ
- **GIVEN** モード ON、サーヴァントAの再臨 `start` が 1
- **WHEN** ユーザーが 0.5 秒以内にピップを `2 → 3 → 4` と連続で変更したとき
- **THEN** トーストは新規発行されず、同一トーストの内容が「再臨 1→4」と合算消費に更新される。

#### Scenario: 表示時間
- **WHEN** 不足クランプが発生していないトーストが表示されたとき
- **THEN** 約 2.5 秒で自動的に消える。
- **WHEN** 不足クランプとインライン入力を含むトーストが表示されたとき
- **THEN** 約 6 秒間表示される。

### Requirement: 現在値の減算ジェスチャー
ユーザーは、サーヴァントカードの再臨ピップおよびスキル/アペンドチップに対して、長押し（500ms 以上）または右クリック（contextmenu）で現在値を 1 段階下げられなければならない (SHALL)。育成記録モード ON のときは、この操作は素材の返還を発生させなければならない (SHALL)。

#### Scenario: 長押しによる -1
- **WHEN** ユーザーがスキルチップを 500ms 以上長押ししたとき
- **THEN** スキルの `start` が 1 段階下がる（下限を下回らない）。
- **THEN** 通常タップによる +1 は発火しない（長押し成立後の pointerup では加算しない）。

#### Scenario: 右クリックによる -1
- **WHEN** ユーザーがスキルチップを右クリック（contextmenu）したとき
- **THEN** ブラウザのコンテキストメニューは抑止される。
- **THEN** スキルの `start` が 1 段階下がる。

#### Scenario: 下限でのクランプ
- **GIVEN** スキル `start` が下限値（スキル=1、アペンド=0）に達している
- **WHEN** ユーザーが長押しまたは右クリックで -1 操作をしたとき
- **THEN** `start` は変更されず、トーストも表示されない。

#### Scenario: ピップにも統一適用
- **WHEN** ユーザーが再臨ピップを長押し、または右クリックしたとき
- **THEN** 再臨の `start` が 1 段階下がる（下限 0、上限 4）。

#### Scenario: モード OFF 時の挙動
- **GIVEN** 育成記録モードが OFF
- **WHEN** 長押し / 右クリックによる -1 を行ったとき
- **THEN** `start` は下がるが `possession` は変更されない（モード仕様に従う）。

### Requirement: モード切替推奨バナー
ユーザーが `localStorage['posession']` に初めて非 0 の所持数を保存したとき、システムは `/material` ページに育成記録モードを ON にするよう促すバナーを 1 回だけ表示しなければならない (SHALL)。バナーは dismiss または「ON にする」操作後に再表示してはならない (SHALL NOT)。

#### Scenario: バナー表示条件
- **GIVEN** `localStorage['material/tracking-mode']` が `false`
- **GIVEN** `localStorage['material/tracking-suggest-dismissed']` が `false` か未設定
- **WHEN** ユーザーが `possession` に初めて非 0 の値を入れて localStorage が更新されたとき、ユーザーが次に `/material` ページを表示した時点
- **THEN** バナーが共通目標パネル直下に表示される。

#### Scenario: 「ON にする」を選択
- **WHEN** バナーの「ON にする」を押したとき
- **THEN** `material/tracking-mode` が `true` になる。
- **THEN** `material/tracking-suggest-dismissed` が `true` になる。
- **THEN** バナーは閉じる。

#### Scenario: 「今はやめておく」を選択
- **WHEN** バナーの「今はやめておく」を押したとき
- **THEN** `material/tracking-mode` は変更されない。
- **THEN** `material/tracking-suggest-dismissed` が `true` になる。
- **THEN** バナーは閉じる。

#### Scenario: 一度 dismiss したら再表示しない
- **GIVEN** `material/tracking-suggest-dismissed` が `true`
- **WHEN** ユーザーがその後 `possession` を更新しても、ページを再訪してもバナーが表示されてはならない (SHALL NOT)。

### Requirement: 所持数の `/material` と `/material/result` 間のリアルタイム共有
`localStorage['posession']` は `/material` と `/material/result` の両ページで参照・更新されなければならない (SHALL)。一方のページで更新があったときに、もう一方のページが既にマウントされていれば、再読み込みなしに最新値を反映しなければならない (SHALL)。

#### Scenario: 双方向の同期
- **GIVEN** ブラウザの別タブで `/material/result` を開いている、別タブで `/material` を開いている
- **WHEN** `/material` 側でトラッキングモードにより `possession` が更新されたとき
- **THEN** `/material/result` 側の所持数表示も `ls-sync` カスタムイベント経由で即時更新される。
- **WHEN** `/material/result` 側でユーザーが所持数を手動入力したとき
- **THEN** `/material` 側の内部 `possession` 状態も即時更新される。

### Requirement: 既存 `start` 変更フローとの互換
育成記録モードによる新規 UI（トグル、バナー、長押し/右クリック、トースト）の導入によって、既存の以下の挙動を破壊してはならない (SHALL NOT)：

- 既存ユーザーの `material` / `posession` キーは引き続き同じスキーマで利用する。
- モード OFF（既定）のときの `start` 変更挙動は従来と同一。
- 共通目標パネルの折りたたみ・展開動作は既存挙動を維持する。
- `sumMaterials` の結果（Calculate ボタン押下時の必要素材計算）は変わらない。

#### Scenario: 既存ユーザーの初回挙動
- **GIVEN** 既に `material` と `posession` が localStorage に存在するユーザー
- **WHEN** 機能リリース後に初めて `/material` を開いたとき
- **THEN** 既存のサーヴァント状態と所持数はすべて従来どおり表示される。
- **THEN** モードは OFF として扱われる。

#### Scenario: Calculate ボタンの結果が同等
- **GIVEN** 同じ `chaldeaState`、モード ON / OFF の差分のみ
- **WHEN** Calculate ボタンを押して `sumMaterials` を実行したとき
- **THEN** 算出される必要素材合計はモードに関わらず同一である。

## Constraints
- **データモデル**: 各サーヴァント状態は `{ disabled: boolean, targets: { ascension, skill, appendSkill } }` の形式で、各 target は `{ disabled, ranges: [{ start, end }] }` 構造を持つ。
- **値域**: `ascension.start/end` は 0〜4、`skill.start/end` は 1〜10、`appendSkill.start/end` は 0〜10。
- **スキル/アペンドの個数**: スキルは 3 個固定、アペンドは 5 個固定。
- **全体共通の目標保持**: `chaldeaState.all` キーに共通目標を保持し、各サーヴァント追加時のデフォルト値の参照元として利用する。
