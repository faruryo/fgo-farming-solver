# Design

## Context

`fetchAndTransformData`（`lib/master-data/update.ts`）は、スプレッドシート CSV の3行目（index 2）の5列目以降を素材の略称として読む。略称ごとに `normalizeItemName` で正式名称を引き、Atlas `nice_item` と完全一致で突き合わせる。外れたら `i.name.includes(shortName)` の部分一致に落ち、それでも外れた列は items にも drop_rates にも入らず、黙って捨てられる。

2026-10-11 時点の公開シートと Atlas JP `nice_item` を、現行の `normalizeItemName` に通して照合した結果は次のとおり。

- 周回対象で捨てられているのは `ｶｹﾗ`（6544 煌星のカケラ）と `ｴｰﾃﾙ`（6556 エーテル収光体）の2列だけで、#120 の本番点検と一致する。
- `ｶｹﾗ` が外れるのは、静的テーブルのキーが全角の `カケラ` だから。部分一致も `煌星のカケラ`.includes(`ｶｹﾗ`) が偽になる。
- `ｴｰﾃﾙ` は静的テーブルに無く、部分一致も同じ理由で偽になる。
- ほかに外れる見出し（`剣猛火` `EX1` `肖像1` など）は種火・フォウ・概念礼装の列で、周回対象素材ではない。現状どおり捨ててよい。
- 静的テーブルには半角キー（`ﾗﾝﾀﾝ` `ｵｰﾛﾗ` `ｷｭｰﾌﾞ` `ﾚﾝｽﾞ` `ﾗﾝﾌﾟ` `ｽｶﾗﾍﾞ`）と全角キーが混在している。シートの表記は列ごとに揺れている。

updater の呼び出し元は `scripts/run-updater.ts`（GitHub Actions、2時間ごと）と `scripts/update-data.ts`（ローカルモック再生成）、ベンチ用スクリプトだけで、Workers には載らない。

## Goals / Non-Goals

**Goals:**

- 見出しの全角・半角の揺れで素材列が捨てられないようにする。
- 周回対象素材が items から落ちたら、次の更新ジョブのログで気付けるようにする。

**Non-Goals:**

- 種火・フォウ・概念礼装の列を取り込むこと。
- 欠落を検出したときに KV 書き込みを止めること（Decision 3）。
- 料理作成側の欠落判定や文面を変えること。#120 の (1)(2) は event-craft-data-gap-observability で済んでいる。
- 定期的な本番点検ジョブを作ること。updater 内の警告で足りる。
- `mocks/all.json` を再生成すること。現在のモック（2026-06-12 生成）にもこの2素材は無いが、再生成すると4か月分のシート更新が丸ごと差分に入り、モック依存のテストの期待値も動く。モックの更新は別に行う。

## Decisions

### 1. 略称は NFKC で揃えてから静的テーブルを引く

`normalizeItemName` の入口で `shortName.normalize('NFKC')` を取り、静的テーブルもキーを NFKC にした Map として引く。テーブルの既存キーは書き換えずに残す。これで `ｶｹﾗ` は既存の `カケラ` エントリに当たり、`ﾗﾝﾀﾝ` などの半角キーも従来どおり当たる。静的テーブルにもパターン変換にも当たらないときは、NFKC 後の略称を返す。

`update.ts` の部分一致フォールバックは、生の `shortName` でなく `normalizeItemName` の戻り値で引く。items に保存する `shortName` はシートの生の表記のままにする（短縮IDのレジストリや表示は `shortName` に依存しないが、変える理由も無い）。

- 代替案A: 静的テーブルに `ｶｹﾗ` と `ｴｰﾃﾙ` の半角キーを足すだけ。差分は2行で済むが、シート側が別の列を半角にしたら同じ欠落がまた起きる。テーブルの全角・半角混在も解消しない。
- 代替案B: テーブルの全キーを全角に書き換える。NFKC で引くなら書き換えは不要で、差分が増えるだけ。

