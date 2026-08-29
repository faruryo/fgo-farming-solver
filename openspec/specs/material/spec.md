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

#### Scenario: 所持済みサーヴァントの現在値は変更されない
- **GIVEN** サーヴァントが所持済みである
- **WHEN** ページ再読み込みや他端末との同期が発生したとき
- **THEN** 現在値（`start`）は編集済みの値のまま維持される (SHALL NOT be overwritten)。

#### Scenario: サーヴァントの現在値は所持状態を切り替えても保持される
- **GIVEN** サーヴァントが所持済みで、現在値（`start`）が編集されている
- **WHEN** ユーザーが「未所持」に切り替え、その後ページ再読み込みや他端末との同期が発生したとき
- **THEN** 現在値・目標値は編集済みの値のまま維持され、初期値へ戻らない (SHALL NOT)。
- **THEN** その後再び「所持」に切り替えると、未所持化前の現在値がそのまま表示される。

### Requirement: 共通目標設定
ユーザーは、全サーヴァントに対する育成目標（霊基再臨、スキル、アペンド）を一括で設定できなければならない (SHALL)。

#### Scenario: 共通目標の一括適用
- **WHEN** 共通目標パネルで霊基再臨/スキル/アペンドの目標値を変更したとき
- **THEN** 全サーヴァントの該当目標値（`ranges[].end`）がただちに更新される。
- **THEN** 各サーヴァントの育成完了判定はこの共通目標値を基準として行われる。

#### Scenario: `all` キーによる共通目標の保持と伝播
- **GIVEN** `chaldeaState` は実サーヴァントに加えて特殊 ID `all` のエントリを持つ（サーヴァント一覧・所持数カウント・育成完了判定からは常に除外される）。
- **WHEN** 共通目標パネルで霊基再臨/スキル/アペンドの目標値（`end`）を変更したとき
- **THEN** `chaldeaState.all.targets.*.ranges[].end` にも同じ値が書き込まれる（`applyGlobal` は `prev` の全キーを走査するため `all` も対象になる）。
- **WHEN** `localStorage['material']` の読み込み時（`mergeChaldeaState`）に `state.all` が存在し、かつ個別の保存データを持たないサーヴァントが存在するとき
- **THEN** そのサーヴァントの `targets` は、`end` のみ `state.all.targets` から継承した値で初期化される (SHALL)。
- **THEN** `start`（現在値）は `state.all.targets` から継承**しない** (SHALL NOT)。常に `createServantState()` が定義する正しいデフォルト値が使われる。
- **THEN** `chaldeaState.all.targets.*.ranges[].start` を直接編集する UI は存在しない。この値は `mergeChaldeaState` のいかなる複製経路にも使われないため、他のサーヴァントの表示に影響しない。
- **THEN** `state.all` の `targets` が欠落・不正な形式であった場合、`mergeChaldeaState` は例外を送出せず、`state.all` が存在しない場合と同様に個別データのみで状態を組み立てる。

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
- **THEN** トグル横に `?` ツールチップで、育成記録モード固有の挙動の説明（「ON 時、現在値を変更すると所持数を自動で増減します」）が表示される。タップ/長押し/右クリックの操作方法自体は、サーヴァント一覧の常設ヒント（「現在値操作の常設案内表示」要件）が担うため、このツールチップには含めない。

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
- **THEN** 通常素材とQPの `possession` は変更されない。アペンドの解放に必要なサーヴァントコインは本データモデルの対象外である。
- **GIVEN** 育成記録モードが ON、サーヴァントAのアペンド2 `start` が 1
- **WHEN** ユーザーがアペンド2チップをクリックして `start` を 2 にしたとき
- **THEN** `appendSkillMaterials['1']` の素材とQPが `possession` から減算される。

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
ユーザーは、サーヴァントカードのスキル/アペンドチップに対して、長押し（500ms 以上）または右クリック（contextmenu）で現在値を 1 段階下げられなければならない (SHALL)。下限（スキル=1、アペンド=0）に達している状態で長押しまたは右クリックした場合は、上限（スキル=10、アペンド=10）へラップしなければならない (SHALL)。再臨ピップは点灯中ピップのクリックによる -1 と重複するため長押しの対象外とし、右クリックによる -1 のみ提供しなければならない (SHALL)。ピップの右クリックによる -1 は下限（0）でラップせず、従来通りクランプする (SHALL)。育成記録モード ON のときは、これらの操作は素材の消費または返還を発生させなければならない (SHALL)。チップの長押し操作中（`pointerdown` から解除まで）は、対象チップに軽いプレス感（縮小・明度低下等）による視覚フィードバックを表示しなければならない (SHALL)。

