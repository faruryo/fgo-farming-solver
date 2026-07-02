## 1. マージロジックの修正

- [x] 1.1 `hooks/use-chaldea-state-merger.ts` の `mergeChaldeaState` を修正し、`state.all` から個別サーヴァントへ複製する `targets` について、`end` は `state.all.targets` から、`start` は `initialState[id].targets`（`createServantState()` のデフォルト）から組み立てるようにする。`ascension` / `skill` / `appendSkill` の 3 ターゲット全てに適用する。
- [x] 1.2 `state.all?.targets` が欠落・不正な形式の場合に例外を投げず、`state.all` が存在しない場合と同じフォールバック（個別データのみで組み立て）になるようガードを追加する。
- [x] 1.3 マージ結果に対する後処理として、`disabled === true` の各サーヴァントの `targets.*.ranges[].start` を `initialState[id].targets.*.ranges[].start`（正しいデフォルト）へ無条件に上書きするロジックを追加する。`end` は上書き対象外とする。`id === 'all'` はこの後処理の対象外とする。`initialState[id]` が存在しない ID（マスタから削除された旧データ等）はスキップし、既存の `targets` をそのまま維持する（例外を投げない）。
- [x] 1.4 既存の 5 枠パディングロジック（`appendSkill.ranges.length < 5` の場合の補完）と、1.1〜1.3 の変更が矛盾なく組み合わさることを確認する（適用順序: all からの end 継承・パディング → 未所持サーヴァントの start 強制矯正、の順で処理する）。
- [x] 1.5 `TargetState.disabled`（target 種別ごとの有効/無効フラグ）は `end` と同じソース（`state.all.targets[target].disabled`）から継承する既存挙動を変更しないことを確認する。

## 2. テストの更新

- [x] 2.1 `hooks/use-chaldea-state-merger.test.ts` の既存テストのうち、「`all` テンプレートの `start` がそのまま複製される」ことを前提にしているケース（`expands appendSkill to 5 slots for servants merged from the "all" template` 等）を、`start` は常にデフォルト・`end` のみ `all` を継承する新しい期待値に更新する。
- [x] 2.2 `disabled: true` のサーヴァントについて、保存データの `start` が汚染されていても（例: 全枠 `start: 1`）、マージ後は正しいデフォルト（`0`/`1`）へリセットされることを検証するテストを追加する。`end` は変更されないことも併せて検証する。
- [x] 2.3 `disabled: false`（所持済み）のサーヴァントについて、`start` が保存値のまま維持され、上書きされないことを検証するテストを追加する。
- [x] 2.4 `state.all.targets` が欠落している壊れたデータ（例: `state.all = { disabled: false }` のみ）を渡した場合に、例外を投げず `initialState` ベースでフォールバックすることを検証するテストを追加する。
- [x] 2.5 所持済み（`disabled: false`）で `start` を編集済みのサーヴァントが「未所持」に切り替わった場合、次回のマージで `start` がデフォルトへリセットされることを検証するテストを追加する（design.md Risks で明記したトレードオフの回帰テスト）。個別トグルと `ms-servants-io.tsx` の一括未所持化（`disabled: true` かつ `targets` 保持のまま複数サーヴァントを渡すケース）はマージロジック上同一の入力形状のため、同じテストケースでカバーする。
- [x] 2.6 `initialState` に存在しない ID（マスタから削除された旧データを模したケース）を含む `state` を渡した場合に、例外を投げず該当エントリの `targets` がそのまま維持されることを検証するテストを追加する。
- [x] 2.7 `pnpm test` を実行し、全テストが通過することを確認する。

## 3. 実機確認

- [x] 3.1 `pnpm dev` 実行中のローカル環境で `/material` を開き、既存の `localStorage['material']`（`disabled: true` かつ `appendSkill start:1` の汚染データ）が、ページロード後に `start:0` へ是正されることをブラウザで確認する。
- [x] 3.2 共通目標パネルでアペンド目標値（`end`）を変更した際、引き続き全サーヴァント（`disabled` に関わらず）の目標値に反映されることを確認する（既存機能のリグレッションがないこと）。
- [x] 3.3 所持済みサーヴァントで手動編集済みの `start` が、本変更後も変化しないことを確認する。
- [x] 3.4 所持済みサーヴァントの `start` を編集後、未所持に切り替えて再訪すると `start` がデフォルトへリセットされる既知のトレードオフを実際に確認し、想定通りの挙動であることをチェックする。あわせて、ページ再読み込みを挟まずとも同一セッション内（`ls-sync` 経由）で即座にリセットされる場合があることも実機で確認する。

## 4. ドキュメント反映

- [x] 4.1 実装完了後、`openspec archive material-all-template-start-leak` を実行し、delta spec を `openspec/specs/material/spec.md` に同期する。
- [x] 4.2 `openspec archive` は `## Requirements` セクションのみを同期し、`## Constraints` 内の自由記述（「全体共通の目標保持」項目）は自動更新されない。アーカイブ後、この記述を新しい `start`/`end` 継承仕様（`end` のみ `all` から継承し、未所持サーヴァントは毎回矯正される）に手動で書き換える。
