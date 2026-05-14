## ADDED Requirements

### Requirement: モックダッシュボードデータの自動生成
開発者は、現在開催中のガチャ・イベントデータを Atlas Academy API から取得して `mocks/dashboard.json` を自動更新できなければならない (SHALL)。

#### Scenario: スクリプトの実行
- **WHEN** 開発者が `pnpm update:mock:dashboard` を実行するとき
- **THEN** `fetchDashboardMeta()` が呼び出され、現在時刻でフィルタリングされたデータが取得される。
- **THEN** 結果が `mocks/dashboard.json` に上書き保存される。
- **THEN** 取得件数（イベント数・ガチャ数・サーヴァント数）がコンソールに出力される。

#### Scenario: エラー時の挙動
- **WHEN** Atlas Academy API へのリクエストが失敗したとき
- **THEN** エラーメッセージがコンソールに出力され、`mocks/dashboard.json` は変更されない。
