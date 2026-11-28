# Tasks

## 1. 育成ぶんの保存先と合算の手順

- [ ] 1.1 `lib/constants/storage-keys.ts` に育成ぶんのキー `material/servant-result` を足し、`CLOUD_SYNC_KEYS` に加える（旧 `material/result` は残す）。`lib/constants/storage-keys.test.ts` の同期キーの一覧を更新し、同期キーを見るテストが通ることで確かめる
- [ ] 1.2 合算の純関数（育成ぶん・旧値・クラススコアの状態 → 必要数）を `lib/` に作り、「育成ぶんあり」「育成ぶんが `{}`・旧値あり（旧値を使わない）」「育成ぶんのキーなし・旧値あり（旧値をそのまま使い、クラススコアぶんを足さない）」「どちらもなし」「部分目標の盤面」のユニットテストを付けて通す
- [ ] 1.3 必要数を返すクライアント用のフックを作り、`material/servant-result`・`material/result`・`classScore` の変更（`ls-sync` を含む）で値が更新されることと、キーが無いときに初期値を保存しない（移行前の端末で開いても `material/servant-result` が作られない）ことをテストで確かめる

## 2. 書き手を育成ぶんに切り替える

- [ ] 2.1 `components/material/index.tsx` と `material-calc-button.tsx` の Calculate を、育成ぶんだけを `material/servant-result` に保存する形に変え、旧 `material/result` を書かなくする。`hooks/use-roster-need.ts` の `calculateTotalRequiredMaterials` の呼び出しも合算の関数に揃える。既存のテストを更新して通す
- [ ] 2.2 `/material`（`components/material/index.tsx`）と `/material/[className]`（`components/material/material.tsx`）が共通で使う hook で、サーヴァント素材のデータを読み込んだ直後と、サーヴァントの状態が変わるたびに値が変わったときだけ育成ぶんを書き直し、`ls-sync` を `derived: true` で出す（Calculate は今のとおりふつうの `ls-sync`）。読み込み前は書かないこと、現在のスキルLvを上げると育成ぶんが減ること、クラス別ページの目標変更でも書き直されること、新しい端末で `/material` を開いても同期が dirty にならないこと、値が変わらなければ書かないこと、キーが無いとき読み込み直後と復元では空の結果で作らないこと、移行前の端末でユーザーが目標を全部終えると空の値でキーが作られ旧値が使われなくなることをテストで確かめる

## 3. 読み手を合算の手順に揃える

- [ ] 3.1 `components/material/result.tsx` の全体の必要数を 1.3 のフックから取り、内訳のクラススコアぶんが全体を上回らないことをテストで確かめる。保存値が無いときに URL のクエリを育成ぶんの初期値にする今の挙動を残す（クエリは保存しない）。移行前の端末でクエリなしに開いても `material/servant-result` が作られず旧値のまま表示されるテストを付けて通す。ソルバー連携のパラメータにも同じ値が渡ることを確かめる
- [ ] 3.2 `hooks/use-quest-efficiency-options.ts`、`components/dashboard/NearGoalSection.tsx`・`RecommendedQuest.tsx`、`hooks/use-progress-report.ts` を 1.3 のフック（または 1.2 の関数）経由に変え、どれも `material/servant-result` を書かないことを含めて既存のテストを更新して通す

## 4. クラススコアの部分目標

- [ ] 4.1 `deriveClassStatusFromBoard` を「未解放の目標マスが1つ以上で `target`」に変え、`hooks/use-class-score.ts` の目標クラス数とクラスのステータスを、盤面のあるクラスでは保存値でなく読むたびに盤面から導出する。部分目標・目標マスが全て解放済・全マス目標と、「部分目標の盤面と `none` が保存済み」の状態から始めて目標に数えられるテストを付けて通す
- [ ] 4.2 クラスカードの必要QP・素材を、`target` のクラスは目標かつ未解放のマスぶん、`none` のクラスは全マス解放ぶん（見出しを「全マス解放に必要」に変える）で表示する。`target` のカードの合計がサマリーと一致するテストを付けて通す
- [ ] 4.3 一部だけ目標のクラスで、未設定 / 目標 / 解放済 の切り替えが「目標」を選んだ表示になることをコンポーネントテストで確かめる
- [ ] 4.4 詳細ダイアログに、経路上の解放済のマスを目標に戻す一括操作を足し（ふだんの「ルート目標」は解放済を維持したまま）、経路の外のマスが変わらないユニットテストを付けて通す。追加した文言を i18n の各言語に入れる

## 5. 結合の確認

- [ ] 5.1 `pnpm type-check`・`pnpm lint`・`pnpm test` が通ることを確かめる <!-- verify-only -->
- [ ] 5.2 dev server で、クラススコアの目標マスを増やしてから `/material/result` を開き、内訳が全体を上回らないことと、一覧の「目標: n / 9」とカードの値を、変更前後のスクリーンショットで確かめる <!-- verify-only -->
