# Tasks

## 1. 型とコンパクト化

- [ ] 1.1 `lib/master-data/types.ts` の `EventPlannerEvent` に、任意のフィールド `pointRewards`・`missions`・`pointItemId` と、報酬の型（種類・objectId・個数・名前・アイコン）を design の決定 2 のとおり足す。KV を読むところ（`EventPlannerEvent` を使う箇所）で、無いときに空として扱えることを確かめ、型の都合で必要なら `?? []` を足す
- [ ] 1.2 `lib/refresh-event-data-compact.ts` の `ItemMap` に品目の種類（Atlas の `type`）を足し、`compactPointRewards`（累計ポイントの昇順、報酬のアイテムに名前とアイコン）、`compactMissions`（`dispNo` の順、表示名・報酬・`conds` の `condType`・`targetIds`・`targetNum`）、`findPointItemId`（周回クエストのドロップのうち種類が `eventPoint` の品目）を純粋関数として足す。80627 の `rewards` と 80632 の `missions` から切り出した小さな fixture（数件ずつ）で、並び順・報酬の種類の区別・名前とアイコン・条件の要点・ポイントの品目が無いときを `lib/refresh-event-data-compact.test.ts` でテストする

## 2. スクリプト

- [ ] 2.1 `scripts/refresh-event-data.ts` の `fetchItemMap` で品目の種類も持ち、取り込むイベントごとに 1.2 の関数でポイント報酬・ミッション・ポイントの品目を作って保存する。取り込みの条件（`decideEventImport`）は変えない。ポイント報酬とミッションの整形は try で囲み、失敗したらそのフィールドを空にしてイベントの取り込みを続け、理由をログに出す。`AtlasEvent` の型と `validateAtlasEvent` に `rewards`・`missions` を任意として足す（無くても既存のイベントを捨てない）
- [ ] 2.2 `mocks/events.json` の既存のイベントの1つに、ポイント報酬とミッションの例を数件ずつ足し、`lib/refresh-event-data-merge.test.ts` などの既存テストが通ることと、旧データ（フィールドの無いエントリー）を読むテストを足す

## 3. 品質ゲート

- [ ] 3.1 `pnpm test --run`、`pnpm run lint:ratchet`、`pnpm run type-check` が通ることを確かめる <!-- verify-only -->

## 4. 実データでの確認

- [ ] 4.1 手元で `pnpm exec tsx scripts/refresh-event-data.ts <scratch>/event_data.json`（既存の KV を渡さず、出力は worktree の外の一時ファイル。本番の KV には書かない）を実行し、出力の 80627 にポイント報酬が180件・ポイントの品目 94160904、80632 にミッションが100件入っていること、交換所・ロト・周回クエストの件数が実行前の main の出力と変わらないこと、整形後のイベントあたりのサイズを確かめ、結果を実装 PR に載せる <!-- verify-only -->
