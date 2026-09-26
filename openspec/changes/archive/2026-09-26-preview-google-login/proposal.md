## Why

プレビューのホストはデプロイのたびに変わる一方、Google の承認済みリダイレクト URI は本番のコールバックだけである。プレビューで認可を始めると Auth.js の `state` と PKCE がプレビューの Cookie に残り、本番のコールバックではコード交換まで届かない。セッション Cookie もホストに紐づくため、本番で発行したセッションをプレビューから読めない。

## What Changes

- 許可されたプレビューホストの Google ログインだけ、認可コードの受け取りと交換を本番コールバックに寄せ、短い引き渡し JWT でプレビュー自身のセッション Cookie を発行する。
- 本番 `fgo-farming-solver.faru.jp` と localhost のサインインは今の Auth.js のままにする。
- 引き渡し先のアカウントは `providerAccountId` の許可リストに限り、リストが空なら誰にも JWT を出さない。
- 引き渡し用シークレットは `AUTH_SECRET` とは別にする。プレビューが本番シークレットを持っている問題は #91 のままにする（のちに `preview-isolation` で解消済み）。

## Capabilities

### New Capabilities

- `preview-auth`: プレビューから本番コールバック経由で Google ログインし、同じ `providerAccountId` のセッションをプレビューホストに発行する。

### Modified Capabilities

- `sync`: プレビューで確立したセッションのユーザー識別子も、本番と同じ Google の `providerAccountId` である。

## Impact

- `app/api/auth/[...nextauth]/route.ts` に、接頭辞 `pv1.` の `state` だけ入る分岐を足す。無効化すると通常の Auth.js に渡す。
- プレビューの認可開始、フラグメントの受け取り、セッション Cookie 発行を追加する。
- `components/common/auth-button.tsx` とプッシュ通知設定の `signIn('google')` は、プレビューホストだけ新しい開始経路を使う。
- 新しい依存パッケージは足さない。Google のクライアントシークレットは本番のコード交換だけが使う。
