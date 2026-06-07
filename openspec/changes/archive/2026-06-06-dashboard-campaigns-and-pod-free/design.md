## Context

ダッシュボードの表示要素は現状 3 つの観点から構成される:

1. **EventSection**: banner つきイベントを Atlas `nice_event.json` から拾って表示。
2. **RecommendedQuest / NearGoalSection**: 直近の計算結果に AP キャンペーンを反映したソルバー結果を可視化。
3. **GachaSection / RecentServantSection**: 召喚バナーとサーヴァント情報。

しかし Atlas Academy のデータには `questCampaign` 種別の「キャンペーンイベント」(消費AP50%DOWN、ストーム・ポッド消費なし、フレポ2倍 等) も存在し、これらは **banner=null** であるため現状 UI 上に一切現れない。`master-data/campaigns` には `questAp` ターゲットのみが抽出され、ソルバーには反映されるが、ユーザー向けの「今このキャンペーンが走っている」という情報通知は完全に欠落している。

特に「期間限定 ストーム・ポッド消費なし！」は冠位戴冠戦の開催初週限定で発動する重要期間で、project memory `project-stormpod-priority` の意義 (ストームポッド上限 9 個・1日 3 個入手の溢れ対策として冠位研鑽戦を優先表示) が **更に強くなる**。この特別状態を UI が区別できないことが本提案の中核課題。

Atlas データ構造の調査結果:

- 「ストーム・ポッド消費なし」キャンペーンは event name に「ストーム・ポッド消費なし」を含む `questCampaign` 種別の event として実在する (例: id 71676, 71565)。
- これらは `campaigns: [{ target: 'questAp', calcType: 'multiplication', value: 1000 }]` という **等倍 (×1.0) ノイズ campaign** を持つだけで、target からはポッド消費なしを判定できない。
- 意味は `event.name` + `event.campaignQuests` (対象 quest ID 群) + 開催期間 で成立している。
- ポッド消費系クエスト (冠位戴冠戦・オーディール・コール) の元 AP 値は実質固定で、AP キャンペーンによる増減は事実上発生しない (Atlas が当てる campaign は value=1000 のノイズ)。

## Goals / Non-Goals

**Goals:**

- ストーム・ポッド消費なし期間中、ユーザーが「今ポッド消費なしで冠位戴冠戦が回し放題」と即座に認知できる。
- AP半減・ポッド報酬倍率など、banner なしキャンペーンの「対象期間」「対象クエスト数」を一覧表示できる。
- ポッド消費なし期間中、`RecommendedQuest` 周回数モードと `NearGoalSection` 効率モードが対象クエストを **より積極的に** 提示する。
- ストーム・ポッド消費系クエストには **Pod アイコン** を表示し、期間中は `×0` を併記して消費なしを可視化する。
- 既存の AP キャンペーン処理 (ソルバー連携) には影響を与えない。

**Non-Goals:**

- 「ストーム・ポッド消費なし」を campaign target として Atlas 側のデータモデル変更を要求する (= 我々のロジックで name ベース判定する)。
- `RecommendedQuest` AP モードや `NearGoalSection` 最短モードの **ソート順位** を変更する (バッジ追加のみ)。
- ポッド残量のユーザー入力や、ポッド消費なし期間外の冠位戴冠戦 priority 調整 (既存挙動維持)。
- Atlas のストーム・ポッド報酬倍率 (id 71557 等 `questUseRewardAddItem` target) の対象アイテム個別表示。一覧上の名前と期間のみ表示で足りる。
- 既存 EventSection の挙動変更 (キャンペーンは別セクションに分離する)。

## Decisions

### D1. キャンペーン判定は event name パターンマッチ + target カテゴリ分け

**選択**: ストーム・ポッド消費なし期間は `event.name.includes('ストーム・ポッド消費なし')` で判定。それ以外のキャンペーンは `event.campaigns[].target` 値でカテゴリ分類。

**理由**:

- Atlas は「ストーム・ポッド消費なし」を campaign target としては表現せず (`questAp value=1000` のノイズしか持たない)、event name と campaignQuests で意味を成立させている。
- name ベース判定は壊れやすいが、Atlas データ自体が name に意味を載せている以上、これより上流の正規化は望めない。
- target ベースの分類は機械的に決まる: `questAp` 系 → AP割引、`questFp/questFriendship` → フレポ・絆、`largeSuccess/superSuccess/combineQp` → 強化・育成、その他 → 「その他」。

**代替案**: campaignQuests の対象 quest IDs が「冠位戴冠戦」系のみ含まれることで判定 → クエスト名による間接判定で堅牢性は同程度かつコスト増。却下。

