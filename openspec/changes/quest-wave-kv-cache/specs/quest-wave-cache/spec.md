## ADDED Requirements

### Requirement: wave データのオンデマンド取得
クエスト詳細ページは、Atlas Academy API からクエストの wave (enemy 構成) データをオンデマンドで取得しなければならない。取得には Quest データに含まれる `aaQuestId` を使用する。

#### Scenario: wave データの取得成功
- **WHEN** ユーザーが `aaQuestId` を持つクエストの詳細ページを開く
- **THEN** `https://api.atlasacademy.io/nice/JP/quest/{aaQuestId}/1` へ HTTP GET が発行される
- **THEN** レスポンスの `stages` から wave データが構築されてページに表示される

#### Scenario: ローディング中の表示
- **WHEN** wave データのフェッチが進行中
- **THEN** wave セクションにローディングインジケーターが表示される

#### Scenario: `aaQuestId` がないクエスト
- **WHEN** ユーザーが `aaQuestId` を持たないクエストの詳細ページを開く
- **THEN** wave 用のフェッチは発行されない
- **THEN** 既存の "Enemy data not available" フォールバック UI が表示される

#### Scenario: フェッチ失敗
- **WHEN** Atlas Academy API へのリクエストが失敗する (network error / non-OK response)
- **THEN** wave データは空として扱われる
- **THEN** 既存の "Enemy data not available" フォールバック UI が表示される

### Requirement: `useQuestWave` フック
`hooks/use-quest-wave.ts` に `useQuestWave(aaQuestId?: number)` フックを実装しなければならない。このフックは `{ waves, isLoading }` を返す。

#### Scenario: フックの戻り値
- **WHEN** `aaQuestId` が指定されてフェッチが完了した
- **THEN** `waves` に `Wave[]` が格納される
- **THEN** `isLoading` が `false` になる

#### Scenario: `aaQuestId` 未指定時
- **WHEN** `aaQuestId` が `undefined`
- **THEN** フェッチは発行されない
- **THEN** `waves` は `undefined`、`isLoading` は `false`
