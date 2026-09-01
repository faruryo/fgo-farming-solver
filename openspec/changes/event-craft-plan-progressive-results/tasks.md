## 1. Progressive compute API

- [x] 1.1 Shared context 構築後にパターンを固定順で組み立て、各本完了で通知できる関数を `event-craft-advisor.ts` に切り出す（既存 `computeEventCraftPlan` は全本後 fold のまま）
- [x] 1.2 Worker メッセージ列 → fold 済み plan / timedOut IDs / 完了フラグの reducer を pure 関数として切り出す

## 2. Tests

- [x] 2.1 reducer のケース表（0件 timeout、途中まで届いて timeout、done まで全部、requestKey 不一致は無視）を追加し、一時的に条件を壊して赤くなることを確認してから戻す
- [x] 2.2 既存 `computeEventCraftPlan` テストが同じ最終結果のまま通ることを確認する

## 3. Worker and UI

- [x] 3.1 `event-craft-allocation.worker.ts` がパターン完了ごとに postMessage し、最後に done を送る
- [x] 3.2 UI の Worker 購読を部分適用にし、10 秒 terminate 後も受信分を残す。全体タイムアウト文言は 0 件のときだけ
- [x] 3.3 未完了パターンの個別待ち/失敗表示と i18n（ja/en）を追加する。入力 debounce 中は段階カードを出さない
- [x] 3.4 `canPersistResolvedPattern` とマシュ advice が、完了済み選択があるときは overall timeout で空にならないことをテストする

## 4. Verify

- [x] 4.1 対象テストと type-check を通す
- [x] 4.2 `openspec validate --specs` および change の validate を通す
