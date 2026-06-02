## Context

進捗レポート（マシュ）は `state_snapshots` テーブルの過去レコードと現在の localStorage 状態を比較して進捗を算出する。新規サーヴァント検出（`lib/progress/tier.ts` の `detectNewServants`）は「比較対象スナップショットで `disabled=true` だったサーヴァントが現在 `disabled=false` になった」遷移を数え、その rarity 別推定APを `deltaAp` に足し戻す。

スナップショットの書き込み口は2系統あり、どちらも同日キー `id = <userId>:<YYYY-MM-DD>` に `ON CONFLICT DO UPDATE` で上書きする（`lib/progress/snapshot.ts`）:

1. `/api/cloud` POST（クラウド保存時）: `KEYS`（`material`, `material/result`, `posession`, `items`, `quests` 等）の localStorage 全体を保存。**material あり**。
2. `/api/solve` GET（計算実行時）: `{ items, quests }` のみ保存。**material なし**。

問題点:
- 自動同期（autoSync）は既定 OFF（`hooks/use-cloud-sync.ts`）。手動クラウド保存をしないユーザーの日次スナップショットは `/api/solve` の material 無しレコードのみになる。
- material が無いスナップショットを `extractChaldeaState` が `null` にし、`detectNewServants` は `past == null` を「全員 `disabled=true` だった」と誤解釈して全所持サーヴァント（例: 457体）を新規カウント → 幻のAP（+13,095,042）。
- `sync` spec は既に「ソルバー実行時に localStorage 全体を保存」と規定しており、現状の `/api/solve` 実装は**仕様違反**。

## Goals / Non-Goals

**Goals:**
- ソルバー実行時のスナップショットに material を含むフル状態を保存し、`sync` spec に準拠させる。
- material を欠くスナップショットで material 入りスナップショットを上書きしない。
- 比較対象に chaldea state が無い場合、新規サーヴァントを 0 件として誤検出を防ぐ（安全弁）。

**Non-Goals:**
- クラウド KV (`cloud:<userId>`) の保存内容・同期 UX の変更はしない。
- autoSync の既定値変更はしない。
- `state_snapshots` のスキーマ変更・過去データのマイグレーションはしない（安全弁により既存の material 無しレコードは自然に無害化）。
- スナップショットの保持世代数・取得期間ロジック（前回/1週間前/1ヶ月前）の変更はしない。

## Decisions

### Decision 1: フル状態の保存はクライアント起点で行う
`/api/solve` は GET でクエリ文字列に `items`/`quests` しか持たず、material はサーバに渡っていない。material はクライアント localStorage にしか存在し、サイズも大きいためクエリ文字列での受け渡しは不適。よって**クライアントが計算成功時にフル状態を送信**する。

- **採用**: 計算成功（`components/farming/index.tsx` の `handleSubmit` が `{id}` を受領）した時点で、`KEYS` の localStorage 全体を JSON でスナップショット保存エンドポイントへ送信する。
- 保存エンドポイントは `state_snapshots` への日次上書きのみを行い、cloud KV は触らない。`/api/cloud` の POST はクラウド KV も書き換えるため流用しない（クラウド保存していないユーザーの意図しない上書きを避ける）。
- 既存の `saveSnapshot(db, userId, body)`（`lib/progress/snapshot.ts`）を再利用し、`body` に `{ storage: { ...KEYS } }` 形（`/api/cloud` と同じ CloudData 互換）を渡す。`extractChaldeaState` 等は `storage` ラッパと素の両形を既にサポート済み。

**代替案**: サーバ側 `saveSnapshot` で「欠けたフィールドを直近スナップから継承（merge）」する案も検討したが、(a) 一度もクラウド保存していないユーザーには material が永久に入らない、(b) material が古いまま据え置かれ得る、という欠点があり、フル状態保存に劣る。

### Decision 2: `/api/solve` のサーバ側スナップショット保存を撤去
Decision 1 でクライアントがフル状態を保存するため、`/api/solve` 内の `saveSnapshot({ items, quests })` は不要かつ有害（material 無し上書きの元凶）。撤去する。`farming_results`（計算履歴）の INSERT は無関係なので維持する。

### Decision 3: `detectNewServants` の null 安全弁
`past == null`（比較対象に chaldea state が無い）のとき `[]` を返す。`progress-visualizer` spec の新規サーヴァント要件は「`disabled` が `true` から `false` に変化」した遷移を前提としており、記録の無い状態は遷移として観測できない。これは仕様準拠の防御であり、Decision 1/2 と独立して既存の material 無しレコードを無害化する効果も持つ。

### Decision 4: 保存タイミングは「計算成功時・1回」
`handleSubmit` でソルバー結果 `{id}` を受領した直後にフル状態を保存する。結果ページ表示時ではなく計算実行時にすることで「その計算で使った状態」をスナップショットでき、`sync` spec の「ソルバー実行時」シナリオに一致する。保存失敗は結果遷移をブロックしない（fire-and-forget + エラーログ、既存 `/api/solve` の挙動踏襲）。

## Risks / Trade-offs

- **保存リクエストの増加（計算ごとにフル状態を1回 POST）** → material を含むため body は大きいが、日次上書きで行数は増えない。fire-and-forget で UX をブロックしない。
- **クライアントとサーバ両方が当日のスナップを書く可能性（クライアント保存 + クラウド保存）** → どちらも material 入りフル状態なので、同日上書きされても破壊は起きない（従来の material 無し上書き問題が解消する）。
- **未ログインユーザー** → スナップショット保存はログイン時のみ（既存挙動と同じ）。未ログインでは進捗比較自体が無効。
- **安全弁による「過小評価」** → material 無しの古いスナップが比較対象になると新規サーヴァント検出が 0 になり進捗が控えめに出るが、誤った巨大値より望ましい。新規レコードが material 入りになれば次回以降は正しく検出される。

## Migration Plan

1. 安全弁（Decision 3）と保存フロー（Decision 1/2）を同一変更でデプロイ。
2. 既存の material 無しスナップショットは安全弁により誤検出されなくなる（データ修正不要）。
3. デプロイ後、ユーザーが次に計算するとフル状態スナップが書かれ、翌日以降の比較が正常化する。
4. ロールバック: 変更を revert すれば従来挙動に戻る（スキーマ変更が無いためデータ互換）。
