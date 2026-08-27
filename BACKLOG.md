# Backlog

まだ change 化していない課題を置く場所。着手するときは `openspec/changes/` へ proposal を切り出す。



---

## 周回数計算画面（/farming）の上部UIがモバイル（iPhone）で崩れる・見づらい

**【完了】**
`components/farming/item-input.tsx`（アイコン・素材名・入力欄の等幅フレックス横並び左寄せ）、`item-category-fieldset.tsx`、`item-fieldset.tsx`（レスポンシブグリッド `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`）を最適化。
また `app/globals.css` の `.c-farming-footer` に `env(safe-area-inset-bottom)` およびモバイル（幅640px以下）のボタンスタイルを適用し、画面下部の固定フッターと入力要素の被りを解消。

---

## 所持アイテム数入力をダッシュボードから利用したい

**【完了】**
ダッシュボードヘッダーの「所持アイテム」ボタンおよび `NearGoalSection` の「所持数を編集」導線から、全素材のカテゴリ別所持数編集およびスクリーンショット一括取込（`PossessionModal` / `PossessionImportDialog`）を直接起動可能に統合完了。`STORAGE_KEYS.POSSESSION` 経由で各セクションに即時反映。

---

## `/material`（クラス一覧トップ）だけページ固有の title / description が無い

**重要度: 低（クローラと共有プレビューにのみ影響。利用者の体験とデータは無傷）**

### 訂正（旧エントリの前提誤り）

このエントリは元々「Material Catalog 移行で `/material` `/material/[className]` 両方の
metadata が失われた」という内容だったが、調査の結果2点誤りがあった。

1. `/material/[className]/page.tsx` には移行時点で既に `generateMetadata` が実装済みで、
   クラス別ページは SSR 時点でクラス名入り title が出ている。対応不要。
2. `/material` は旧実装(移行前)の時点でもページ固有 metadata を持っておらず、
   `app/layout.tsx` の既定 title (`FGO周回ソルバー`) を継承するだけだった。
   つまり Material Catalog 移行による退行ではなく、**元からある全ルート共通のギャップ**
   （ページ固有 metadata を持つのは `[className]` だけ）。

なお `components/material/material.tsx` にあったクライアント側 `<Head title={...}>` は、
React 19 / Next 16 の `<title>` hoisting により `generateMetadata` の title と重複する
2本目の `<title>` を実際に生成していた（文字列が同一だったため無害）。この重複は削除済み。

### 残りのスコープ

`/material` にページ固有の title / description を付けるかどうかは、既存 spec
(`openspec/specs/material/spec.md` 等)に metadata 要件が無いため**新規要件の追加**にあたる。
着手する場合は `openspec/changes/` へ proposal を切り出してから行う。

---

## ダッシュボード「開催中のイベント」でTODO完了済みイベントの非表示・折りたたみ制御

**【完了】**
`EventSection.tsx` において、`todoState` のアイテム交換タスク（`event-shop-${eventId}`）の完了状態（読取専用）と連動し、交換完了バッジ表示、ヘッダーの「完了済みを非表示」トグルスイッチ、および「完了済みのイベント（N件）を表示/折りたたむ」アコーディオンリンクを実装。
トグル状態は `localStorage` の `dashboard.eventSection.hideCompleted` に永続化され、`todoState` への副作用なしにダッシュボードの情報密度を最適化。

---

## ダッシュボードTODOウィジェットの表示範囲拡張（期限間近以外のタスクへのアクセス性向上）

**重要度: 中（UI/UX向上・機能アクセシビリティ改善）**

### 背景 / 課題

現状のダッシュボード上部 `TodoWidget` は「期限間近のタスク（デイリー: 24時間以内、ウィークリー/イベント: 48時間以内）」のみをフィルターして表示している。
そのため、開催されたばかりのイベント（終了まで3日以上ある場合）や残り期日に余裕があるTODOタスクが画面に一切表示されず、ユーザーが早めにTODOを把握・消化したくてもダッシュボードから確認・チェックできない。
また、イベントTODOをあらかじめチェックして「開催中イベント」非表示連動を発動させたい場合にも支障が出る。

### UI/UX分析

1. **現行仕様の制約**:
   - 「期限間近」に絞ることで省スペース化には成功しているが、タスクの存在自体が見えなくなる弊害がある。
2. **単純な全件表示の懸念**:
   - 期限無制限で全TODOを表示すると、タスクが多い場合にウィジェット領域が縦長になりダッシュボードの他要素を圧迫する。

### 検討・提案方向

- **表示モード切替（「期限間近」 ＋ 「すべてのTODOを表示」アコーディオン）**:
  - デフォルトは現行通り「期限間近のタスク」を優先表示し省スペースを維持。
  - ウィジェット内（ヘッダーまたはフッター）に `すべてのタスクを表示 (N件)` の展開コントロールを配置し、タップすると期日に余裕があるイベントTODO等も一覧表示・一括チェックできるようにする。
