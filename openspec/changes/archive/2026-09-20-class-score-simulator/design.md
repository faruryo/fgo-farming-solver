## Context

See proposal.md - Why.
既存の FGO Farming Solver は、サーヴァントごとの育成目標（`STORAGE_KEYS.MATERIAL` = `ChaldeaState`）から `sumMaterials()` を通じて `STORAGE_KEYS.MATERIAL_RESULT`（`Record<string, number>`）を算出し、`/material/result` で所持数（`STORAGE_KEYS.POSSESSION`）と突き合わせて不足数を算出しています。この不足数が周回ソルバー（`/farming` / `/api/solve`）へ渡され、最適な周回クエストが導出されます。

クラススコア（Class Board）は 1 クラスあたり QP 3億1,700万、モニュメント 500 個、ピース 140 個、通常素材 816 個、星光の砂 6,680 個、トーチ 10 個を消費しますが、これまで素材目標の集計パイプラインに含まれていませんでした。

## Goals / Non-Goals

**Goals:**
- ユーザーごとの 9 クラス（7騎士/4騎士 + EX1 + EX2）の目標ステータス（未設定・最大目標・解放済み）の管理と永続化。
- 目標設定されたクラススコアの最大解放必要素材を純粋関数で高速に集計。
- 既存の `MATERIAL_RESULT` との透過的な合算と、`/material/result` での内訳表示。
- クラススコア専用アイテム（星光の砂、新星/明星/極星のトーチ）の所持数・不足数トラッキング。
- 破壊的操作（一括リセット等）に対する二段階確認（`AlertDialog`）、Undo トースト、高リスクな「一括完了」の排除。
- クラウド同期（`CLOUD_SYNC_KEYS`）への安全な統合。

**Non-Goals:**
- 全 760 マス（1 クラス 80〜90 マス）の 2D グリッド完全再現シミュレータ（手動マス目入力のユーザー負担過大のため MVP では除外）。
- 冠位認定戦のグランドクラス（通常素材不使用、星冠の結晶のみ消費）のシミュレーション。

## Decisions

### Decision 1: 静的マスターデータの定義 (`lib/class-score/data.ts`)
- **決定**: Atlas Academy の `nice_class_board.json` および AppMedia の公開集計データに基づき、9 クラスの必要素材一覧を静的 TypeScript 定数として保持する。
- **理由**: Atlas Academy のクラスボード生データ（約 2.8MB）を Workers 実行時やクライアントでパースするとメモリと CPU を浪費する。事前コンパイル済みの静的定数であれば数 KB で済み、バンドルサイズ・実行速度が極めて良好。
- **代替案**: API 経由での動的取得。却下：通信遅延・Workers メモリ超過（exceededCpu）リスクのため。

### Decision 2: 既存スキーマを壊さない目標合算アーキテクチャ
- **決定**: `STORAGE_KEYS.MATERIAL_RESULT` のデータ構造（`Record<string, number>`）は維持し、計算実行時に `sumMaterials(chaldeaState)` と `sumClassScoreMaterials(classScoreState)` を合算して保存する。
- **理由**: `MATERIAL_RESULT` のスキーマを変更すると、周回ソルバー（`/farming`）、ダッシュボード、進捗レポート（`/api/progress`）、クエスト効率計算フックなど広範な既存システムに破壊的変更が生じる。合算値を流し込むことで、既存機能が一切の変更なしにクラススコア目標を自動で認識できる。
- **内訳の保持**: `/material/result` で内訳を表示するため、クラススコア分の必要素材集計（`Record<string, number>`）をオンザフライで再計算・突合して「SVT: X / CS: Y」と表示する。

### Decision 3: 多層防御による安全設計（誤操作ケア）
- **決定**:
  1. **一括完了の廃止**: 日常的に使用せず誤タップリスクが極めて高い「全クラス完了」ボタンは UI に配置しない。
  2. **導線の隔離**: 「一括リセット」はカード一覧の外側（詳細メニュー内）に隔離する。
  3. **二段階確認**: 一括リセット実行時は `AlertDialog` による警告モーダルを必須とする。
  4. **Undo トースト**: 実行直前の状態を 1 世代メモリに保持し、実行後に「元に戻す」アクション付き Toast を表示する。
- **理由**: 誤操作による目標データ消失を防ぎ、万が一の誤操作時も 1 タップで原状回復できるようにするため。

### Decision 4: クラススコア専用アイテム（砂・トーチ）の扱い
- **決定**:
  - `nice_item` に存在する Atlas ID（砂: 50, 新星: 51, 明星: 52, 極星: 53）を利用する。
  - 周回ソルバー（`/farming`）へのパラメータ引き渡し時、fgodrop のドロップアイテムテーブルに存在しないアイテム（トーチ等）はソルバー対象外として除外する（既存の `EXCLUDED_ITEM_IDS` と同様の整合性ガード）。
  - `/material/result` では「クラススコア素材」として独立表示し、所持数（`STORAGE_KEYS.POSSESSION`）と不足数をトラッキング可能にする。

### Decision 5: データ永続化とクラウド同期
- **決定**:
  - `STORAGE_KEYS.CLASS_SCORE = 'classScore'` を新設。
  - 型定義:
    ```typescript
    export type ClassScoreClassKey =
      | 'saber' | 'archer' | 'lancer' | 'rider'
      | 'caster' | 'assassin' | 'berserker' | 'extra1' | 'extra2'

    export type ClassScoreStatus = 'none' | 'target' | 'completed'

    export type ClassScoreState = {
      classes: Partial<Record<ClassScoreClassKey, ClassScoreStatus>>
    }
    ```
  - `CLOUD_SYNC_KEYS` に `STORAGE_KEYS.CLASS_SCORE` を追加。
  - クラウド同期の縮小ガード（半減検出・キー欠落保護）において、`classScore` キーが存在しない場合でも他のキーの同期を阻害しないようフォールバック設計を行う。

## Risks / Trade-offs

- **[Risk] クラススコアの素材要求が莫大で、周回ソルバーの総周回数が極端に膨らむ**
  → **Mitigation**: `/material/result` でサーヴァント育成分とクラススコア分の内訳を明示し、クラススコア画面ですぐに目標を個別に解除・調整できるようにする。
- **[Risk] 将来的に FGO 本編で新クラススコア（EX3等）が追加された場合の互換性**
  → **Mitigation**: `ClassScoreClassKey` およびマスタデータをモジュール化し、キー追加のみで容易に拡張できる構造にする。
- **[Risk] 一括リセットの誤操作**
  → **Mitigation**: 二段階確認（`AlertDialog`）＋ Undo トースト ＋ 一括完了の排除という多層防御を適用する。
