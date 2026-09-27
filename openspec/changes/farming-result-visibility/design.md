# Design: 周回計算結果の公開・非公開設定

## Context

周回計算結果は Cloudflare D1（SQLite）の `farming_results` テーブルに保存され、UUID を主キーとする URL（`/farming/results/[id]`）で閲覧されます。
現在はログインの有無や所有者に関わらず、URL を知っていれば誰でも閲覧可能であり、保存後の公開・非公開の制御や取り消しの仕組みが存在しません。
また、認証は NextAuth（Auth.js）を用いており、セッションから `user.id` を取得可能です。未ログイン時の計算結果は `user_id = 'anonymous'` として保存されます。

## Goals / Non-Goals

**Goals:**
- D1 の `farming_results` テーブルに `is_public` カラムを追加し、結果ごとの公開・非公開状態を永続化する。
- ログインユーザーが周回計算を実行する際、既定の公開設定（デフォルト: 公開）をユーザー設定（localStorage）から反映して保存する。
- 未ログインユーザーの計算結果は常に公開（`is_public = 1`）として保存する。
- 結果画面（`/farming/results/[id]`）において、所有者（ログイン中本人）に対して公開/非公開を切り替えるトグル UI を提供する。
- `batch_id` を持つペア結果の場合、目標A・目標Bの両行の公開状態を連動して更新・維持する。
- 非公開結果への第三者（非所有者および未ログインユーザー）アクセス時は 404 Not Found を返す。所有者は常時閲覧可能とする。
- ツイートボタンは公開結果にのみ表示する。
- 既存データはすべて公開状態を維持し、過去の共有リンクを破損させない。

**Non-Goals:**
- クラウド同期データ（`KEYS` in `use-cloud-sync`）の拡張（ユーザー設定は端末ローカルの localStorage で完結）。
- 共有用トークンを別途発行する仕組み（既存の UUID ベースの URL をそのまま活用）。
- 未ログインユーザーに対する非公開機能の提供（所有者を特定・認証できないため）。

## Decisions

### 1. D1 スキーマ定義とマイグレーション
- `migrations/0005_farming_results_visibility.sql` を作成:
  ```sql
  ALTER TABLE farming_results ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;
  ```
- SQLite における `DEFAULT 1` 付きの `ADD COLUMN` はテーブル再構築を伴わず即座に適用可能。
- 既存行は自動的に `is_public = 1`（公開）となり、バックフィル不要で後方互換性を完全に保つ。

### 2. 既定公開設定の管理（ユーザー設定）
- キー: `STORAGE_KEYS.FARMING_RESULT_DEFAULT_PUBLIC` (`fgo:farming:default_public`)。
- 初期値: `true`（公開）。
- 配置場所: 周回計算画面（`/farming` および `/farming/manual`）のオプション欄。
- 保存先: 端末ごとの localStorage（クラウド同期対象外）。
- ログイン中のみ設定を有効・表示し、未ログイン時は「ログインすると非公開保存を選べます」といった注記または非活性とする。

### 3. 計算実行時の保存ロジック（`app/api/solve/route.ts`）
- リクエストのクエリパラメータに `isPublic`（`'true' | 'false' | '1' | '0'`）を受け付ける。
- `userId === 'anonymous'` の場合は強制的に `is_public = 1`。
- ログインユーザーの場合、指定された値（指定なしは 1）を `farming_results.is_public` にバインドして `INSERT`。
- `batch_id` による 2 行保存の場合、`idA` と `idB` の両方に同一の `is_public` 値を保存。

### 4. 結果取得と閲覧権限判定（`lib/get-result.ts` & Server Component）
- `lib/get-result.ts` の `getResult(id: string, currentUserId?: string | null)`:
  - SQL: `SELECT result_data, created_at, batch_id, user_id, is_public FROM farming_results WHERE id = ?`（論理削除済みの直接リンク閲覧仕様を維持するため `deleted_at IS NULL` は付与しない）。
  - 戻り値に `isOwner?: boolean`, `isPublic?: boolean` を追加（プライバシー保護のため Google `providerAccountId` である `user_id` は外部や API レスポンスに露出させない）。
  - アクセス制御:
    - `row.is_public === 0`（非公開）かつ `row.user_id !== currentUserId` の場合、エラー（`Result not found`）をスローし、呼出元で 404 扱いとする。
    - 所有者（`row.user_id === currentUserId`）であれば、`is_public` の値に関わらず正常に取得。
  - 開発環境（モック）では `isPublic = true`, `isOwner = true` を返し、開発を阻害しない。
- `app/farming/results/[id]/page.tsx`:
  - `auth()` でセッションを取得し、`getResult(id, session?.user?.id)` に渡す。
  - 非公開で権限がない場合は `notFound()` により Next.js 標準の 404 ページを表示。
  - `Page` コンポーネントに `isOwner: boolean`（`raw.isOwner`）および `isPublic: boolean`、`resultId: string` を props として渡す。

### 5. 公開設定の更新 API（`app/api/farming/results/[id]/route.ts`）
- `PATCH /api/farming/results/[id]`:
  - リクエスト Body: `{ isPublic: boolean }`
  - 認証チェック: 未ログインなら 401 Unauthorized。
  - 所有者チェック: 対象 `id` の `user_id === session.user.id` でなければ 404 Not Found。
  - `batch_id` が存在する場合:
    - `UPDATE farming_results SET is_public = ? WHERE batch_id = ? AND user_id = ?` で連動更新（共有リンク閲覧可能な論理削除済みの行も、本人のプライバシー保護のため更新対象に含む）。
  - 単独行の場合:
    - `UPDATE farming_results SET is_public = ? WHERE id = ? AND user_id = ?`（同上）。
  - 戻り値: `{ ok: true, isPublic: boolean }`。

### 6. UI コンポーネント設計
- **結果画面（`components/farming/result.tsx`）**:
  - タイトル右または操作バーに、所有者限定の「公開設定」トグル（`Switch` コンポーネント）を表示。
  - 公開状態（公開中 / 非公開）をバッジまたはテキストで明示。
  - トグル切り替え時に `PATCH` API を呼び出し、ローカルの `isPublic` 状態を楽観的/即座に更新。エラー時はロールバックしてトースト表示。
  - `TweetIntent` コンポーネントは `isPublic === true` のときのみレンダリング。
- **周回計算画面（`components/farming/index.tsx`）**:
  - オプション欄（クエスト選択ツリー付近）に「計算結果の公開設定」チェックボックスまたはスイッチを配置。
  - 未ログイン時は説明ツールチップまたは固定表示。

## Risks / Trade-offs

- **[Risk] 既存の共有リンクが意図せず 404 になる**
  - → **Mitigation**: 新規カラム `is_public` のデフォルト値を 1 とし、マイグレーション適用済みの全既存レコードおよび過去の URL がそのまま公開状態を維持できるようにする。
- **[Risk] 開発環境（`next dev`）での D1 未接続時のクラッシュ**
  - → **Mitigation**: `lib/get-result.ts` および `PATCH` API の開発環境用フォールバック（`mocks/result.json` 利用時や `NODE_ENV === 'development'` 時のダミー応答）を維持する。
- **[Risk] A/B ペアの一方のみが非公開になる不整合（片肺状態）**
  - → **Mitigation**: `batch_id` が存在するレコードの更新・保存は常に `batch_id` をキーとして A/B 両行をアトミックに連動処理する。
