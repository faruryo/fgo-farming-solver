# Proposal

## Why

#120 の本番点検で、周回対象の金素材「煌星のカケラ」(6544) と銀素材「エーテル収光体」(6556) が `all_drops_json` の items に無いと分かった。スプレッドシートの見出しにはこの2素材の列 `ｶｹﾗ` / `ｴｰﾃﾙ` があり、ドロップ率も載っている。しかし updater の略称変換が半角カナの見出しを Atlas の正式名称に結び付けられず、列ごと捨てていた。そのため、この2素材を必要とするユーザーは料理作成の配分計算で止まり、周回ソルバーでもこの2素材を目標に入れられない。

## What Changes

- 略称を引く前に、見出しの文字幅を NFKC で揃える。静的テーブルのキーも同じ正規化で引くので、既存の半角キー（`ﾗﾝﾀﾝ` など）はそのまま効く。
- 静的テーブルの `エーテル` に `エーテル収光体` を登録する。部分一致フォールバックには頼らない。
- updater は書き込み前に、周回対象（`skillLvUp`・銅銀金・priority 298 以下）の Atlas 素材のうち items に載らなかったものを一覧し、GitHub Actions の warning として出す。KV への書き込みは止めない。
- 修正が本番 cron に乗ったあと、#120 の点検スクリプトを本番 `all_drops_json` に再度かけ、`gaps=0` を確かめる。

## Capabilities

### New Capabilities

なし

### Modified Capabilities

- `master-data`: 「アイテム名のマッピング」に、見出しの全角・半角の違いで変換が外れないことを加える。あわせて、周回対象素材が items に載らなかったときに更新ログで分かる要件を加える。

## Impact

- `lib/master-data/item-naming.ts`（`normalizeItemName` の入力正規化と静的テーブル）
- `lib/master-data/update.ts`（部分一致フォールバックも正規化後の略称で引く）
- `scripts/run-updater.ts`（周回対象の欠落を warning で出す。`lib/event-craft-data-check.ts` の `auditFarmableCraftGaps` を再利用）
- `lib/master-data/update.test.ts`
- 本番データへの効果: 次回の `update-master-data` 実行で items に2素材が加わり、対応する drop_rates も載る。既存素材の短縮IDは id_registry により変わらない。新しい2素材には新しい短縮IDが振られる。
- 周回ソルバーの対象素材が2つ増える。料理作成の欠落判定の条件は変えない。
