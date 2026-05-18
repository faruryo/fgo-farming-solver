## Context

`openspec/specs/solver/spec.md` には「AP 半減キャンペーンの適用」が要件として書かれているが、`lib/solver.ts` には実装が存在しない（quest.ap をそのまま使用）。一方で `progress-visualizer` 仕様は `total_ap` を期間比較の KPI として扱う前提で組まれており、もしソルバーが直接 quest.ap を半減してしまうと、キャンペーン期と非キャンペーン期で同じ目標規模の `total_ap` が大きく揺れて KPI 比較が破綻する。

ユーザーの第一価値はトップページ（達成間近の素材 / 周回予定クエスト）にキャンペーンが反映されることであり、Atlas Academy `nice_event.json` で機械的に取得可能なことも実証済み。今回はこのユーザーストーリーに焦点を絞り、データ取得経路・ソルバー API・ダッシュボード表示・キャッシュ層の方針を設計レベルで確定させる。

調査で確認した主要事実：

- Atlas API `NiceEvent.campaigns[]` に `target: 'questAp'` のキャンペーン情報があり、`calcType + value` で AP 修正子を表現する（実例: `multiplication value=500` → ×0.5）。
- 対象クエストは `NiceEvent.campaignQuests[]` で列挙される（`questId`, `phase`, `isExcepted`）。`warIds` 指定で広域に当てるパターンもある。
- Atlas の `NiceQuest.consume` / `MstQuest.actConsume` はキャンペーン未適用の原価 AP（複数キャンペーン対象クエストで実測確認済）。修正子は呼び出し側で適用する必要がある。
- 既に `Quest.aaQuestId` が短縮 quest ID と Atlas quest ID のブリッジとして全クエストに保持されている。
- 実データ規模（297 quests / 1954 drop_rates）でソルバー実行時間は最悪 ~22ms（M1, ap-min 60 items）。JSON.parse(220KB) は 0.5ms 未満で誤差。
- `progress-visualizer` の `deltaAp` 計算はアイテム個数差分ベース（`pastTargetSum - currentTargetSum`）で、`total_ap` には直接依存しない。`current.totalAp` は `targetApIncrease` の参照に使われる程度。

## Goals / Non-Goals

**Goals:**
- トップページの「達成間近の素材」「周回予定クエスト」が、開催中の AP 半減キャンペーンを反映した周回数・ランキング・AP 表示を行う。
- ユーザーが計算ボタンを押した後にキャンペーンが開始されても、ダッシュボードを開けば反映されている。
- 計算履歴 (`farming_results`) や snapshot に保存される `total_ap` の意味が、キャンペーン状況に左右されない（nominal AP を保存）。
- キャンペーン反映の遅延上限（最大 ~30 分）を明示的に設計に組み込み、ユーザーに開示する。
- ソルバーの性能リグレッションを検知できるベンチマークを残す。

**Non-Goals:**
- `progress-visualizer` の KPI 厳密化（nominal/effective の完全分離）：今回スコープ外。`progress-visualizer` 側は item-count 差分が主指標なので、ソルバー出力経路を nominal に固定するだけで現状以上に大きく崩れることはない。厳密版は別 change で扱う。
- `rarity-ap-table` のキャンペーン非依存性の保証：マスターデータ更新時に再生成され、キャンペーン期と非キャンペーン期で多少の値ぶれが生じうるが、本 change では明示的に既知の許容差として扱う。
- 結果ページ (`/farming/result`) の AP 表示変更：ダッシュボード優先。結果ページは別 change で段階的に。
- Atlas 側のキャンペーン更新ラグへの対応：マスターデータ更新 cron の頻度問題であり、本 change の範囲外。

## Decisions

### Decision 1: ソルバーに `applyCampaigns` オプションを追加（呼び分け方式）

`solve(drops, params, options)` の `options.applyCampaigns: boolean` で、原価 AP（false, デフォルト）と実効 AP（true）を切り替える。両方の AP を一度に返す方式（複合出力）ではなく、明確に呼び分ける。

**Rationale:**
- 既存呼び出し箇所（`app/api/solve/route.ts` で履歴・snapshot 用）は `false` を明示して書き換えればよく、振る舞いを変えない。
- ダッシュボード側だけが `true` で再計算するパスを追加するため、変更が局所化される。
- 同じソルバー結果に "2 種類の AP" を同居させると下流での取捨選択ロジックが複雑になり、漏れの原因になる。
- ソルバーは数 ms 〜十数 ms なので、必要なときに 2 回呼んでもコストは無視できる（実測ベース）。

