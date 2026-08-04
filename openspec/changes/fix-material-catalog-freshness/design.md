## Context

現在の `/material` は `revalidate = 1800` を宣言しているが、OpenNext の `staticAssetsIncrementalCache` は読み取り専用であるため、ビルド時に prerender されたデータが次回デプロイまで更新されない。`/material/[className]` は `generateStaticParams` を持たず、キャッシュへの書き込みにも失敗するため、実質的にリクエストごとの動的レンダーになっている。

両ページは `getNiceServants()` と `getMaterialsForServants()` を通じて Atlas Academy の `nice_servant.json` を利用し、`/material` はさらに `nice_item.json` を利用する。2026-08-03 の実測では前者が約 67.2 MB、後者が約 1.2 MB であり、クラス別ページは本番で 503 を返すことがある。一方、必要項目へ蒸留すると、顔画像を含むサーヴァント情報・素材・アイテムを合計約 1.0 MB にできる。

Cloudflare Workers Free plan の HTTP CPU 上限は 10 ms である。約 1.0 MB の JSON parse だけでもローカル Node 計測で平均約 9.7 ms を要したため、KV 化後も大きな JSON を Worker で parse して Next.js SSR する構成は安全余裕がない。既存の master-data 更新は GitHub Actions で実行され、`MASTER_DATA` KV に書き込む経路を持つため、この経路を Material Catalog の producer として再利用する。

## Goals / Non-Goals

**Goals:**

- 新サーヴァントをアプリ本体の再デプロイなしで `/material` に反映する。
- ページリクエスト時の Atlas Academy 巨大 JSON 取得・parse をなくす。
- Worker ではカタログを parse せずストリーム配信し、Free plan の CPU 上限に収まる経路にする。
- サーヴァント・素材・アイテムを同一の検証済みスナップショットとして配信する。
- 更新失敗時は last-known-good を維持し、静かに古いデータへ固定される失敗を検知可能にする。
- カタログ読込の待機・失敗によって利用者の localStorage / クラウド同期状態を変更しない。

**Non-Goals:**

- OpenNext 全体の incremental cache を R2 / KV 書き込み可能構成へ変更すること。
- `/material` 以外のデータ取得経路や既存 master-data キーを移行すること。
- `material`、`posession`、クラウド同期の保存スキーマを変更すること。
- クラス別ページの UI 統合・廃止や URL 体系の再設計。
- 新しい外部依存ライブラリを追加すること。

## Decisions

### 1. `material_catalog_v1` を単一の versioned KV value とする

カタログは次の wire model を持つ。

```ts
type MaterialCatalogV1 = {
  schemaVersion: 1
  updatedAt: number
  sources: {
    niceServant: { etag?: string; lastModified?: string }
    niceItem: { etag?: string; lastModified?: string }
  }
  servants: Array<{
    id: number
    name: string
    className: ClassName
    collectionNo: number
    rarity: number
    face: string | null
  }>
  materials: MaterialsForServants
  items: Array<{ id: number; name: string; icon: string }>
}
```

1 キーにまとめることで、KV の eventual consistency があっても、ある利用者がサーヴァントだけ新しく素材だけ古い状態を読むことを防ぐ。`material_catalog_v1` というキー名と `schemaVersion` の両方で互換性境界を明示する。

サーヴァント画像は `ServantCard` が実際に使う代表 face だけにする。現在の `extraAssets` 全体を保持する案は実装変更が少ない一方、実測でサーヴァント metadata だけで約 1.53 MB になるため採用しない。クラス別キーへの分割はレスポンスを小さくできるが、更新の原子性、キー管理、Free KV の書込回数、トップページ用全体キーとの重複が増えるため採用しない。

### 2. 既存 GitHub Actions updater で条件付き取得・蒸留・検証する

`scripts/run-updater.ts` に独立した Material Catalog phase を追加する。I/O と判断を分け、Atlas response の変換、semantic fingerprint、validation は pure 関数として専用モジュールへ置き、fetch・KV read/write は orchestration 境界に残す。

updater は既存カタログの source validators を読み、`If-None-Match` / `If-Modified-Since` を送る。両方 304 なら parse も KV write もしない。一方だけ 200 の場合は、変更側だけ再生成し、304 側は既存の検証済み section を再利用する。取得元の validator だけが変わり蒸留結果が同じ場合も書き込まない。`updatedAt` は semantic content が変わって正常な新カタログを書いた時だけ更新する。

ただし、`nice_servant.json` が更新され、`nice_item.json` が 304 の場合は、既存 catalog の `items` が旧素材参照に限定された projection であるため、新規参照を含まないことがある。新しい素材 ID が既存 item 集合で充足できない場合だけ `nice_item.json` を条件なしで 1 回再取得し、完全な item source から再投影する。通常の 304 更新は 2 リクエストのまま維持する。

validation は少なくとも次を検査する。

- schema version と必須 collection の存在
- servant / item ID の一意性
- servant ID と materials key の対応
- 期待する ascension / skill / append material shape
- 全 material item ID が items に存在する参照整合性
- ID・数量・QP の有限性と非負制約
- 既存正常値に対する不自然な件数減少
- UTF-8 serialized size が 5 MiB 以下であること

候補が不正なら `put` せず、既存値を保持して `failed = true` とする。他 phase は継続してよいが、workflow 全体は非 0 で終了させる。既存 validation のように「上書き拒否を warning だけ出して成功扱い」にしない。

Atlas の巨大 JSON をオンデマンドに取得する案は、現在の 503 原因を残すため採用しない。差分更新専用の新しい cron Workerも、Free Workers の CPU 制約と既存の GitHub Actions 移管方針に反するため採用しない。

