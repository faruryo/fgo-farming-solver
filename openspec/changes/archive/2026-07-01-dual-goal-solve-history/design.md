## Context

周回ソルバーは `solve(drops, params)` を線形計画法で解き、`solveBoth` で AP最小・周回数最小の2目的関数を同時に返す。育成計算機(`components/material/result.tsx` の `goSolver`)から `/farming?items=...` で不足分を取り込み、`/farming`(`components/farming/index.tsx`)のフォーム submit で `GET /api/solve` を叩いて `farming_results` に1行保存、`/farming/results/[id]` に着地する。

現状 `stockEnabled` の ON/OFF で、取り込み個数が `max(0, 必要数 + buffer − 所持)`(ストック込み=目標B)か `max(0, 必要数 − 所持)`(必要分=目標A)の**どちらか一方**に切り替わる。ON 時は `goSolver` が buffer を `items=` に焼き込んで渡し、`stockIncluded=1` を付ける。結果として「最低限」と「ストック込み」を同一画面で比較できない。

`buffer(item)` は `lib/quest-efficiency.ts` の純関数で rarity×category から決まり、`/farming` 側も items マスタと `useStockTarget()` を持つため、目標B = 目標A + buffer をソルバー入力側で導出可能である。

`farming_results` は `migrations/0001` で作成、`0002` で `deleted_at`/`quest_selection`(いずれも nullable・NULL=pre-feature)を追加済み。`stockIncluded` は専用カラムではなく `result_data.params.stockIncluded`(JSON)に格納される。

## Goals / Non-Goals

**Goals:**
- 育成計算機からの周回計算で、目標A(必要分)と目標B(必要分+バッファー)を1リクエストで同時に解き、両方を履歴に残す。
- 2目標を `batch_id` で連結した2行として保存し、履歴一覧/結果ページでペア集約・差分表示する。
- 進捗KPI/ダッシュボードのアンカーは目標A(必要分)に固定し、既存の進捗挙動を変えない。
- 既存データ無変更・バックフィル不要の後方互換を維持する。

**Non-Goals:**
- 手入力 `/farming` 単独からの2目標化(入口は `goSolver` 限定)。
- 3目標以上への一般化。
- 旧 `stockEnabled=ON` 保存行(buffer 焼き込み済み)のレトロな2目標ペア化。
- 目的関数(AP最小/周回数最小)の変更(これは既存 `solveBoth` のまま)。

## Decisions

### D1: 履歴モデルは「2行 + batch_id」(M1)

目標A・目標Bを別々の `farming_results` 行として保存し、新規 nullable カラム `batch_id`(UUID)で連結する。

- **なぜ M1 か**: 結果ページ・履歴行・`stockIncluded` badge・進捗スナップショットを**ほぼそのまま再利用**でき、目標A行を素直に進捗KPIのアンカーにできる。後方互換は `batch_id=NULL`=単独で吸収。
- **代替案 M2(1行に `{min,buffer}` 内包)却下**: `result_data` の契約(`BothResult`)が変わり、ダッシュボードの再solveや進捗スナップショットがどちらをKPIにするか分岐を強いられる。
- **代替案 M3(比較テーブル新設)却下**: 連携の作り直しが大きく、得られる価値に見合わない。

### D2: 目標A・Bともに goSolver で算出し URL で両方渡す

`goSolver` は目標A(`items=<max(0, 必要数 − 所持)>`)と、`stockEnabled=ON` のとき目標B(`itemsStock=<effectiveDeficiency = max(0, 必要数 + buffer(item) − 所持)>`)の双方を URL で `/farming` に渡す。`/farming` は受け取った両パラメータを `/api/solve` に転送するだけで、目標Bを再導出しない。

