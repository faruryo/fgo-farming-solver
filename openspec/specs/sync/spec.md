# 仕様書: ユーザーデータ同期 (User Data Sync)

## 概要
ユーザーの所持素材数、必要素材数、および計算設定を複数のデバイス間で同期し、データの永続性を確保する機能です。NextAuth による認証と Cloudflare KV を利用して実現します。

## 同期メカニズム

### 1. 同期対象データ
`localStorage` 内の以下のキーを同期対象とする。
- 素材関連: `posession` (所持数), `input` (必要数), `material`, `material/result`
- 設定関連: `objective`, `halfDailyAp`, `dropMergeMethod`, `dropRateKey`, `dropRateStyle`
- 履歴・その他: `farming/results`, `items`, `quests`

### 2. メタデータ管理
各デバイスは以下のメタデータを持つ。
- `deviceId`: デバイスを識別するユニークなID。
- `updatedAt`: ローカルデータの最終更新日時。
- `lastSyncedAt`: 最後にクラウドと同期（保存または読み込み）が成功した日時。

### 3. オートシンク (Auto-Sync)
- ユーザーが有効化している場合、ローカルデータの変更（`localStorageUpdated` イベント等）を検知してから **5秒後** に自動的にクラウドへ保存を行う。
- コンフリクトが検出されている間は、自動保存は中断される。

## コンフリクト解消ロジック

ローカルとクラウドの `updatedAt` を比較し、以下のルールで処理する。

### A. 自動ロード (Safe Auto-Load)
以下の条件をすべて満たす場合、クラウドのデータを自動的にローカルに適用する。
- クラウドの方がデータが新しい。
- ローカルデータが「クリーン」である（`updatedAt === lastSyncedAt`、つまり未同期の変更がない）。

### B. 競合検出 (Conflict Detection)
以下の条件を満たす場合、ユーザーに競合を通知し、手動での解決（どちらを優先するか）を求める。
- クラウドの方がデータが新しい。
- ローカルデータが「ダーティ」である（`updatedAt > lastSyncedAt`、つまり未同期の変更がある）。
- データの更新元デバイス ID が現在のデバイスと異なる。

## 技術スタック
- **フロントエンド**: `useCloudSync` カスタムフックによるステート管理。
- **API**: `/api/cloud` (GET/POST)。
- **ストレージ**: Cloudflare KV (`CLOUD_SAVE`)。キー名はユーザーのメールアドレス等の識別子を使用。
- **データベース**: D1 データベースを使用して、計算結果の履歴 (`farming_results`) を永続化する。