### 3. ページは静的シェル、API は KV stream の透過配信とする

`/material` はビルド時・リクエスト時にデータを取得せず、catalog loader を含む静的 UI シェルを返す。`GET /api/material-catalog` だけを `force-dynamic` とし、本番では `MASTER_DATA.get('material_catalog_v1', { type: 'stream', cacheTtl: 300 })` 相当で取得した `ReadableStream` を `Response` body として返す。Worker は JSON.parse / stringify を行わない。

成功応答は `Content-Type: application/json` と短いブラウザキャッシュ（初期値 `public, max-age=300`）を持つ。カタログ欠落・KV failure は `503` / `no-store` とし、Atlas へフォールバックしない。producer が last-known-good を保持するため、通常の upstream 障害は API failure ではなく旧カタログの継続配信になる。

`force-dynamic` な RSC から KV JSON を parse・SSR する案は変更量が少ないが、Free Workers 10 ms に対する余裕がなく、HTML/RSCへ大きな props を埋め込むため採用しない。R2 ISR は page regeneration の CPU、queue/binding、populateCache 対応を必要とし、この問題の範囲を超えるため採用しない。Atlas更新時にアプリ全体を再デプロイする案も、データ更新とコードリリースを再び結合するため採用しない。

### 4. カタログ検証完了後だけ stateful UI を mount する

client loader は `schemaVersion` と最低限の response shape を確認してから `Index` / `Material` を mount する。loading・error 中はこれらを mount しない。これにより `useChaldeaState([])` や空データを初期値として localStorage 永続化へ流す経路を作らない。

カタログ取得後は既存の `mergeChaldeaState` を使い、新 ID を未所持の既定状態で追加し、既存 ID の保存値を優先する。カタログに一時的に存在しない保存済み ID も `...state` の既存挙動で保持する。カタログ自体はユーザーの cloud-sync `KEYS` に追加しない。

loading・error・retry の表示文言は既存 i18n 規約どおり `t('kebab-key', '日本語フォールバック')` を通す。

### 5. クラス別ページは既知 class を静的生成する

有効な Material class の canonical list を 1 箇所に定義し、`generateStaticParams`、URL validation、Pagination / PageSelect で共有する。`dynamicParams = false` とし、未定義 class は Worker でカタログを読む前に 404 にする。`beast` に加えて `beastEresh`、`unBeastOlgaMarie` など現在有効な個別 class を落とさない。

クラス別ページを `/material?class=` へ統合する案は重複 UI を減らせるが、既存 URL・bookmark・画面挙動を変更するため本変更では採用しない。

### 6. local development fallback は明示的に分離する

KV binding が無い `next dev` では、既存の filesystem cache 付き Atlas loader から同じ catalog builder を呼べるようにする。Miniflare が空の local KV binding を提供する場合もあるため、明示的なローカル環境では key 未seed または KV 読み取り失敗時に同じ loader へフォールバックする。本番 KV 欠落時にローカル mockやAtlasへ倒れる分岐は設けない。テストは外部 network を使わず、固定 response と in-memory storage を注入する。

## Risks / Trade-offs

- [初回表示で catalog fetch の 1 round trip が増える] → 静的シェルと明確な loading UIを先に表示し、約 1 MB の raw payloadをブラウザキャッシュする。実装後に実機で LCP・操作可能時間を測定する。
- [KV / browser cache により更新反映が nominal cron より遅れる] → `updatedAt` を payload に保持し、KV `cacheTtl` と browser `max-age` をそれぞれ 5 分に制限する。両キャッシュが直列に効く最悪時は約 10 分となるため、「30分以内」を厳密保証とは扱わず、scheduler 遅延と伝播を監視する。
- [consumer deploy 前に v1 key が無いと 503 になる] → versioned key を feature branch の手動 updater 実行で先に seed・検証してから consumer を mergeする。
- [Atlas schema change で builder が失敗する] → strict validation と last-known-good 保護で利用者への破損配信を防ぎ、workflow を赤にして検知する。
- [client parse・480件前後の描画コストは残る] → Worker CPU から利用者端末へ移す判断であり、payload projection と browser cache で抑える。必要になった場合の virtualization は別変更とする。
- [公開 API から catalog が直接取得可能になる] → 同じ情報は既に公開ページへ埋め込まれており、秘密情報・利用者情報を一切含めない。第三者データの出典・利用条件は既存の公開方針を維持する。

## Migration Plan

1. `MaterialCatalogV1` 型、pure builder、validator、semantic comparison と単体テストを追加する。
2. updater phase と条件付き Atlas fetch を追加し、dry-run で件数・参照整合・約 1 MB の size budgetを確認する。
3. `update-master-data.yml` を feature branch 指定で手動実行し、実 Atlas データから未使用の `material_catalog_v1` を本番 KV に seedする。test fixture は本番へ書き込まない。
4. stream API、client loader、静的 `/material`、静的 class params、404を追加して統合テスト・buildを行う。
5. seed済み key の schema・件数・sizeを再確認してから consumer をデプロイする。
6. 本番で `/material`、全 class、`/material/zzzz`、API status、Worker CPU / error、catalog `updatedAt` を確認する。

Rollback は consumer のデプロイを直前版へ戻す。旧版は build-time data を使うため、新しい KV key が残っていても影響を受けない。producer は書き込みを停止しても最後の正常値を保持する。`material_catalog_v1` は rollback 時に削除せず、原因調査と再デプロイに利用する。

## Open Questions

- なし。初期 cache TTL、5 MiB size budget、件数減少閾値は実装時の fixture と実データ計測で保守的な定数として確定し、designの境界を変える必要が生じた場合だけ更新する。
