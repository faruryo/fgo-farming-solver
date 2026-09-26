# preview-auth Specification

## Purpose
プレビューホストの Google ログインを、本番に登録済みの認可コールバック経由で完了し、プレビュー自身のセッションとして確立する。

## Requirements

### Requirement: 本番と localhost のサインインは変更しない

本番ホストと localhost の Google サインインは、既存の Auth.js の経路のままでなければならない (MUST)。プレビュー用の分岐は、環境変数で全体を無効化できなければならない (MUST)。無効化されているとき、引き渡し用の `state` も Auth.js に渡さなければならない (MUST)。

#### Scenario: 通常の Auth.js state はそのまま渡る

- **WHEN** 本番コールバックの `state` が引き渡し用の接頭辞 `pv1.` で始まらない
- **THEN** そのリクエストは加工されずに Auth.js のコールバックへ渡る

#### Scenario: 分岐を無効化する

- **WHEN** 引き渡し分岐を無効化する環境変数が有効でない
- **THEN** `state` が `pv1.` で始まっていても Auth.js のコールバックへ渡る
- **THEN** このアプリの引き渡し処理は Google と通信しない

### Requirement: プレビューは本番のリダイレクト URI で認可を始める

許可されたプレビューホストでサインインを始めたとき、Google の認可 URL の `redirect_uri` は `https://fgo-farming-solver.faru.jp/api/auth/callback/google` でなければならない (MUST)。戻り先のオリジンは、その開始リクエストのオリジンだけで決まり、クエリの `callbackUrl` からは取ってはならない (MUST NOT)。戻りパスは、開始リクエストと同じオリジンの Referer の pathname だけから取らなければならない (MUST)。`/` で始まらない値、`//` で始まる値、`\`・`?`・`#`・`://` を含む値は `/` に置き換えなければならない (MUST)。`state` は接頭辞 `pv1.` を持ち、戻り先、発行から 10 分の有効期限、nonce、PKCE verifier を共有シークレットで暗号化して含めなければならない (MUST)。Auth.js がプレビューに置く `state` Cookie や PKCE Cookie は、この経路では使ってはならない (MUST NOT)。

#### Scenario: プレビューのサインイン開始

- **WHEN** 許可されたプレビューホストで Google サインインを開始する
- **THEN** ブラウザは、本番のリダイレクト URI と `pv1.` で始まる `state` を持つ Google の認可 URL へ移る
- **THEN** 戻り先オリジンは開始リクエストのオリジンと一致し、クエリ文字列からは決まらない

#### Scenario: 本番と localhost は従来の開始経路

- **WHEN** ホストが本番または localhost である
- **THEN** サインインは従来の `signIn('google')` のままである

#### Scenario: 外部へ出る戻りパスは使わない

- **WHEN** Referer が別オリジンである、または pathname が `//evil.example` のように外部遷移として解釈される
- **THEN** 戻りパスは `/` になる

### Requirement: 署名できない state は捨てる

引き渡し分岐が有効なとき、`pv1.` の `state` を復号できない、または期限切れの場合は、Google と通信せず、リダイレクトしてもならない (MUST NOT)。復号できるまで戻り先の検証に進んではならない (MUST NOT)。

#### Scenario: 復号に失敗する

- **WHEN** 引き渡し分岐が有効で、`state` が `pv1.` で始まり、共有シークレットで復号できない
- **THEN** Google のトークンエンドポイントを呼ばない
- **THEN** リダイレクトレスポンスを返さない

#### Scenario: 10 分を過ぎた state

- **WHEN** 引き渡し分岐が有効で、`state` の発行から 10 分を過ぎている
- **THEN** Google のトークンエンドポイントを呼ばない
- **THEN** リダイレクトレスポンスを返さない

### Requirement: 戻り先は自アカウントの Worker プレビューに限る

コード交換の前に、戻り先が `https` であり、ホスト名が `<prefix>-fgo-farming-solver.<アカウントのサブドメイン>.workers.dev` の形であることを検証しなければならない (MUST)。`<prefix>` は DNS ラベル 1 つ、サブドメインは設定されたアカウントのサブドメイン 1 つに限る。`*.pages.dev`、他の Worker 名、他アカウントのサブドメイン、ユーザー情報付き URL、ポート指定、クエリやパスへの部分文字列一致は拒否しなければならない (MUST)。拒否したときは認可コードを交換してはならない (MUST NOT)。

#### Scenario: 許可されたプレビューホストだけコード交換する

- **WHEN** 復号した戻り先が、設定されたサブドメイン上の `fgo-farming-solver` のプレビューホストである
- **THEN** 本番がその戻り先へ渡す前に認可コードを交換してよい

#### Scenario: 形が違う戻り先では交換しない

- **WHEN** 戻り先が `pages.dev`、別の Worker 名、別のサブドメイン、`http`、ユーザー情報、または非標準ポートを含む
- **THEN** 認可コードを交換しない
- **THEN** そのホストへリダイレクトしない

### Requirement: Google のトークンをプレビューへ渡さない

認可コードの交換は本番だけが行い、Google のクライアントシークレットは本番の交換だけで使わなければならない (MUST)。Google のアクセストークンとリフレッシュトークンを、プレビューへのレスポンスや引き渡し JWT に含めてはならない (MUST NOT)。

