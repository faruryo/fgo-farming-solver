## Context

`hooks/use-chaldea-state-merger.ts:74-108` の `resetDisabledServantStarts` は、`disabled: true` のサーヴァントについて、`targets.ascension/skill/appendSkill.ranges[].start` を `mergeChaldeaState` が呼ばれるたび `createServantState()` の下限値（再臨0 / スキル1 / アペンド0）へ無条件で上書きする。`mergeChaldeaState` は `useChaldeaState`（`hooks/use-chaldea-state.ts`）から `useLocalStorage` の `onGet` として渡っており、初回読込・タブ間 `storage` イベント・`ls-sync` カスタムイベントの全てで実行される。矯正後の state は `useLocalStorage` の永続化 effect でそのまま `localStorage` に書き戻され `ls-sync` を発火するため、所持を外した直後にクラウド同期経由で他端末にも伝播する。

導入元は commit `46bde1a2`（"アペンド/再臨/スキルの現在値が all テンプレート由来で1に固定される不具合を修正"）で、`all` 共通目標テンプレートから `start` が漏れて未所持サーヴァントに `1` が焼き付く不具合への対処だった。同コミットは同時に `buildTargetsFromAllTemplate`（`all` 合成経路で `start` を常に `createServantState()` の default にし、`end` だけ `all` から継承する）も導入しており、こちらが本来の漏れ防止策として単独で機能している。`resetDisabledServantStarts` はその上に重ねられた冗長な矯正であり、`all` 合成を経由しない「所持済みサーヴァントが編集した `start` を持ったまま未所持へ戻す」経路まで巻き込んで消してしまっている。

`openspec/specs/material/spec.md:49-66` はこの過剰修正後の挙動をそのまま SHALL / SHALL NOT 要件として明文化しており、"未所持へ戻したサーヴァントの現在値編集履歴は保持されない" というシナリオでデータ消失を仕様として承認してしまっている。同シナリオが参照する一括未所持化の経路（`ms-servants-io.tsx`）は現在のコードベースに存在せず（`disabled: true` を書き込む箇所は `hooks/create-chaldea-state.ts` の default 生成のみ）、参照自体が既に陳腐化している。

## Goals / Non-Goals

**Goals:**

- 所持解除→再所持の往復で `start`（現在値）が保持されるようにする。
- `all` テンプレートからの `start` 漏れ防止（`buildTargetsFromAllTemplate`）は維持する。
- クラウド同期経由での他端末への伝播を止める（原因を消すことで自然に解消する）。

**Non-Goals:**

- 未所持中に `start` を表示・編集できるようにすること（現状どおり `{owned && (...)}` の外では描画しない）。
- 既にこの不具合で破壊された過去データの復元・マイグレーション。
- 減算ラップ・操作案内など BACKLOG.md の他項目。

## Decisions

### 1. `resetDisabledServantStarts` を削除する（表示時デフォルト化などの代替は採用しない）

`start` の読み手を全数調査した結果、いずれも `disabled` を個別にガードしている。

- `lib/sum-materials.ts:14` — `if (s.disabled === true || id === 'all') return`
- `components/material/index.tsx:221` — `if (!st || st.disabled) return`（所持数・育成完了カウント）
- `components/material/index.tsx:246,251` — `unowned = st?.disabled ?? true` を経由してのみ `done` 判定に使用（フィルタ）
- `lib/progress/growth.ts:40` — `if (id === 'all' || !sv || sv.disabled) continue`
- `lib/progress/diff.ts:118` — `if (!state || state.disabled) return 0`
- `components/dashboard/ProgressSection.tsx:38` — `if (servant.disabled) return`

`components/material/servant-card.tsx` の UI も `{owned && (...)}` の中でしか `start` を描画しない。つまり未所持サーヴァントの `start` を素通りで消費する箇所は存在せず、`resetDisabledServantStarts` は「誰も見ない値を毎回破壊しているだけ」で、防いでいる実害はない。BACKLOG.md の案A（表示・計算時にだけ default 扱いする、永続化はしない案）は、既にガード済みの読み手にとって到達しないコードを追加するだけになるため採用せず、矯正処理自体を削除する。

### 2. `buildTargetsFromAllTemplate` はそのまま残す

このロジックは `all` 合成経路（個別の保存データを持たないサーヴァントに `all` の `end` だけを継承する経路）でのみ `start` を `createServantState()` の default に固定する。今回のバグの原因ではなく `resetDisabledServantStarts` とは独立したガードであり、`openspec/specs/material/spec.md:76-84`（`all` キーによる共通目標の保持と伝播）は変更しない。

### 3. 育成記録モード（トラッキング）との非干渉

`resetDisabledServantStarts` は `mergeChaldeaState` 内で直接 `start` を書き換えており、`servant-card.tsx` の `applyStart`（`onWillStartChange` / `onStartChange` 経由で所持数を増減する育成記録モードの経路）を通らない。したがって削除後も所持数の遡及的な増減は発生しない。所持解除中に消えていた進捗が復元されるだけで、育成記録モードの所持数会計には影響しない。

## Risks / Trade-offs

- [過去にこの処理で既にフロアへ矯正済みのデータは戻らない] → 移行は行わない。次にそのサーヴァントを所持へ戻した時点でユーザーが編集できる値として現れるため、自己修復的（今後は破壊されない）。
- [「未所持でも `start` にゴミが残る」別経路が将来生まれた場合に検知できなくなる] → 現状、`disabled: true` を書き込む箇所は `createServantState()` の default 生成のみであることを確認済み。将来 UI が増える場合は、そのUI側で `start` の妥当性を担保する。

## Migration Plan

1. `hooks/use-chaldea-state-merger.test.ts` の「未所持サーヴァントの polluted な `start` を default へリセットする」テストを、往復保持（所持→編集→未所持化→再マージ→再所持で値保持）のリグレッションテストへ反転する。`all` 漏れ防止関連のテストは変更しない。
2. `hooks/use-chaldea-state-merger.ts` から `resetDisabledServantStarts` と呼び出しを削除する。
3. `openspec/specs/material/spec.md` のサーヴァント状態管理シナリオを更新する。
4. `pnpm test --run`、`pnpm run type-check`、`pnpm run lint` を実行する。
5. 自動同期を OFF にするか localStorage をバックアップした上で、ブラウザ実機で所持解除→再所持の往復を確認する。

## Open Questions

なし。
