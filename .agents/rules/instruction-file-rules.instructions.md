---
paths:
  - .agents/rules/**/*.md
  - .claude/rules/**/*.md
  - .github/instructions/**/*.md
applyTo: ".agents/rules/**/*.md,.claude/rules/**/*.md,.github/instructions/**/*.md"
---

# Instructions ファイル作成ルール

このディレクトリのファイルは Claude Code・GitHub Copilot・Antigravity（Gemini）の複数エージェントに適用されるハイブリッド形式で書くこと。

| エージェント | 読み取り方法 | フロントマターキー |
|---|---|---|
| Claude Code | `paths` glob でマッチしたファイルに自動適用 | `paths` |
| GitHub Copilot | `.github/instructions/` シンボリックリンク経由で `applyTo` を参照 | `applyTo` |
| Antigravity / Gemini | `.agents/rules/` を直接参照（`GEMINI.md` 経由）。フロントマターは無視 | なし |

## ファイル命名


ファイル名は必ず `.instructions.md` で終わること
配置場所: `.agents/rules/NAME.instructions.md`（`.github/instructions/` と `.claude/rules/` はシンボリックリンク）
`NAME` はルールの対象や目的を表す kebab-case にすること（例: `postgresql-repository`, `api-handler`）


## フロントマター形式

```yaml
---
paths:

path/to/target/**/*.go   # Claude Code 用（YAML リスト形式）
applyTo: "path/to/target/**/*.go"   # GitHub Copilot 用（クォートされた文字列形式）
---
```

### 必須キー

| キー | 対応ツール | 形式 |
|------|-----------|------|
| `paths` | Claude Code | YAML リスト（`- glob` の箇条書き） |
| `applyTo` | GitHub Copilot | クォートされた文字列（複数の場合はカンマ区切り） |

### 複数パスの書き方

```yaml
---
paths:

internal/foo/**/*.go
internal/bar/**/*.go
applyTo: "internal/foo/**/*.go,internal/bar/**/*.go"
---
```

### glob パターン例


`**/*.go` — すべての Go ファイル（再帰）
`internal/gateway/**/*.go` — gateway 配下すべての Go ファイル
`**/*.go,**/*_test.go` — 複数パターン（Copilot のカンマ区切り例）


## ルール本文の書き方


見出し・箇条書きで構造化すること
禁止事項には **BLOCKER**、推奨には **WARNING** などの強度を明示すること
コード例を含める場合は正しい例・誤った例の両方を示すと効果的