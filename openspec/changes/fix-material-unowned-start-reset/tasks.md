## 1. テストとコード修正

- [x] 1.1 `hooks/use-chaldea-state-merger.test.ts` の「未所持サーヴァントの polluted な `start` を default へリセットする」テストを、往復保持（所持→編集→未所持化→再マージ→再所持で値保持）のリグレッションテストへ反転する。現行コードに対して赤くなることを確認する。他の `disabled: true` を含むテスト（`components/material/index.test.tsx` の `all` エントリ、`lib/cloud-sync/shrink-guard.test.ts`、`lib/progress/summary.test.ts`、`lib/event-plan.test.ts`）はいずれも floor-reset 挙動を検証しておらず、変更不要（調査済み）
- [x] 1.2 `hooks/use-chaldea-state-merger.ts` から `resetDisabledServantStarts` とその呼び出しを削除し、1.1 のテストを通す
- [x] 1.3 `all` 漏れ防止（`does not leak "all" template start into unowned servants...`）・カタログ ID 変更等、既存の他テストが引き続き通ることを確認する
- [x] 1.4 `hooks/use-local-storage.test.tsx` に、`onGet: mergeChaldeaState` 相当を渡した `useLocalStorage` で「所持済み・start編集済みサーヴァントを disabled: true にした state を保存 → `ls-sync` イベント発火 → 再読込」を再現し、永続化された `start` が消えないことを検証する統合テストを追加する。単体の `mergeChaldeaState` 呼び出しだけでは、報告された症状（persist effect → `ls-sync` → `onGet` 再適用 → 再persist のループ）を再現できないため、この統合テストが実際の不具合解消の証拠になる。現行コードに対して赤くなることを確認する

## 2. spec 同期と検証

- [x] 2.1 `openspec validate fix-material-unowned-start-reset --strict` を通す
- [x] 2.2 `pnpm run type-check`、`pnpm run lint`、`pnpm test --run` を実行する

## 3. 実機確認

- [x] 3.1 実機（`pnpm dev`）で確認済み。育成済みサーヴァント（100100 アルトリア・ペンドラゴン）のスキル/アペンドを非デフォルト値へ編集 → 所持解除 → ページ再読込（`mergeChaldeaState` 実行）→ 所持へ戻す、の往復で `start` が localStorage・UI 表示の両方で保持されることを確認した
- [x] 3.2 育成記録モード ON の状態で同様の往復を行い、所持数が変動しないことを確認した（`toggleOwned` は `applyStart` を経由しないため所持数は不変。トグル前後で `posession` の値が完全一致することを確認済み）

## 4. 後始末

- [x] 4.1 `BACKLOG.md` の「所持を外して戻すと育成状況(start)が全部リセットされる」項目を削除する（`openspec/changes/` へ着手済みのため）
