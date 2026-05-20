## Context

`fgo-data-updater` worker は Cloudflare Workers の Cron Trigger (`0 * * * *`) で起動し、`fetchAndTransformData()` と `fetchDashboardMeta()` を直列に実行している。Observability ログを集計すると、24h で 22 回中約 10 回が `exceededCpu` で失敗していた（成功 run の cpuTime は 1.7s 程度のため、Workers 標準の 30s CPU 上限ではなく subrequest／コールドスタート系の内部上限を踏んでいると推察）。

フロント側 `app/api/dashboard-meta/route.ts` は KV `dashboard_meta` を都度フェッチするだけの薄い API のため、cron が壊れる → KV が壊れる／古いまま、が即座にユーザー表示の欠落につながる。

## Goals / Non-Goals

**Goals:**
- cron 実行の失敗・空応答が **KV のデータを壊さない／空で上書きしない** ことを保証する
- worker の責務を cron 専用に絞り、表面積を最小化する

**Non-Goals:**
- `exceededCpu` の発生自体を抑える（Cloudflare 側の上限が主因のため、頻度や分割で根治しない）
- `nice_war.json` の取得を軽量化する（別 issue で war-map KV キャッシュなどを検討）
- cron スケジュールの変更（毎時 1 本のまま据え置き）
- 手動トリガー用 HTTP エンドポイントの維持（運用負荷とセキュリティ表面のため削除）
- KV のスキーマ変更

## Decisions

### D1: KV 書き込み前のバリデーションをガード層として挟む
`fetchAndTransformData()` と `fetchDashboardMeta()` の戻り値を専用 validator にかけ、欠損が疑われるレスポンスでは `KV.put` をスキップして既存値を温存する。

判定ルール:
- `MasterData`: `items` / `quests` / `drop_rates` のいずれかが空 → 拒否
- `DashboardMeta`: `events` と `gachas` が **両方とも** 空 → 拒否（FGO で両方ゼロは現実的にありえない）

代替案: 既存 KV を都度読み出して差分比較（例: 「ガチャ数が前回比 -80% なら拒否」）。却下 — 1 取得 ＋ 比較ロジックの維持コストに対して、拒否したい異常パターンが「空配列」に集中しているためコスパが悪い。将来必要になったら拡張する。

代替案: スキーマバリデーション（zod など）で型を完全検証。却下 — スコープが膨らむわりに今回の問題（空応答）は単純な長さチェックで十分。

### D2: `validation.ts` は `lib/master-data/` 配下に置く
updater-worker と将来の他コンシューマ（例: `scripts/update-data.ts`）で同じガードを使えるようにする。テストも既存の vitest 環境にそのまま乗る。

### D3: cron スケジュールは変更しない
分割案も検討したが、`exceededCpu` の per-run 確率は実行頻度に依存しない（むしろランタイム内部の subrequest／コールドスタート系の問題）。頻度を下げても毎回同じ確率で失敗するので、根本対策にならず単にデータが古くなる時間が伸びるだけ。

KV 保護層が入った後は、毎時 run が半数失敗してもデータが空で上書きされないため、現状のスケジュールで十分。

### D4: 手動 HTTP エンドポイントを廃止
従来 `/update` を介して手動更新できるようにしていたが、以下の理由で削除する:
- 認証なしのまま放置すると Atlas Academy への DoS ベクタになる
- 認証を付けるとシークレット管理（`wrangler secret put` / GitHub Secrets）の運用負荷が乗る
- 緊急時は Cloudflare ダッシュボードの Worker → Triggers → "Trigger Cron" ボタンから同等の発火ができる

→ worker は `scheduled` ハンドラのみを export する。

### D5: `updateMasterData` を 2 関数に分離
従来の `updateMasterData` は drops と dashboard meta を直列で実行し try/catch も外側にあったため、drops 側で throw すると dashboard meta が走らなかった。これを `updateDrops` / `updateDashboardMeta` の独立関数に分離し、片方の失敗が他方を巻き込まないようにする。

### D6: spec は `master-data` capability に集約
新 capability は作らず、既存 `master-data/spec.md` に「失敗・空応答時の KV 保護」要件を ADDED で足す。既存の「定期的なデータ更新」「campaigns の cron 周期と整合」は変更しない。

## Risks / Trade-offs

- **[Risk] バリデーションが緩すぎて異常データを通す** → Mitigation: 単純な長さチェックだが、観測された異常パターン（全配列ゼロ）はすべて拒否できる。将来別パターンが出たら validator を拡張
- **[Risk] バリデーションが厳しすぎて正常データを拒否し続け、KV が永遠に古い** → Mitigation: FGO は常時 1 件以上のイベント／ガチャがある前提のため、両方ゼロは事実上発生しない。万一発生してもログが残るので運用者が気づける
- **[Trade-off] HTTP エンドポイント廃止で curl からの即時更新ができなくなる** → CF ダッシュボードの "Trigger Cron" で代替可能。運用上の不便は最小
- **[Trade-off] `exceededCpu` 自体は減らない** → 表示への影響は KV 保護で吸収できるが、Worker 実行回数の課金やログの賑やかさは現状維持。気になるなら別 issue で war-map キャッシュなどを追求

## Migration Plan

1. PR をマージし、GitHub Actions の `deploy-updater` ジョブで新 worker をデプロイ
2. Cloudflare ダッシュボードで `fgo-data-updater` の URL に `GET` してみて 404 になることを確認（HTTP エンドポイント廃止確認）
3. その後 Observability で空応答時のスキップログ（"Refusing to overwrite ..."）が観測されたら、validator が機能していることを確認

ロールバック: `git revert` でこの PR を戻し、worker を再デプロイ。KV のデータ構造は変えていないので互換性問題なし。
