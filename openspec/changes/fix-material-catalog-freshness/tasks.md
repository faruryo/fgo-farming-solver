## 1. Material Catalog の型・pure変換・検証

- [x] 1.1 `MaterialCatalogV1`、material専用servant/item DTO、source validator型と `material_catalog_v1` 定数を専用モジュールへ追加する
- [x] 1.2 Atlas servant/item入力から代表face・必要素材・表示用itemだけを生成するpure builderを実装し、既存の素材縮約ロジックを安全に共有する
- [x] 1.3 schema、空・重複ID、servant/material対応、item参照、有限非負値、件数減少、UTF-8 5 MiB上限を検査するpure validatorを実装する
- [x] 1.4 `updatedAt`とsource検証子を除いたsemantic equality/fingerprintを実装し、実質不変時のKV書込抑止を判定できるようにする
- [x] 1.5 builder/validator/fingerprintの正常・空・重複・参照欠損・NaN・件数急減・サイズ境界テストを追加し、guardを一時的に外して回帰テストが赤くなることを確認後に復元する

## 2. GitHub Actions updater への統合

- [x] 2.1 `fetch`と既存source validatorを注入できる条件付きAtlas取得境界を実装し、200/304、strong/weak ETag、Last-Modifiedを扱う
- [x] 2.2 `scripts/run-updater.ts`へ独立したMaterial Catalog phaseを追加し、既存KVの読込、304 section再利用、完全候補の検証、単一key put、semantic skipを実装する
- [x] 2.3 Material Catalogの取得・変換・検証失敗では既存KVを保持しつつ`failed = true`とし、他phase完了後もworkflow全体を非0終了させる
- [x] 2.4 `DRY_RUN=1`で実Atlas fixtureまたは明示した一時ファイルを使い、production KVへ書き込まず件数・serialized bytes・更新/skip理由を確認できる診断出力を追加する
- [x] 2.5 両source 304、片側200、semantic同一、既存catalog欠落、検証拒否、put失敗、他phase成功時のworkflow failureをI/O mockでテストし、新規テストの赤確認後に復元する

## 3. 低CPU Material Catalog API

- [x] 3.1 Cloudflare KVから`type: 'stream'`・短い`cacheTtl`で値を取得する境界を追加し、productionとlocal developmentの分岐を依存注入可能にする
- [x] 3.2 `GET /api/material-catalog`を実装し、成功時はKV streamをparseせずJSON/短期cache header付きで返し、欠落・失敗時は`503`/`no-store`を返す
- [x] 3.3 local developmentでは既存filesystem cache付きAtlas取得から共通builderを呼び、本番KV欠落時にはAtlas・mockへfallbackしないことを環境別テストで固定する
- [x] 3.4 stream透過、header、503、productionでの外部fetch禁止をroute/境界テストへ追加し、新規テストの赤確認後に復元する

## 4. 静的ページと安全なclient loader

- [x] 4.1 Material Catalogをfetch・最低限validateし、loading/error/retry/successを管理するclient loaderを追加して、表示文言を`material` localeのkebab-case keyへ登録する
- [x] 4.2 catalog検証成功後だけ`Index`/`Material`をmountし、loading/error中は`material`・`posession`・cloud metadata・`ls-sync`へ副作用を出さないようにする
- [x] 4.3 `Index`、`ServantCard`、tracking toastのpropsをmaterial専用DTOへ適合させ、代表`face`を使いつつ既存計算・所持状態・画像fallbackを維持する
- [x] 4.4 `/material`と`/material/[className]`からbuild/request時Atlas取得を除去し、静的UIシェルから共通client loaderを利用する
- [x] 4.5 beast派生を含むcanonical material class一覧を共有し、`generateStaticParams`と`dynamicParams = false`で既知classを静的生成して不正classを404にする
- [x] 4.6 loading時にstateful UIがmountしないこと、success時の新ID追加と既存状態保持、欠落ID保持、error/retry無副作用、既知class/不正classをコンポーネント・routeテストで固定し、新規テストの赤確認後に復元する

## 5. 検証と安全なリリース

- [x] 5.1 固定fixtureで対象テストを実行し、`pnpm run type-check`、`pnpm run lint`、`pnpm run lint:ratchet`、`pnpm test --run`、`pnpm run build`を通す
- [x] 5.2 `openspec validate fix-material-catalog-freshness --strict`と`git diff --check`を通し、catalog・API・UIのspec対応を確認する
- [x] 5.3 `DRY_RUN=1`で最新Atlasデータを蒸留し、servant/material/item件数、参照整合、raw sizeが5 MiB未満、不要`extraAssets`不在を確認する
- [ ] 5.4 明示的な運用承認後、feature branchの`update-master-data.yml`を手動実行して未使用の`material_catalog_v1`を実データでseedし、schema・件数・sizeを確認してからconsumerをmergeする
- [ ] 5.5 デプロイ後に`/material`、全定義class、`/material/zzzz`、`/api/material-catalog`、新サーヴァント反映、Worker CPU/error、catalog鮮度を確認し、問題時はconsumerをrollbackしてKV値を保持する
