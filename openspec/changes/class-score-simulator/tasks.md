## 1. データモデル & マスタ定義

- [ ] 1.1 `lib/constants/storage-keys.ts` に `STORAGE_KEYS.CLASS_SCORE` を追加し、`CLOUD_SYNC_KEYS` に含める
- [ ] 1.2 `lib/class-score/types.ts` を作成し、クラスキー（`ClassScoreClassKey`）、ステータス（`ClassScoreStatus`）、ステート型（`ClassScoreState`）を定義する
- [ ] 1.3 `lib/class-score/data.ts` を作成し、Atlas Academy / AppMedia に基づく 9 クラスの必要素材静的マスターデータを定義する
- [ ] 1.4 `lib/class-score/sum.ts` を作成し、目標クラスの必要素材を合算する純関数 `sumClassScoreMaterials()` を実装し、単体テスト（`sum.test.ts`）を追加する

## 2. 状態フック & 目標合算パイプライン

- [ ] 2.1 `hooks/use-class-score.ts` を作成し、`useLocalStorage` を用いた状態永続化、ステータス切替、および一括操作・Undo 関数を提供する
- [ ] 2.2 `lib/class-score/merge-materials.ts` を作成し、サーヴァント必要素材（`sumMaterials`）とクラススコア必要素材（`sumClassScoreMaterials`）を合算する純関数およびテストを追加する
- [ ] 2.3 `components/material/index.tsx` および `components/material/material-calc-button.tsx` の計算処理でクラススコア目標を合算して `MATERIAL_RESULT` に保存する

## 3. クラススコア目標シミュレータ UI

- [ ] 3.1 `components/class-score/class-card.tsx` を作成し、クラスアイコン・名前・目標ステータス切替（未設定 / 目標 / 解放済）・必要素材プレビューを実装する
- [ ] 3.2 `components/class-score/reset-alert-dialog.tsx` を作成し、一括リセット時の二段階確認モーダル（`AlertDialog`）を実装する
- [ ] 3.3 `components/class-score/index.tsx` を作成し、9クラス一覧・サマリーヘッダー・一括操作メニュー・Undoトーストを実装する
- [ ] 3.4 `app/material/class-score/page.tsx` を新設し、ナビゲーションメニュー（`components/common/nav.tsx`）および `/material` ヘッダーに導線リンクを追加する

## 4. 素材結果画面（/material/result）の拡張

- [ ] 4.1 `components/material/result.tsx` の素材カードにクラススコア内訳表示（サーヴァント: X / CS: Y）を追加する
- [ ] 4.2 クラススコア専用アイテム（星光の砂、新星/明星/極星のトーチ）を所持数・不足数トラッキングの表示対象として追加する
- [ ] 4.3 周回ソルバー（`/farming`）への引き渡しパラメータからドロップ対象外の専用素材を除外し、通常素材のみを安全に連携するガードを確認する

## 5. 多言語対応 & 検証

- [ ] 5.1 `locales/ja.json` および `locales/en.json` にクラススコア関連の翻訳キーを同時に追加する
- [ ] 5.2 ユニットテスト（`pnpm test`）を実行し、マスタデータ集計・目標合算・フック挙動を検証する
- [ ] 5.3 型チェック（`pnpm run type-check`）および Lint（`pnpm run lint:ratchet`）を実行する
- [ ] 5.4 `openspec validate --specs` を実行し、仕様整合性を確認する