### D2. ポッド消費なし期間情報は `dashboard_meta` に同梱

**選択**: `DashboardMeta` 型に `podFreePeriods: { name, startedAt, endedAt, questIds: string[] }[]` を追加。`fetchDashboardMeta()` で抽出して KV `dashboard_meta` に書き込む。

**理由**:

- `master-data/campaigns` (`all_drops_json`) はソルバー入力 (= questAp 限定) と用途が異なる。ソルバーは AP 計算しかしないので、ここに podFreePeriod を入れると役割が混じる。
- ダッシュボード専用情報なので `dashboard_meta` 側に置くのが意味的に正しい。
- 期間情報は data shape が小さい (数百バイト程度) ので、`dashboard_meta` のサイズ膨張は無視できる。

**代替案**: クライアント側で `events` 配列から都度抽出 → 名前判定ロジックがクライアントとサーバで分散し、保守性低下。却下。

### D3. キャンペーンセクションは既存 EventSection と分離

**選択**: 新セクション `CampaignSection` を作り、既存 `EventSection` の直後 (= 「開催中のイベント」のすぐ下) に配置。

**理由**:

- banner ありの実イベントと banner なしのキャンペーンは視覚的に異質 (前者は画像中心、後者はテキスト中心)。同一セクションに混ぜると UI が破綻する。
- 既存 EventSection のレイアウト (画像 110px 高 + ドロップアイコン) はキャンペーンに使い回せない。
- セクションを分けることで、表示有無を独立に制御できる (キャンペーンゼロの期間は CampaignSection を非表示)。

**代替案**: EventSection 内に二段表示で混在 → CSS/レイアウト複雑化。却下。

### D4. RecommendedQuest 周回数モードの tier 拡張

**選択**: 期間中のみ tier 0 (ポッド無料対象クエスト) を導入し、その配下に既存 tier 1 (冠位研鑽戦) / tier 2 (オーディール・コール) / tier 3 (その他) を温存。

**理由**:

- 期間中はポッド消費なし対象 = 冠位戴冠戦 7 種類だけが対象クエスト。これらは元々 tier 1 に含まれているが、「冠位戴冠戦の **どれが** 今ポッド無料か」を区別する手段が必要。
- 期間外は tier 0 を消す (= 既存挙動と完全一致)。
- AP モードはソート順位を触らない (ユーザー指示)。AP モード時は `tier 0` の概念を持たず、対象クエストに視覚バッジのみ追加。

**代替案**: 周回数モード時に冠位戴冠戦を AP モードと同様にバッジのみで処理 → 「ポッド無料を最優先で表示する」というユーザー要望を満たさない。却下。

### D5. NearGoalSection 効率モードのポッド無料優遇ロジック

**選択**: 期間中、効率モードでは **各 targetItem ごとに以下のルールでクエストを選ぶ**:

1. ポッド無料対象クエスト群 (questIds) のうち、その item を drop するクエストが存在するか確認。
2. 存在すれば、その中で `lapsNeeded = Math.ceil(needed / drop_rate)` が最小のクエストを採用 (effectiveAp は無視)。
3. 存在しなければ、既存の効率プール (top 20) ロジックで採用。
4. 全 targetItem を上記で評価し、`lapsNeeded` 昇順で Top 4 を表示。同じクエストが複数行に並ぶことを許容。

**理由**:

- ユーザーの「ポッド無料で回収できるアイテムなら全部そのクエストで周回した時の周回数を表示」要望を直接実装。
- AP は冠位戴冠戦上のキャンペーン対象になりにくいため、effectiveAp 計算を行っても結果は変わらない。シンプルに `drop_rate / lap` で評価できる。
- 同じクエストが並ぶケースは「冠位戴冠戦 1 種類で複数アイテムが集まる」ことを示し、ユーザーの戦略判断 (このクエストを N 周すれば全部済む) に直結する。

**最短モードは触らない**: ユーザー指示。バッジのみ表示。

### D6. Pod アイコンの実装位置と表現

**選択**: `QuestIdentity` (`components/common/QuestIdentity.tsx`) に `consumesPod?: boolean` と `podFree?: boolean` の prop を追加。AP 表示の横に Pod アイコンを描画する。期間中 (`podFree: true`) は Pod アイコンに `×0` または斜線を重ねる。

**理由**:

