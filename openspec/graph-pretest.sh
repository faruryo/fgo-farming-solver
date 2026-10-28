#!/usr/bin/env bash
# ops-graph が Baseline Gate・Worker の worktree 用意後・fan-in 後のテストの前に worktree の root で流す準備。
# 新しい worktree の .wrangler/ にはローカル D1 が無く、D1 を使うテストが落ちるため、CI（deploy.yml）と同じくマイグレーションを当てる。
# --local だけを使い、本番の D1 には触れない。
set -euo pipefail

pnpm exec wrangler d1 migrations apply fgo-farming-solver-db --local < /dev/null