NFKC は全角英数字を半角にし、合成済み文字も揃える。見出しのクラス接頭辞（`剣` など）や `+` を含む礼装列は変わらないことを照合で確かめた。

### 2. `エーテル` は静的テーブルに明示する

NFKC 後の `エーテル` は部分一致で `エーテル収光体` に当たる（現 Atlas JP で `エーテル` を含む素材は1件だけ）。それでも部分一致は Atlas の並び順で最初の1件を取るので、同名を含む素材が増えると黙って別素材に結び付く。周回対象の金銀素材は静的テーブルで固定する、という既存の方針に揃える。

### 3. 欠落は warning で出し、書き込みは止めない

`fetchAndTransformData` の末尾で、組み上がった items / quests / drop_rates と取得済みの `aaItems` を `parseCraftAuditInputs` → `auditFarmableCraftGaps` → `formatFarmableCraftAudit` に通す。欠落が1件以上あれば `console.warn` に `::warning title=farmable items missing from drops::` を付けて1行ずつ出す。GitHub Actions はこれを実行サマリの annotation として表示する。判定は #120 の点検スクリプトと同じ関数を使うので、点検と更新ジョブで欠落の定義がずれない。

書き込みを止めない理由: Atlas は新素材を実装と同時に載せるが、シートに列が足されるのは数日から数週間あとになる。その間ずっと書き込みを止めると、ほかの素材やクエストのドロップ率まで古いまま凍る。

- 代替案: `validateMasterData` に入れて書き込みを拒否する。上記の理由で採らない。
- 代替案: Discord などへ通知する。新素材の実装直後は数日間毎回鳴るため、通知疲れのほうが大きい。必要になったら別 change で足す。

`parseCraftAuditInputs` は Atlas の行に未知の `background` などがあると null を返す。そのときは点検をせずに `::warning::` で「点検を実行できなかった」と1行出し、処理は続ける。黙って点検を飛ばすと、この警告自体が効かなくなるため。

### 4. 本番での確認は既存の点検スクリプトを再実行する

マージ後、`update-master-data` の次回実行（main の schedule、または workflow_dispatch）で KV が更新される。そのあと #120 と同じ手順で `wrangler kv key get all_drops_json --remote` を読み取り、`scripts/audit-craft-drop-coverage.ts` にかけて `gaps=0` / exit 0 を確かめ、#120 に結果を書く。

## Risks / Trade-offs

- [新しい2素材が solver の対象に加わる] → 既存素材の短縮IDは id_registry で固定されるので、保存済みの所持数・目標・周回結果の参照は変わらない。新素材には `assignItemId` が新規IDを振る。モック再生成後の `stable-ids` / `regression` テストで既存IDが動かないことを確かめる。
- [NFKC で別の略称同士が同じ文字列に潰れる] → 2026-10-11 の公開シートで、NFKC により表記が変わる見出しは14列（半角カナ素材8列と礼装列6列）。新たな重複は生じない（`凸2` の重複は元のシートにある）。シートが変わったときの衝突は Decision 3 の warning で拾える。
- [新素材の実装直後は毎回 warning が出る] → 意図した挙動。シートに列が足されれば消える。止まらないことがむしろ要件。
- [annotation に気付かない] → 本変更は「気付ける場所を作る」までに留める。ログと #120 の点検手順の両方で確認できる状態にする。

## Migration Plan

1. コード変更とテストを main にマージする。
2. `update-master-data` を workflow_dispatch で1回走らせ、ログに farmable 欠落の warning が出ないことと、KV が書き込まれたことを確かめる。
3. 本番 `all_drops_json` を読み取りで取得し、点検スクリプトで `gaps=0` を確かめ、#120 にコメントして閉じる。

ロールバック: コードを revert して次回の updater 実行を待つ。2素材が items から消えるだけで、既存素材のIDには影響しない。
