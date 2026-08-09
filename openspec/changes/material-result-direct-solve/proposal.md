## Why

育成計算機の結果画面(`/material/result`)からgoSolverで周回計算に進む際、いったん`/farming`へURLで目標A(必要分)・目標B(ストック込み)を渡し、`/farming`側でそれを`/api/solve`へ転送している。しかし`/farming`がこの導線で実質提供している価値は周回対象クエスト選択(汎用コンポーネント`CheckboxTree`、`localStorage['excludedQuests']`を軸に旧`quests`キーからの移行・デュアルライトを伴う)だけで、個数入力欄はこの経路では実質使われていない。

この中継構造が「目標Aは永続state・目標Bは揮発state」という非対称な中間状態を生み、`/farming`の入力欄を手編集すると対応関係が崩れて`farming_results`に不整合なペアが保存される不具合(BACKLOG.md記載)の温床になっていた。中継自体を無くせば、この不整合が発生する余地自体が消える。

## What Changes

- 周回対象クエスト選択(`CheckboxTree`)を`/material/result`へ統合する。データソースは既存の`localStorage['excludedQuests']`(グローバル)を使うが、`/farming`に埋め込まれている旧`quests`キーからの移行・デュアルライト(クラウド同期契約維持のため`sync`specがSHALLで要求)を共有フックへ切り出し、両画面で使う。
- `goSolver`(`components/material/result.tsx`)を、`/farming`へのURL遷移(`router.push('/farming?items=...')`)から、目標A・B・周回対象クエストを算出したうえで直接`/api/solve`を呼び出し、成功したら`/farming/results/[id]`へ遷移する形に変更する。**BREAKING**(goSolver経由の遷移契約を`/farming`へのURL渡しから直接送信へ変更。ただし利用者から見た最終着地点(`/farming/results/[id]`)と保存されるデータ形式は変わらない)。
- `/farming`側の`itemsStock`受け取りロジック(`stockItemsParam` state、URLの`itemsStock`読み取り、送信時の条件分岐)は、goSolverが`/farming`を経由しなくなることで到達不能になるため削除する。`/farming`への直接アクセス(手入力での利用)はこの経路では`itemsStock`が発生しないため、削除の影響を受けない。
- `/material/result`は周回計算履歴保存に必要な副作用(`localStorage['farming/results']`書き込み・`ls-sync`イベント発火・`saveProgressSnapshot()`)を`/farming`の`handleSubmit`から引き継ぐ。

## Capabilities

### New Capabilities
(なし)

### Modified Capabilities
- `material`: `/material/result`に周回対象クエスト選択UIを追加する要件を新設する。
- `solver`: 「周回目標取り込みの余剰ストック追従」要件を、`/farming`経由のURL渡しから、`/material/result`側での直接送信へ変更する。

## Impact

- **UI**: `components/material/result.tsx`(`CheckboxTree`統合・`goSolver`を直接送信に変更・ローディング状態・バリデーション表示の追加)。
- **データ取得**: `app/material/result/page.tsx`(`getDrops()` / `getLocalQuests()` のSSR取得を追加。既存の`getItems()`と合わせて2系統のカタログを渡す。アイテムIDは`getItems()`由来のAtlas ID/短縮ID変換を今回変更しない)。
- **削除**: `components/farming/index.tsx`の`stockItemsParam`関連コード(到達不能になる)。
- **共有ロジック**: `/farming`の`handleSubmit`が持っていた送信〜結果遷移フロー(バリデーション → `/api/solve`呼び出し → `farming/results`書き込み → `saveProgressSnapshot`)は`/material/result`側へ移植する(入力形式が`itemCounts`と`amounts`/`possession`で異なるため、フロー全体を1つの共有フックにはしない)。ただしバリデーション条件・副作用の呼び出し部分など共通化できる箇所は関数として切り出し、両画面から呼ぶ。クエスト選択の永続化ロジック(旧`quests`キーからの移行・デュアルライト)は入力形式に依存しないため、共有フック(`useExcludedQuests`)として完全に共有する。
- **テスト**: `/material/result`からの直接送信の統合テスト、`/farming`直接アクセス経路の非破壊確認、削除後の`stockItemsParam`関連コードが残っていないことの確認。
- **取り下げ**: BACKLOG.mdにあった「`/farming`手編集時に目標Bを破棄するフォールバック」案(`fix-farming-stock-target-edit-fallback`として一度proposeし取り下げ済み)は、本changeにより経路自体が無くなるため不要になる。
- **スコープ外**: `/farming`への直接アクセス(手入力での利用)自体のUI・挙動は変更しない。
