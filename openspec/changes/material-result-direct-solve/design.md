## Context

現状のgoSolver経由フロー: サーヴァント選択 → `/material/result`(`goSolver`が目標A・Bを算出し`router.push('/farming?items=...&itemsStock=...')`) → `/farming`(URLを受け取り`itemCounts`/`stockItemsParam`へ格納、フォームで`handleSubmit`→`/api/solve`→`/farming/results/[id]`)。

`/farming`がこの経路で提供している要素を洗い出すと:
- 個数入力欄(`ItemFieldset`): goSolverが計算した値がそのまま表示されるだけで、この経路では実質編集されない(ユーザー確認済み)。
- 周回対象クエスト選択(`CheckboxTree`): `localStorage['excludedQuests']`(グローバル、素材データと無関係)を軸にした汎用コンポーネント。ただし単純な読み書きではなく、旧`quests`キーからの一方向移行とデュアルライト(後述)を伴う。`/material/result`との素材データ上の依存関係はない。
- バリデーション: 「アイテム最低1件」「クエスト最低1件」の2つのAlertガード。
- 送信副作用: `/api/solve`呼び出し、`localStorage['farming/results']`書き込み+`ls-sync`イベント、`saveProgressSnapshot()`、結果ページへの遷移。

このうち`/material/result`に無いのはクエスト選択UI(とその元データである`quests`カタログ)だけ。個数は`/material/result`側で`amounts`/`possession`/`stockEnabled`/`resolvedStockBuffer`から既に正しく算出できている(`goSolver`が既に実装済み)。

`itemsStock`(目標B)の生成・消費は`goSolver`(生成)→`/farming`の`stockItemsParam`(受信・保持)→`/api/solve`(消費)の一本道であることをgrepで確認済み。`/farming`への直接アクセス(手入力)経路は`itemsStock`を一度も生成しない。したがって`goSolver`が`/farming`を経由しなくなれば、`/farming`側の`itemsStock`関連コードは到達不能になる。これは以前検討していた「`/farming`手編集時に目標Bを破棄するフォールバック」(`fix-farming-stock-target-edit-fallback`として一度propose、取り下げ済み)が対象としていたバグの発生経路そのものであり、本changeで経路ごと無くなる。

## Goals / Non-Goals

**Goals:**
- goSolver経由の周回計算を`/material/result`から`/farming`を経由せず直接`/api/solve`へ送信し、`/farming/results/[id]`へ着地させる。
- `/farming`直接アクセス(手入力)の挙動・UIは変更しない。
- `/farming`側で到達不能になった`itemsStock`関連コードを削除する(残さない)。
- 送信副作用(`farming/results`書き込み、`ls-sync`、`saveProgressSnapshot`、バリデーション)を`/farming`の`handleSubmit`と同等に`/material/result`側で再現する。

**Non-Goals:**
- `/farming`ページ自体の削除。手入力での利用は残す。
- 目標A/B算出アルゴリズム(`goSolver`の計算ロジック自体)の変更。
- クエスト選択の永続化方式(`excludedQuests`)の変更。既存のグローバルキーをそのまま使う。

## Decisions

### クエストカタログの入手経路: `/material/result/page.tsx`で`getDrops()`/`getLocalQuests()`をSSR取得
`/farming/page.tsx`と同じ関数・同じパターンを再利用する。`getItems()`(Atlas ID系、既存)と`getDrops()`/`getLocalQuests()`(短縮ID系、新規追加)の2系統のカタログが`/material/result`に同居することになるが、これはアイテムIDの変換(`toApiItemId`)を担う既存の`goSolver`ロジックの範囲内で完結しており、クエストカタログはアイテムIDの変換に関与しないため混線しない。

### 送信副作用の置き場所: `/material/result`に`handleSubmit`相当のロジックを実装する
`/farming`の`handleSubmit`(バリデーション → `/api/solve`呼び出し → `farming/results`書き込み・`ls-sync`・`saveProgressSnapshot` → 遷移)をそのまま`/material/result`の送信ボタンに移植する。

