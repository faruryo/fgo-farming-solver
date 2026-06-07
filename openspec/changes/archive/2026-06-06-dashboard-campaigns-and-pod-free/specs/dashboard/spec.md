## ADDED Requirements

### Requirement: キャンペーンセクション (CampaignSection)
ダッシュボードは、Atlas Academy `nice_event.json` 上で配信される `type=questCampaign` 種別のうちバナー画像を持たないキャンペーンイベントを、独立したセクションとして集約表示しなければならない (SHALL)。

#### Scenario: 表示位置
- **WHEN** トップページが描画されるとき
- **THEN** `CampaignSection` は既存の `EventSection` (「開催中のイベント」) の直下に配置される。
- **THEN** 表示対象キャンペーンが 0 件のとき、`CampaignSection` は描画されない (セクションヘッダごと非表示)。

#### Scenario: カテゴリ分類
- **WHEN** `CampaignSection` がキャンペーンを描画するとき
- **THEN** 各キャンペーンは以下 3 カテゴリのいずれかに分類されなければならない (SHALL):
  - `ファーミング直結`: `target ∈ { questAp (value < 1000), questApFirstTime, questUseRewardAddItem (targetIds=[49]) }` のキャンペーン、または event name に `ストーム・ポッド` を含むキャンペーン。
  - `強化・育成`: `target ∈ { largeSuccess, superSuccess, svtequipLargeSuccess, svtequipSuperSuccess, combineExp, combineQp, svtequipCombineQp, exchangeSvt, exchangeSvtCombineExp }`。
  - `その他`: 上記以外のすべて (`questFp`, `questFriendship`, `questUseFriendshipUpItem`, `questUseContinueItem`, `questEquipExp`, `questPassiveSkill`, `questItemFirstTime`, `friendPointGachaFreeDrawNum`, `targetIds != [49]` の `questUseRewardAddItem` 等)。
- **THEN** カテゴリ順は `ファーミング直結` → `強化・育成` → `その他` で固定される。

#### Scenario: カテゴリ内並び順
- **WHEN** カテゴリ内で複数キャンペーンを並べるとき
- **THEN** `endedAt` (終了時刻) の昇順で並べ、期限切れが近いものを上位に表示する。

#### Scenario: 表示項目
- **WHEN** 各キャンペーン行が描画されるとき
- **THEN** event name、残り時間 (`formatDuration(endedAt)` 形式)、および対象クエスト件数 (`campaignQuests.length`) が表示される。
- **THEN** 対象クエスト件数が 0 件のキャンペーンは描画から除外される (campaignQuests が空のものは表示しない)。

#### Scenario: ストーム・ポッド消費なし行の強調
- **WHEN** `CampaignSection` 内に `event.name` が「ストーム・ポッド消費なし」を含むキャンペーンが存在するとき
- **THEN** その行はカテゴリ分類を無視して `CampaignSection` の最上段に固定される。
- **THEN** 視覚的に他のキャンペーンより強調された装飾 (アイコン・色) で描画される。

#### Scenario: ノイズキャンペーンの除外
- **WHEN** `campaign.target === 'questAp'` かつ `calcType === 'multiplication'` かつ `value === 1000` のとき
- **THEN** その campaign は AP 割引としては扱われず、`ファーミング直結` カテゴリへの分類根拠から除外される。
- **THEN** ただし同じ event の他 campaign や name パターンによりカテゴリが決まる場合は通常通り表示される。

### Requirement: ストーム・ポッド消費なし期間の検出と配信
ダッシュボードは、`dashboard_meta` から「ストーム・ポッド消費なし期間」 (`podFreePeriods`) を読み取り、現在時刻が含まれる期間とその対象 quest ID 集合をクライアント全体で利用可能にしなければならない (SHALL)。

#### Scenario: 期間判定の入力
- **WHEN** クライアントが「ポッド消費なし期間中か否か」を判定するとき
- **THEN** `DashboardMeta.podFreePeriods` を参照し、`now ∈ [startedAt, endedAt]` を満たすエントリの集合を取得する。
- **THEN** その対象 `questIds` を union した Set を「ポッド無料対象クエスト Set」として全コンポーネントに供給する。

#### Scenario: 期間外
- **WHEN** 現在時刻がいずれの `podFreePeriods` エントリにも該当しないとき
- **THEN** 「ポッド無料対象クエスト Set」は空集合として供給される。
- **THEN** ストーム・ポッド消費なしに依存する UI 強調 (バッジ、tier 0、効率モード優遇) はすべて無効化される。

#### Scenario: podFreePeriods 不在時のフォールバック
- **WHEN** `dashboard_meta` に `podFreePeriods` フィールドが存在しないとき (古いデータ)
- **THEN** クライアントは `podFreePeriods` を空配列として扱い、エラーを発生させない。

### Requirement: クエスト識別行への Pod アイコン表示
ストーム・ポッド消費系クエスト (冠位戴冠戦・オーディール・コール フリクエ) のクエスト識別行 (`QuestIdentity`) は、AP 表示の横にストーム・ポッドアイコンを表示しなければならない (SHALL)。

