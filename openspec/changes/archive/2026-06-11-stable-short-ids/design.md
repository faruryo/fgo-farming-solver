# Design: 短縮IDの世代間安定化

## 背景 / 制約

- 短縮IDの構造的セマンティクスは維持する必要がある:
  - クエストID = `{2文字エリアプレフィックス}{base36 index(1〜2文字)}`
  - Daily はプレフィックスが `'0'` 始まり（`/api/solve` の half-daily-AP 係数 `0:0.5` と UI ツリーの `id[0]` / `id.slice(0,2)` グルーピングが依存）
  - URL 圧縮（`?quests=` のセクション/エリアプレフィックスマッチ）も同形式に依存
- 更新ワーカーは無料プランでサブリクエスト律速 → 新規KV readは追加しない（既存の `readWaveCountSeed` の read を流用）
- 公開ペイロードは top-5/top-100 フィルタ済みの**部分集合**のみ → 前回ペイロードの quests[] だけを記憶源にすると墓標が1世代しか持たず、削除→新規追加でIDが再利用されうる。**ペイロード内 append-only レジストリ**で恒久化する。

## データ構造: `id_registry`（`all_drops_json` に同梱）

```ts
interface QuestIdEntry { id: string; aa?: number }   // aa = aaQuestId（判明している場合）
interface IdRegistry {
  version: 1
  areas: Record<string, string>          // エリア名 -> 2文字プレフィックス
  quests: Record<string, QuestIdEntry>   // "エリア名\tクエスト名" -> entry（append-only）
  items: Record<string, string>          // String(atlasId) -> 短縮アイテムID（append-only）
}
```

- `lib/get-drops.ts` は items/quests/drop_rates/campaigns のみ取り出すため、追加フィールドは既存消費者に不可視（後方互換）。
- サイズ: 数百クエスト × 数十バイト ≒ 数十KB。剪定不要。サイズはログで監視。

## モジュール: `lib/master-data/stable-ids.ts`（新規・純粋関数）

- `registryFromPrevious(previous?)`: 前回ペイロードに `id_registry` があればそれを採用。無い場合（移行初回）は公開済み quests/items から合成し、**現在公開中の全IDをピン留め**する。
- `assignQuestIds(quests, registry): Map<longId, shortId>`
  1. レジストリから `usedPrefixes` / `byAa` / プレフィックス毎の `maxIndex` を構築
  2. エリアプレフィックス解決: レジストリ一致（セクション互換 `prefix[0]==='0'` ⇔ Daily を検証）→ 再利用。不一致→ 未使用最小プレフィックスを新規割当（Daily: `'0'+c`、Free: `'10'..'zz'` で `'0'` 始まりをスキップ）
  3. クエスト毎: `area\tname` キー一致 → なければ `aaQuestId` 一致（リネーム耐性）。**aa フォールバックは一致エントリの旧キーが今世代に現存しない場合のみ発動**（スプレッドシート→Atlas の名前マッチは曖昧で別クエストに同一 aaQuestId が振られることがあり〔実例: アヴァロンのノリッジ/キャメロットが共に aa=3000901〕、無条件だと新規クエストが現存クエストのIDを奪って重複IDを生む）。**`entry.id` が現エリアプレフィックスで始まる場合のみ再利用**（エリア移動/改名クエストが旧プレフィックスを持ち込んでツリーが分裂するのを防ぐガード）。今世代内で割当済みのIDは再利用しない（重複の最終ガード）。不一致→ `prefix + (maxIndex+1).toString(36)` を新規採番（最小空きではなく max+1 = 墓標維持）
  4. レジストリへ追記（aa ベース一致で新キーになった場合は旧キーを無害な墓標として残す）
- `assignItemId(item, itemsForPositional, registry): string`
  - `registry.items[atlasId]` 一致 → 再利用
  - 不一致 → `toApiItemId()` の positional 候補。別 atlasId に登録済みなら同一 intercept 空間の maxIndex+1。`''`（非対象アイテム）はそのまま返す
- 空レジストリでの実行は現行の位置ベース採番と**完全一致**（パリティテストで保証）

## 接続点

1. `lib/master-data/update.ts`
   - `fetchAndTransformData` の opts に `previous?: Pick<MasterData,'quests'|'items'> & { id_registry?: IdRegistry }` を追加
   - アイテムマッピングループの `toApiItemId(...)` → `assignItemId(...)`
   - L503-521 の位置採番ブロック → `const longToShortQuestId = assignQuestIds(quests, registry)`（直後の remap 2行は不変。下流の top-N フィルタ・campaigns の `aaQuestIdToShortId`・`populateWaveCounts` は remap 後のIDで動くため変更不要）
   - 戻り値に `id_registry: registry` を含める
2. `updater-worker/index.ts`
   - `readWaveCountSeed` を `readPreviousMasterData(env)`（前回ペイロード丸ごと parse、失敗時 null）に置換。wave-count seed は純粋ヘルパー `waveCountSeedFrom(previous)` で導出（`lib/master-data/` 側に移してテスト可能に）
   - `fetchAndTransformData` に `previous` を渡す。ログ: `Quest IDs: reused N, new M (registry K entries)`
3. `lib/master-data/validation.ts`
   - クエスト/アイテムID一意・`/^[0-9a-z]{3,}$/`・Dailyプレフィックス形状・`drop_rates[].quest_id` 参照整合を追加（検証失敗→KV書込み拒否→レジストリも進まず単調性維持）
4. `scripts/update-data.ts`: `mocks/all.json` を読めたら `previous` として渡す（初回再生成でコミット済みモックIDをピン留め）。KV と同じ `validateMasterData` ゲートで不正モックの書込みを拒否
5. `lib/get-local-items.ts`: atlasId キーの第二マップでフォールバック解決

## ロールアウト

- 初回本番 cron: 前回ペイロードに `id_registry` 無し → 合成レジストリが公開中297件のIDを全てピン留め。フィルタ外クエストには新インデックスが振られるが非公開のため無害。以後レジストリが世代を超えて持続。
- lib とワーカーは同一リポでバンドルされるため同時にデプロイされる（updater-worker は GitHub Actions、本体は Workers Builds）。

## 既知のトレードオフ

- dev（モック由来）と prod（KV由来）のレジストリは徐々に乖離する。モックの定期リフレッシュで緩和（ドキュメント化のみ）。
- 過去に保存された結果/スナップショットの壊れた参照は修復不能（再発防止のみ）。
- `?quests=` の `includes` による素朴なプレフィックスマッチ（`'204'` がセクション `'2'` 全選択を誘発しうる）は既存問題のまま → follow-up issue。
