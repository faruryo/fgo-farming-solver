## ADDED Requirements

### Requirement: クラススコア目標状態のクラウド同期
システムは、`classScore` キーをクラウド同期対象（`CLOUD_SYNC_KEYS`）に含め、複数端末間でクラススコアの目標状態を同期しなければならない (SHALL)。

#### Scenario: クラススコア状態のクラウド保存と復元
- **WHEN** クラススコア画面で目標設定が変更され、オートシンクが有効であるとき
- **THEN** 変更から 5 秒後に `/api/cloud` を通じて Cloudflare KV に `classScore` が保存される。
- **WHEN** 別の認証済み端末でログインまたは同期を実行したとき
- **THEN** クラウドに保存された `classScore` がローカルに復元・適用される。
