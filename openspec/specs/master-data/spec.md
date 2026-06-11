# 仕様書: マスターデータ管理 (Master Data Management)

## Purpose
FGO周回ソルバーが必要とする最新のアイテム情報、クエスト情報、およびドロップ率データを外部ソースから取得し、アプリケーションが利用可能な形式に変換・保持する機能。
## Requirements
### Requirement: データソースの統合
システムは、複数の外部ソースからデータを取得し、一貫性のある形式に統合しなければならない (SHALL)。

#### Scenario: データのフェッチ
- **WHEN** データ更新プロセスが実行されるとき
- **THEN** 「FGOアイテム効率劇場～2～」スプレッドシート（CSV）および Atlas Academy API からデータが取得される。

### Requirement: アイテム名のマッピング
システムは、スプレッドシート上の日本語略称を Atlas Academy の正式名称に正確に変換しなければならない (SHALL)。

#### Scenario: 名称変換の実行
- **WHEN** マッピングルール（静的テーブル、パターン変換、フォールバック）が適用されるとき
- **THEN** 略称（例: 「証」）が正式名称（例: 「英雄の証」）に変換される。

### Requirement: データ最適化 (Top 5 フィルタリング)
システムは、ソルバーの性能とストレージ制限を維持するため、保存するデータ量を最適化しなければならない (SHALL)。

#### Scenario: クエストデータの削減
- **WHEN** 最終的なデータセットを構築するとき
- **THEN** アイテムごとにドロップ率上位 5 件のクエスト、および相対効率上位 100 件のマルチドロップ候補のみが保持される。
- **THEN** 保存されるデータに wave (enemy) 情報は含まれない。

### Requirement: Quest データに `aaQuestId` を保持
システムは、Atlas Academy API との紐付けを維持するため、クエストごとに固有の ID を保持しなければならない (SHALL)。

#### Scenario: `aaQuestId` の保存
- **WHEN** スプレッドシートのクエストと Atlas Academy のデータが一致したとき
- **THEN** 出力される Quest データに `aaQuestId` フィールドが含まれる。

### Requirement: 失敗・空応答時の KV 保護
システムは、KV (`all_drops_json` / `dashboard_meta`) を上書きする前にフェッチ結果を検証し、欠損が疑われる場合は書き込みをスキップして既存データを温存しなければならない (SHALL)。

#### Scenario: フェッチが throw したら KV を変更しない
- **WHEN** `fetchAndTransformData` または `fetchDashboardMeta` が例外を投げたとき
- **THEN** worker は例外をログに残し、対応する KV キーへの `put` を実行しない。
- **THEN** 既存の KV データはそのまま保持される。

#### Scenario: drops の必須配列が空なら書き込まない
- **WHEN** `fetchAndTransformData` が完走したが `items` / `quests` / `drop_rates` のいずれかが空配列だったとき
- **THEN** worker は警告ログを出力し、`all_drops_json` への `put` を実行しない。
- **THEN** 既存の `all_drops_json` はそのまま保持される。

#### Scenario: dashboard meta の events と gachas が両方空なら書き込まない
- **WHEN** `fetchDashboardMeta` が完走したが `events` と `gachas` が両方とも空だったとき
- **THEN** worker は警告ログを出力し、`dashboard_meta` への `put` を実行しない。
- **THEN** 既存の `dashboard_meta` はそのまま保持される。

#### Scenario: dashboard meta の片方だけが空なら書き込みを許可する
- **WHEN** `fetchDashboardMeta` が `events` または `gachas` のどちらか片方だけ空のレスポンスを返したとき
- **THEN** worker は通常通り `dashboard_meta` を更新する（ガチャ無し期間／イベント切替期間として有効）。

### Requirement: 定期的なデータ更新
システムは、常に最新のドロップデータを提供するため、定期的に自動更新を実行しなければならない (SHALL)。

#### Scenario: 自動更新の実行
- **WHEN** GitHub Actions の Cron ジョブがトリガーされたとき
- **THEN** `fetchAndTransformData` が実行され、KV 内のデータが更新される。

### Requirement: ガチャバナー URL の生成
システムは、Atlas Academy CDN の正しいパスを使用してガチャバナー画像 URL を生成しなければならない (SHALL)。

#### Scenario: バナー URL の構築
- **WHEN** `fetchDashboardMeta()` がアクティブなガチャエントリを処理するとき
- **THEN** バナー URL は `{staticOrigin}/JP/SummonBanners/img_summon_{imageId}.png` の形式で生成される。
- **THEN** 旧形式 (`/JP/Banner/summon_{imageId}.png`) は使用されない。

