## 1. HistoryGraph の実装変更

- [ ] 1.1 `components/dashboard/HistoryGraph.tsx` の事前フィルタ（`visibleHistory` で片方の種別を除外する処理）を撤去する。
- [ ] 1.2 `useState<StockFilter>` を追加し、初期値を `deriveStockMeta(history).defaultFilter` から導出する。`history` フェッチ完了時（またはその変化時）に初期値を再計算する。
- [ ] 1.3 `FarmingHistoryChart` へ渡す `history` を、選択中の `stockFilter` に基づき `isStock(h) === (stockFilter === 'stock')` でフィルタした配列にする。
- [ ] 1.4 `FarmingHistoryChart` に `showStockToggle={deriveStockMeta(history).bothExist}`、`stockFilter`、`onStockFilterChange` を渡し、トグル操作で state が更新されるようにする。

## 2. 動作確認

- [ ] 2.1 `pnpm tsc --noEmit`（または既存の type-check コマンド）を実行し型エラーがないことを確認する。
- [ ] 2.2 ブラウザ実機（`http://localhost:3000/`）で、通常/ストック込み両方の履歴を持つアカウントでトグルが表示され、切り替えでグラフ・予測線が正しく再描画されることを確認する。
- [ ] 2.3 片方の種別のみの履歴を持つ場合にトグルが表示されないこと、既存の「履歴が2件未満なら非表示」挙動が壊れていないことを確認する。
- [ ] 2.4 モバイル幅でトグル+期間フィルタ+タブのレイアウトが崩れないことを確認する。
- [ ] 2.5 `/farming/history` ページの既存トグル挙動に回帰がないことを確認する。
