# Tasks: ap-budget-quartz-cost

> 前提: `event-lottery-planner` の残課題（`/events` ナビ導線・アイテム名解決）が完了していること。

## Phase 0: データ確定（実装前に出典で固める）
- [x] D1: マスターレベル → 最大AP テーブル（1〜200）を確定し定数化。出典: Gamerch 早見表（ユーザー提供）。アンカー ML170→146 / ML180→148 / ML200→152 検証済み。`lib/master-profile/max-ap.ts`。
- [x] D2: 回復量ルール確定。**v1 は黄金の果実＝最大AP全回復のみ所持入力対象**、不足は聖晶石。白銀/青銅は出典不確定のため非対応（ユーザー決定）。
- [x] D3: 聖晶石単価定数（¥10,000 / 168個 ≒ ¥59.5/個）を `lib/ap-budget.ts` に定義。

## Phase 1: master-profile（マスターレベル同期）
- [x] `masterLevel` 用 localStorage キー＋アクセサ（未設定時は最大レベル既定）。`hooks/use-master-level.ts`。
- [x] `use-cloud-sync.ts` の `KEYS` に `masterLevel` を追加（自動同期）。
- [x] マスターレベル → 最大AP 導出関数（D1 テーブル使用）＋単体テスト。`lib/master-profile/max-ap.test.ts`（7件緑）。

## Phase 2: AP予算ロジック
- [x] `lib/ap-budget.ts`: 必要AP → 黄金の果実優先消費 → 残りを聖晶石換算 → 課金額化。
- [x] 旧固定換算（金果実40/銀林檎20）の表示を本ロジックに置換。`EventPlannerClient`/`EventPlanResultCard`。
- [x] **換算統一**: `components/farming/result-stat.tsx` の固定 `totalAp/144`・`/168*10000` 換算を `ap-budget`（最大AP基準）に移行。
- [x] 単体テスト: りんご充当・聖晶石枚数・金額の境界（所持0・過剰・過不足ちょうど）。`lib/ap-budget.test.ts`（7件緑）。

## Phase 3: UI
- [x] 計画ページにマスターレベル入力（同期）＋所持黄金の果実入力（localStorage 端末ローカル）を追加。
- [x] 消費AP内訳表示（黄金の果実消費数＋聖晶石枚数＋課金額）。
- [x] 換算式インフォメーション（ツールチップ + 入力注記）。
- [x] 一覧/計画で終了済みイベントを選択可能化＋会期外バッジ（既存実装で充足: 一覧は終了グループ描画、計画は「終了」バッジ）。
- [x] `locales/{ja,en}.json` にキー追加。

## Phase 4: 検証
- [x] `pnpm run type-check` / `pnpm run lint` / 全テスト緑（1015 件）。
- [x] `pnpm dev` + ブラウザ実機確認（browser-use, localhost:3000/events/80586）。ML200→最大AP152→必要聖晶石39/¥2,321、ML100→125→48/¥2,857、所持果実10→消費10/聖晶石38/¥2,262、リロード永続（masterLevel同期キー/goldenFruit端末ローカル）、ツールチップ換算式表示 を全て確認。
- [x] `openspec validate ap-budget-quartz-cost --strict` → valid。