**Alternatives considered:**
- (Y) 1 回の `solve` で effective / nominal の両方を返す: 計算 1 回で済むが、最適化目的関数（特に objective='ap'）の選好が変わる以上、片方は近似値になり整合性が悪い。
- 履歴保存時のみ最初から effective AP で計算して保存する: KPI が安定しない。本提案の主目的に反する。

### Decision 2: ダッシュボードはクライアント側で毎回再計算する

トップページの該当 2 コンポーネントは、保存済み結果ではなく `solve(currentDrops, recentResult.params, { applyCampaigns: true })` をクライアント側 useMemo で実行した結果を表示する。

**Rationale:**
- 保存済み結果はソルバー実行時点のスナップショットなので、その後に開始されたキャンペーンを反映できない。
- ソルバーが client-side で javascript-lp-solver を使う方針（既存）と整合する。
- 計算履歴 (`/farming/history`) は逆に「保存時の事実」を見せたいので、保存値（nominal）を素のまま表示する責務分担になる。

**Alternatives considered:**
- サーバー側で再計算してエンドポイントを追加: 二重実装になる。Cloudflare Workers の CPU 時間を消費する利点が薄い。
- 保存済み結果を後から書き換える（campaign 発火時に再計算して上書き）: 履歴の不変性を壊す。

### Decision 3: 3 層キャッシュ構成

| Layer | 対象 | TTL / 粒度 | 失効条件 |
|-------|------|-----------|----------|
| L1 HTTP | `/api/drops` レスポンス | `max-age=300, stale-while-revalidate=3600` | master-data 更新 cron 完了後 ~5 分以内に edge が新版に切り替わる |
| L2 Module | クライアントの drops bundle | セッション内永続 | ページリロード |
| L3 Solver result | `solve()` 出力 | 再計算は drops / params / `activeCampaignDigest` の変化時のみ | 30 分バケットで `activeCampaignDigest` を再評価 |

`activeCampaignDigest = hash(nowBucketed30min での active campaign ID 群)`。これで campaign の開始 / 終了境界をまたいだ瞬間に自然に再計算が走る。最大遅延は L1 (~5 分) + L3 (~30 分) = 約 ~35 分、平均 ~17.5 分。

**Rationale:**
- L1 を `force-dynamic` のままにすると毎回 KV 読みになる（今もそうなっている）。これは無駄。
- 一方で TTL=1h にすると最悪 1 時間ラグ。SWR が両者の中間で挙動上もシンプル。
- 体感秒単位精度（`setTimeout` で次の境界まで待つ）は実装複雑度に対して価値が低い。ユーザーストーリー上 30 分ラグは許容、と確認済み。

**Alternatives considered:**
- cron からの明示的な cache purge: 実装は可能だが、cron worker が edge cache API に到達する経路を別途整える必要があり過剰。
- ETag + If-None-Match: revalidate のたびに origin に当たるので L1 のメリットが薄れる。

### Decision 4: キャンペーン情報は drops バンドルに「全期間分」を同梱する

KV `all_drops_json` に `campaigns: { id, calcType, value, validFrom, validTo, questIds }[]` として、現在開催中だけでなく未来分（取得済みの範囲）も含める。

**Rationale:**
- L1 キャッシュが 1 時間スケールで存在しても、クライアントが時刻フィルタすればキャンペーンの開始 / 終了境界に追従できる。
- master-data 更新の頻度を上げなくても、未来分が既に降ってきていれば境界跨ぎは正しく扱える。
- ペイロード増加は限定的（同時開催数 + 近未来分で数十エントリ程度）。

**Alternatives considered:**
- 「現在開催中の campaign」だけを返す: cron 周期内に開始する campaign を取り逃す。
- 別エンドポイント `/api/campaigns` を切る: drops と同期せず競合状態を作りやすい。

### Decision 5: キャンペーン → quest ID マッピングは master-data updater で確定する

`nice_event.json` の `campaignQuests[].questId`（Atlas ID）を、updater 内で `aaQuestId → 短縮 quest ID` のマップに変換し、最終バンドルでは短縮 quest ID を使う。クライアントは Atlas ID を知る必要がない。

**Rationale:**
- ソルバーは短縮 ID で動いており、クライアントで毎回 ID 変換するのは無駄。
- updater が一度だけ変換すればよい。
- ペイロードが小さくなる（短縮 ID は数文字、Atlas ID は 7-8 桁）。

### Decision 6: campaign の AP 修正子は「`calcType: multiplication, value: 500` → ×0.5 (= value/1000)」と解釈する

