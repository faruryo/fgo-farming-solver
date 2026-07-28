# Automated quality guardrails

人間が全diffを読むことだけに依存せず、「壊れたら機械が赤くする」範囲を増やすための運用を定義する。元にした考え方は[1日500コミットは、もう読めない ── だからコードレビューをやめた](https://zenn.dev/singularity/articles/stopped-reviewing-my-code)。

## Required gates

| Gate            | Command                              | Role                                                        |
| --------------- | ------------------------------------ | ----------------------------------------------------------- |
| ESLint errors   | `pnpm run lint`                      | 新規に許容しない決定的な型・Promise・Hook・構文エラーを拒否 |
| Warning ratchet | `pnpm run lint:ratchet`              | 既存負債をファイル・ルール単位で固定し、増加を拒否          |
| TypeScript      | `pnpm run type-check`                | `strict` 型検査                                             |
| Tests           | `pnpm test --run` / `pnpm test:perf` | 振る舞い・回帰・性能境界                                    |
| OpenSpec        | `openspec validate --strict --json`  | 仕様と実装作業の同期                                        |

`eslint.config.mjs` の例外はファイル別allowlistに理由付きで置く。ソース内の `eslint-disable`、`@ts-ignore`、`@ts-expect-error` は使わない。

## Ratchet policy

`quality/lint-ratchet-baseline.json` は警告をファイル・ルール単位で数えた在庫である。総数だけではないため、別ファイルへの負債移動も新規違反として失敗する。

1. まず `pnpm run lint:ratchet` で増加がないことを確認する。
2. 警告を直したら、`pnpm run lint:ratchet:update` を実行する。
3. baseline diffが減少だけであることを確認する。増加を受け入れるためにupdateしてはならない。
4. ルールの在庫がゼロになったら、`eslint.config.mjs` でwarningからerrorへ昇格し、baselineから消す。

## Report-only structural audits

- `pnpm run audit:duplicates`: jscpdでコピー重複を検出し、console / JSON / SARIFへ出力する。
- `pnpm run audit:dead-code`: Knipで未使用ファイル・export・依存・unresolved entryを検出し、JSONへ出力する。

導入時点ではどちらもマージゲートではない。全体在庫と動的entry point由来の誤検知を含むため、GitHub Actionsでは常にレポートをartifactとして残し、検出結果だけでは通常CIを失敗させない。無視設定は、entry pointを正しく記述しても残る具体的な誤検知にだけ理由付きで追加する。

## Review loop

AIレビュアーの指摘を機械的に全適用しない。PRの `AI review resolution` に次のいずれかを記録する。

- real fix: 修正し、可能なら回帰テストを追加する。
- valid nitpick: 安価なら修正し、見送るなら意図と理由を残す。
- false positive or stale: 現行コード・仕様で確認し、見送る根拠を残す。

人間はUI、操作感、通知タイミング、仕様そのものの妥当性、データ損失を伴う判断を確認する。機械lintの結果を人間レビュー規約へ重複させない。

## Codex code review activation

リポジトリ側は `AGENTS.md` の `## Code Review Rules` まで設定済み。レビュー実行は外部設定であり、利用枠・費用に影響するため別作業とする。

1. 対象リポジトリをCodex cloudへ接続する。
2. [Codex code review settings](https://chatgpt.com/codex/settings/code-review)でCode reviewを有効化する。
3. 全PRに適用する場合はAutomatic reviewsを有効化する。単発確認はPRコメントの `@codex review` を使う。
4. 代表PRで指摘の精度を確認し、ノイズがあれば `AGENTS.md` のレビュー規約を狭める。

APIベースのGitHub Actionを使う場合は、公式の[`openai/codex-action`](https://github.com/openai/codex-action)とGitHub secretの`OPENAI_API_KEY`が必要になる。キー作成、secret登録、費用承認なしには追加しない。

## Platform scope

必須CIはUbuntuで動かす。本番はCloudflare Workersであり、Node側にmacOS / Windows固有のprocess、credential、filesystem分岐がないため、現時点の3 OS matrixは同じコードを重複実行するだけで保護対象がない。

将来OS固有コードを追加するときは、対象OSのworkflowへ「そのOSでのみ実行されるコードパス」をコメントし、プラットフォーム値を引数化した単体テストも追加する。ブラウザ差異はOS matrixではなくPlaywrightのブラウザ回帰で扱う。

## Article recommendation inventory

| Recommendation                     | Result in this repository                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| Agent rules in files               | Existing `AGENTS.md` / scoped rulesを維持し、testing pointerとCode Review Rulesを追加 |
| Size, complexity, strict type lint | Error + file/rule ratchetとして導入                                                   |
| Pure functions and edge-case tests | Scoped testing instructionsとして導入                                                 |
| jscpd / Knip                       | Report-only workflowとして導入                                                        |
| Linux / macOS / Windows CI         | Linuxは既存。macOS / Windowsは保護対象がないため非適用                                |
| Different-model PR review          | Repository rulesは準備済み。Automatic reviewsの外部有効化は未実施                     |
| Human review                       | UI・操作感・仕様・データ境界へ限定してPR templateに明記                               |
