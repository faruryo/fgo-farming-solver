# Design

## Context

欠落判定は `lib/event-craft-data-check.ts` の `findMissingCraftData` にあり、戻り値は atlasId の配列だけである。`EventCraftSection` は長さが 1 以上なら `fullNeed` を作らず、固定文 `event-craft-data-missing` を出す。判定はブラウザ内で完結するため、Workers Logs には残らない。Workers Logs の保持は約7日（`analytics_guide.md`）。

欠け方は実装上すでに2分岐している。

- カタログに無い（周回対象、または Atlas にも無く分類できない）
- カタログにあるが、`drop_rate > 0` かつ既知クエストの行が無い（周回対象は常に、それ以外は同カテゴリの他素材に行があるときだけ）

素材名は `EnrichedItem.name`（表示ロケールの Atlas 名）にある。

## Goals / Non-Goals

**Goals:**

- 画面のエラーに、欠けた素材の名前（無ければ ID）と欠け方を出す。
- 同じ内容を、集計しやすい1行の構造化ログとして Workers Logs に残す。
- 周回対象素材の全件について、本番ドロップ表との突き合わせを読み取り専用で1回実行できるようにする。

**Non-Goals:**

- 欠落時に配分計算を続行すること。止め方は変えない。
- D1、Analytics Engine、Logpush の追加。
- 突き合わせの定期ジョブ、KV への書き込み、欠落の自動修復。
- 所持数・必要数・ユーザー識別子の記録。

## Decisions

### 1. 欠落は `{ atlasId, reason }` で返す

`reason` は `absent`（表に素材が無い）と `unrated`（ドロップ行が無い）の2値。画面の文言とログの分類は、この戻り値だけを見る。判定条件は現状のまま移す。

別案: 画面側で drops を再走査して欠け方を決める。判定が二重になり、ログと表示がずれうるので採らない。

### 2. ログは専用 API の `console.info` 1行

検出はクライアントでしか起きない。`POST /api/event-craft-data-gap` が検証済みの欠落だけを次の1行で出す。

```json
{"event":"craft_data_gap","count":2,"absent":[6518],"unrated":[6517]}
```

Workers Logs は `$workers.event.request.path` がこのパスの行、またはメッセージの `craft_data_gap` で集計する。保持7日は、デプロイ後に「今止まっているか」を見る目的には足りる。永続化は issue の完了条件に無い。

クライアントは、ソートした `atlasId:reason` の署名が前回と違うときだけ送る。再描画では送らない。

リクエストは `gaps` 配列だけを受け取る。未知フィールドは捨て、生ボディはログに出さない。`atlasId` は整数、`reason` は2値、件数上限は40、ボディ上限は4KB。外れたら 400 で、ログは出さない。認証は付けない。料理作成は未ログインでも使え、止まった事実の大半は anonymous 側に出る。

別案: Analytics Engine。保持は長いが binding が増え、今回の「ログから集計」を超える。別案: D1。本番データ保護の対象になり、所持に近い情報を置く動機が残る。

### 3. 突き合わせは読み取り専用スクリプトの一回実行

`scripts/audit-craft-drop-coverage.ts` は、ローカルの drops JSON と Atlas 素材 JSON を読み、周回対象（`skillLvUp`・銅銀金・priority 298 以下）の全件を `findMissingCraftData` に渡す。stdout に id・名前・reason を出し、1件でもあれば exit 1。

本番の確認は `wrangler kv key get all_drops_json --remote` の読み取りと、公開の Atlas `nice_item` で行う。KV へは書かない。cron worker には置かない（CPU 10ms 制約）。結果の一覧は PR または issue コメントに残し、リポジトリへ本番 JSON をコミットしない。

別案: マスタ更新ワークフローへ常設する。穴の有無を継続監視できるが、今回の完了条件は一回の一覧で足りる。

### 4. 文言は素材ごとに i18n

導入文に加え、素材ごとに次のどちらかを出す。

- `{{name}}はドロップ表にありません`
- `{{name}}はドロップ表にありますが、ドロップするクエストがありません`

名前が無いときは `ID {{id}}` を `name` に入れる。キーは `locales/ja.json` と `locales/en.json` の両方に置く。

## Risks / Trade-offs

- [未認証 POST でログを水増しできる] → 件数・サイズ上限、未知フィールド非記録、クライアントの署名単位送信。認証を足すと未ログインの欠落が見えなくなる。
- [Workers Logs は約7日で消える] → デプロイ直後の確認に使う。長期保存は Non-Goal。
- [突き合わせが一回きりだと、その後のマスタ更新で穴が戻りうる] → 画面とログが継続して検知する。スクリプトは同じコマンドで再実行できる。
- [名前は表示ロケールの Atlas 名] → ログは ID のみなので、ロケールが違っても集計キーは揃う。

## Migration Plan

挙動追加のみ。既存の計算停止は維持する。API を戻す場合はクライアントの POST が 404 になるが、画面の欠落表示は残る。ログだけ止まる。

## Open Questions

なし
