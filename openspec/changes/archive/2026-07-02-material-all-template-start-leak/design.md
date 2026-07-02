## Context

`hooks/use-chaldea-state-merger.ts` の `mergeChaldeaState` は、ローカルストレージから読み込んだ `ChaldeaState` に `all` キー（共通目標テンプレート）が存在する場合、個別の保存データを持たないサーヴァント全員に対して `state.all.targets` を `JSON.parse(JSON.stringify(...))` で丸ごと複製する。

```ts
const merged = state.all
  ? {
      ...Object.fromEntries(
        Object.entries(initialState).map(([id, { disabled }]) => [
          id,
          { disabled, targets: JSON.parse(JSON.stringify(state.all.targets)) },
        ])
      ),
      ...state,
    }
  : { ...initialState, ...state }
```

一方、`all` を更新できる唯一の経路である `components/material/index.tsx` の `applyGlobal` は `end`（目標値）しか書き換えない（`start` は既存値をそのまま素通しする）。`all` はサーヴァントカードとして描画されないため、`start` を直接編集する UI は存在しない。結果として `all.targets.*.start` は `all` エントリが最初に生成された瞬間の値で永久凍結され、その凍結値が `mergeChaldeaState` を介して個別編集していない全サーヴァントの `start` に複製され続ける。

**当初案の欠陥（1回目のレビューで判明）**: 上記の複製経路だけを断っても、既存ユーザーのデータは直らない。`hooks/use-local-storage.ts` の永続化 effect は、マウント時に `onGet`（= `mergeChaldeaState`）でマージした結果を、ユーザー操作なしでも即座に `localStorage` に書き戻す（`json !== oldJson` なら `setItem`）。このため、一度でも `/material` を開いたユーザーの `localStorage['material']` には、実際には未編集のサーヴァントも含め全 ID 分の明示エントリが既に存在する。`mergeChaldeaState` の `...state` スプレッドは、この明示エントリを `all` 由来のデフォルトより優先するため、「`all` から `start` を継承しない」という変更だけでは、**既に書き戻し済みの汚染データには一切効果がない**（実測: 460 体中 457 体が該当する主母集団）。

過去 3 コミット（`ad73129` → `7db1a48` → `26bd9cf`）はいずれも「新規生成時のデフォルト定数」側を修正しており、この永続化・複製の組み合わせには手を付けていなかったため、デフォルト値を変えるたびに同じ症状が再発していた。

## Goals / Non-Goals

**Goals:**
- `mergeChaldeaState` が `all` から個別サーヴァントへ `targets` を複製する際、`start` を `all` から継承しないようにする（新規サーヴァント追加時の再発防止）。
- 既に `localStorage` に書き戻し済みの汚染データ（未所持サーヴァントの凍結 `start`）を、専用マイグレーションスクリプトなしに、通常のページロードだけで是正する。
- `end` の共通目標継承（既存の正当な機能）は維持する。

**Non-Goals:**
- `disabled: false`（所持済み）のサーヴァントで、既に凍結値と一致してしまっている少数のケース（観測データでは 5/460 体）の自動是正は行わない。「本当に意図して全枠を同じ値に揃えた」可能性を排除できないため、所持済みサーヴァントの `start` には一切触れない。該当ユーザーは既存 UI（チップの長押し/右クリックによる -1 操作）で 1 アクション手動修正できる。
- 既存ユーザーの `localStorage` を書き換える独立したマイグレーションスクリプト（ワンショットのデータ移行処理）の追加は行わない。「未所持サーヴァントの `start` を毎回矯正する」ロジック自体が、通常の読み込みパスに組み込まれるため不要。
- `chaldeaState.all` キー自体の廃止・データモデル変更は行わない（`end` の共通目標保持という現行機能は生きているため）。

## Decisions

### `end` は `all` から継承し、`start` は常に `createServantState()` のデフォルトを使う（複製経路の修正）
`mergeChaldeaState` の `all` 分岐で、複製元を `state.all.targets` ではなく「`end` は `state.all.targets` から、`start` は `initialState[id].targets`（= `createServantState()` が返す正しいデフォルト）から」組み立てるハイブリッド構造に変更する。これは新規に追加されるサーヴァント（`state` に未だ明示エントリを持たない ID）に対して効く。

### 未所持（`disabled: true`）サーヴァントの `start` を毎回強制的にデフォルトへ矯正する（既存汚染データの是正）
`mergeChaldeaState` の最終段で、マージ済みの各エントリについて `disabled === true` の場合、`targets.*.ranges[].start` を `initialState[id].targets.*.ranges[].start`（正しいデフォルト）へ**無条件に上書き**する。`end` はこの上書きの対象外とし、既存値（`all` 由来か個別設定かを問わず）をそのまま維持する。

根拠: 未所持サーヴァントは、そもそも `start` を編集する UI 手段が存在しない（`servant-card.tsx` のピップ/チップは `{owned && (...)}` のガード内でのみ描画され、未所持カードには現れない）。したがって未所持サーヴァントの `start` に「ユーザーが意図して設定した値」が入っている可能性はなく、無条件上書きは安全である。唯一の例外は「過去に所持していて `start` を編集した後、未所持に戻したサーヴァント」だが、これは Risks で扱う。

### `TargetState.disabled`（ターゲット種別ごとの有効/無効フラグ）は `end` と同じく `all` から継承する
`start`/`end` とは別に、各 target（`ascension`/`skill`/`appendSkill`）は `disabled: boolean` フィールドを持つ（例: `ms-servants-io.tsx` のインポート処理が `ascension.disabled` を設定するケースがある）。本変更はこのフィールドの継承元を変更しない。`end` と同じ「継続的に外部から更新されうる」性質の値として扱い、`state.all.targets[target].disabled` から継承する（従来の丸ごと複製と同じ挙動を維持）。

