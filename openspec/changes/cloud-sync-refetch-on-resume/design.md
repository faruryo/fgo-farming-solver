## Context

`hooks/use-cloud-sync.ts` で `/api/cloud` GET（= サーバの新データ取得 → `checkConflict` 経由の自動ロード判定）が発火するのは次の2経路のみ:

- 初回マウントの `useEffect`（`fetchCloudData` を呼ぶ）
- 自分の保存成功後（`handleSave` 末尾の `await fetchCloudData()`）

`visibilitychange` / `pageshow` を契機とした再取得は存在しない。モバイルで「アプリを開く」操作の多くは既存タブの再開であり React は再マウントされないため、別デバイスの更新が評価されず、古い前提のローカルが auto-save で push されると他デバイスの更新を上書きしうる。

さらにブラウザ実機検証で**最大の構造的原因**が判明した（モッククラウド + ドロワー開閉で確認済み）:

0. **同期エンジンがアプリに常駐していない。** `useCloudSync` の実マウント箇所は nav ドロワー内の `NavHeader` / `CloudRow`（`<SheetContent>` 内 = ドロワーを開いている間のみマウント）と `/cloud` ページのみ。`CloudIndicator` はどこからも描画されていないデッドコード。つまり**ドロワーを閉じた通常利用中は、変更追跡リスナーも auto-save も初回フェッチも一切存在しない**。閉じたまま編集 → dirty マークされず → 後でドロワーを開くと「古いままクリーン」なメタデータでクラウド新を検出 → 未保存のローカル編集が自動ロードで上書き消失する。これがユーザーの観測する「PC とスマホで同期がうまくいかない」の主因。再開リスナーを追加してもエンジンが常駐していなければ意味がないため、headless の `CloudSyncEngine`（`useCloudSync()` を呼ぶだけで `null` を返す）を `app/providers.tsx`（`SessionProvider` 内）に常駐させる。

精査で判明した前提条件が2つある:

1. **`applyData` はライブな UI に伝播しない。** `applyData` は detail なしの `CustomEvent('ls-sync')` を dispatch するが、`useLocalStorage` のリスナーは `detail.key` が自分のキーと一致しない限り無視する（`use-local-storage.ts:55-56`）。したがって localStorage を書き換えてもマウント済みコンポーネントの state は古いまま残り、ユーザーが次に1箇所でも編集すると persist effect が**古い state オブジェクト全体を書き戻して**適用済みクラウドデータを巻き戻し、dirty 化 → auto-save で退行データをクラウドへ push する。再開時適用を追加すると「フォーム表示中の適用」が常態化するため、この伝播修正は本変更の前提条件である。
2. **イベントを発火しない直書きがある。** `material/result`（`components/material/material-calc-button.tsx:26`、`components/material/index.tsx:347`）と `farming/results`（`components/farming/index.tsx:216`）は `localStorage.setItem` 直書きで `ls-sync` を dispatch しないため、metadata（`updatedAt`）が bump されず「クリーン」に誤認される。再開時オートロードはこれらの直後の値を**コンフリクト検出なしで上書き**しうる（auto-save 対象にもならない）。

既存の安全機構は `checkConflict`（`isCloudNewer` × `isLocalClean`）で成立しており、上記2点を塞いだうえで再取得さえ走れば、自動ロード/コンフリクト判定はそのまま正しく機能する。

## Goals / Non-Goals

**Goals:**
- 同期エンジン（変更追跡・auto-save・自動ロード・再開リスナー）を UI の表示状態に依存せずアプリ常駐にする。
- タブ可視化（`visibilitychange` → visible）と bfcache 復元（`pageshow` で `persisted === true`）で `fetchCloudData` を再実行する。
- 適用したクラウドデータをマウント済みコンポーネントのライブ state に伝播させる（キーごとの `ls-sync` 通知）。
- 直書きされていた `material/result` / `farming/results` を変更追跡（dirty 検出・auto-save 対象）に乗せる。
- 同時イベント・複数フックインスタンスによる `/api/cloud` GET のバーストを合流させる。

**Non-Goals:**
- `checkConflict` の判定ロジック（`isCloudNewer` / `isLocalClean` / `deviceId` 比較）自体の変更。
- ポーリングや WebSocket 等のリアルタイム push 同期の導入。
- サーバ側の条件付き書き込み（If-Match 等）による last-write-wins 競合の根本解決。
- `useCloudSync` の複数インスタンス化（nav / cloud-indicator / cloud）の状態共有リファクタ。

## Decisions

### D1: 再取得イベントは `visibilitychange`(visible) と `pageshow`(persisted のみ) を採用
- `visibilitychange` は `document.addEventListener` で登録し、`document.visibilityState === 'visible'` のときのみ実行。タブ切替・モバイルのアプリ復帰の主経路。
- `pageshow` は **`event.persisted === true` のときのみ**実行。`pageshow` は通常のページロードでも毎回発火するため、無条件にすると初回マウントのフェッチと二重 GET になる。非 persisted のロードはマウント時フェッチで既にカバーされている。
- `focus` は採用しない: visible 判定と重複発火しやすく、`visibilitychange` + `pageshow` で実用上カバーできる。