### Requirement: イベントデータの一括取得
システムは、アクティブなイベント情報を N+1 リクエストなしに取得しなければならない (SHALL)。

#### Scenario: 一括フェッチの実行
- **WHEN** `fetchDashboardMeta()` が実行されるとき
- **THEN** `export/JP/nice_event.json` を1リクエストで取得し、メモリ内でフィルタリングを行う。
- **THEN** 個別の `/nice/JP/event/{id}` エンドポイントへのリクエストは行われない。

### Requirement: ガチャフィルタリングの精度
システムは、ガチャタイプに基づいてフレポ召喚を除外し、課金石・有料石限定のガチャのみを表示しなければならない (SHALL)。

#### Scenario: stone/chargeStone タイプのみ表示
- **WHEN** アクティブガチャをフィルタリングするとき
- **THEN** `type` が `stone` または `chargeStone` であるエントリのみが `DashboardMeta.gachas` に含まれる。
- **THEN** `type` が `friendPoint` のエントリは除外される。

### Requirement: AP キャンペーン情報の抽出
システムは、Atlas Academy `nice_event.json` の `target=questAp` キャンペーンを抽出し、drops バンドルに同梱しなければならない (SHALL)。

#### Scenario: キャンペーン抽出と quest ID 変換
- **WHEN** マスターデータ更新プロセスが `nice_event.json` を処理するとき
- **THEN** `campaigns[]` のうち `target` が `questAp` であるエントリが収集される。
- **THEN** 各 campaign について `campaignQuests[]` の `questId` (Atlas ID) を `aaQuestId` 経由でアプリ内短縮 quest ID に変換する。
- **THEN** `campaignQuests[].isExcepted === true` のエントリは対象から除外される。
- **THEN** 短縮 quest ID に変換できない（drops に存在しない）クエストは無視される。

#### Scenario: 出力データ構造
- **WHEN** 更新後の drops バンドルが KV `all_drops_json` に保存されるとき
- **THEN** バンドルには `campaigns` フィールドが含まれ、各エントリは少なくとも `{ id, calcType, value, validFrom, validTo, questIds }` を持つ。
- **THEN** `questIds` はアプリ内の短縮 quest ID 配列である。
- **THEN** `validFrom` / `validTo` は Unix 秒で、現在開催中だけでなく未来分のキャンペーンも含めて保存される（取得時点で Atlas が公開している範囲）。

#### Scenario: 既存フィールドの後方互換性
- **WHEN** `campaigns` フィールドを追加するとき
- **THEN** `items`, `quests`, `drop_rates` 等の既存フィールドの形状は変更されない。
- **THEN** `campaigns` フィールドを参照しない既存クライアントは従来どおり動作する。

### Requirement: campaigns の cron 周期と整合
システムは、`campaigns` の鮮度をマスターデータ更新の cron 周期と一致させなければならない (SHALL)。

#### Scenario: 毎時更新時のキャンペーン更新
- **WHEN** マスターデータ更新 cron が走るとき
- **THEN** `campaigns` フィールドも同じパス内で再生成され、KV に保存される。

### Requirement: nice_war の条件付き GET による再 parse 回避

システムは、`nice_war.json` (約23MB) の取得において ETag / Last-Modified を用いた条件付き GET を行い、未変更時は parse 済みの compact マッピングを再利用して 23MB の download+parse をスキップしなければならない (SHALL)。これにより phase A の `exceededCpu` を回避する。

#### Scenario: weak ETag を strong に正規化して送信する

- **WHEN** `global_fetch_strictly_public` 経由の fetch が upstream の strong ETag を weak (`W/"..."`) 化して返し、その値をキャッシュしていたとき
- **THEN** 次回の条件付き GET では `If-None-Match` に先頭の `W/` を剥がした strong ETag を載せる。
- **THEN** 保険として、保存済み `Last-Modified` を `If-Modified-Since` にも載せる。

#### Scenario: 304 ならキャッシュを再利用し再 parse / 再キャッシュしない

- **WHEN** 条件付き GET が `304 Not Modified` を返し、キャッシュ済み `aaQuests` が存在するとき
- **THEN** 23MB の parse を行わずキャッシュ済み `aaQuests` を再利用する。
- **THEN** キャッシュの再書き込み (`put`) は行わない。

#### Scenario: 200 なら parse して正規化済み検証子と共にキャッシュする

