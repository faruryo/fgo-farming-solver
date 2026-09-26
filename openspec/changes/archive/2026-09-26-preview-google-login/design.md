## Context

ログインは Auth.js（`lib/auth.ts`）で、`token.sub` に Google の `providerAccountId` を入れている。コールバックは `app/api/auth/[...nextauth]/route.ts`。承認済みリダイレクト URI は本番だけ（`deployment_guide.md`）。この change の時点では、プレビューは本番の `CLOUD_SAVE` と `DB` にバインドされていた（#91 の `preview-isolation` で専用リソースへ分離済み）。動機は proposal.md を参照。

## Goals / Non-Goals

**Goals:**

- プレビューのサインインだけ本番コールバックでコード交換し、プレビューホストに Auth.js が読めるセッション Cookie を書く。
- 失敗時は Google を呼ばず、未検証のホストへリダイレクトしない。
- 分岐は環境変数 1 つで無効化し、無効時は Auth.js にそのまま渡す。

**Non-Goals:**

- プレビューから本番シークレットを取り除くこと（#91）。
- localhost のログイン方式を変えること。
- Google Cloud Console のリダイレクト URI を増やすこと。

## Decisions

### 1. `state` は `pv1.` 付きの AES-GCM 暗号文にする

PKCE verifier を平文や HMAC のペイロードに置くと、Google とブラウザから読める。共有シークレットから導出した AES-GCM で `{origin, path, exp, nonce, verifier}` を暗号化する。接頭辞 `pv1.` だけで分岐し、それ以外は Auth.js に渡す。状態の有効期限は 10 分。

代替: Auth.js の Cookie を本番へ転送する。ホストが違い、プレビューの Cookie を本番は受け取れない。

### 2. 戻り先の形

`https` のみ。ホスト名は `<prefix>-fgo-farming-solver.<subdomain>.workers.dev`。`<prefix>` は DNS ラベル 1 つ（バージョン ID の先頭 8 文字と、ブランチの preview alias の両方）。`<subdomain>` は `PREVIEW_WORKERS_DEV_SUBDOMAIN` と完全一致。ユーザー情報、ポート、`pages.dev`、別 Worker 名は拒否する。判定は URL をパースしたホスト名に対して行い、クエリやパスの部分文字列では一致させない。

オリジンは開始リクエストの URL から取り、`callbackUrl` は読まない。戻りパスは同一オリジンの Referer のパスだけを使い、相対パスとして再検証する。

### 3. アカウント許可リスト

`PREVIEW_LOGIN_ALLOWED_IDS`（カンマ区切りの `providerAccountId`）。空なら全員拒否。コード交換のあと、JWT 発行の前に見る。メールでは照合しない。プレビューの完了処理でも同じリストを再確認する。

### 4. シークレット

`PREVIEW_HANDOFF_SECRET` は `AUTH_SECRET` / `NEXTAUTH_SECRET` と別でなければならない。未設定または同一なら、分岐が有効でも JWT を出さず Google も呼ばない。セッショントークン自体は、検証後にその Worker の `AUTH_SECRET` で Auth.js の `encode` を通し、`__Secure-authjs.session-token` として書く。引き渡し JWT の署名には使わない。

分岐の無効化は `PREVIEW_AUTH_HANDOFF=1` のときだけ有効。それ以外は `pv1.` も含めて Auth.js に渡す。

### 5. 引き渡し JWT とフラグメント

HMAC-SHA256 の JWT。`exp` は 60 秒、`aud` は戻り先オリジン。クレームは `sub`、`name`、`email`、`picture`、`nonce`、`jti`、開始時の相対パス。Google のトークンは入れない。`Response.redirect` はフラグメントを拒否するため、`Location` を直接セットして `https://<origin>/auth/preview-complete#handoff=<jwt>` へ 302 する。

完了ページがフラグメントを同一オリジンの POST に渡す。audience はそのリクエストのオリジンと一致しなければならない。成功後はフラグメントを除いた相対パスへ移す。

### 6. nonce と jti

開始時に HttpOnly / Secure / SameSite=Lax の nonce Cookie を書く。完了時に JWT の nonce と照合し、不一致ならセッションを書かない。`jti` は本番 D1 の `preview_auth_jti` へ `INSERT ... ON CONFLICT DO NOTHING` し、挿入できたリクエストだけセッションを書く。行は消さない。Durable Object はプレビュー URL が生成されなくなるため使わない。

### 7. コード交換

本番だけが `GOOGLE_CLIENT_SECRET` でトークンエンドポイントを呼ぶ。続けて userinfo を読み、`sub` を `providerAccountId` とする。アクセストークンは本番の中だけで使い、レスポンスに出さない。`access_type=offline` は付けず、リフレッシュトークンを要求しない。

## Risks / Trade-offs

- [許可アカウントの本番 KV / D1 をプレビューのコードが書ける] → 許容しない。プレビューの保存先は `preview-isolation` の専用リソースであり、本番の KV / D1 には向けない。
- [D1 に `preview_auth_jti` が無いと完了は失敗する] → 有効化の前に `db/schema.sql` を本番 D1 へ適用する。未作成ならセッションは書かない。
- [プレビューが `AUTH_SECRET` を持ったまま] → #91。今回の引き渡し署名は別シークレットにする。#91 の `preview-isolation` で、プレビューの `AUTH_SECRET` は本番と別の値になった。
- [フラグを立てる前はプレビューログインは今までどおり失敗する] → 本番の通常ログインは変わらない。

## Migration Plan

1. `db/schema.sql` の `preview_auth_jti` を本番 D1 に作る。`PREVIEW_HANDOFF_SECRET`（`AUTH_SECRET` とは別）、`PREVIEW_WORKERS_DEV_SUBDOMAIN`、`PREVIEW_LOGIN_ALLOWED_IDS` を Worker に設定する。
2. `PREVIEW_AUTH_HANDOFF=1` を設定して分岐を有効にする。
3. 戻すときは `PREVIEW_AUTH_HANDOFF` を外す。通常の Auth.js コールバックに戻る。

## Open Questions

なし。アカウントのサブドメインはリポジトリに無いため、環境変数で指定する。