#### Scenario: ポッド消費系クエストの識別
- **WHEN** `QuestIdentity` が描画される quest の `area` に `冠位戴冠戦` または `オーディール・コール` が含まれるとき
- **THEN** AP 表示の横に Pod アイコンが表示される。

#### Scenario: ポッド消費なし期間中の `×0` 表現
- **WHEN** 当該 quest が「ポッド無料対象クエスト Set」に含まれるとき
- **THEN** Pod アイコンには `×0` を併記、または斜線 (罰印) で「消費なし」状態が視覚的に表現される。

#### Scenario: 期間外の通常表示
- **WHEN** 当該 quest がポッド無料対象 Set に含まれないとき
- **THEN** Pod アイコンは通常表示 (`×0` や罰印なし) で描画される。

## MODIFIED Requirements

### Requirement: 推奨周回クエスト (RecommendedQuest)
ユーザーが次に周回すべき最適なクエストを提示しなければならない (SHALL)。表示されるクエストの AP・周回数・ランキングは、現在時刻で有効な AP キャンペーンを反映していなければならない (SHALL)。

セクションヘッダにはソートモード切替トグルを設け、ユーザーは `周回数` (冠位研鑽戦・オーディール・コール優先、およびストーム・ポッド消費なし期間中はポッド無料対象を最優先) と `AP` (AP キャンペーン割引対象クエスト優先) を切り替えられなければならない (SHALL)。

#### Scenario: 周回数モードでの推奨
- **WHEN** ソートモードが `周回数` で、ソルバーによる計算結果が存在するとき
- **THEN** 以下の優先度で並べ替え、同優先度内では予定周回数 (`lap`) が多い順で並べる:
  - tier 0: 「ポッド無料対象クエスト Set」に含まれるクエスト (= ストーム・ポッド消費なし期間中の冠位戴冠戦等)。期間外は該当なし。
  - tier 1: `area` に `冠位研鑽戦` を含むクエスト。
  - tier 2: `area` に `オーディール・コール` を含むクエスト。
  - tier 3: その他。
- **THEN** 合計 4 件までの推奨クエストを表示する。

#### Scenario: AP モードでの推奨
- **WHEN** ソートモードが `AP` で、ソルバーによる計算結果が存在するとき
- **THEN** 現在時刻で有効な AP キャンペーンによりクエストの AP が割引されている (`displayResult` の `quest.ap` が drops の元 `ap` より小さい) クエストを最上位、その他をその下に並べ、同優先度内では予定周回数 (`lap`) が多い順で並べる。
- **THEN** 合計 4 件までの推奨クエストを表示する。
- **THEN** AP モードではポッド無料対象クエストもバッジ表示のみで、ソート順位への影響は与えない。

#### Scenario: 優先度 tier 境界の視覚化
- **WHEN** ソルバー結果から選ばれた 4 件以内に、複数の優先度 tier に属するクエストが含まれるとき
- **THEN** 各 tier の境界に区切り線とその tier 名 (例: `周回数` モードでは `冠位研鑽戦` / `オーディール・コール` / `その他`、`AP` モードでは `その他`) のラベルを挿入する。
- **THEN** 各 tier 内のクエストは `lap` 降順 (上記の優先度仕様) で並べたまま、視覚的に「同じ優先度のグループ」として読めるようにする。

#### Scenario: ストーム・ポッド消費なしバッジ
- **WHEN** 表示される quest が「ポッド無料対象クエスト Set」に含まれるとき
- **THEN** モードに関わらず、その quest カードには Pod×0 (または罰印) を表現する視覚バッジが表示される。

#### Scenario: クエストカードのアイテムアイコン表示（PC）
- **WHEN** PC（sm ブレークポイント以上）でクエストカードを表示するとき
- **THEN** そのクエストで収集対象となるドロップアイテムのアイコンが最大 5個 まで表示されなければならない (SHALL)。

#### Scenario: クエストカードのアイテムアイコン表示（モバイル）
- **WHEN** モバイル（sm ブレークポイント未満）でクエストカードを表示するとき
- **THEN** ドロップアイテムのアイコンは 1個 のみ表示されなければならない (SHALL)。

#### Scenario: 表示時のキャンペーン反映
- **WHEN** トップページがマウントされ RecommendedQuest が再描画されるとき
- **THEN** 保存済み計算結果の `params` を入力とし、現在の drops バンドルと現在時刻で有効な AP キャンペーンを適用したソルバー結果（`applyCampaigns: true`）に基づいてクエスト選定・周回数・AP 表示を行う。
- **THEN** 計算実行後にキャンペーンが開始された場合でも、ダッシュボードを開くだけで反映される。

#### Scenario: ソートモードの永続化
- **WHEN** ユーザーがトグルでソートモードを変更したとき
- **THEN** 選択は LocalStorage キー `dashboard.recommendedQuest.sortMode` に保存され、次回アクセス時に再現される。