- **イベントタスクの表示優遇 / カテゴリ別フィルター**:
  - 開催中イベントに関連するTODOタスクは、期限に関わらずアコーディオン展開時や優先領域に分かりやすく表示・識別できるようにする。

---

## TODOチェック完了時のUI/UX向上（ドーパミンが出るマイクロインタラクション・音・演出の強化）

**重要度: 中（UI/UX向上・達成感とモチベーション設計）**

### 背景 / 課題

現状のTODO機能（`components/todo/index.tsx` および `components/todo/TodoWidget.tsx`）では、タスクのチェックボックスをオンにした際の反応が一瞬の文字色変更および打ち消し線（`line-through`）の適用、あるいは即時のDOM消滅のみである。
タスクを完了させた瞬間の達成感・手ごたえ・爽快感（視覚・聴覚・触覚フィードバック）が欠如しており、タスク消化時のモチベーションや完了後の満足感が得られにくい。

### UI/UX分析 & 検討方向

過剰なポップアップ通知（トーストや会話ダイアログ）でテンポを害するのを避け、**チェックというユーザーのアクションそのものに対して直接的・即時的で心地よい多角フィードバック（視覚・聴覚・触覚）**を返す設計とする。

1. **マイクロアニメーション（Pop & Bounce + Stroke + Particle）**:
   - **Checkbox Bounce**: `framer-motion` を用い、チェック時にチェックボックスがぽんと弾けるバウンド効果（`scale: [1, 1.25, 0.95, 1.0]`）。
   - **Strikethrough Stroke**: テキストの打ち消し線が左から右へ流れるように引かれるアニメーション。
   - **Particle Burst**: チェックボックスの周囲に金色の小さな粒子（スパーク・星）が一瞬弾けて消えるエフェクト。

2. **FGO風システムSE（Web Audio API 音声合成）**:
   - 外部音声ファイルのダウンロード遅延や容量増加を避け、Web Audio API で高音の軽快なFGO風「キラリーン！/決定音」を即時合成・再生。
   - ブラウザの Autoplay Policy を考慮し、タップ/クリック操作を直接トリガーとして発音。設定画面等でON/OFF切替可能に。

3. **触覚フィードバック（Web Haptics API）**:
   - モバイル端末（対応ブラウザ）で `navigator.vibrate([15, 30, 20])` などの短く心地よい触覚パルスを発生。

4. **全達成時のコンプリート演出（ALL CLEAR バナー & 紙吹雪）**:
   - 未完了タスクがゼロになった瞬間、FGOの「QUEST CLEAR」風のゴールドバナーがカットインし、紙吹雪（Confetti）が舞い散る特別演出。

5. **ダッシュボード TodoWidget のレイアウトアニメーション**:
   - チェック直後にカードが即時消失するのではなく、バウンド＆線引き演出を見せてから、`AnimatePresence` でカードの高さが縮んで滑らかに消えるレイアウト遷移を実装。

---

## リファクタリング候補（2026-08-16 設計検討）

Opus subagent 3体（master-data / material-ui / cloud-and-domain）による調査結果。各項目に **behavior-preserving**（振る舞い保存・openspec不要）/ **behavior-touching**（振る舞いに触れる・`openspec new change` 必須、AGENTS.md準拠）のラベルを付けている。優先順位はユーザーに見える不整合 → churn×サイズ → 安さの順。

### 1. 実効不足（effectiveDeficiency）の定義が2画面で食い違いうる

**ラベル: behavior-touching（openspec 必須） / 工数 M / 優先度 最高**

`components/material/result.tsx` の `stockDeficiencies`/`queryItemsB`（225, 300行）は `toStockItemLike(item)` を使い、drops データの有無に関わらず常にストックバッファを乗せる。一方 `components/material/material-selection-advisor.tsx` の `deficiencyFor`（135-145行）は `dropItemByAtlasId.get(id)` がヒットしない素材で `effectiveDeficiency` を呼ばずバッファ無しの `Math.max(0, required - owned)` にフォールバックする（139-142行、コードで確認済み）。

**確認できたこと**: コード上の分岐差異は確実に存在する。**未確認なこと**: `amounts`/`possession` にはあるが `drops.items` に無い（またはatlasId欠落の）素材が実データで実在するか。存在すれば「素材計算結果」と「配布アドバイザー」で同じ素材の不足数が異なって見える実バグになる。着手前にまず実データでこのケースが起きるか確認すること。

対応案: `useEffectiveDeficiency` のような共有フックに集約し、drops に無い素材の扱い（バッファを乗せるか、明示的に除外表示するか）を1箇所で決める。

### 2. `EXCLUDED_ATLAS_IDS`（QPを進捗指標から除外）が2箇所に別実体で存在

**【完了】** `lib/progress/constants.ts` に `EXCLUDED_ATLAS_IDS` として一本化完了。

### 3. `lib/master-data/update.ts` の5分割

