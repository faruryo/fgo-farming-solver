## 1. 部品と範囲の判定

- [ ] 1.1 `components/ui/` に Base UI の `NumberField` の薄い包みを足す（`Root` と `Input` だけ。桁区切り無し、`allowOutOfRange`、`inputMode="numeric"`、ほかの `components/ui` の欄と同じ見た目、`aria-invalid` を渡せる）
- [ ] 1.2 `lib/servant-roster-review.ts` に、欄の値（`number | null`）を Lv・宝具Lv の範囲で読む関数を足す（`null` は値なし、範囲内の整数は値、範囲外と整数でない値は不正）。単体テストを足す（Lv の 1・120・0・121・1.5・`null`、宝具Lv の 1・5・6）

## 2. 欄

- [ ] 2.1 `components/material/servant-level-dialog.tsx` の Lv・宝具Lv の欄を 1.1 の包みにし、範囲の判定を 1.2 にする。範囲外の欄は今までどおり赤枠で示し保存できないようにする
- [ ] 2.2 `components/material/servant-roster-review.tsx` の Lv・宝具Lv の欄を 1.1 の包みにし（`type="number"`・`min`・`max`・`step` を外す）、範囲の判定を 1.2 にする。候補のボタンで入る値は今までどおり
- [ ] 2.3 2.1・2.2 の部品テストを足す（「９０」を打つか貼ると 90 で保存できる、値 90 の欄に「Lv 90」を貼っても 90 のまま、121・0・宝具Lv 6 は丸められず範囲外の表示で保存・取り込みに入れない、1.5 も範囲外、欄を空にして保存すると値が消える、値 90 の欄で英字を打っても 90 のまま）

## 3. 確かめ

- [ ] 3.1 型検査・lint・単体テストを通す <!-- verify-only -->
- [ ] 3.2 dev server で、小窓と確かめ画面の欄に「９０」「Lv 90」を貼る・121 を入れて Enter を押すことを実画面で確かめる <!-- verify-only -->
- [ ] 3.3 実機で、デスクトップの Chrome と Safari で日本語入力のまま「９０」を打つ・値のある欄を「１００」に打ち替える・iPhone で数字のキーボードが出ることを確かめる（人が行う） <!-- verify-only -->