### `initialState[id]` が存在しない場合のフォールバック
サーヴァントがゲームデータ更新でマスタから削除された等の理由で、`localStorage` の `state` に残る ID が現在の `initialState`（＝現在の `servants` 一覧から生成）に存在しないケースがありうる。この場合、未所持矯正ロジックは `initialState[id]` が存在しない ID をスキップし、既存の `servant.targets` をそのまま維持する（矯正を行わない）。エラーを送出しない。

代替案として検討したが採用しなかったもの:
- **ヒューリスティックによる判定（例: 全枠が同一値かつ凍結パターンと一致する場合のみリセット）**: 所持済みサーヴァントにも適用できる汎用的な案だが、「本当に意図して全部 1 に揃えた」ケースを誤って上書きするリスクがあり、1 回目のレビューでも指摘された通り確実性に欠ける。`disabled` フラグによる判定は、UI 上「編集不可能」という事実に基づくため、ヒューリスティックではなく構造的に安全。
- **`localStorage['material']` に対する一度きりのマイグレーションスクリプト**: `disabled` 判定を毎回の読み込みパスに組み込む方が、コードが 1 箇所に閉じ、スキーマバージョン管理や「マイグレーション未実行ユーザー」の考慮が不要になる。
- **`all` キー自体を廃止し、`end` は別の独立したフィールドに移す**: より本質的なリファクタリングだが、`localStorage` スキーマ変更を伴い影響範囲が広がる。今回はスコープ外とする。

## Risks / Trade-offs

- [Risk] **未所持へ戻したサーヴァントの `start` 編集履歴が失われる**: 過去に所持して `start` を編集し、その後「未所持」トグルで `disabled: true` に戻したサーヴァントは、次回のマージ処理で `start` がデフォルトへリセットされる。再度「所持」に戻しても、編集していた値は復元されない。この経路には個別トグルだけでなく、`ms-servants-io.tsx` の一括インポート欄を空にする操作（全サーヴァントを一括で `disabled: true` にする、`targets` は保持されたまま）も含まれる。すなわち、**個別トグルより広い範囲（全所持サーヴァント一括）で `start` 編集が失われうる**経路が存在する。
  → **Mitigation**: 既存仕様上、未所持サーヴァントは「育成完了判定および所持数カウントの対象外」であり（`material/spec.md` 内「所持状態のトグル」要件）、その `start` は元々アプリ内のどの計算にも使われていない。この挙動は既存の設計思想と整合しており、意図的なトレードオフとして受け入れる。ただし影響範囲が「個別トグル」に留まらないことを利用者向けにも明確にする必要があるため、tasks.md にこの一括経路を含めた検証テストを追加する。
- [Risk] **リセットのタイミングは「次回ページロード時」より早い**: `useLocalStorage` は `localStorage.setItem` 後に `ls-sync` カスタムイベントを dispatch し、同一ウィンドウ内の他のリスナー（同じ `key` を購読する `useLocalStorage` インスタンス）がそれを受けて `onGet`（= 矯正ロジック込みの `mergeChaldeaState`）を再適用する。そのため、未所持へのトグル操作を行った**その場（同一セッション内）で即座に** `start` がリセットされる可能性があり、「ページを再訪したとき」という表現は実装の一側面に過ぎない。ドキュメント上は「次回のマージ処理（ページロードまたはセッション内の再同期）」と表現し、実機確認でこの即時性を確認する。
- [Risk] `state.all?.targets` が欠落している壊れた `all` エントリ（例: 手動での `localStorage` 編集や過去のバージョン間の不整合）が存在すると、`JSON.parse(JSON.stringify(undefined))` で例外が発生し、`useLocalStorage` の catch 節で `initialState` にフォールバックし、直後の永続化 effect がユーザーデータ全体をデフォルト値で上書きしてしまう既存の潜在的データ損失経路がある。
  → **Mitigation**: 本変更で `all` 分岐を書き直す際に `state.all?.targets` のオプショナルチェーンガードを追加し、欠落時は `state.all` を無視して個別データのみで組み立てる（`state.all` が存在しない場合と同じ扱いにフォールバックする）。
- [Trade-off] `disabled: true` サーヴァントの `end`（目標値）は矯正の対象外のため、`all` 由来の凍結された古い `end` が残っていた場合はそのまま残る。ただし `end` は `applyGlobal` により継続的に更新される値であり、`start` のような「編集不能ゆえの凍結」は発生しないため実害はない。

## Migration Plan

1. `mergeChaldeaState` を修正: (a) `all` からの複製で `end` のみ継承、(b) 未所持サーヴァントの `start` を毎回矯正、(c) `state.all?.targets` の欠落に対するガードを追加。
2. `hooks/use-chaldea-state-merger.test.ts` を更新後の期待値に合わせて更新し、新しい挙動（未所持は矯正・所持済みは非破壊）を検証するテストケースを追加。
3. `openspec/specs/material/spec.md` の該当シナリオを本変更の delta で更新（`openspec archive` 実行時に反映）。
4. ロールバック: 本変更は読み取り時のマージロジックのみを変更し、`localStorage` の書き込みフォーマットやキー構造は変更しないため、コードを元に戻すだけで安全にロールバックできる（ロールバック後は矯正が止まるだけで、データが破壊されることはない）。

## Open Questions

- なし（スコープは `mergeChaldeaState` の `start` 継承・矯正ロジックに限定）。
