## Why

クエスト短縮ID（例: `1o3`）とアイテム短縮IDは、マスターデータ変換時にスプレッドシートの並び順から位置ベースで採番されている。そのため上流にクエスト/エリアが追加されると後続のIDが全てずれる。ユーザーのクエスト選択は短縮IDのまま `localStorage('quests')`・クラウド同期・共有URLに永続化されているため、データ更新後に保存済みIDが**黙って別のクエストを指す／存在しなくなる**。

実害確認済み: 実ユーザーの計算結果 (`f0925cbb`) で、保存された297件のID中59件が現データに存在せず、冠位研鑽戦Ⅴ〜Ⅶ全クラス等が対象から脱落。本来より **+2,432周 / +47,017AP** 悪い周回計画が生成された。

## What Changes

- **短縮IDの世代間安定化（採番の永続化）**
  - 更新ワーカーが前回公開済み `all_drops_json` を読み（既存のwave-count seed読込と同一のKV readを流用、サブリクエスト増なし）、前回のID割当を再利用する。
  - クエスト: `エリア名+クエスト名`（第一キー）/ `aaQuestId`（リネーム耐性のフォールバック）でマッチし、同一クエストは同一IDを維持。新規クエストはエリア内 max index + 1 を採番。
  - エリアプレフィックス: エリア名でマッチして再利用。新規エリアは未使用の最小プレフィックスを採番。
  - アイテム: `atlasId` でマッチして再利用。新規アイテムは衝突しないIDを採番。
  - 削除されたクエスト/アイテムのIDは**恒久的に再利用しない**（ペイロード内に append-only な `id_registry` を同梱し、墓標として永続化）。
- **検証ゲートの強化**: ID一意性・Dailyプレフィックス形状（`id[0] === '0'` ⇔ Daily）・drop_rates の参照整合性を `validateMasterData` に追加し、既存のKV書込み保護に乗せる。
- **フォールバック**: 前回データが無い/壊れている場合は現行の位置ベース採番と完全に同一の結果になる（初回実行・ローカルモック生成）。
- **ランタイム補完**: `lib/get-local-items.ts` に atlasId ベースのフォールバック解決を追加し、固定化されたアイテムIDが Atlas 側の並び替え後もアイコン/カテゴリ解決できるようにする。

## Non-goals

- 過去に保存済みの計算結果・スナップショット内の壊れたID参照の修復（不可能）。
- クライアント側の選択保存形式の変更（チェック済み→除外リスト反転による「新規クエスト自動選択」）と NEW バッジ表示は後続の `new-quest-visibility` change で扱う（本 change の `id_registry` が前提）。
- `components/material/result.tsx` 等のランタイム positional 採番箇所の完全な atlasId 化（露出は現状と同等のため follow-up）。

## Capabilities

### Modified Capabilities
- `master-data`: 短縮IDの世代間安定性要件と `id_registry` の追加、KV保護検証の拡張

## Impact

- `lib/master-data/stable-ids.ts`（新規・純粋関数モジュール）
- `lib/master-data/update.ts`（採番ブロックの置換、`previous` オプション追加）
- `lib/master-data/types.ts`（`MasterData.id_registry` 追加・後方互換）
- `lib/master-data/validation.ts`（一意性・形状検証の追加）
- `updater-worker/index.ts`（前回ペイロード読込への一本化）
- `scripts/update-data.ts`（ローカルモックの前回値ピン留め）
- `lib/get-local-items.ts`（atlasId フォールバック）
- 消費側（UI ツリー・URL 圧縮・rarity-worker fingerprint 等）は **変更不要**: ID形式（2文字エリアプレフィックス + base36 index）は維持される