- **なぜ goSolver で算出するか(当初案からの訂正)**: 当初は「/farming で B = A + buffer を導出」する案だったが、これは **stock-only 素材(`必要数 ≤ 所持 < 必要数+buffer`)を取りこぼす**。A は `max(0, 必要数−所持)=0` となり `/farming` に届かないため、A からは B を復元できない。正しい目標Bは `effectiveDeficiency = max(0, 必要数+buffer−所持)` であり、これは 必要数・所持の双方を持つ `goSolver` でしか正確に算出できない。よって B も goSolver で算出して URL 搬送する。
- **trade-off**: `/farming` フォームで個数を手編集しても目標Bは取り込み時のスナップショットのまま追従しない。入口は goSolver 限定(ユーザー決定)であり手編集は副次ケースのため許容する。
- `stockEnabled` トグルの意味は「B の代わりに解く」→「B も一緒に解く」へ再解釈。

### D3: API は1リクエストで A・B 両目標を受領し2行保存

`GET /api/solve` に目標Bの個数(例: `itemsStock=`)を追加。サーバは `batch_id=uuid` を発番し、`solveBoth(A)` → A行(`stockIncluded=false`)、`solveBoth(B)` → B行(`stockIncluded=true`)を挿入、レスポンスに `id`(=A行)と `batchId` を含める。

- `B==A`(増分ゼロ)または目標Bが渡されない場合は `batch_id=NULL` の1行のみ(従来動作)。
- 保存は従来どおり nominal AP(`applyCampaigns: false`)。
- 着地は目標A行(`result.id`)。

### D4: ペア削除は A/B 連動

`batch_id` を持つ行の削除は、`UPDATE farming_results SET deleted_at=... WHERE batch_id=? AND user_id=?` で両行を同時に論理削除する。兄弟引き・一覧は `deleted_at IS NULL` 前提なので片肺状態を起こさない。

### D5: 進捗アンカーは目標A

進捗スナップショット/KPI/ダッシュボードは目標A(`stockIncluded=false`・nominal)を参照(現状の `saveProgressSnapshot` 経路をそのまま使用)。目標Bは比較・上乗せ表示のみで分母に入れない。

## Risks / Trade-offs

- **stock-only 素材の取りこぼし** → 目標Bを `A + buffer` で導出すると `必要数 ≤ 所持 < 必要数+buffer` の素材を落とす。`effectiveDeficiency` として goSolver で算出し `itemsStock=` で搬送して回避(D2)。
- **`/farming` 手編集時の目標B非追従** → 目標Bは取り込み時スナップショット。手編集では追従しない。入口は goSolver 限定のため許容(必要なら手編集検知で単一目標へフォールバックする余地あり)。
- **旧 ON 行をペア化できない** → 素のA(必要数・buffer内訳)を保存していないため復元不可。単独のまま「ストック込み」badge付きで据え置き(誠実な割り切り、実害は過去計算が比較ビューにならないのみ)。
- **計算コスト2倍** → 2目標 × `solveBoth` = 最大4 solve。候補300件で数ms/solve のため許容範囲。`B==A` 早期判定で無駄solveを回避。
- **履歴一覧のペア集約** → 取得済み50行をメモリ上で `batch_id` グルーピング(クエリ追加不要)。結果ページの兄弟引きのみ `idx_results_batch` を使用。
- **モック表示** → ローカルD1フォールバックの `mocks/history.json`/`mocks/result.json` はペア確認用に数件追加が必要(本番データではない)。

## Migration Plan

1. `migrations/0003_farming_results_batch.sql`: `ALTER TABLE farming_results ADD COLUMN batch_id TEXT;` + `CREATE INDEX IF NOT EXISTS idx_results_batch ON farming_results(batch_id);`。SQLite の nullable ADD COLUMN はテーブル再構築を伴わずオンライン適用可。
2. バックフィルなし。既存行は `batch_id=NULL` のまま単独表示(`0002` の `quest_selection` NULL=pre-feature と同じ契約)。
3. ロールバック: 機能フラグ的に `goSolver`/`/api/solve` の2目標経路を戻せば、`batch_id` カラムは残っても無害(NULL のまま単独表示)。カラム削除は不要。

## Open Questions

- 履歴一覧でペアカードのソート順は目標A行の `created_at` 基準でよいか(A/B はほぼ同時刻なので実質差はない想定)。
- 結果ページの A/B 表示は「タブ切替」か「上下並置」か(UX実装時に実機で確認)。
