## MODIFIED Requirements

### Requirement: データ最適化 (Top 5 フィルタリング)
ソルバーの計算速度を維持し、デー��サイズを Cloudflare KV の制限内に��めるため、以下の処理を行う��
- アイテムごとに、ドロップ率が高い上位 5 つのクエストのみを保持する。
- 上位 5 位に含まれないクエストデータは最終的なデータセットから除外する。
- 追加として、相対効率スコア上位 100 クエス���をマルチドロップ候補として保持する。
- **wave データの取得は行わない** (変更点)。wave データはクライアントサイドでオンデマンドに取得する。

#### Scenario: wave データを含まない更新
- **WHEN** `fetchAndTransformData` が実行される
- **THEN** `/nice/JP/quest/{id}/1` への HTTP リクエストは発行されない
- **THEN** 保存される Quest データに `waves` フィールドは含まれない

## ADDED Requirements

### Requirement: Quest データに `aaQuestId` を保持
`fetchAndTransformData` は Atlas Academy の quest ID が判明しているクエストについて、`aaQuestId: number` を Quest データに含めて KV に保存しなければならない。

#### Scenario: `aaQuestId` の保持
- **WHEN** スプレッドシートのクエストが Atlas Academy の quest と一致した
- **THEN** 出力 Quest データの `aaQuestId` フィールドに Atlas Academy quest ID が設定され��

#### Scenario: 一致しないクエストの `aaQuestId`
- **WHEN** スプレッドシートのクエストが Atlas Academy の quest と一致しない
- **THEN** 出力 Quest データに `aaQuestId` フィールドは含まれない (undefined)

## REMOVED Requirements

### Requirement: Quest wave データの事前取得
updater は Atlas Academy の `/nice/JP/quest/{id}/1` から wave データを取得し Quest に埋め込んでいたが、この処理を廃止する。

**Reason**: wave データはソルバー計算に使用されておらず UI 表示のみに使用される。クライアントサイドのオンデマンド取得に移行することで updater のサブリクエスト消費を削減する。

**Migration**: `app/quests/[id]/page.tsx` が `useQuestWave(quest.aaQuestId)` を通じて Atlas Academy から直接取得する。
