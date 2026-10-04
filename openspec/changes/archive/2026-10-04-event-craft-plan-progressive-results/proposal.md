## Why

料理作成アドバイザーは 5 パターンを 1 つの Worker で一括計算し、1 本が 10 秒ハードタイムアウトに達すると完了済みの軽いパターンまで画面全体がエラーになる。算出済みの配分を先に使えるようにし、重いパターンの失敗を個別化する。

## What Changes

- Worker は各パターン完了ごとに結果を `postMessage` し、UI は届いたカードから表示する。
- 10 秒ハードタイムアウトと計算失敗は未完了パターンだけの状態とし、完了済みカードの表示・選択を止めない。
- 一括タイムアウト時の画面全体エラー表示をやめる。未完了カードは個別に待ち/失敗を出す。
- 使い切りアルゴリズムの根本改修と画面レイアウトの大幅刷新はしない。

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `material-selection-advisor`: 料理配分の 5 パターン計算を段階表示し、タイムアウトをパターン単位にする。

## Impact

- `lib/event-craft-advisor.ts` のパターン組み立てを逐次通知できる形に分ける。
- `lib/event-craft-allocation.worker.ts` のメッセージ契約。
- `components/material/event-craft-advisor.tsx` の Worker 購読、ローディング、タイムアウト、カード選択、マシュ文言。
- 関連 unit / component テストと `locales` のタイムアウト文言。