#### Scenario: 長押しによる -1
- **GIVEN** スキル `start` が下限値（1）を上回っている
- **WHEN** ユーザーがスキルチップを 500ms 以上長押ししたとき
- **THEN** スキルの `start` が 1 段階下がる。
- **THEN** 通常タップによる +1 は発火しない（長押し成立後の pointerup では加算しない）。下限に達している場合の挙動は「下限でのラップ」シナリオを参照。

#### Scenario: 右クリックによる -1
- **GIVEN** スキル `start` が下限値（1）を上回っている
- **WHEN** ユーザーがスキルチップを右クリック（contextmenu）したとき
- **THEN** ブラウザのコンテキストメニューは抑止される。
- **THEN** スキルの `start` が 1 段階下がる。下限に達している場合の挙動は「下限でのラップ」シナリオを参照。

#### Scenario: 下限でのラップ（スキル/アペンド）
- **GIVEN** スキル `start` が下限値（スキル=1、アペンド=0）に達している
- **WHEN** ユーザーが長押しまたは右クリックで -1 操作をしたとき
- **THEN** `start` は上限値（スキル=10、アペンド=10）へ変化する。
- **THEN** 育成記録モード ON かつ所持数が足りていれば、下限から上限までの差分に相当する素材が消費される。

#### Scenario: ピップは長押し対象外
- **WHEN** ユーザーが再臨ピップを 500ms 以上押し続けたとき
- **THEN** `start` は変化しない（減算はクリックまたは右クリックで行う）。
- **THEN** プレス感の視覚フィードバックも表示されない。

#### Scenario: ピップの右クリックによる -1（下限ではクランプ、ラップしない）
- **WHEN** ユーザーが再臨ピップを右クリックしたとき
- **THEN** 再臨の `start` が 1 段階下がる（下限 0、上限 4）。
- **THEN** `start` が既に 0 のときに右クリックしても `start` は 0 のまま変化せず、上限（4）へはラップしない。
- **THEN** 直後の左クリックは通常どおり動作する（クリック抑止フラグが残留しない）。

#### Scenario: モード OFF 時の挙動
- **GIVEN** 育成記録モードが OFF
- **WHEN** 長押し / 右クリックによる -1（下限でのラップを含む）を行ったとき
- **THEN** `start` は変化するが `possession` は変更されない（モード仕様に従う）。

#### Scenario: 長押し中の視覚フィードバック
- **WHEN** ユーザーがスキル/アペンドチップを `pointerdown` して押し続けているとき（500ms 未満で判定成立前を含む。成立後も指を離すまで継続）
- **THEN** 対象チップに軽いプレス感（scale 縮小・明度低下等）の視覚フィードバックが表示される。

#### Scenario: 長押しキャンセル時のフィードバック解除
- **WHEN** ユーザーが長押し成立前に `pointerup`、または要素外へ `pointerleave`、あるいは `pointercancel` が発生したとき
- **THEN** 視覚フィードバックは即座に解除され、`-1`（下限でのラップを含む）は発火しない（既存の長押しキャンセル挙動どおり）。

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
- モード OFF（既定）のときの `start` 変更挙動は従来と同一。ただし、スキル/アペンドの下限での長押し/右クリックが上限へラップする挙動（「現在値の減算ジェスチャー」要件の「下限でのラップ」シナリオ）は、モードの ON/OFF に関わらず適用される意図的な仕様変更であり、この互換要件の対象外とする。
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

### Requirement: 育成計算機結果のストック込み不足の副表示

システムは育成計算機の結果(`/material/result`)において、育成必要数/不足を主表示として維持 SHALL。保存値 `material/result`(育成必要数, Atlas ID キー)はストックで書き換えない SHALL。グローバル設定 `stockEnabled=ON` のときのみ、各素材に「+ストック分」(=`buffer(item)`)を含めた目標/不足を控えめに副表示する SHALL。`stockEnabled=OFF` のときは従来どおり育成必要数/不足のみを表示する。

#### Scenario: 既定は育成必要数のみ
- **WHEN** `stockEnabled=OFF` で育成計算機の結果を表示する
- **THEN** 各素材は育成必要数/不足のみが表示され、表示は従来と変わらない

#### Scenario: stockEnabled=ON で副表示
- **WHEN** `stockEnabled=ON` で育成計算機の結果を表示する
- **THEN** 育成必要数/不足を主としつつ、ストック込み目標(育成必要数 + `buffer(item)`)が控えめに併記される

#### Scenario: 保存値は不変
- **WHEN** `stockEnabled` を切り替える
- **THEN** `material/result`(育成必要数)の保存値は変化しない(ストックは表示・取り込み時に計算)