#### Scenario: 引き渡し先にトークンが無い

- **WHEN** コード交換に成功し、プレビューへ戻す
- **THEN** リダイレクト先の URL に Google のアクセストークンもリフレッシュトークンも含まれない

### Requirement: 許可リストにあるアカウントだけセッションを渡す

コード交換のあと、引き渡し JWT を発行する前に、Google の `providerAccountId` を許可リストと照合しなければならない (MUST)。照合にメールアドレスを使ってはならない (MUST NOT)。許可リストが空、または一致しない場合は JWT を発行してはならない (MUST NOT)。

#### Scenario: リストが空なら拒否する

- **WHEN** 許可リストが未設定または空である
- **THEN** コード交換のあとでも引き渡し JWT を発行しない

#### Scenario: メールアドレスでは一致させない

- **WHEN** 許可リストにメールアドレスだけが入り、`providerAccountId` は入っていない
- **THEN** そのアカウントには引き渡し JWT を発行しない

### Requirement: 引き渡し JWT は 60 秒で戻り先オリジンだけが受け取れる

本番は、有効期限 60 秒の JWT を URL フラグメントに付け、検証済みのプレビュー URL へ 302 しなければならない (MUST)。JWT の audience は戻り先オリジンでなければならない (MUST)。中身は `sub` クレームに入れた `providerAccountId`、名前、メール、画像、nonce、`jti`、開始時に同じオリジンから取り出した相対パスに限る (MUST)。署名用シークレットは Auth.js が使うシークレット（`AUTH_SECRET`、未設定なら `NEXTAUTH_SECRET`）とは別の値でなければならない (MUST)。未設定、または同じ値のときは、Google と通信せず、JWT を発行してはならない (MUST NOT)。

#### Scenario: フラグメントでプレビューへ戻る

- **WHEN** 許可されたアカウントのコード交換に成功する
- **THEN** レスポンスは検証済みプレビュー URL への 302 で、JWT はフラグメントにあり、有効期限は 60 秒である
- **THEN** audience はそのプレビューのオリジンである

#### Scenario: 引き渡しシークレットが Auth.js のシークレットと同じ

- **WHEN** 引き渡し用シークレットが未設定、または Auth.js が使うシークレット（`AUTH_SECRET`、未設定なら `NEXTAUTH_SECRET`）と同じである
- **THEN** 認可コードを交換せず、Google のトークンエンドポイントを呼ばない
- **THEN** 引き渡し JWT を発行しない

### Requirement: プレビューが自分のセッション Cookie を書く

フラグメントはプレビューのサーバへ送られない。プレビューのページがフラグメントを読み、同一オリジンのエンドポイントへ渡さなければならない (MUST)。そのエンドポイントは、署名と期限が正しく、audience がリクエストのオリジンと一致し、`sub` が許可リストに今も含まれるときだけ、そのホストのセッション Cookie を書かなければならない (MUST)。セッション Cookie は、そのプレビューの `AUTH_SECRET` で Auth.js の `encode` を通した値を `__Secure-authjs.session-token` として、`HttpOnly`・`Secure`・`SameSite=Lax` で書かなければならない (MUST)。移動先のパスは、JWT のパスに完了時にも同じ相対パスの検証をかけ直したものでなければならない (MUST)。`user.id` は `providerAccountId` でなければならない (MUST)。Cookie を書いたあと、フラグメントを除いた URL へ移さなければならない (MUST)。期限切れや audience 不一致では Cookie を書いてはならない (MUST NOT)。

#### Scenario: 一致した audience で Cookie を書く

- **WHEN** プレビューが、自分のオリジンを audience とする期限内の引き渡し JWT を受け取る
- **THEN** そのホストにセッション Cookie を書き、`user.id` は JWT の `sub`（`providerAccountId`）である
- **THEN** ブラウザはフラグメントを含まない、開始時の相対パスへ移る

#### Scenario: audience が違う、または期限切れ

- **WHEN** audience がリクエストのオリジンと違う、または期限切れである
- **THEN** セッション Cookie を書かない

#### Scenario: 発行後に許可リストから外れた

- **WHEN** 引き渡し JWT の発行後、完了までの間に、その `sub` が許可リストから外れた
- **THEN** セッション Cookie を書かない

### Requirement: nonce と jti で引き渡しを一度きりにする

プレビューは認可開始時に nonce を `HttpOnly`・`Secure`・`SameSite=Lax` の Cookie へ書き、完了時に引き渡し JWT の nonce と照合しなければならない (MUST)。不一致では Cookie を書いてはならない (MUST NOT)。引き渡し JWT の `jti` は一度使ったら再使用できてはならない (MUST NOT)。

#### Scenario: nonce が Cookie と一致しない

- **WHEN** 引き渡し JWT の nonce が、プレビューの nonce Cookie と一致しない
- **THEN** セッション Cookie を書かない

#### Scenario: 同じ jti を再使用する

- **WHEN** 同じ `jti` の引き渡し JWT を二度目に渡す
- **THEN** 二度目はセッション Cookie を書かない

#### Scenario: 同じ jti を同時に使う

- **WHEN** 同じ `jti` の完了が重なる
- **THEN** セッション Cookie を書くのは一方だけである
