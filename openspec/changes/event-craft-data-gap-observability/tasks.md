# Tasks

## 1. 欠落の欠け方を返す

- [x] 1.1 `findMissingCraftData` の戻り値を `{ atlasId, reason: 'absent' | 'unrated' }[]` にする。判定条件は現状のまま、カタログに無いものを `absent`、正のドロップ行が無いものを `unrated` とする。検証: `lib/event-craft-data-check.test.ts` の既存ケースが reason 付きで通り、`absent` と `unrated` を入れ替えると赤くなること。

## 2. 画面に名前と欠け方を出す

- [x] 2.1 `locales/ja.json` と `locales/en.json` に、導入文と欠け方2種（`{{name}}` 補間）のキーを追加する。`EventCraftSection` は欠落ごとに `EnrichedItem.name` を出し、名前が無いときは `ID {{id}}` を出す。配分計算を止める条件は変えない。検証: `EventCraftSection.test.tsx` で、カタログ欠落は素材名と「ドロップ表に無い」、ドロップ行欠落は素材名と「ドロップするクエストが無い」、名前の無い素材は数値 ID が出ること。i18n のテストモックは `{{name}}` を埋めること。

## 3. 欠落を Workers Logs に1回残す

- [x] 3.1 欠落配列の検証（整数 `atlasId`、`reason` は2値、最大40件、未知フィールドは捨てる）と、ログ1行 `{ event: 'craft_data_gap', count, absent, unrated }` の整形を pure 関数にする。`POST /api/event-craft-data-gap` は妥当なときだけ `console.info` し 204 を返し、不正・4KB 超は 400 でログを出さない。4KB 超は超えたチャンク以降を読まない。生ボディはログに出さない。検証: 所持数や識別子を含む入力でも、整形結果に `count` / `absent` / `unrated` 以外が出ないこと、上限超過と不正 reason が拒否されること。条件を緩めるとテストが赤くなること。
- [x] 3.2 `EventCraftSection` は、欠落の組（ソートした `atlasId:reason`）が前回と違うときだけ POST する。再描画では送らない。ドロップ表の取得失敗では送らない。欠落が無いときは送らない。検証: `EventCraftSection.test.tsx` で、欠落表示の再レンダーでは fetch が1回、欠落の組が変わると2回目、取得失敗と欠落なしではこの POST が無いこと。

## 4. 本番ドロップ表の一回点検

- [x] 4.1 `scripts/audit-craft-drop-coverage.ts` を追加する。引数の drops JSON と Atlas 素材 JSON を読み、周回対象（`skillLvUp`・銅銀金・priority 298 以下）の全件を `findMissingCraftData` に渡し、id・名前・reason を stdout に出す。1件でもあれば exit 1、ゼロなら exit 0。Atlas 素材配列が空なら exit 2。KV へは書かない。検証: 穴ありフィクスチャで exit 1 かつ該当行が出ること、穴なしで exit 0 になること、空の Atlas 配列は拒否すること。穴ありを exit 0 にするとテストが赤くなること。
- [x] 4.2 本番 `all_drops_json` を `wrangler kv key get --remote` の読み取りだけで取得し、公開 Atlas `nice_item` と突き合わせてスクリプトを1回実行する。結果（ゼロ、または id・名前・reason の一覧）を PR または issue #120 のコメントに残す。本番 JSON はリポジトリにコミットしない。検証: 実行コマンド、exit code、一覧がコメントに残っていること。

## 5. 全体確認

- [x] 5.1 `pnpm run type-check`、対象テスト、`pnpm run lint:ratchet`、`openspec validate event-craft-data-gap-observability --strict` が通る。
- [x] 5.2 `pnpm dev` で `/events/80614` の料理作成を開く。欠落が無いアカウントでは配分に進み、欠落を模したとき（または点検で穴があった素材を不足に含めたとき）は名前と欠け方が画面に出ること。375px 幅でもエラー文が読めること。
