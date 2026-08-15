## 1. スキル/アペンドの減算ラップ

- [ ] 1.1 `components/material/servant-card.tsx` に `decrementTarget(target, cur)` ヘルパーを追加する（`ascension` は `cur - 1` のまま、`skill`/`appendSkill` は `cur <= min ? max : cur - 1`）。
- [ ] 1.2 `handlePointerDown` の長押しタイマー内の `applyStart(target, idx, cur, cur - 1)` を `applyStart(target, idx, cur, decrementTarget(target, cur))` に置き換える。
- [ ] 1.3 `handleContextMenu` の `applyStart(target, idx, cur, cur - 1)` を同様に置き換える（ピップ由来の `ascension` 呼び出しでも `decrementTarget` がラップしないことを確認する）。

## 2. 既存テストの更新・追加

- [ ] 2.1 `components/material/servant-card.test.tsx` の `does not decrement skill below its minimum (1)` を、ラップ後の期待値（`onStartChange` が `('skill', 0, 1, 10)` で呼ばれる）を検証するテストへ書き換える。
- [ ] 2.2 appendSkill の下限（0）から長押し/右クリックで上限（10）へラップすることを検証するテストケースを追加する。
- [ ] 2.3 ascension（ピップ）が下限（0）で右クリックしてもラップせずクランプされたままであることを検証する既存テストを維持・確認する。

## 3. 常設ヒントの追加

- [ ] 3.1 `locales/ja.json` / `locales/en.json` の `material` namespace に、ヒント用キー（例: `owned-card-gesture-hint`）を追加する（日本語フォールバック必須の規約に従い、ja側の値をそのままデフォルト文言にする）。
- [ ] 3.2 `components/material/index.tsx` に `useTranslation('material')` を新規導入する。
- [ ] 3.3 サーヴァントグリッドの既存 else 分岐内、グリッド直前に常設ヒント（`t('owned-card-gesture-hint', 'タップ:+1 ／ 右クリック・長押し:-1')`）を追加する。新たな条件分岐は作らず既存の分岐構造に相乗りする。
- [ ] 3.4 ヒント用のスタイル（`.c-servant-hint` 等、`c-global-note` 相当の控えめな見た目）を該当の CSS ファイルに追加する。

## 4. 既存ツールチップの整理

- [ ] 4.1 育成記録モード設定パネルのツールチップ本文から、常設ヒントと重複する操作説明（「タップ:+1／長押し:-1」）を削除し、育成記録モード固有の自動増減説明のみを残す。
- [ ] 4.2 残す文言も `t()` 化し、`locales/ja.json` / `locales/en.json` の `material` namespace にキーを追加する。

## 5. テスト基盤・検証

- [ ] 5.1 `components/material/index.test.tsx` に `react-i18next` のモックを追加する（`catalog-loader.test.tsx` の既存パターンを参考にする）。
- [ ] 5.2 常設ヒントが一覧表示時に表示され、空状態（フィルタ結果0件）では表示されないことを検証するテストを追加する。
- [ ] 5.3 `pnpm test` / 型チェックを実行し、既存テストを含めて全て通ることを確認する。
- [ ] 5.4 `pnpm dev` が起動している状態でブラウザ実機検証を行う: (a) スキル/アペンドの下限で長押し・右クリックし上限へラップすることを確認、(b) 霊基再臨ピップの右クリックが下限(0)でラップしないことを確認、(c) 常設ヒントが一覧表示時・空状態それぞれで期待通りに表示/非表示になることを確認、(d) 育成記録モードON時にラップで所持数が正しく増減し、不足時はブロックトーストが出ることを確認。
