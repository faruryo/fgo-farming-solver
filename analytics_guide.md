# 利用状況の分析ガイド (Analytics)

本番の「誰が・どの機能を・人かボットか」を調べるための手段と制約をまとめる。
利用者数の確認・機能廃止判断・ボット混入の切り分けなどで参照すること。

## データソースと制約

| ソース | 取れるもの | 保持期間 | 計算単位の紐付け |
|---|---|---|---|
| **D1 `farming_results`** | user_id(`anonymous`/Google sub), target_items, quest_selection, total_ap/lap, batch_id, created_at | 永続 | ○ |
| **Workers Logs**(observability) | user-agent, cf-connecting-ip(実IP), verifiedBotCategory, asOrganization, referer, path, search params | **約7日のみ** | ✗(リクエスト単位) |
| Cloudflare GraphQL Analytics | 集約メトリクス(国/UA/ボット等) | 〜30日程度 | ✗(サンプリング・集約) |

### 重要な制約(ハマりどころ)
- **Workers Logs は約7日で消える**。7日より前の流入(UA/IP/ボット)は遡及不可。長期分析は不可。
- **`farming_results` に UA/IP/referer/入口種別は無い**。過去の計算を遡って「人/ボット」「手入力/goSolver」に分類することはできない。
- **`verifiedBotCategory` が空 = 人間とは限らない**。Cloudflare が検証済みの自己申告ボット(Googlebot 等)しか分類しない。隠れスクレイパーは空に混じる。確実なボットスコアは有料プラン(Bot Management)が必要。
- 未ログイン利用は全員 `user_id='anonymous'` で1グループに潰れる(`app/api/solve/route.ts`)。自分のログアウト分・他人・ボットが混在する。
- **ローカル開発(`localhost:3000` / `curl localhost`)の計算は本番ではなくローカル D1 に書く**。本番 anonymous 件数を検証トラフィックで汚さないよう、調査時は混同しないこと(`batch_id` カラムの有無=本番未デプロイ、で local/prod を見分けられる)。

## 調査クエリ例

### 利用者数(D1・永続・確実)
```bash
npx wrangler d1 execute fgo-farming-solver-db --remote --json \
  --command "SELECT user_id, COUNT(*) n, MIN(created_at) first, MAX(created_at) last \
             FROM farming_results GROUP BY user_id ORDER BY n DESC"
```
- `target_items` のパターンで入口を推定可能: 単一アイテム少数={手入力の可能性}、多品種大量={goSolver(育成)由来}。あくまで推定。

### 人/ボット/UA(Workers Logs・直近7日のみ)
Cloudflare observability MCP(`query_worker_observability`)を使う。主なキー:
`$workers.event.request.path` / `.headers.user-agent` / `.headers.cf-connecting-ip` /
`.cf.verifiedBotCategory` / `.cf.asOrganization` / `.headers.referer` / `.search.items`
- 例: path=`/farming` を `verifiedBotCategory` で groupBy count → ボット比率の概算。
- referer が `/material/result` 由来 = goSolver、直アクセス = 手入力、で入口の概算判定が可能(直近7日のみ)。

## 永続的に分析したい場合(手段の比較)

継続的に「手入力 vs goSolver」「人 vs ボット」を見たいなら解析手段の追加が必要。
**既に observability ログにリッチな情報(UA/IP/verifiedBotCategory/referer/search.items)が出ている**ため、
外部ツールを足すより **Cloudflare の機能を enable して「7日で消える」を解消する**のが素直。

### CF ネイティブ(推奨・サーバ側=全数・adblock 無関係)
| 手段 | 解決する問題 | コスト | 性質 |
|---|---|---|---|
| **Logpush → R2** | ①ログ7日消滅 | enable のみ(コード不要) | 既存リッチログを永続化。後から何度でも生ログ解析。**最有力** |
| **Workers Analytics Engine** | ②独自軸の永続集計 | 少量コード(`writeDataPoint`) | solveごとに entry_source/botCategory/isLoggedIn 等を記録。保持~3ヶ月・GraphQL/SQL集計。DB改修不要 |
| **GraphQL Analytics API** | ③過去ボット比率を今すぐ | 設定ゼロ(既存収集) | HTTPリクエスト分析・約30日・bot次元あり。集約のみ |
| **Web Analytics** | 人間のページ利用 | enable | クッキーレスJSビーコン。**クライアント側=adblock の影響を受ける** |

### サーバ側に自前記録(案B・計算単位で永続)
`/api/solve` 保存時に少数シグナルを D1 に記録。計算1件ごとに紐付き、7日制約・遡及不可・anonymous潰れを回避。
- 候補列: `entry_source`(manual/gosolver, referer か明示パラメータで判定) / `bot_category`(`cf.verifiedBotCategory`) / `ip_hash`(cf-connecting-ip をソルト付きハッシュ。生IPは保存しない) / `user_agent` / `referer`。

### 外部クライアント側ツール(GA4 / Plausible / Umami / PostHog)
- 長所: JS実行クライアント≒人間のみ計測 → ボットが自然に消え「人間の機能利用」を見やすい。`entry_source` カスタムイベントで手入力/goSolver比率が取れる。
- 短所: **本ユーザー層(技術寄り)は adblock 率が高く過少計測**・API/ボットは見えない・遡及不可・GA4は同意バナー/Google依存(Plausible/Umami/CF Web Analyticsはクッキーレスで回避可)。

### 使い分け
- 「ボット混入の実態」も知りたい → **CF サーバ側(Logpush or Analytics Engine)**。全数が見える。
- 「人間が手入力を使うか」だけ → 外部クライアント側 or Web Analytics(adblock過少を承知で相対比を見る)。
- 別の問いに答えるので併用も可。

> 注: 本ドキュメントは「手入力画面(`/farming` のアイテム数入力)を廃止してよいか」の利用実態調査(2026-06)を機に作成。当時のデータでは手入力相当(単一アイテム)の流入が観測され、廃止判断は保留となった。
