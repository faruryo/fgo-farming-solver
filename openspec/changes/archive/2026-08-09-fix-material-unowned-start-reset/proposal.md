## Why

育成済みサーヴァントの「所持」を一度外して戻すと、再臨・スキル・アペンドの現在値（`start`）が全て下限（再臨0 / スキル1 / アペンド0）へ不可逆に消える。原因は `hooks/use-chaldea-state-merger.ts` の `resetDisabledServantStarts` が、`disabled: true` の全サーヴァントの `start` を `mergeChaldeaState` が呼ばれるたび（localStorage 読込・`ls-sync` 再同期のたび）に無条件で下限値へ上書きしていること。書き換え後の state はそのまま `useLocalStorage` の永続化 effect で保存され `ls-sync` を発火するため、クラウド同期経由で他端末にも伝播する。

`start` を消費する箇所（`lib/sum-materials.ts`、`components/material/index.tsx` の所持数集計・フィルタ、`lib/progress/growth.ts`、`lib/progress/diff.ts`、`components/dashboard/ProgressSection.tsx`）は全て `disabled` を個別にガードしており、未所持サーヴァントの `start` は元々どこにも影響しない。`servant-card.tsx` の UI も所持中（`{owned && (...)}`）でしか `start` を描画しない。つまりこの矯正処理は可視化されない値を毎回破壊しているだけで、防いでいる実害は存在しない。

導入元の commit `46bde1a2`（アペンド/再臨/スキルの現在値が `all` 共通目標テンプレート由来で1に固定される不具合の修正）は、本来 `all` 合成経路（`buildTargetsFromAllTemplate`）だけを直せばよかったところ、未所持サーヴァント全員の `start` を毎回矯正するという広すぎる対処を追加していた。`openspec/specs/material/spec.md` はこの過剰修正後の挙動をそのまま SHALL 要件として明文化してしまっている。

## What Changes

- `resetDisabledServantStarts`（および `mergeChaldeaState` からの呼び出し）を削除し、所持を外しても `start` を保持する。
- `all` テンプレートからの `start` 漏れ防止（`buildTargetsFromAllTemplate`）は変更しない。
- 破壊的挙動を正としていた既存テストを反転し、所持→編集→未所持化→再マージ→再所持で `start` が保持されるリグレッションテストに置き換える。
- `openspec/specs/material/spec.md` の該当シナリオを、保持を保証する内容へ更新する。

## Capabilities

### Modified Capabilities

- `material`: 未所持サーヴァントの現在値（`start`）をマージ時に強制矯正しないよう要件を修正する。

## Impact

- 対象: `hooks/use-chaldea-state-merger.ts`、`hooks/use-chaldea-state-merger.test.ts`、`openspec/specs/material/spec.md`。
- 保存スキーマ・公開 API に変更なし。UI・他コンポーネントの変更なし。
- 既にこの不具合で破壊された過去データの復元・マイグレーションは行わない（次に所持へ戻した時点で編集可能になり自己修復する）。
