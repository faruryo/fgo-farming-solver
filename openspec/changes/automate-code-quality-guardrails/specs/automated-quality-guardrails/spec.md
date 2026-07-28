## ADDED Requirements

### Requirement: 決定的lintのzero-debtゲート

システムは、既存違反がない型・Promise・文字列化・Hook安全性の決定的lintルールをerrorとして実行し、違反を含む変更をCIで拒否しなければならない (MUST)。

#### Scenario: 新しい決定的違反

- **WHEN** 変更が未処理Promise、非Promiseへのawait、危険な既定文字列化、または新規の禁止型アサーションを追加する
- **THEN** `pnpm run lint` は非ゼロで終了する

### Requirement: 既存品質負債のratchet

システムは、関数サイズ、複雑度、`any`、non-null assertion、および段階導入する静的解析ルールの既存違反をファイル・ルール単位で記録し、各単位の違反数増加をCIで拒否しなければならない (MUST)。

#### Scenario: 既存負債の増加

- **WHEN** あるファイル・ルールの違反数がコミット済みベースラインを上回る
- **THEN** lint ratchet 検査は増加箇所を表示して非ゼロで終了する

#### Scenario: 既存負債の削減

- **WHEN** 違反数がベースライン以下へ減少する
- **THEN** lint ratchet 検査は成功し、ベースライン更新コマンドが新しい在庫を生成できる

### Requirement: lint例外の中央管理

システムはインラインの `eslint-disable`、`@ts-ignore`、`@ts-expect-error` による回避を許可せず、正当な例外を `eslint.config.mjs` の対象ファイル別overrideへ理由付きで集約しなければならない (MUST)。

#### Scenario: インライン抑止の追加

- **WHEN** ソースまたはテストへインラインlint抑止が追加される
- **THEN** lintはその抑止を設定として適用せず、検出対象の問題を報告する

#### Scenario: 正当な例外

- **WHEN** 外部画像や意図的なHook依存など機械ルールと両立しない実装が必要である
- **THEN** 対象ファイルと理由がESLint設定のallowlistに記録され、他ファイルには例外が波及しない

### Requirement: テスト可能な設計ルール

エージェント向け規約は、ドメイン判断を可能な限りpure関数へ分離し、時刻・乱数・環境・I/O・プラットフォーム依存を境界から注入し、既存コードを触る場合にも同じ方針を適用するよう要求しなければならない (MUST)。

#### Scenario: I/Oと判断が混在するコードの変更

- **WHEN** エージェントがHTTP、filesystem、Cloudflare bindingまたはブラウザAPIとドメイン判断が混在するコードを変更する
- **THEN** 規約は判断をpure関数へ抽出して単体テストし、I/Oを呼び出し側に残すよう指示する

### Requirement: 意味のあるテストケース

エージェント向け規約は、正常、エッジ、複合コーナー、境界、空、null/undefined、不正、エラー、否定、回帰から該当ケースを選び、新規テストが対象コードの意図的な破壊で失敗することを確認するよう要求しなければならない (MUST)。

#### Scenario: 新規回帰テスト

- **WHEN** バグ修正にテストを追加する
- **THEN** テストは修正を戻した状態または条件を反転した状態で失敗し、修正後に成功することが確認される

### Requirement: 重複・デッドコードのreport-only監査

CIはjscpdとKnipをPR、main、および定期実行で走らせ、結果を取得可能なartifactとして保存しなければならない (MUST)。初期導入時は検出結果だけで通常CIまたはマージを失敗させてはならない (MUST NOT)。

#### Scenario: 既存の重複または未使用候補を検出

- **WHEN** jscpdまたはKnipが候補を検出する
- **THEN** 監査workflowはレポートをartifactへ保存し、検出コマンドの終了状態にかかわらず他方の監査とartifact uploadを継続する

### Requirement: リポジトリ固有AIレビュー規約

ルート `AGENTS.md` は、Codexレビューが重大なリポジトリ固有リスクと安全な代替経路を確認できる短い `## Code Review Rules` を含まなければならない (MUST)。機械lintで決定的に確認できる事項をレビュー規約へ重複記載してはならない (MUST NOT)。

#### Scenario: クラウド同期または本番データ境界の変更

- **WHEN** PRがクラウド同期、D1/KV更新、または公開マスターデータ境界を変更する
- **THEN** AIレビュー規約は無確認上書き、テストデータ混入、未公開データ公開、重いcron処理のWorkers再配置を重大リスクとして確認する

### Requirement: レビュー指摘と人間確認の分離

PRテンプレートは、AIレビュー指摘を「本物の修正」「妥当なnitpick」「誤検知または古い情報」に分類して結論を記録する欄と、UI・操作感・仕様判断を人間が確認する欄を分けなければならない (MUST)。

#### Scenario: AIレビューに対応したPR

- **WHEN** AIレビュアーが1件以上の指摘を投稿する
- **THEN** PRには各指摘の分類、修正または見送り理由、追加した回帰テストの有無が残る

### Requirement: 実行環境に対応するCI

必須CIのOSは、本番またはサポート対象の固有コードパスを実際に実行する環境に限定しなければならない (MUST)。OSを追加する場合、workflowはそのOSでのみ守られるコードパスをコメントで説明しなければならない (MUST)。

#### Scenario: OS固有コードがないCloudflare Webアプリ

- **WHEN** Node側にmacOSまたはWindows固有のfilesystem、process、credential処理が存在しない
- **THEN** 必須CIは本番に対応するUbuntuを維持し、保護対象のないOS matrixを追加しない

#### Scenario: 将来OS固有コードを追加

- **WHEN** サポート対象OSだけで実行されるコードパスを追加する
- **THEN** 対応OSのCIと再現テストを追加し、workflowに保護対象と実行頻度の理由を記載する

### Requirement: 外部AIレビュー有効化の分離

リポジトリはAutomatic reviewsが利用できるレビュー規約を提供しなければならない (MUST)。一方、APIキー登録、有料利用、外部Codex設定の変更をリポジトリ内実装の完了として偽ってはならない (MUST NOT)。

#### Scenario: リポジトリ側の準備完了

- **WHEN** `AGENTS.md` とPRテンプレートが導入される
- **THEN** リポジトリ側はAutomatic reviewsまたは `@codex review` で同じ規約を利用でき、外部設定の残作業が運用文書に明記される