### D2: 短いクールダウン（~5秒）を**モジュールレベルで共有**してバーストを合流
- スロットリングの目的は**同時イベントの合流**（`visibilitychange` と `pageshow` の連続発火、および nav / cloud-indicator / cloud の3フックインスタンスの同時反応）であり、レート制限ではない。
- **長いクールダウン（例: 30秒）は不可**: スロットルされた復帰の後に再試行イベントは来ないため、「30秒の遅延」ではなく「次の復帰まで古いまま」になり、直そうとしているバグを再生産する。真の復帰イベントは元来低頻度なので、バースト合流に足る ~5 秒で十分。
- 直近フェッチ時刻は `useRef`（インスタンス毎）ではなく**モジュールスコープの変数**で共有する。これにより復帰1回あたりの GET をほぼ1回に抑えられる。
- クールダウンは復帰経路（`refetchIfStale`）にのみ適用し、`handleSave` 後の `fetchCloudData`（保存直後の状態同期に必須）には適用しない。

### D3: 既存 `fetchCloudData` をそのまま再利用
- リスナーから `refetchIfStale` → `void fetchCloudData()` を呼ぶだけにする。session 有無・dev モック（`MOCK_CLOUD_KEY`）も既存どおり処理されるため分岐の重複を避けられる。
- リスナー登録 `useEffect` の依存は `fetchCloudData`。identity 変化時にリスナーを張り直す既存パターンと整合する。

### D4: `applyData` をキーごとの `ls-sync`(detail 付き) dispatch に変更（本変更の前提条件）
- 現状の detail なし `CustomEvent('ls-sync')` は `useLocalStorage` 全コンシューマに無視されるため、書き込んだ各キーについて `new CustomEvent('ls-sync', { detail: { key } })` を dispatch する。
- 安全性（「通知が dirty を作らない」ための2点の付随修正を含む）:
  - **適用中ガードはモジュールスコープの共有フラグにする。** 現行の `isApplyingCloudDataRef` はインスタンス毎の ref だが、イベントはウィンドウグローバルであり、nav / cloud-indicator / cloud の**他インスタンス**の変更追跡リスナーが dispatch を拾って dirty 化する（detail なしの現行 dispatch でも既に発生している実バグで、適用→dirty→auto-save→相手デバイスが適用→…のデバイス間 ping-pong 保存を生む）。全インスタンスは同一モジュールを共有するため、`let isApplyingCloudData = false` をモジュールスコープに置けば解決する。
  - **変更追跡リスナーから native `storage` イベントを外す。** 適用で書いた localStorage は**別タブ**に native `storage` イベントとして届き、そのタブのリスナーが共有メタデータ（`LOCAL_METADATA_KEY` は同一ブラウザ全タブ共有）を dirty に上書きしてクリーン状態を壊す。書き込んだタブが自分でメタデータを更新し auto-save も自分で予約する責務を持ち（`useCloudSync` は全ページの Nav に常駐するため必ず存在する）、他タブへの**表示伝播**は `useLocalStorage` 自身の `storage` リスナーが担うので、変更追跡側で `storage` を聴く必要はない。
  - dispatch は共有フラグが true の間に同期実行されるため、全インスタンスの変更追跡リスナーがスキップされ、クリーン状態（`updatedAt === lastSyncedAt`）が保たれる。
  - `useLocalStorage` 側は再読込で setState 後、persist effect が `json === oldJson` 比較で no-op になるため書き戻しループは発生しない。
  - `applyData` の `new Event('localStorageUpdated')` dispatch は削除する（リスナーは use-cloud-sync の変更追跡のみで、適用を dirty 化させる作用しかない。手動ローカル復元 `local-section.tsx:45` の発火元は genuine な変更なので維持）。
- 既知の例外: `material` キーは `onGet: mergeState`（`hooks/use-chaldea-state.ts:12`）で読み出し時に正規化されるため、正規化結果が保存 JSON と異なる場合は1回だけ書き戻し（dirty 化 → auto-save 1回）が発生しうる。意味的には正しいマージ結果の保存であり、2周目は安定するためループにはならない（Risks 参照）。

