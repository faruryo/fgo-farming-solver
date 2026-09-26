# Spec Delta

## ADDED Requirements

### Requirement: 絆トラッカー状態のクラウド同期
システムは、`bondTracker` キーをクラウド同期対象（`CLOUD_SYNC_KEYS`）に含め、複数端末間で絆トラッカーの登録内容と入力値を同期しなければならない (SHALL)。

#### Scenario: 絆トラッカー状態のクラウド保存と復元
- **WHEN** 絆トラッカー画面で登録サーヴァントや入力値が変更され、オートシンクが有効であるとき
- **THEN** 変更から 5 秒後に `/api/cloud` を通じて Cloudflare KV に `bondTracker` が保存される。
- **WHEN** 別の認証済み端末でログインまたは同期を実行したとき
- **THEN** クラウドに保存された `bondTracker` がローカルに復元・適用される。