実装上は `effectiveAp = Math.max(0, Math.round(originalAp * value / 1000))`（multiplication）または `effectiveAp = value`（fixedValue）。`addition` / `none` は本 change では未使用扱い（出現したらログのみ）。

**Rationale:**
- 実データの「消費 AP 50%DOWN」が `multiplication value=500`、「消費 AP 0」が `fixedValue value=0` と確認できた。
- `value/1000` スケールは Atlas 内の他フィールドでも一般的（drop rate 等）。
- 未知の `calcType` 出現時に過剰反応せず、original AP にフォールバックすることで安全側に倒す。

**Open question (verification needed):**
- value の意味が「乗算後の AP 比率」か「割引率」か（500 が ×0.5 か ×(1-0.5) か）。半減ケースは結果同じだが、中間値（例: value=300）で挙動が変わるため実装時にテストデータで確定する。

### Decision 7: ベンチマークテストは継続実行する

`lib/solver-perf.test.ts` を残し、`solve()` の典型ケースに対して上限閾値（例: 60 items で 100ms）を assertion として持たせる。

**Rationale:**
- ユーザーから「再計算を入れて大丈夫か」の懸念があり、現状の性能特性が将来劣化していないことを CI で担保する。
- 実機（モバイル）での体感は M1 値の 2-4 倍想定。CI 環境のばらつきを考慮し、閾値は M1 計測値の 5 倍程度に置く（厳しすぎるとフレーキーになる）。

## Risks / Trade-offs

- **[Risk]** Atlas Academy 側のキャンペーン情報反映ラグ（数時間〜半日）
  → Mitigation: master-data 更新を毎時 cron で実行する既存運用に追従。本仕様では「最大 30 分の表示遅延」をユーザーに開示する文言を入れ、Atlas 側のラグまでは保証外と明記。

- **[Risk]** value の意味スケール（×0.5 か ×(1-0.5) か）の未確定
  → Mitigation: 実装フェーズで `value=500` 以外の中間値が現役で運用されている実例を Atlas 過去データから探し、ユニットテストで確定。確定までは「半減」「無料」のみサポートでローンチも可。

- **[Risk]** `progress-visualizer` の `current.totalAp` が effective AP で渡された場合、`targetApIncrease` 比較が若干歪む
  → Mitigation: ダッシュボードと違い、`ProgressReportPanel` 経路は計算実行直後の result から `total_ap` を取っており、今回の Decision 1 で `applyCampaigns: false` 固定にすれば nominal で流れる。ここを明示的にテストする。

- **[Trade-off]** 反映遅延 ~30 分: ユーザー認知の優先度より実装複雑度を重視。境界時刻を予測して setTimeout する精密版は不採用。

- **[Trade-off]** drops bundle のサイズ増加（campaigns 同梱）: 数 KB 程度の増加見込み。L1 / L2 キャッシュ込みで体感影響は小。

- **[Risk]** L1 SWR で初回リクエスト（cold edge）がやや遅い場合がある
  → Mitigation: stale-while-revalidate なので 2 回目以降は瞬時。cold は ~100-400ms で、本機能の許容範囲内。

## Migration Plan

1. master-data updater に campaign 抽出を追加（drops バンドル形状が後方互換的に拡張される。古いクライアントは `campaigns` フィールドを無視できる）。
2. ソルバー API に `options.applyCampaigns` を追加。デフォルト false。既存呼び出しは振る舞い不変。
3. ダッシュボード側で再計算フックを導入し、トップページ 2 コンポーネントを切り替える。
4. キャッシュ層を順次有効化：L2 (module cache) → L1 (Cache-Control) → L3 (useMemo deps)。
5. ベンチマークテストを CI で実行する設定にする。

ロールバック: ダッシュボード側の再計算フックを `useRecentResult` 直読みに戻すだけで完全に元に戻せる。データパイプライン側の `campaigns` フィールド追加は無害（参照しなければ無視されるだけ）。

## Open Questions

- Decision 6 の value スケール（×0.5 か ×(1-0.5) か）の最終確認方法（実装フェーズで Atlas 過去データの中間値ケースを当たる）
- L1 の SWR を OpenNext on Cloudflare Workers でどう設定するか（Cache-Control ヘッダ直書きでよいか / `revalidate` exports で十分か）。実装時に確認。
- ダッシュボードに置く「反映遅延の開示」の最終文言・配置（ツールチップ / フッター / ヘルプの 3 案）はデザインレビューで詰める。