- `QuestIdentity` は `RecommendedQuest` / `NearGoalSection` / quest 詳細ページの全てで使われる共通コンポーネント。一箇所変更で全体反映される。
- Pod アイコンは Atlas の item id 49 (ストーム・ポッド) の icon を流用すれば自前で SVG を作らずに済む。
- `×0` の見せ方は、CSS で badge を重ねる方式 (ピクセル安定) と SVG で罰印を重ねる方式があり、CSS で十分。

**判定ソース**: `consumesPod` は drops の quest.area が `冠位戴冠戦` または `オーディール・コール` 配下かどうかで判定。`podFree` は podFreePeriod 内かつ questIds に含まれるかで判定。

### D7. キャンペーンセクション内のカテゴリ分けと並び順

**カテゴリ → target マッピング**:

- ファーミング直結:
  - `questAp` (`value <= 999` の純粋な AP 割引のみ。`value=1000` のノイズは除外)
  - `questApFirstTime`
  - `questUseRewardAddItem` (`targetIds=[49]` 等のストーム・ポッド系)
  - event name に「ストーム・ポッド」を含むもの (ノイズ campaign 除外後の救済)
- 強化・育成:
  - `largeSuccess`, `superSuccess`, `svtequipLargeSuccess`, `svtequipSuperSuccess`
  - `combineExp`, `combineQp`, `svtequipCombineQp`
  - `exchangeSvt`, `exchangeSvtCombineExp`
- その他:
  - `questFp`, `questFriendship`, `questUseFriendshipUpItem`, `questUseContinueItem`
  - `questEquipExp`, `questPassiveSkill`, `questItemFirstTime`
  - `friendPointGachaFreeDrawNum`, `questUseRewardAddItem` (targetIds 49 以外)

カテゴリ内は **終了時刻が近い順** で並べる (期限切れ間近を上位)。ストーム・ポッド消費なしのみカテゴリ無視で最上段固定。

### D8. AP 表示の事前事後表示 (継承)

ポッド消費系クエストでも、もし AP キャンペーンが当たって `effectiveAp < originalAp` になる場合は **既存仕様** に従い、AP 表示を「元 AP → effective AP」の事前事後で見せる。Pod アイコンと併記。

## Risks / Trade-offs

[ストーム・ポッド消費なしの名前判定が壊れやすい] → Atlas が event name の表記を変えると検出不可。Mitigation: `'ストーム・ポッド消費なし'` と `'ストームポッド消費なし'` (中黒の有無) の両方をチェック。テストで明示。

[キャンペーン件数が多くなりセクションが冗長化] → 平常時で 5-10 件、復刻イベント期間で 15-20 件もあり得る。Mitigation: カテゴリ分けで「ファーミング直結」を上に置き、「その他」は折りたたみ可能にする (将来検討、初版は単純展開)。

[同じクエストが NearGoalSection に複数並んで「達成間近の素材」セクションが冠位戴冠戦の素材一覧になる] → 期間中は意図通りの振る舞いだが、視覚的に冗長。Mitigation: クエスト名カラムを 1 回目だけ表示、2 行目以降は連結ライン等で省略する将来拡張を残す (初版は素直に複数表示)。

[Pod アイコンを Atlas item id 49 のアセットから取得する場合、CDN 経由 fetch が増える] → 1 回ロードでブラウザキャッシュに乗るため、影響は初回のみ。Mitigation: Atlas static origin のキャッシュヘッダーに依存。問題があれば自前 SVG に切り替え。

[クライアントの古い `dashboard_meta` キャッシュ (podFreePeriods 不在) が読まれる] → クライアント側で `podFreePeriods ?? []` で defensive にフォールバック。サーバ側更新ジョブが 30 分内で再書き込みするので最大 30 分の遅延。

## Migration Plan

1. `lib/master-data/types.ts` に `podFreePeriods` を **オプショナル** フィールドとして追加 (古いデータ互換)。
2. `fetchDashboardMeta()` を更新し、新規 KV 書き込み時から `podFreePeriods` を含める。
3. クライアント hooks/components 側で `?? []` で defensive 読み取り。
4. 段階的に新セクション・新ロジックを展開。
5. 古い `dashboard_meta` (podFreePeriods 不在) は 30 分以内の cron で自動置換されるので、特別な migration 手順は不要。

## Open Questions

- Pod アイコンの取得元: Atlas item id 49 の icon URL を直接埋め込むか、自前 SVG にするか。実装時に Atlas item メタデータをスキャンして決める。
- カテゴリ「ファーミング直結」「強化・育成」「その他」のラベル文言の最終形。
- 終了が近いキャンペーンの強調 (色変え) を初版に含めるか、後続改善とするか。