### Requirement: 育成計算機結果画面での周回対象クエスト選択

システムは`/material/result`に、周回対象クエストを選択するUI(既存の`CheckboxTree`)を統合 SHALL。選択状態は既存のグローバルな`localStorage['excludedQuests']`を`/farming`と共有 SHALL。旧`quests`キーからの一方向移行、および`quests`キーへのデュアルライト(`sync`specの「除外クエストリストの永続化と同期」要件)は`/farming`と同じ共有ロジックを使い SHALL、`/material/result`側で個別に再実装しない。

#### Scenario: 既定は全クエストが選択済み
- **WHEN** `/material/result`を初めて開き、`excludedQuests`・旧`quests`のいずれも未設定のとき
- **THEN** 周回対象クエストはすべて選択済みとして表示される。

#### Scenario: 旧questsキーからの移行は/farmingと同じロジックで行われる
- **WHEN** `excludedQuests`が未設定で旧`quests`キーのみ存在する状態で`/material/result`を先に開いたとき
- **THEN** `/farming`を開いた場合と同じ移行結果(旧`quests`のチェック済みリストを反映した`excludedQuests`)になる。

#### Scenario: 選択状態は/farmingと同期する
- **WHEN** `/material/result`でクエストの選択を変更したとき
- **THEN** `localStorage['excludedQuests']`が更新され、`/farming`を(直接アクセスで)開いたときも同じ選択状態が反映される。

#### Scenario: クエスト未選択時は送信できない
- **WHEN** `/material/result`で周回対象クエストが1件も選択されていない状態で送信しようとしたとき
- **THEN** 送信はブロックされ、クエストを最低1件選択するよう促すメッセージが表示される。

### Requirement: Material Catalog による非同期データ読込
育成素材計算機の `/material` および `/material/[className]` は静的な UI シェルとして配信され、クライアントから Material Catalog API を取得して表示データを初期化しなければならない (SHALL)。ページのサーバーレンダリング処理は Atlas Academy の `nice_servant.json` または `nice_item.json` を取得してはならない (SHALL NOT)。

#### Scenario: カタログ取得成功後に計算機を初期化する
- **WHEN** Material Catalog API が互換性のある正常なカタログを返したとき
- **THEN** サーヴァント一覧、素材、アイテム情報を使って既存の育成素材計算機 UI が表示される。
- **THEN** 新しいカタログが KV に反映された後は、アプリ本体を再デプロイしなくてもブラウザキャッシュの有効期間終了後に新サーヴァントが表示される。

#### Scenario: 読込中は空の Chaldea state を初期化しない
- **WHEN** Material Catalog の取得が完了していないとき
- **THEN** 読込状態を表示し、`Index` またはクラス別 `Material` コンポーネントを空のサーヴァント配列で mount しない。
- **THEN** `localStorage['material']` と `localStorage['posession']` を読み書きせず、`ls-sync` を発火しない。

#### Scenario: 取得失敗時に利用者状態を変更しない
- **WHEN** Material Catalog API が失敗、非対応 schema、または壊れた JSON を返したとき
- **THEN** 計算機の代わりに再試行可能なエラー表示を行う。
- **THEN** `localStorage['material']`、`localStorage['posession']`、クラウド同期メタデータを変更しない。

### Requirement: カタログ更新と既存利用者状態の互換性
Material Catalog は読み取り専用のマスターデータとして扱い、既存の `material` / `posession` 保存スキーマおよびクラウド同期対象キーを変更してはならない (SHALL NOT)。新しいサーヴァント ID は既存の Chaldea state へ安全に追加し、保存済みの既存サーヴァント状態を上書きしてはならない (SHALL NOT)。

#### Scenario: 新サーヴァントを既定状態で追加する
- **GIVEN** 利用者の `localStorage['material']` に既存サーヴァントの編集済み状態が保存されている
- **WHEN** 新しいサーヴァント ID を含む Material Catalog を読み込んだとき
- **THEN** 新サーヴァントは未所持かつ既定の現在値・目標値で追加される。
- **THEN** 既存サーヴァントの所持、現在値、目標値は保持される。

#### Scenario: 一時的にカタログから見えない ID を削除しない
- **GIVEN** 利用者の `localStorage['material']` に、現在のカタログに存在しないサーヴァント ID が保存されている
- **WHEN** Chaldea state とカタログをマージしたとき
- **THEN** 保存済み ID の状態を localStorage から削除しない。

### Requirement: クラス別 URL の事前検証
`/material/[className]` は正規の Material クラス名だけを受理し、不正な値をデータ取得前に 404 としなければならない (SHALL)。有効クラス一覧は静的生成、URL 検証、クラス選択 UI で共有しなければならない (SHALL)。