- 代替案: 共通コンポーネント/フックとして完全に共有する(`useFarmingSubmit`のようなフック抽出)。→ 採用寄りだが、`/farming`側は`itemCounts`(フォーム入力)から、`/material/result`側は`amounts`/`possession`から、それぞれ異なる形で`items`パラメータを組み立てるため、フックの引数設計に時間がかかる。tasksでは移植を基本としつつ、共通化できる部分(バリデーション条件、副作用の一連の処理)は関数化する方針にとどめる。

### クエスト選択の永続化ロジック(移行・デュアルライト)は共有フックへ切り出す
`localStorage['excludedQuests']`は単純な読み書きだけで完結しない。`components/farming/index.tsx`(95-155行目)には「旧`quests`キーからの一方向移行」「`excludedQuests`→チェック済みリストへの反転アダプタ」「`quests`キーへの同期用デュアルライト+`ls-sync`発火」が埋め込まれており、後者は`openspec/specs/sync/spec.md`の「除外クエストリストの永続化と同期」要件がSHALLで要求するクラウド同期・スナップショット互換契約である。`/material/result`が`excludedQuests`を素朴に読み書きするだけだと、この移行・デュアルライトが行われず、旧`quests`のみ復元されたユーザーが`/material/result`を先に開いた場合に選択状態を無視して全選択扱いになる、または`/farming`側の同期契約が満たされない。このロジックを共有フック(`useExcludedQuests`)へ切り出し、`/farming`・`/material/result`の両方から使う。

- 代替案: `/material/result`側は独自に`excludedQuests`を読み書きし、移行・デュアルライトは`/farming`側にだけ残す。→ 却下。`/material/result`から一度も`/farming`を経由せず操作した場合に旧`quests`キーが更新されず、クラウド同期・スナップショットの既存契約(sync spec)を満たせない。

### アイテム数バリデーションは目標Aだけで判定しない
`/farming`の既存バリデーション(「集めたいアイテムの数を最低1つ入力してください」)は`itemCounts`(目標Aに相当)の空チェックのみで行っている。しかし`solver`specの「stock-only素材も目標Bに含まれる」要件により、全素材が「必要数≤所持<必要数+buffer」(目標Aは0件だが目標Bは非0件)の場合が存在しうる。目標Aのみでバリデーションすると、ストック補充だけを目的とした正当な計算がブロックされる。`/material/result`側の新しいバリデーションは「目標Aまたは目標Bのいずれかに1件以上」で判定する。

- 代替案: 既存の`/farming`のバリデーションロジックをそのまま流用する。→ 却下。上記の境界ケースを塞いでしまう、既存の潜在バグを新しい実装にも引き継ぐことになる。

### `/farming`の`itemsStock`関連コードは削除する(フォールバックを残さない)
`stockItemsParam` state、`searchParams.get('itemsStock')`の読み取り、送信時の条件分岐(`components/farming/index.tsx:158-160,204-205,217-222`)を削除する。`/farming`への直接アクセスではこれらが一度もセットされないため、削除しても直接アクセス経路の挙動に影響しない。

- 代替案: 万一に備えて残す。→ 却下。到達不能なコードを残すと、将来「なぜこの分岐があるのか」を再調査するコストが発生する。`openspec/specs/solver/spec.md`の該当要件も本changeで書き換えるため、コードとスペックの整合を取る。

## Risks / Trade-offs

- [`/material/result`の責務が増え、画面が複雑になる] → クエスト選択はデフォルト全チェックであり、通常操作では触れる必要がない(既存の`/farming`でも同様)。折りたたみ可能なセクションとして追加し、常時表示による圧迫を避ける。
- [`getDrops()`/`getLocalQuests()`追加によるページ生成コストの増加] → `/material/result`は`dynamic = 'force-dynamic'`の動的ページであり、`/farming`も同様の構成で同じ関数を呼んでいる実績がある。
- [送信副作用の移植漏れ(`ls-sync`未発火等)によるクラウド同期・進捗スナップショットの回帰] → tasksで`/farming`の`handleSubmit`と1対1の対応チェックリストを作り、移植漏れを防ぐ。

## Migration Plan

- 既存データへの影響なし。`farming_results`のスキーマ・保存形式は変わらない。
- ロールバックはコード変更の取り消しのみで完結する(スキーマ変更なし)。`/farming`の`itemsStock`関連コード削除も同様に取り消し可能。

## Open Questions

(なし)
