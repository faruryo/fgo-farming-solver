## 1. Component Test Infrastructure

- [x] 1.1 React Testing Library、user-event、jest-dom、jsdom を devDependencies に追加し、lockfile を更新する。
- [x] 1.2 Vitest に TypeScript path alias、共通 setup file、ファイル単位の jsdom 選択を導入し、既存テストの既定 Node 環境を維持する。
- [x] 1.3 jest-dom matcher、RTL cleanup、jsdom に不足する `ResizeObserver` / `matchMedia` の polyfill を共通 setup に追加する。
- [x] 1.4 strict validation の最低1 delta 要件を満たすため、プロダクト挙動ではなくテスト実行環境のみを記述する最小の capability delta を追加する。

## 2. Material Component Tests

- [x] 2.1 サーヴァント・アイテム・必要素材データを生成する共通 test fixture を追加する。
- [x] 2.2 `Index` の育成記録モード OFF/ON、素材消費・返還、素材不足ブロックと所持数補正、切替 UI、案内バナーを検証する。
- [x] 2.3 `ServantCard` の再臨・スキル・アペンド現在値操作、変更ブロック、長押し・右クリック、所持切替を検証する。
- [x] 2.4 `TrackingToast` / `BlockedToast` の表示、入力値補正、確定・キャンセル操作を検証する。

## 3. Verification

- [x] 3.1 `pnpm exec openspec validate material-component-tests --strict` が成功することを確認する。
- [x] 3.2 `pnpm run type-check` と `pnpm run lint` が成功することを確認する。
- [x] 3.3 `pnpm test` を実行し、main でも再現するローカル D1 未セットアップ起因の既知 2 件を除く全テストが成功することを確認する。
- [x] 3.4 差分がテスト・設定・OpenSpec 文書に限定され、UI 実装コードを変更していないことを確認する。