#### Scenario: ソートモード既定値の自動判定
- **WHEN** LocalStorage に `dashboard.recommendedQuest.sortMode` の保存値が無い状態でセクションが初期化されるとき
- **THEN** 現在時刻で有効な AP キャンペーンが 1 件以上あれば既定を `AP`、無ければ `周回数` とする。
- **THEN** 一度ユーザーがトグル操作した以降は、キャンペーン有無に関わらず LocalStorage の値が優先される。

### Requirement: ゴール間近セクション (NearGoalSection)
達成が近い（周回数が少ない）素材を提示し、ユーザーのモチベーションを維持しなければならない (SHALL)。表示されるクエストの AP・周回数・ランキングは、現在時刻で有効な AP キャンペーンを反映していなければならない (SHALL)。

セクションヘッダにはソートモード切替トグルを設け、ユーザーは `効率` (総合効率トップクエストプールに絞った提示、およびストーム・ポッド消費なし期間中はポッド無料対象クエストで集まるアイテムを優遇) と `最短` (各アイテムの最小周回数クエストを提示) を切り替えられなければならない (SHALL)。

#### Scenario: 達成間近なアイテムの抽出
- **WHEN** 直近の計算結果が存在し、ユーザーがまだ集めきっていない素材があるとき
- **THEN** 最大 4 件まで「あと○周で達成！」というメッセージと共にクエストが表示される。
- **THEN** 各クエスト項目には、エリア名とクエスト名が「エリア名 · クエスト名」の形式で表示されなければならない (SHALL)。

#### Scenario: 表示時のキャンペーン反映
- **WHEN** トップページがマウントされ NearGoalSection が再描画されるとき
- **THEN** 残り素材量（必要数）は、保存済み計算結果の `params` を入力に、現在の drops バンドルと現在時刻で有効な AP キャンペーンを適用したソルバー結果（`applyCampaigns: true`）から得る。
- **THEN** 各アイテムに表示するクエスト候補は、`drops.drop_rates` の全体から `params.quests` で許可された quest_id に限定し、各 quest の AP は元 AP に対し `computeEffectiveAp` で現在時刻有効なキャンペーンを適用した値を使う。
- **THEN** 計算実行後にキャンペーンが開始された場合でも、ダッシュボードを開くだけで反映される。

#### Scenario: 最短モードでのクエスト選定
- **WHEN** ソートモードが `最短` のとき
- **THEN** 候補プール全体 (`params.quests` で許可された全クエスト) から、各アイテムについて `Math.ceil(needed / drop_rate)` が最小となるクエストを 1 つ選ぶ。
- **THEN** すべての残目標アイテムを評価対象とし、選ばれたクエストの周回数昇順でアイテムを並べ、上位 4 件を表示する。
- **THEN** ポッド消費なし期間中は対象クエストに視覚バッジを表示する。ソート順位は変更しない。

#### Scenario: 効率モードでのクエスト選定 (ポッド消費なし期間外)
- **WHEN** ソートモードが `効率` で、ストーム・ポッド消費なし期間外のとき
- **THEN** `params.quests` で許可された各クエストに対し、ユーザーが残目標を持つすべてのアイテムについての `drop_rate(quest, item) / effectiveAp(quest)` の合計を効率スコアとして計算する。
- **THEN** 効率スコア上位 20 件を「高効率クエストプール」とする。
- **THEN** ユーザーの残目標があるアイテムを `needed` 昇順で 10 件取り、各アイテムについて高効率クエストプール内で `Math.ceil(needed / drop_rate)` が最小となるクエストを 1 つ選ぶ。プール内にそのアイテムを落とすクエストが存在しない場合はそのアイテムを除外する。
- **THEN** 選ばれた (アイテム, クエスト, 周回数) を周回数昇順で並べ、上位 4 件を表示する。

#### Scenario: 効率モードでのクエスト選定 (ポッド消費なし期間中)
- **WHEN** ソートモードが `効率` で、ストーム・ポッド消費なし期間中のとき
- **THEN** 各 targetItem について、以下のルールでクエストを選定する:
  - (a) 「ポッド無料対象クエスト Set」内のクエストのうち、その item を落とすクエストが存在するか確認する。
  - (b) 存在する場合: その中で `Math.ceil(needed / drop_rate)` が最小のクエストを採用する (effectiveAp は無視)。
  - (c) 存在しない場合: 期間外と同じ既存ロジック (高効率プール top 20 + プール内最短) を適用する。
- **THEN** 選ばれた (アイテム, クエスト, 周回数) を周回数昇順で並べ、上位 4 件を表示する。
- **THEN** 同じクエストが複数アイテムに採用され、結果として複数行に並ぶことを許容する。
- **THEN** ポッド無料対象クエストの行には Pod×0 バッジを表示する。

#### Scenario: ソートモードの永続化と既定値
- **WHEN** ユーザーがトグルでソートモードを変更したとき
- **THEN** 選択は LocalStorage キー `dashboard.nearGoal.sortMode` に `'efficiency' | 'laps'` 文字列で保存され、次回アクセス時に再現される。
- **WHEN** LocalStorage に保存値が無い、または `'efficiency' | 'laps'` のいずれでもないとき
- **THEN** 既定モードを `効率` (`'efficiency'`) として初期化する。