- **WHEN** 条件付き GET が `200 OK` を返したとき
- **THEN** 23MB を 1 度だけ parse して compact マッピング (`id/name/spotName/afterClear/warLongName`) を構築する。
- **THEN** 正規化済み (strong) ETag と `Last-Modified` を検証子としてキャッシュに保存し、次回の 304 成立に備える。

### Requirement: rarity AP テーブルの指紋ベース再計算ゲート
システムは、rarity AP テーブル専用 worker (`fgo-rarity-updater`) において、入力 drops が rarity AP に影響する形で変化したときのみ再計算を行わなければならない (SHALL)。これにより毎時の cron 実行で最大 50 回の LP ソルブが無条件に走って `exceededCpu` を頻発させる状態を避ける。

#### Scenario: 入力が実質不変なら再計算をスキップ
- **WHEN** rarity worker が `all_drops_json` を読み、`quests`(id/ap)と `drop_rates`(quest_id/item_id/drop_rate)から算出した指紋が前回保存値 (`rarity_ap_tables_fp`) と一致し、かつ既存の `rarity_ap_tables` が存在するとき
- **THEN** worker は `buildRarityApTables` を呼ばずにスキップし、KV を変更しない。

#### Scenario: AP に効く入力が変化したら再計算
- **WHEN** `quests.ap`(AP キャンペーン反映を含む)または `drop_rates`、あるいはクエスト件数が前回から変化し、指紋が一致しないとき
- **THEN** worker は `buildRarityApTables` を実行して `rarity_ap_tables` を更新し、その後に新しい指紋を `rarity_ap_tables_fp` へ保存する。

#### Scenario: AP に効かない揺れでは再計算しない
- **WHEN** `waveCount` のインクリメンタル埋めや配列順の変化のみで `all_drops_json` が書き換わったとき
- **THEN** 指紋は変化せず、再計算はスキップされる。

#### Scenario: 再計算失敗時は指紋を据え置く
- **WHEN** `buildRarityApTables` が例外を投げた、または `exceededCpu` で中断したとき
- **THEN** `rarity_ap_tables_fp` は更新されず、次回 cron が同じ入力で再試行する。
- **THEN** 個別の更新エンドポイントや別経路は設けない。

### Requirement: ストーム・ポッド消費なし期間の抽出
システムは、Atlas Academy `nice_event.json` から「ストーム・ポッド消費なし期間」を抽出し、`dashboard_meta` に同梱して配信しなければならない (SHALL)。

#### Scenario: 期間エントリの抽出
- **WHEN** `fetchDashboardMeta()` が Atlas Academy `nice_event.json` を処理するとき
- **THEN** `type === 'questCampaign'` かつ `name` に `ストーム・ポッド消費なし` または `ストームポッド消費なし` (中黒なし) を含む event を「ポッド消費なしキャンペーン候補」として抽出する。
- **THEN** 候補のうち `now ∈ [startedAt, endedAt]` を満たす、または将来開催予定 (`startedAt > now`) を含めて DashboardMeta に格納する (期間外エントリの保持有無は実装判断)。

#### Scenario: 対象クエストの短 ID 射影
- **WHEN** 候補 event の `campaignQuests` を処理するとき
- **THEN** 各 `campaignQuests[].questId` (Atlas Academy quest ID) を、master-data の `aaQuestId → 短 quest ID` マップで射影する。
- **THEN** マップに対応エントリが無い quest ID は除外する。
- **THEN** 射影後の短 quest ID 集合を該当エントリの `questIds` フィールドに格納する。

#### Scenario: DashboardMeta への格納
- **WHEN** `fetchDashboardMeta()` が `DashboardMeta` を返すとき
- **THEN** `podFreePeriods: { name: string, startedAt: number, endedAt: number, questIds: string[] }[]` フィールドが返り値に含まれる。
- **THEN** 該当キャンペーンが 1 件も存在しないとき、`podFreePeriods` は空配列となる。

#### Scenario: 後方互換のためのオプショナル扱い
- **WHEN** クライアントが古い `dashboard_meta` (`podFreePeriods` 不在) を読むとき
- **THEN** クライアント側で空配列としてフォールバックされるよう、`DashboardMeta` 型では `podFreePeriods` をオプショナルもしくは defensive な default を持たせる。