#### Scenario: 既知クラスを表示する
- **WHEN** `saber`、`alterEgo`、`beastEresh` など定義済みのクラス URL を開いたとき
- **THEN** 対応する静的 UI シェルが表示され、Material Catalog の取得後にそのクラスの計算機が表示される。

#### Scenario: 不正クラスを 404 にする
- **WHEN** `/material/zzzz` のような未定義クラス URL を開いたとき
- **THEN** `404 Not Found` を返す。
- **THEN** Material Catalog API、KV、Atlas Academy のいずれにもアクセスしない。

### Requirement: 現在値操作の常設案内表示
サーヴァント一覧は、フィルタ結果が1件以上あるとき、サーヴァントグリッドの直上に現在値操作方法（タップ:+1／右クリック・長押し:-1）を説明する常設ヒントを表示しなければならない (SHALL)。ヒントはホバー等の追加操作なしに常時視認できなければならない (SHALL)。

#### Scenario: 一覧表示時のヒント表示
- **WHEN** サーヴァント一覧のフィルタ結果が1件以上あるとき
- **THEN** サーヴァントグリッドの直上に操作案内のヒントが表示される。

#### Scenario: 空状態でのヒント非表示
- **WHEN** フィルタ条件に一致するサーヴァントが0件のとき
- **THEN** 操作案内のヒントは表示されない（空状態メッセージのみ表示される）。

### Requirement: ストック不足フィルタの常時表示と自動ON

システムは `/material/result` の表示フィルタ(全て / 不足 / ストック不足)のうち「ストック不足」タブを、ストック目標（`stockEnabled`）の値に関わらず常時表示 SHALL。ストック目標が OFF の状態で「ストック不足」タブが選択されたとき、システムはストック目標を ON に切り替える SHALL。バッファ値は既存のカテゴリ・レアリティ別の既定値をそのまま適用し、この操作単独では追加の数値入力を要求しない SHALL。この自動ON操作は、育成必要数の保存値(`material/result`)および所持数(`possession`)を変更しない SHALL。

#### Scenario: stockEnabled=OFF でもタブが見える
- **WHEN** `stockEnabled=OFF` の状態で `/material/result` を表示する
- **THEN** 「全て」「不足」に加えて「ストック不足」タブも表示される

#### Scenario: タブ選択で自動的にストック目標がONになる
- **GIVEN** `stockEnabled=OFF` の状態で `/material/result` を表示している
- **WHEN** 「ストック不足」タブを選択する
- **THEN** `stockEnabled` が ON になり、表示フィルタはストック不足(育成必要数+バッファ未達)の素材に絞り込まれる
- **AND** 各素材にストック込み目標の副表示(既存の「育成計算機結果のストック込み不足の副表示」要件)が現れる

#### Scenario: 自動ON時は既定バッファ値を使う
- **GIVEN** ユーザーがストック目標のバッファ値を一度もカスタマイズしていない
- **WHEN** 「ストック不足」タブの選択により `stockEnabled` が自動でONになる
- **THEN** 各カテゴリ×レアのバッファ値は既存のデフォルト解決結果がそのまま使われ、ユーザーへの追加入力は要求されない

#### Scenario: 自動ONは保存値を書き換えない
- **WHEN** 「ストック不足」タブの選択により `stockEnabled` が自動でONになる
- **THEN** `material/result`(育成必要数)と `possession`(所持数)の保存値は変化しない

#### Scenario: 既に ON のときはタブ選択だけで絞り込む
- **GIVEN** `stockEnabled=ON` の状態で `/material/result` を表示している
- **WHEN** 「ストック不足」タブを選択する
- **THEN** `stockEnabled` の値は変わらず、表示フィルタのみがストック不足の素材に絞り込まれる

## Constraints
- **データモデル**: 各サーヴァント状態は `{ disabled: boolean, targets: { ascension, skill, appendSkill } }` の形式で、各 target は `{ disabled, ranges: [{ start, end }] }` 構造を持つ。
- **値域**: `ascension.start/end` は 0〜4、`skill.start/end` は 1〜10、`appendSkill.start/end` は 0〜10。
- **スキル/アペンドの個数**: スキルは 3 個固定、アペンドは 5 個固定。
- **全体共通の目標保持**: `all` キーに共通目標を保持する。個別データを持たないサーヴァントは `end`（目標値）のみ `all` から継承し、`start`（現在値）は常に正しいデフォルト値になる。`all` 自身の `start` を編集する UI は無く、他のサーヴァントには影響しない。所持状態を切り替えても現在値は保持され、矯正されない。
