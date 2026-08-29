## Context

`components/material/result.tsx` は `useStockTarget()`(`hooks/use-stock-target.ts`)から `stockEnabled` / `setStockEnabled` / `stockBuffer` を取得している。表示フィルタ `filterMode: 'all' | 'short' | 'stock'` は `useState` で保持され、`stock` タブのボタン自体が現状 `{stockEnabled && (...)}` で条件描画されている(`result.tsx:417-425`)。`stockEnabled=OFF → filterMode==='stock' なら 'short' へフォールバック`という既存の `useEffect`(`result.tsx:233-236`)もあり、OFF中は `stock` モードに入れない前提で書かれている。

`stockEnabled` は `⚙ ストック目標` ダイアログ(`StockTargetSettings`)の `Switch` でのみ変更でき、`localStorage`(`STORAGE_KEYS.STOCK_ENABLED`)を介してクラウド同期・他画面(クエスト効率・配布アドバイザー等)とも共有されるグローバル設定である。詳細は proposal.md - Why を参照。

## Goals / Non-Goals

**Goals:**
- 「ストック不足」タブをボタンの表示条件から `stockEnabled` を外し、常時表示にする。
- タブ選択時、`stockEnabled=OFF` なら `setStockEnabled(true)` を呼んで自動ONにする。
- 既存の OFF→'stock' フォールバック `useEffect` と競合しないようにする(自動ONにより OFF は一瞬で終わるため、フォールバックが先に発火して意図しない `filterMode` 巻き戻りを起こさないこと)。

**Non-Goals:**
- ストック目標のバッファ値(カテゴリ×レア別デフォルト)のロジック変更。
- ⚙ ストック目標ダイアログの UI・文言変更。
- `result.tsx` 全体の i18n(`t()`)対応。このファイルは現状すべてのラベルが日本語ベタ書きで、`ui-conventions.instructions.md` の BLOCKER 規約に反する既存debtがあるが、本changeが触れるのはタブの表示条件と onClick のみであり、範囲拡大は行わない。

## Decisions

### D1: `stockEnabled` の自動ONは「ストック不足」タブの onClick 内で行う

`onClick` ハンドラを `() => { setFilterMode('stock'); if (!stockEnabled) setStockEnabled(true) }` とする。`setStockEnabled` は `useLocalStorage` の setter で非同期反映だが、`filterMode` は React state として即座に `'stock'` になるため、次のレンダーで `stockEnabled` が真になった時点で `displayedItems` のストック不足フィルタ(`filterMode === 'stock' && stockEnabled`)が有効化される。

代替案: `useStockTarget` 側に「自動ON」ロジックを持たせる → この画面固有のUX判断(タブクリックで有効化)を汎用フックに漏らすことになり、他画面(クエスト効率など)にも波及しかねないため不採用。

### D2: OFF→'stock' フォールバック `useEffect` の扱い

既存の `useEffect(() => { if (!stockEnabled && filterMode === 'stock') setFilterMode('short') }, [stockEnabled, filterMode])` は、タブ非表示だった時代に「OFFのまま外部から `filterMode='stock'` になる経路」を潰すための保険だった。本changeでタブを常時表示にし、かつタブ選択時に必ず `setStockEnabled(true)` を伴わせるため、通常操作ではこの `useEffect` が発火する余地はなくなる。ただし `stockEnabled` を⚙ダイアログで手動OFFに戻した際、`filterMode==='stock'` のままだと表示が壊れる(ストック不足フィルタが無効なのに tab は active 表示のまま)ため、このフォールバック自体は変更・削除しない。

代替案: フォールバックを削除し、`filterMode==='stock' && !stockEnabled` の状態を許容して「ストック不足」ボタンを disabled 表示に切り替える → 手動OFF後にユーザーが再度⚙で気づく導線が増えるだけで実装が複雑化するため不採用。

### D3: ボタンの活性表示

常時表示になった「ストック不足」タブは、`stockEnabled=OFF` 時も他の2タブ(全て/不足)と同じ見た目で選択可能とする(クリックで即ONになるため、事前に disabled 表現を出す必要はない)。ホバー等での「ONにします」という予告UIは本changeのスコープ外(Non-Goals参照)。

## Known Limitations

- `filterMode`(全て/不足/ストック不足のどのタブがactiveか)は `useState` のみで保持され、`stockEnabled` と異なり `localStorage` に永続化されない。リロードすると常に「全て」に戻る。これは3タブ共通の既存挙動であり本changeが持ち込んだ回帰ではないが、本changeにより「ストック不足」タブへの導線が強化された分、リロードで見失う体験のインパクトは相対的に大きくなる。対応(`filterMode` の永続化)は本changeのスコープ外とし、必要になった時点で別changeとして提案する。

## Risks / Trade-offs

- [ユーザーが意図せず `stockEnabled` をONにしてしまう] → タブ名「ストック不足」自体がストック目標機能であることを示しており、⚙ダイアログでいつでもOFFに戻せる。既存のグローバル設定を経由するため、他画面(クエスト効率等)の表示にも影響が及ぶ点は許容する(それがそもそもの `stockEnabled` の設計)。
- [OFF→'stock' フォールバック `useEffect` とタブ onClick の実行順序] → 同一クリックイベント内で `setFilterMode('stock')` と `setStockEnabled(true)` を同期的に呼ぶため、React のバッチ更新により中間状態(`filterMode==='stock'` かつ `stockEnabled` 未反映)がレンダーされる可能性は低いが、念のため実装時に手動テスト(OFF状態からのクリックで一度で絞り込まれるか)で確認する。
