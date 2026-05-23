## 1. データ層: `getResult` に `createdAt` 同梱

- [x] 1.1 `lib/get-result.ts` の戻り値型を `(Result | BothResult) & { createdAt?: string }` に拡張する。
- [x] 1.2 D1 経路の SELECT を `SELECT result_data, created_at FROM farming_results WHERE id = ?` に変更し、戻り値に `createdAt: result.created_at` を含める。
- [x] 1.3 ローカルモック経路 (`mocks/result.json`) のフォールバック時は `createdAt: new Date().toISOString()` で補完する。
- [x] 1.4 `lib/get-result.ts` の単体テスト (D1 stub と mock 経路) を追加し、`createdAt` が正しく返ることをアサートする。

## 2. ルート層: createdAt の伝搬

- [x] 2.1 `app/farming/results/[id]/page.tsx` で `getResult` 戻り値から `createdAt` を取り出し、`<Page>` の `createdAt` prop に渡す (legacy / both 両経路)。

## 3. UI 層: タイトル横の時刻表示

- [x] 3.1 `components/farming/result.tsx` の `PageProps` を両バリアントに `createdAt?: string` を追加する。
- [x] 3.2 `formatDate(isoStr?: string)` ヘルパを追加し、design D5 に沿って `Z` 補完・パース失敗時空文字返却を実装する。
- [x] 3.3 legacy `<h1>` 内に `formattedDate` を muted text の `<span>` (`text-xs font-normal text-muted-foreground ml-3`) として描画する。空文字時は何も出さない。
- [x] 3.4 `BothResult` 経路の `<h1>` でも同一の inline span を描画する (タブ切り替えに依存しない位置)。

## 4. テスト・検証

- [x] 4.1 `formatDate` の unit test を追加 (`'2026-05-24T03:00:00Z'` が JST で `5月24日 12:00` に整形される / 空文字・不正値で `''` を返す / SQLite 形式 `2026-05-24 03:00:00` も整形できる)。
- [x] 4.2 `pnpm run lint` と `pnpm run type-check` をパスさせる。
- [x] 4.3 `pnpm dev` でローカル起動し、`/farming/results/[id]` を browser で実機確認する (`feedback_verify_before_push` に準拠)。
  - legacy 結果ページ / AP+LAP 結果ページの両方でタイトル横に `(計算日時: M月D日 HH:MM)` が表示されること。
  - `createdAt` が無いケース (テスト的にモックを抜く等) で従来通り計算結果のみ描画されること。
- [x] 4.4 `openspec validate --change farming-result-show-created-at` を実行し、警告・エラーが無いことを確認する。