### Requirement: 短縮IDの世代間安定性
システムは、マスターデータ更新をまたいでクエスト短縮IDおよびアイテム短縮IDが同一の対象を指し続けることを保証しなければならない (SHALL)。採番済みIDの記録は公開ペイロード `all_drops_json` 内の append-only な `id_registry` フィールドに同梱して永続化する。

#### Scenario: 更新間でのクエストIDの再利用
- **WHEN** 更新ジョブが前回公開済みペイロードを読み込んだ状態でデータを変換し、`エリア名+クエスト名`（または改名時のフォールバックとして `aaQuestId`）が前回と一致するクエストが存在するとき
- **THEN** そのクエストには前回と同一の短縮IDが割り当てられる。
- **THEN** 上流でのクエスト/エリアの挿入・削除は他クエストのIDに影響しない。
- **THEN** `aaQuestId` フォールバックは、一致エントリの旧キー（エリア名+クエスト名）が今世代に現存しない場合のみ発動する（名前マッチの曖昧性により別クエストへ同一 `aaQuestId` が振られた場合に、現存クエストのIDを新規クエストが奪って重複IDを生むことを防ぐ）。

#### Scenario: 新規クエスト・新規エリアの採番
- **WHEN** レジストリに存在しないクエストまたはエリアが出現したとき
- **THEN** 新規クエストは当該エリアプレフィックス内の最大インデックス+1で採番される。
- **THEN** 新規エリアは未使用のプレフィックスを取得し、既存エリアのプレフィックスは変更されない。
- **THEN** Daily セクションのクエストIDは常に `'0'` 始まり、Free セクションは `'0'` 以外で始まる（ID形式 `{2文字エリアプレフィックス}{base36インデックス}` を維持）。

#### Scenario: 削除されたIDの恒久的非再利用
- **WHEN** 過去にIDを割り当てられたクエスト/アイテムがデータから消滅し、その後新規のクエスト/アイテムが追加されたとき
- **THEN** 消滅した対象のIDが新規対象に再割り当てされることはない（レジストリの墓標が公開フィルタの世代を超えて維持される）。

#### Scenario: アイテムIDの atlasId ベース再利用
- **WHEN** 変換対象のアイテムの `atlasId` がレジストリに登録済みのとき
- **THEN** 登録済みの短縮アイテムIDが再利用される。
- **WHEN** 未登録のアイテムの位置ベース候補IDが他の `atlasId` に割当済みのとき
- **THEN** 同一カテゴリ空間内の衝突しないIDが新規採番される。

#### Scenario: 前回データ不在時のフォールバック
- **WHEN** 前回公開済みペイロードが存在しない、または読込・parse に失敗したとき
- **THEN** 採番は現行の位置ベース割当と同一の結果になり、変換は失敗しない。

#### Scenario: id_registry 無しペイロードからの移行
- **WHEN** 前回ペイロードに `id_registry` フィールドが存在しないとき（本機能導入直後の初回実行）
- **THEN** 公開済みの quests / items から レジストリが合成され、現在公開中の全IDがピン留めされる。

#### Scenario: 後方互換性
- **WHEN** 既存の消費者（`lib/get-drops.ts` 等）が `id_registry` を含むペイロードを読み込んだとき
- **THEN** 追加フィールドは無視され、既存の動作に影響しない。

### Requirement: ID整合性の検証による KV 保護
システムは、KV への書き込み前にID空間の整合性を検証し、不整合を検出した場合は書き込みを拒否しなければならない (SHALL)。同じ検証はローカルモック再生成（`scripts/update-data.ts`）にも適用する。

#### Scenario: ID重複・形式違反の検出
- **WHEN** 変換結果にクエストIDまたはアイテムIDの重複、`/^[0-9a-z]{3,}$/` に合致しないクエストID、またはセクションとプレフィックスの不整合（Daily ⇔ `'0'` 始まり）が含まれるとき
- **THEN** `all_drops_json` は書き込まれず、前回の正常なデータとレジストリが維持される。

#### Scenario: drop_rates の参照整合
- **WHEN** `drop_rates[]` のいずれかの `quest_id` が quests に存在しないとき
- **THEN** 書き込みは拒否され、エラーがログに記録される。

## Constraints
- **データ構造**: `MASTER_DATA` KV 内の `all_drops_json` キーに、`items`, `quests`, `drop_rates`, `campaigns`（および採番安定化用の `id_registry`）の構造で保存されること。
- **除外ルール**: AP 5 未満のクエストはノイズとして除外されること。
- **wave データの非保持**: updater プロセスにおいて Atlas Academy からの wave データ取得は行わないこと。
