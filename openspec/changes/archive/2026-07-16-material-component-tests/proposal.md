## Why

育成記録モードでは、現在値の変更に連動する素材の消費・返還、素材不足時の更新ブロック、モード切替や案内バナーなど複数コンポーネントにまたがる挙動がある。既存の純粋関数テストだけでは DOM 操作と状態連携の回帰を検出できないため、Vitest 上で React コンポーネントをユーザー操作に近い形で検証できる基盤と単体テストを追加する。

## What Changes

- `@testing-library/react`、`@testing-library/user-event`、`@testing-library/jest-dom`、`jsdom` を開発依存関係に追加する。
- Vitest の既存 Node テスト環境を維持しつつ、対象ファイル単位で jsdom を選択できる設定、jest-dom matcher、DOM API のテスト用 polyfill、テスト後 cleanup を追加する。
- `Index` の育成記録モード、素材消費・返還、素材不足、モード切替、案内バナーを検証するコンポーネントテストを追加する。
- `ServantCard` の現在値操作、変更前フックによるブロック、長押し・右クリック、所持切替を検証するコンポーネントテストを追加する。
- `TrackingToast` / `BlockedToast` の表示、入力補正、確定・キャンセル操作を検証するコンポーネントテストを追加する。

## Capabilities

### New Capabilities

- `material-component-test-infrastructure`: 既存の非 DOM テストを Node 環境に保ったまま、React コンポーネントテストを jsdom 環境で実行するテスト基盤。

### Modified Capabilities

*(なし)*

本 change はテスト基盤の導入と既存の育成記録モード挙動の回帰テスト追加に限定され、ユーザー向けの機能・UI・要件を新設または変更しないため、本来はプロダクト仕様の delta 対象ではない。ただし OpenSpec 1.4.1 の strict validator が全 change に最低1つの delta を要求するため、ユーザー向け仕様ではなくテスト実行環境の検証要件だけを最小の capability delta として記録する。

## Impact

- 変更対象: `package.json`、`pnpm-lock.yaml`、`vitest.config.ts`、`vitest.setup.ts`、`components/material/*.test.tsx`、テスト fixture、OpenSpec 文書。
- UI 実装コード、プロダクトの見た目・挙動、本番ランタイム依存関係には変更なし。
- 既存の純粋関数テストは引き続き Node 環境で実行し、コンポーネントテストだけが jsdom を使用する。