**【完了 (PR #43)】**
1. `lib/master-data/item-naming.ts` — `NAME_OVERRIDES`・`normalizeItemName`・`getCategory`
2. `lib/master-data/nice-war-source.ts` — 取得元決定（fs→KVキャッシュ→全量fetch）・`NiceWarCache`
3. `lib/master-data/atlas-events.ts` — `AtlasEvent`型・`fetchActiveEvents`・`eventDropItems`・`fetchBasicServants`・`extractApCampaigns`・`extractPodFreePeriods`
4. `lib/master-data/quest-selection.ts` — Top5/Top100相対効率フィルタ
5. `lib/master-data/dashboard.ts` — `fetchDashboardMeta` 関連
6. `lib/master-data/update.ts` — `fetchAndTransformData` オーケストレーター

### 4. cloud-sync クラスタの重複2件（安全に統合可能）

**【完了】**
- `normalizeCloudResponse()` 切り出し完了。
- `lib/cloud-sync/parse.ts` の `parseRecord` 共通化完了。

### 5. `lib/event-plan.ts` の内部重複（383-398行 / 421-436行）

**【完了】** `evaluateBoxes` / `reverseCalcBoxes` 純関数への集約完了。

### 6. `components/material/index.tsx` / `result.tsx` の育成記録台帳・ソルバー送信の分離

**【完了 (PR #42)】**
- `hooks/use-tracking-ledger.ts`（台帳管理・所持数更新・不足トースト通知・QP返却処理）抽出完了。
- `lib/farming/build-solve-params.ts`（ソルバー送信用クエリ構築）抽出完了。

### 7. cloud-sync の「多重マウントされる singleton」構造（大掛かり・保留推奨）

**ラベル: behavior-touching / 工数 M / 優先度 低（単独で企画すること）**

`use-cloud-sync.ts` は `sync-engine.tsx`（常駐headless）・`nav.tsx`（2箇所）・`cloud-indicator.tsx`・`/cloud`ページから同時にマウントされ、`isApplyingCloudData`等がモジュールスコープの`let`でsingletonを偽装している。責務軸で分割するとモジュール変数の所有者がN倍に増えて悪化するため、分割するなら「常駐する`CloudSyncEngine`にstore/providerを1つ置き、他は購読側にする」インスタンス軸の再設計が必要。現在は全インスタンスが個別に`fetchCloudData()`を撃っておりGET回数と自動適用タイミングが変わるため、単独の`openspec new change`として企画すべきで、上記6項目とは同じPRに混ぜない。

### 8. ダッシュボード/farming クラスタが集計churnで最も高い（個別ファイルは大きくない）

**ラベル: 調査のみ・設計は次回 / 優先度 情報共有**

単体では大きくないが、過去6ヶ月の変更頻度を積み上げるとリポジトリ最高: `app/page.tsx`(16) / `RecommendedQuest.tsx`(20) / `progress-report-content.tsx`(20) / `farming/index.tsx`(20) / `NearGoalSection.tsx`(16) / `ProgressSection.tsx`(13) / `GachaSection.tsx`(11) / `EventSection.tsx`(11)。BACKLOG内の「所持アイテム数入力をダッシュボードから利用したい」「/farming モバイルUI崩れ」がこのクラスタに集中する。今回は深掘りしていないため、この2件に着手するタイミングで構造調査を改めて行うのが妥当。

### 9. `QuestEfficiencyList.tsx` / `QuestEfficiencyCard.tsx` の localStorage state 9個の完全重複

**【完了】** `hooks/use-quest-efficiency-options.ts` に集約完了。

### 10. localStorage キー文字列のハードコード散在(`'posession'` 等)

**【完了 (PR #39)】** `lib/constants/storage-keys.ts`（`STORAGE_KEYS` 定数）に集約完了。

### 11. `QuestEfficiencyList.tsx` のinclude/excludeトグルUIのコピペ重複

**【完了】** `IncludeExcludeToggle` コンポーネントに集約完了。

### 付record: 死にコード・ツール設定の別件（このセクションの対象外・削除はユーザー判断）

- `knip.json` の `entry` に Next.js App Router のエントリ（`app/layout.tsx`/`page.tsx`等）が含まれておらず、`app/layout.tsx→layout.tsx→header.tsx→Nav`のような到達チェーンが追えていない。`components/common/nav.tsx`（直近6ヶ月17コミットの現役ファイル）が誤って「未使用」判定されるなど、`pnpm run audit:dead-code` のレポート全体の信頼性が下がっている。App Routerのエントリglobを追加するのが妥当（ツール設定のみ、挙動変更なし）。
- 一方 `components/common/footer.tsx` と `components/common/logo.tsx` は、App Router移行コミット(`04bc5a6`)以降どこからも参照されておらず、**本物の死にコード**と確認済み（grep裏取り済み）。削除可。
- BACKLOG.md 冒頭の「現在値の減算が下限で止まる」「右クリック/長押しで操作できることが案内されていない」の2件は、`5ab0bd1`（PR #34）と `openspec/changes/decrement-wrap-hint/`（tasks.md全項目`[x]`）で実装済みだったため、2026-08-16 にエントリ削除および change の archive を完了。




