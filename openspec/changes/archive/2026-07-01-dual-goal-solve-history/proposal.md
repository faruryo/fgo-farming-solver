## Why

現状の周回ソルバーは、グローバル設定 `stockEnabled` の ON/OFF によって「育成に必要な分(必要数)」か「ストックのバッファーを上乗せした分」の**どちらか一方の目標でしか周回計画を出せない**。ユーザーは「最低限ここまで周回すれば足りる」ラインと「ストックも貯めるならここまで」ラインを並べて比較し、ストック上乗せが何周/何AP増えるのかを一度の計算で把握したい。

## What Changes

- 育成計算機(`goSolver`)からの周回計算で、**目標A(必要分)と目標B(必要分+バッファー)を同時に解いて両方を計算履歴に保存**する。
- 2目標は `farming_results` の **2行**として保存し、新規カラム `batch_id` で連結する(目標A=`stockIncluded=false`/KPIアンカー、目標B=`stockIncluded=true`)。
- ソルバーAPI(`/api/solve`)が A・B の2つの目標個数を受け取り、2行を1リクエストで保存し `batch_id` を含めて返す。
- 目標B = 目標A + `buffer(item)` を **ソルバー入力側で導出**する(URL に B を焼き込まない)。これに伴い `goSolver` は **素の A(必要数−所持)** を渡すよう変更し、現状の「ON 時に buffer を `items=` に焼き込む」挙動を廃止する。**BREAKING**(取り込み導線の内部契約変更、ただし保存結果の見た目は据え置き)。
- 履歴一覧/結果ページで `batch_id` のペアを**1カードに集約**し「必要分 / +ストック(差分 +Δ)」を表示する。
- batch ペアの論理削除は **A/B 連動削除**(batch_id 単位で両方 `deleted_at` をセット)とする。
- `B == A`(バッファーが実効的に増分ゼロ、または `stockEnabled=OFF`)のときは **B行を作らず従来どおり1行**で保存する。
- 進捗KPI/ダッシュボード/スナップショットは従来どおり **目標A(nominal)** をアンカーとし、挙動を変えない。

## Capabilities

### New Capabilities
<!-- なし(既存capabilityの要件変更で表現できる) -->

### Modified Capabilities
- `solver`: 「2目標(必要分/ストック込み)を同時に解く」要件を追加。`周回目標取り込みの余剰ストック追従` を改訂し、`goSolver` は素のAを渡し B はソルバー入力側で `A + buffer(item)` として導出する。
- `farming-history`: `batch_id` による2行連結保存、ペアの集約表示、A/B連動の論理削除、既存行(`batch_id=NULL`)の単独表示後方互換を追加。

## Impact

- **DB**: `migrations/0003_farming_results_batch.sql` — `farming_results` に `batch_id TEXT`(nullable) 追加 + `idx_results_batch`。バックフィル不要(既存行は `batch_id=NULL` のまま単独表示)。
- **API**: `app/api/solve/route.ts`(A/B 2目標受領・2行save・batch_id返却)、`app/api/farming/results/[id]/route.ts`(A/B連動削除・兄弟引き)、`app/api/farming/history/route.ts`(batch_id 返却)。
- **UI**: `components/material/result.tsx`(goSolver を素のA渡しへ)、`components/farming/index.tsx`(submit で A/B 二重目標送信)、`app/farming/history/page.tsx`(ペア集約カード)、`app/farming/results/[id]/page.tsx`(A/Bタブ)。
- **共有純関数**: `lib/quest-efficiency.ts` の `buffer()` をソルバー入力側でも参照。
- **型**: `interfaces/api.ts`(必要に応じ batch 関連の型)。
- **モック**: `mocks/history.json` / `mocks/result.json` にペア確認用データを数件追加(任意・検証用)。
- **既存データ**: 移行不要・無変更。旧 `stockEnabled=ON` 保存行(タイプ2)は単独のまま「ストック込み」badge付きで据え置き。
