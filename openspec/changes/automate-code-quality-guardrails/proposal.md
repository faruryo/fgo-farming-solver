## Why

AI が生成する変更量に対して、人間の diff レビューだけでは品質確認が追いつかない。既に TypeScript、テスト、Linux CI、秘密情報スキャンはあるが、複雑度・型の逃げ道・重複・デッドコード・レビュー判断の機械化に空白があり、既存負債を増やさず段階的に解消する仕組みが必要である。

## What Changes

- ESLint に関数サイズ、複雑度、型安全、SonarJS、セキュリティのルールを追加する。
- 既存違反はファイル・ルール単位のベースラインとして記録し、新しい違反だけを CI で拒否する。負債がゼロになったルールは通常の error ゲートへ昇格する。
- インラインの `eslint-disable` を廃止し、正当な例外は理由付きの設定ファイル allowlist に集約する。
- pure 関数、境界での依存注入、エッジケース表、テストが実際に失敗することの確認を、エージェントが必要時に読む永続ルールとして追加する。
- jscpd と Knip を report-only で定期・PR実行し、重複とデッドコードの全体在庫を成果物として残す。
- `AGENTS.md` にリポジトリ固有の Codex Code Review Rules を追加し、PR テンプレートで機械レビューの指摘分類と人間が見るべき UI・仕様判断を分離する。
- Codex Automatic reviews の外部設定は、リポジトリ側の規約整備と分離する。API キーや有料利用を無断で有効化するワークフローは追加しない。
- macOS / Windows CI は追加しない。本アプリの本番ランタイムは Linux 上の Cloudflare Workers であり、OS 固有コードパスがないため、3 OS 化しても追加で守る挙動を説明できない。

## Capabilities

### New Capabilities

- `automated-quality-guardrails`: 静的解析のratchet、report-only監査、テスト設計規約、AIレビュー規約とCI上の品質境界を定義する。

### Modified Capabilities

なし。

## Impact

- `eslint.config.mjs`、`.prettierrc`、`package.json`、`pnpm-lock.yaml`、品質ベースラインと検査スクリプト
- `.github/workflows/` と PR テンプレート
- `AGENTS.md`、`.agents/rules/`、品質運用ドキュメント
- OpenSpec の新規 `automated-quality-guardrails` capability
- 開発依存として公式の `eslint-plugin-sonarjs`、`eslint-plugin-security`、`jscpd`、`knip` を追加
