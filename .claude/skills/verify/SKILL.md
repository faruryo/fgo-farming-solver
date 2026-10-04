---
name: verify
description: fgo-farming-solver の変更を、dev server を自分で起動してブラウザ実画面で確かめる手順。UI（app/**, components/**）や /api の変更を実機で検証するときに使う。
---

# fgo-farming-solver の実機検証

ルールの正本は `.agents/rules/ui-conventions.instructions.md` の「UI動作確認」と AGENTS.md の UI Verification。ここには実際に通った手順と罠だけを書く。

## 起動

1. worktree なら `pnpm install --frozen-lockfile`（node_modules が無い）と、本体の `.env.local` へのシンボリックリンク `ln -s ~/fgo-farming-solver/.env.local .env.local`（gitignore 済み、コミットしない）。
2. 3000/3001 以外の空きポートを選ぶ: `lsof -nP -iTCP:3187 -sTCP:LISTEN`（何も出なければ空き）。
3. `pnpm dev -p 3187 > <tmp>/dev.log 2>&1` をバックグラウンドで起動し、ログの `Ready in` を待つ。
4. 配信元の確認: `lsof -nP -iTCP:3187 -sTCP:LISTEN -t` で待受 PID → `lsof -a -p <PID> -d cwd` が自分の作業ツリーか。
   - worktree では Next.js が「multiple lockfiles … selected ~/fgo-farming-solver as the root」と警告するが、cwd が worktree なら worktree のコードが配信される。
   - 補助確認: `curl -s http://localhost:3187/api/dashboard-meta` が作業ツリーの `mocks/dashboard.json` の内容を返すか。

## データ

- dev では Cloudflare KV が空なので、`lib/data-source.ts` が `mocks/*.json` にフォールバックする（dashboard meta は `mocks/dashboard.json`）。
- 開催中イベント・キャンペーンに依存する表示は、mock の期間が過ぎていると何も出ない。検証用に mock へ終了日の遠いエントリを足して確かめ、**その mock 変更はコミットしない**。
- 素材カタログ（`/api/material-catalog`、`/material` のサーヴァント一覧・イベント特攻/絆ボーナス）は mock ではなく、dev でも Atlas の最新データから組み立てられる（`.next/cache/atlasacademy` は Atlas `/info` のハッシュで無効化される）。開催中イベントの対象はそのまま実データで確かめられる。

## 操作（ブラウザ）

- chrome-devtools MCP（`new_page` に `isolatedContext` を付ける → `take_snapshot` で uid → `click` / `fill` / `hover`、値は `evaluate_script` で読む）が通った。
- `take_snapshot` / `take_screenshot` の `filePath` は MCP の workspace root 内しか書けない。作業ツリー内の一時ディレクトリに出し、終わったら作業ツリーの外へ移す。
- `/material` はカタログ読み込みに数秒かかる。`.c-servant-grid` が出るまで待ってから数える。
- `emulate` で viewport を変えるとページが再読み込みされ、画面内 state はリセットされる。

## 観点

- 375px 幅（`emulate` viewport `375x812x2,mobile,touch`）で横スクロールが出ないこと（`document.documentElement.scrollWidth === 375`）。
- ホバー UI は `hover` 後に computed style を読む。
- localStorage: 永続させる変更はリロード後の保持を、永続させない変更は操作前後で `localStorage` が変わらないことを確かめる。実データのバックアップが要るときは JS 変数でなく別 key に退避する（ページ遷移で変数は消える）。

## 片付け

自分が起動した dev server だけを止め、`lsof -nP -iTCP:3187 -sTCP:LISTEN` が何も返さないことを確かめる。ユーザーが起動した server には触らない。
