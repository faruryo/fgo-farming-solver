## Context

現在の CI は Ubuntu 上で lint、型チェック、D1 migration、通常テスト、性能テストを実行し、main への push 後に同じ Linux 系ランタイムから Cloudflare Workers へデプロイする。TypeScript は strict だが、ESLint は `any` と unsafe 系を無効化し、`scripts/` を全除外し、複数ファイルでインラインまたはファイル全体の disable が使われている。60行超の関数は現時点で多数あり、厳格ルールを一括で error にすると既存開発を停止させる。

Zenn記事の設定例と各公式パッケージを確認し、`eslint-plugin-sonarjs`、`eslint-plugin-security`、`knip`、`jscpd` は公式リポジトリ・ライセンス・npm integrity が確認できたものだけを追加する。Codex の公式手順では、GitHub Automatic reviews と `AGENTS.md` の `## Code Review Rules` が推奨されているが、前者はリポジトリ外の設定かつ利用枠・費用に影響する。

## Goals / Non-Goals

**Goals:**

- 決定的に検出できる品質問題を人間のレビューから lint / CI へ移す。
- 既存負債を一括免除せず、増加を止めながら段階的にゼロへ近づける。
- エージェントがテスト可能な設計と意味のあるテストを作るための、短い入口と必要時に読む詳細ルールを置く。
- 重複・デッドコードを可視化しつつ、導入初日から無視コメントを増やす誘因を作らない。
- AIレビューが見るべきリポジトリ固有リスクと、人間が見るべきUI・仕様判断を分離する。

**Non-Goals:**

- この変更だけで既存の大型関数、`any`、non-null assertion をすべて解消すること。
- 人間による UI、操作感、仕様妥当性、データ損失リスクの最終判断を廃止すること。
- OpenAI API キーの作成、GitHub secret の登録、有料のAutomatic reviewsの有効化を無断で行うこと。
- OS 固有コードパスがないWebアプリに、保護対象を説明できないmacOS / Windows CIを追加すること。

## Decisions

### 1. ルールを zero-debt gate と debt-ratchet に分ける

現状違反がゼロ、または今回中にゼロへできるルールは `error` にする。既存違反が多い関数サイズ、複雑度、`any`、non-null assertion、SonarJS / security の一部は `warn` として可視化し、専用スクリプトがファイル・ルール単位の件数をベースラインと比較する。新しい違反または既存ファイル内の件数増加は CI を失敗させる。

単純な `--max-warnings N` は、ある違反を直した枠で別の違反を増やせるため採用しない。新規コードだけ別設定にする案は、Git差分と関数境界の対応が不安定なため採用しない。

### 2. 正当な lint 例外は設定ファイルに集約する

ESLint の inline config を無効化し、外部FGO画像で `next/image` が適さない箇所や、意図的なHook依存配列などは `eslint.config.mjs` のファイル別overrideへ理由付きで置く。テストの `describe` / `it` コールバックは関数行数とcallback nestingだけ対象外にし、複雑度・型・アサーションの検査は残す。

### 3. 型情報を使うルールはバグ検出に絞る

`no-floating-promises`、`no-misused-promises`、`await-thenable`、`no-base-to-string` を zero-debt error とする。全 `strictTypeChecked` の一括導入は、スタイル違反と既存型負債でバグ検出が埋もれるため採用しない。`no-explicit-any` と `no-non-null-assertion` はratchet対象とし、`consistent-type-assertions` は新規違反ゼロのerrorにする。

### 4. テスト設計を永続ルールとして段階開示する

`AGENTS.md` には「テスト作成・リファクタ前に読む」1行のポインタだけを置き、詳細は `.agents/rules/testing.instructions.md` に置く。ルールはpureなドメイン判断の抽出、時刻・乱数・環境・I/Oの依存注入、正常・境界・空・不正・否定・回帰ケース、新規テストが対象の破壊で失敗することの確認を要求する。既存コードを触る際にも適用する。

### 5. 重複とデッドコードは report-only から始める

jscpd と Knip は専用workflowでPR・main・定期実行し、結果をartifactとして保存する。ジョブは `continue-on-error` とし、導入初日の既存在庫やKnipの動的entry point誤検知でマージを止めない。ベースラインが整理され、PR差分だけを信頼して判定できるようになるまでは必須ゲートへ昇格しない。

### 6. レビュー規約は結果と安全経路を書く

`AGENTS.md` の Code Review Rules は、機械lintの再掲ではなく、このリポジトリで重大な事故につながる境界に絞る。具体的には、本番D1/KVへのテストデータ混入、クラウド同期の無確認上書き、未公開FGOデータの公開、UIのi18n逸脱、重い定期処理のWorkers cronへの再配置を検出し、安全な代替経路も併記する。

PRテンプレートでは、AI指摘を「本物の修正 / 妥当なnitpick / 誤検知」に分類して結論を残し、UI・操作感・仕様判断は人間確認欄へ分離する。

### 7. 実行環境に対応するCIだけを持つ

本番・開発の実行境界はLinux上のCloudflare Workersとブラウザであり、Node側にOS分岐がない。したがってPR CIはUbuntuを維持する。将来OS固有のCLI、filesystem、process起動を追加した場合は、その保護対象をworkflowコメントに書いた上で対象OSを追加する。

### 8. Codex Automatic reviewsの外部有効化は明示的に分離する

リポジトリ側はCode Review RulesとPR運用を整える。Automatic reviewsの有効化はChatGPT Codex設定で行い、API actionを使う場合は`OPENAI_API_KEY`と費用承認が必要であるため、この変更では勝手にworkflowを常時発火させない。直近PRにレビュー投稿がないことは確認済みだが、設定画面の現在値はリポジトリから確定できない。

## Risks / Trade-offs

- [ベースライン内で同じファイル・同じルールの違反を入れ替えられる] → ベースラインはファイル単位まで細分化し、レビューでは改善差分を確認する。負債が減ったら即時にベースラインを下げる。
- [SonarJS / security の誤検知が多い] → 初期はratchetまたはreport-onlyにし、例外は設定ファイルへ理由付きで限定する。
- [KnipがNext.jsや動的script entryを未使用と誤認する] → entry/project設定を明示し、report-onlyを維持する。
- [品質workflowがPR時間を延ばす] → 重い構造監査は通常CIから分離し、マージをブロックしない。通常CIにはlint ratchetだけを追加する。
- [Automatic reviewsが未有効のままになる] → ドキュメントに外部アクティベーションと確認方法を残し、リポジトリ内完了と外部残作業を明示する。

## Migration Plan

1. 公式性を確認した開発依存をpnpmで追加する。
2. ESLintのinline disableを中央allowlistへ移し、zero-debtルールの既存違反を修正する。
3. debtルールのベースラインを生成し、CIへratchet検査を追加する。
4. テスト・レビュー規約、PRテンプレート、運用ドキュメントを追加する。
5. jscpd / Knip のreport-only workflowを追加し、ローカルで両コマンドを検証する。
6. lint、type-check、test、OpenSpec strict、workflow構文を検証する。

ロールバックは、追加workflowとlint ratchet stepを外し、package依存・設定・ベースラインを同一変更単位で戻す。製品ランタイムやデータmigrationは変更しない。

## Open Questions

- リポジトリ所有者がCodex Automatic reviewsを有効化するか、API actionを別途導入するか。
- 構造監査の既存在庫を整理した後、どの指標から必須ゲートへ昇格するか。
