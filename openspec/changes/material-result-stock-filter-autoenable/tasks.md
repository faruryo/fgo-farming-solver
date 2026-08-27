## 1. フィルタタブの実装変更

- [x] 1.1 `components/material/result.tsx` の「ストック不足」タブボタンから `{stockEnabled && (...)}` の条件描画を外し、常時表示にする
- [x] 1.2 「ストック不足」タブの `onClick` を `setFilterMode('stock')` に加えて `stockEnabled=OFF` のとき `setStockEnabled(true)` も呼ぶよう変更する
- [x] 1.3 既存の OFF→'stock' フォールバック `useEffect`(`result.tsx:233-236`)が新しい導線と競合しないことを確認する(D2 参照。変更が必要なら最小限に留める)

## 2. 動作確認

- [x] 2.1 `pnpm dev` で `/material/result` を開き、`stockEnabled=OFF` の初期状態で「ストック不足」タブが見えることを確認する
- [x] 2.2 OFF状態から「ストック不足」タブをクリックし、1クリックで `stockEnabled` がONになり、ストック不足素材に絞り込まれ、⚙ストック目標ダイアログのスイッチもON表示になることを確認する
- [x] 2.3 ⚙ストック目標ダイアログで手動でOFFに戻した際、既存のフォールバック挙動(`filterMode` が `short` に戻る)が壊れていないことを確認する
- [x] 2.4 リロード後も `stockEnabled` の状態(localStorage)が保持されることを確認する
  - 確認結果: `stockEnabled` の値自体はlocalStorageに保持され、期待どおり。
  - 既知の制限(このchangeのスコープ外、ユーザー承認済み): `filterMode`(タブのactive状態)は `useState` のみで永続化されておらず、リロードすると常に「全て」に戻る(全3タブ共通の既存挙動で、本changeが導入した回帰ではない)。ストック不足タブを見ていた状態でリロードすると表示は「全て」に戻る。後日、別changeとして `filterMode` の永続化を検討する。
- [x] 2.5 `/quests` 等、`stockEnabled` を共有する他画面の表示が本changeにより意図せず変化していないことを確認する

## 3. 仕上げ

- [x] 3.1 `pnpm run type-check` を実行する
- [x] 3.2 関連テスト(`components/material/*.test.tsx` 等、`filterMode`/`stockEnabled` に触れるもの)を実行・必要なら更新する
- [x] 3.3 `openspec validate --specs` で spec delta を検証する
