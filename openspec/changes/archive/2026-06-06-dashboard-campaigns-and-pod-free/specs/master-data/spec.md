## ADDED Requirements

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