### D5: 判定ロジックを純関数へ抽出し、リグレッションテストを用意する
- 同期挙動は「クリーン/ダーティ × クラウド新旧 × 同一/別デバイス × クールダウン × イベント種別」の組み合わせ状態機械であり、手動ブラウザ確認だけでは退行検知が不可能。一方、テスト基盤は Vitest 4（node 環境・jsdom なし）で `@testing-library/react` は不在、かつ「renderHook を使わず下層ロジックを直接テストする」前例（`hooks/use-dashboard-result.test.ts` 冒頭コメント）が確立している。
- そこで `useCloudSync` 内に埋まっている判定ロジックを `lib/cloud-sync/decision.ts`（仮）の純関数群へ抽出し、フックは「イベント配線 + setState + 副作用」の薄いグルーに退化させる:
  - `decideSyncAction(local, cloud): 'none' | 'auto-apply' | 'conflict'` — `checkConflict` の判定本体（+1000ms 猶予、`isLocalClean`、`deviceId` 比較）。
  - `shouldRefetchOnResume(lastFetchAt, now, cooldownMs): boolean` — D2 のクールダウン判定。
  - `isResumeTrigger(eventType, { visibilityState, persisted }): boolean` — D1 のイベントフィルタ（visible 判定 / persisted 限定）。
  - メタデータ遷移: `markDirty(meta, now)` / `metadataAfterApply(local, cloudMeta)` / `metadataAfterSave(meta, now)` — クリーン/ダーティ状態遷移の単一情報源。
- 純関数は `window` / `localStorage` に触れない（node 環境でそのまま走る）。フック側は抽出関数を呼ぶだけにし、判定の二重実装を残さない。
- 代替案: `@testing-library/react` + jsdom を導入してフックごとテストする案は、依存追加（AGENTS.md の方針に抵触）と既存前例からの逸脱のため不採用。イベント配線そのものの検証は手動ブラウザ確認（tasks の検証節）でカバーする。

### D6: headless `CloudSyncEngine` を Providers に常駐させる
- `components/cloud/sync-engine.tsx` に「`useCloudSync()` を呼んで `null` を返すだけ」のコンポーネントを新設し、`app/providers.tsx` の `SessionProvider` 内に配置する（`useSession` / i18n / `useRouter` の各 Provider 文脈が必要）。
- これにより全ページ・全期間で、初回フェッチ・変更追跡（dirty マーク + auto-save）・再開リスナーが機能する。ドロワー内 `CloudRow` / `/cloud` ページの既存インスタンスは表示用としてそのまま共存する（モジュール共有の適用中フラグ・フェッチ時刻により多重発火は抑制済み）。
- 代替案: nav の `SheetContent` を常時マウント化（`forceMount`）する案は、ドロワー UI の描画コスト・アニメーション挙動への影響が大きく不採用。`CloudIndicator`（未描画のデッドコード）の復活も検討したが、表示責務が不明瞭になるため headless 新設の方が明確。
- 注意: `useCloudSync` は統計用に `getItems` を呼ぶため、エンジン常駐によりページロードごとにアイテム取得が1回増える。既存のデータ取得はキャッシュされる構造（`lib/get-items`）であり許容する。

### D7: 直書きキーに `ls-sync`(detail 付き) dispatch を追加
- `material/result`（2箇所）と `farming/results`（1箇所）の `localStorage.setItem` 直後に `ls-sync` を dispatch し、変更追跡（metadata bump → dirty 検出・auto-save）に乗せる。
- これにより、計算したての結果が「クリーン誤認」のまま再開時オートロードでサイレントに上書きされる事故を、既存のコンフリクト検出フローで防げる。
- `components/farming/index.tsx:110` の `excludedQuests` 移行書き込みは対象外（`useLocalStorage('excludedQuests')` の読み出し effect より前に完了させる意図的に静かな一回限りの移行であり、直後の dual-write 経路が追跡済み）。

## Risks / Trade-offs

- [復帰のたびに GET が増える] → D2 の共有クールダウンで復帰1回あたり ~1 GET に合流。GET は KV 読み取りのみで安価。
- [`visibilitychange` が発火しない環境がある（一部モバイル）] → `pageshow`(persisted) を併用して bfcache 復元を補完。
- [再フェッチが in-flight の auto-save POST と競合する] → fetch がコンフリクトを検出すると `hasConflict` 変化 → `handleSave` の identity 変化 → 変更追跡 effect の cleanup が保留タイマーを clear するため、未発火の auto-save は中断される。既に飛んだ POST との last-write-wins 競合は残るが、これはサーバ側条件付き書き込みが必要な既存の限界で Non-Goal（再取得追加により発生窓はむしろ狭まる）。
- [`material` の `onGet` 正規化による1回の書き戻し] → 自動ロード直後に auto-save が1回余分に走りうるが、内容はマージ済みの正しいデータで、2周目以降は `json === oldJson` で安定。許容する。
- [共有クールダウン採用時、フェッチしなかったインスタンスの `cloudData` state が古くなる] → 影響は /cloud ページの統計表示のみで、同ページはマウント時に自前でフェッチするため実害は小さい。localStorage への適用とイベント伝播はフェッチした1インスタンスで完結する。
- [D4/D5 により従来サイレントだった更新がコンフリクトダイアログとして表面化しうる] → 仕様どおりの挙動（サイレントなデータ消失より望ましい）だが、検証時に体感差として現れることを認識しておく。
