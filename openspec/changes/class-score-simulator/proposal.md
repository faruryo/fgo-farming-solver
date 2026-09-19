## Why

FGOのクラススコア（Class Board）は全開放までに大量の通常素材、ピース・モニュメント、QP、および専用素材（星光の砂・トーチ）を消費します。現在、当ツールではサーヴァント育成素材のみが目標管理の対象となっており、クラススコアに必要な膨大な素材（特にモニュメント500個や各素材70個など）を周回ソルバーや素材不足数に巻き込んで周回計画を立てることができません。

ユーザーごとにクラススコアの最大解放目標を設定可能にし、その必要素材を既存の素材目標システムへ合算・連動させることで、クラススコア完遂に向けた効率的な周回計画と素材追跡を実現します。

## What Changes

- **クラススコア目標シミュレータ画面の新設**:
  - 9クラス（セイバー、アーチャー、ランサー、ライダー、キャスター、アサシン、バーサーカー、EX1、EX2）の目標ステータス（未設定・最大目標・完了）を管理する専用UI（`/material/class-score`）。
  - クラス単位での目標ON/OFF、要求素材（QP・モニュピ・通常素材・砂・トーチ）のリアルタイムプレビュー。
  - 誤操作防止設計：一括リセットの二段階確認（`AlertDialog`）、直前状態へのUndo（トースト通知）、破壊的アクションの導線隔離、日常利用しない「全クラス完了」の廃止。
- **素材目標（MATERIAL_RESULT）との統合**:
  - クラススコアで目標設定された必要素材を算出し、サーヴァント育成必要素材と合算して目標数（`MATERIAL_RESULT`）に反映。
  - `/material/result` でサーヴァント育成分とクラススコア分の内訳を可視化。
  - クラススコア専用素材（星光の砂、新星・明星・極星のトーチ）の所持・不足トラッキング表示。
- **データ永続化とクラウド同期**:
  - `localStorage` に `STORAGE_KEYS.CLASS_SCORE`（`classScore`）を新設。
  - `CLOUD_SYNC_KEYS` に追加し、マルチデバイス間での同期に対応（既存のデータ縮小ガードに準拠）。

## Capabilities

### New Capabilities
- `class-score`: クラススコアの目標ステータス管理、必要素材（通常素材、モニュピ、QP、砂、トーチ）の算出、誤操作防止ケア（確認モーダル・Undo）を提供するシミュレータ機能。

### Modified Capabilities
- `material`: クラススコア目標で要求される素材数を素材目標（`MATERIAL_RESULT`）および `/material/result` の不足数・所持数管理と合算・連携する。
- `sync`: `classScore` キーをクラウド同期対象（`CLOUD_SYNC_KEYS`）へ追加し、他端末と同期可能にする。

## Impact

- **UI / Routes**:
  - 新規ルート `/material/class-score`（または `/class-score`）の追加。
  - `/material` ヘッダーおよびナビゲーションメニュー（`nav.tsx`）への導線追加。
  - `/material/result` でのクラススコア素材（砂・トーチ）表示および内訳表示。
- **State & Storage**:
  - 新規キー `STORAGE_KEYS.CLASS_SCORE`（`classScore`）。
  - `CLOUD_SYNC_KEYS` の拡張。
- **APIs & Data**:
  - Atlas Academy のクラスボードデータ（`nice_class_board.json`）に基づく静的マスターデータ（`lib/class-score/` 配下）。
