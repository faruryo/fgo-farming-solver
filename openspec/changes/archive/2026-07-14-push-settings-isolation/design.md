## Context

プッシュ通知のON/OFF設定トグルの値（`pushEnabled`）が、アカウント全体で同期される `todoSettings` の一部として管理されているため、以下の問題が生じています。
- クラウド自動同期（Sync）がOFFのときにトグルを切り替えてもサーバーに設定が伝わらない。
- 同期OFFの状態でセーブを強制すると、他端末で更新された最新のクラウドデータがローカルの古いデータで上書きされ、データの巻き戻し（先祖返り）が発生する。
- 複数端末で異なる通知設定（例: スマホは通知ON、PCは通知OFF）を行えず、設定が干渉し合ってしまう。

本設計では、`pushEnabled` 設定をクラウド同期の対象から除外し、完全に端末（ブラウザ）ローカルでのみ保持する構成に修正します。

## Goals / Non-Goals

**Goals:**
- プッシュ通知トグル（`pushEnabled`）をクラウド同期の対象から除外し、端末ごとのローカル状態に変更する。
- 通知配信バッチ（GitHub Actions）において、KVの `todoSettings.pushEnabled` によるゲートを廃止し、D1に購読（トークン）が登録されていること自体を配信基準とする。
- トグルON/OFF切り替え時に、クラウドの自動同期のON/OFF状態に関わらず、即座に購読登録/解除API（POST/DELETE）のみが正しく動作するようにし、余計なデータセーブ（巻き戻しリスク）を発生させない。

**Non-Goals:**
- デイリー・ウィークリー・イベントの「TODO自動追加設定（`autoDaily`, `autoWeekly`, `autoEvent`）」のクラウド同期は維持し、変更しない。
- VAPID暗号化や、配信処理を実行するGitHub Actionsのインフラ構成自体は変更しない。

## Decisions

### 1. `pushEnabled` の専用ローカルキー分離
`pushEnabled` は `todoSettings` から分離し、専用キー `fgo_push_enabled` としてブラウザの `localStorage` に保存します。これにより、通知トグルの変更が `todoSettings` の変更イベントやクラウド自動保存を発生させない構成にします。

- **既存データの移行**: 専用キーが存在せず、従来の `todoSettings.pushEnabled` が存在する場合は、その値を一度だけ専用キーへ移行します。以後のローカル保存およびクラウド保存では `todoSettings.pushEnabled` を使用しません。
  - ただし、旧 `pushEnabled` はクラウド同期されていたため「他端末で ON にした値」がこの端末に同期されているだけの可能性があります。移行時は `pushManager.getSubscription()` で当該端末のブラウザ購読の実在を確認し、`旧値 && 購読あり` の場合のみ `true` として移行します（購読が無いのにトグル ON 表示になる不整合を防ぐ）。専用キーはあくまで表示用キャッシュであり、購読の実在（ブラウザ購読 + D1 レコード）が真のソースです。
- **型からの完全除去**: `pushEnabled` は `types/todo.ts` の `TodoSettings` 型および `DEFAULT_TODO_SETTINGS`（`lib/todo/settings.ts`、`scripts/send-todo-notifications.ts` 内の `DEFAULT_SETTINGS`）から削除します。`applyData` はクラウドの `todoSettings` JSON をそのまま localStorage に書き戻すため、過去データの `pushEnabled` プロパティが一時的に残留し得ますが、型と参照を完全に除去することで誰も読まないことを保証します。
- **クラウド同期イベントの除外**: `use-cloud-sync.ts` の変更監視リスナーは現状すべての `ls-sync` / `localStorageUpdated` イベントで dirty / autosave を発火するため、`fgo_push_enabled` だけを除外する denylist ではなく、**同期対象 `KEYS` に含まれるキーのイベントのみ dirty にする allowlist 方式**に変更します（`AUTO_SYNC_KEY` は別イベント系のため影響なし）。これにより通知トグル操作が autosave を誘発しないことを構造的に保証します。

- **クラウドへのセーブ時（`handleSave`）**:
  `todoSettings` の JSON から `pushEnabled` プロパティを削除してから KV に保存します。既存のクラウドデータに残る値も、次回セーブ時に除去されます。
- **クラウドからのロード時（`applyData`）**:
  KV の `todoSettings` を適用する際、専用キー `fgo_push_enabled` は変更せず、クラウド側の `pushEnabled` もローカルの `todoSettings` に戻しません。

### 2. サーバー（配信バッチ）側の配信判定
`scripts/send-todo-notifications.ts` において、`settings.pushEnabled` による判定を廃止します。
- ユーザーがトグルをOFFにした際は、端末側から `/api/notifications/subscribe` (DELETE) が呼び出され、D1データベースの `push_subscriptions` から該当端末のレコードが削除されます。
- したがって、D1に `push_subscriptions` が存在すること自体が「その端末でプッシュ通知を有効にしている」ことの十分条件となるため、サーバー側で個別の `pushEnabled` 設定をKVから読み込む必要はありません。
- これにより、自動同期のON/OFF状態に関わらず、トグルを切り替えた瞬間に通知のON/OFFが正しくサーバー側に伝わります。

## Risks / Trade-offs

- **[Risk]** 過去にKVへ同期された `todoSettings` 内に `pushEnabled` プロパティが残っている場合、意図しない挙動にならないか。
- **[Mitigation]** サーバーの配信バッチ `send-todo-notifications.ts` で `settings.pushEnabled` を完全に参照しないようにするため、過去のKVデータが残っていても無視され、影響はありません。また、次回のセーブによってKV内のデータもマスク版に更新されます。
- **[Risk]** トグルをONにしたままホーム画面アプリをアンインストールするなど、D1に不要な購読が残るケース。
- **[Mitigation]** 配信バッチにおいて Web Push 送信時に404や410（失効）のエラーが返ってきた場合、D1から自動的にそのレコードを削除するクリーンアップ処理（`deleteExpiredSubscription`）が既に組み込まれているため、自動的に解消されます。
- **[Risk]** ブラウザ購読解除後に D1 の DELETE が失敗すると、D1 に購読が残り配信対象になり続ける。
- **[Mitigation]** 解除 API の失敗を明示的に表示し、再試行可能な状態を維持する。次回の有効化では既存のブラウザ購読を再利用して POST 登録できるようにする。
- **[Risk]** 挙動変化として、D1 に購読レコードが残っているが KV の `pushEnabled=false` でスキップされていたユーザー（例: 購読の無い別端末でトグルを OFF にした、sync OFF で設定が KV に届いていなかった）は、ゲート撤廃後にその端末で通知を受け取り始める（眠っていた購読の再活性化）。
- **[Mitigation]** 端末単位の通知制御という本変更の意図どおりの挙動であり許容する。不要であればユーザーは当該端末のトグル OFF（購読削除）で恒久的に停止でき、端末が既に破棄されている場合は 404/410 の自動クリーンアップで解消される。
