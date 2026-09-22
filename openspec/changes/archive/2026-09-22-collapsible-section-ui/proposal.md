## Why

`/material/result`（育成計算機の結果画面）にある「配布・交換券アドバイザー」や「周回対象に含めるクエスト」の折りたたみUIは、現在通常の静的セクション見出しと区別がつかないプレーンなテキスト見出しスタイル（`.c-mat-section-title`）が適用されています。
これにより、ユーザーが「開閉可能であること」を視覚的に認知しづらく、さらに見出し行全体が幅100%の巨大なクリック可能領域となっているため、スクロールや近辺の操作時に意図せずクリックしてコンテンツを閉じてしまう誤操作が頻発しています。
また、サイト全体（ダッシュボードの完了イベントや素材設定画面等）でも折りたたみUIの実装方式や見た目が分断されており、統一されたUXが提供されていません。共通のセクション型折りたたみコンポーネント（`CollapsibleSection`）を導入してデザインシステムに統合し、視覚的アフォーダンスと誤操作防止を両立します。

## What Changes

- **セクション型折りたたみコンポーネントの追加**:
  - `components/common/collapsible-section.tsx` を新設。
  - ヘッダーバーを独立したクリッカブル要素としてカード風にデザインし、背景色・境界線・Chevron開閉アイコン・ホバーフィードバックを備える。
  - コンテンツ領域との間に明確な境界線（またはカード構造）を設け、内部操作時の誤クリックを防止する。
- **`/material/result` のセクション改善**:
  - 「配布・交換券アドバイザー」および「周回対象に含めるクエスト」を共通コンポーネントへ置き換え。
  - 見出し行が単なるテキストではなく、開閉可能な操作バーであることが一目でわかるようにする。
- **UI基盤仕様（ui-framework）および素材計算機仕様（material）の更新**:
  - セクション型折りたたみコンポーネントの仕様と、`/material/result` での表示要件を追加。

## Capabilities

### Modified Capabilities
- `ui-framework`: セクション型折りたたみコンポーネント（`CollapsibleSection`）の仕様を追加。カード型スタイル、開閉インジケータ、キーボード操作対応を規定。
- `material`: `/material/result` 画面のアドバイザーおよびクエスト選択において、静的見出しの代替としてセクション型折りたたみUIを用いる要件を追加。

## Impact

- **Affected Code**:
  - `components/common/collapsible-section.tsx`（新設）
  - `components/material/result.tsx`（アドバイザー・クエスト選択のアコーディオン置き換え）
  - `components/ui/accordion.tsx`（必要に応じてスタイルの調和確認）
  - `openspec/specs/ui-framework/spec.md`
  - `openspec/specs/material/spec.md`
- **Dependencies**: 既存の Tailwind CSS、Base UI / Radix、および lucide-react（ChevronDown 等）のみを使用し、新規依存関係は追加しない。
