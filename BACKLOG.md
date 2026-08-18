# Backlog

まだ change 化していない課題を置く場所。着手するときは `openspec/changes/` へ proposal を切り出す。



---

## 周回数計算画面（/farming）の上部UIがモバイル（iPhone）で崩れる・見づらい

**重要度: 中（UI/UX・レスポンシブ表示）**

### 症状 / 問題

iPhone などのスマートフォン表示において、「周回数を求める」画面（`/farming`）の上部エリア（「集めたいアイテムの数」のアコーディオンや各種ボタン・コントロール類）のレイアウトが崩れたり、詰まって不細工に表示される。

### 現状と影響箇所

`components/farming/index.tsx` や `components/farming/item-fieldset.tsx` 付近。
アコーディオンヘッダー、ボタン類の flex/grid 配置やマージン・パディングが画面幅（375px〜430px程度）で最適化しきれていない。

### 検討方向

- iPhone 各端末サイズ（SE / 14 / 15 / Pro Max 等）における上部コントロール部（アコーディオン、ボタン、アラート等）のレイアウト・余白・フォントサイズ・ボタンの並び順を調整し、タッチしやすいレスポンシブデザインに最適化する。

---

## 所持アイテム数入力をダッシュボードから利用したい

**重要度: 中（利便性・アクセス性向上）**

### 要望

現在「所持アイテム数」の入力・管理は「素材計算結果（`/material/result`）」などの画面で行う必要があるが、これをトップページのダッシュボード（`/`）から直接利用・入力・更新できるようにしたい。

### 現状

ダッシュボード（`app/page.tsx` や `components/dashboard/*`）には進行状況やおすすめクエスト、目標サマリーが表示されているが、所持素材数（`localStorage` の `posession` キー等）を直接確認・編集・インポートする導線や画面構成になっていない。

### 検討方向

- ダッシュボードに「所持アイテム数入力」セクション、またはクイック入力 / 画像認識インポート（`PossessionImportDialog`）を呼び出せるダイアログ/ドロワー導線を配置する。
- ダッシュボードで更新した所持数が即座に素材計算・周回計算に反映されるよう、`possession` state / `ls-sync` 連携を整える。

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

**重要度: 中（UI/UX向上・情報密度とアクセス性の改善）**

### 背景 / 課題

FGOではメインイベント、ボックスイベント、各種復刻イベントやキャンペーン（交換所のみ開設期間を含む）が同時に複数開催されることがある。
ダッシュボード（`/`）の「開催中のイベント（`EventSection`）」に多数のイベントカードが並ぶと、画面の縦幅を大きく占有し、下部にある周回機能（`RecommendedQuest` や `NearGoalSection`）にアクセスしづらくなる（情報過多・ビジュアルノイズ）。

### UI/UX分析

1. **TODOチェック連動のメリット**:
   - ユーザーがTODO（例: 「◯◯イベント アイテム交換を完了する」）を完了・チェックした際、対応するイベントを非表示/折りたたむことで、ユーザーの行動（対応完了）と画面表示が直感的に連動し、ダッシュボードがすっきり整理される。
2. **懸念点・リスク**:
   - **情報参照ニーズとの相違**: 交換所を取り切ってTODOをチェックした後でも、イベントクエストのドロップ効率が良いため周回を続けたいケースや、終了カウントダウン・ロト計画ツールなどの導線を参照したいケースがある。完全消去（DOM削除）にすると意図せず情報が見えなくなるリスクがある。
   - **復元可能性（Discoverability）**: 誤ってチェックした場合や再度確認したい時に、復元手段・再表示UIが無いとユーザーが困惑する。

### 検討・提案方向（ハイブリッド設計）

- **TODO完了連動 ＋ 表示トグル / 折りたたみコントロール**:
  - 対象イベントのTODOが完了済み（`completed: true`）の場合、該当イベントカードを自動的に「非表示（またはコンパクト表示）」にする。
  - `EventSection` のヘッダーに「完了済みを非表示」のトグルスイッチ、またはセクション下に「完了済みのイベント N 件を表示」のアコーディオンリンクを配置し、いつでもオン/オフおよび一時展開ができるようにする。
- **設定の永続化**:
  - 「完了済み非表示」のトグル状態を `localStorage` 等で保存し、再訪問時も快適なダッシュボード表示を維持する。

### 実装上の注意点・不具合防止

- **TODOデータへの副作用（自動追加・書き込み）の禁止**:
  - 連動判定のために `todoState` へ勝手にタスクを自動追加・復元・書き込みを行わないこと。ユーザーが `autoEvent` 設定をOFFにしている場合やタスクを削除している場合、`todoState` に影響を与えず読取専用（Read-only）で判定する。
  - クラウド同期（`ls-sync` / 競合検出）に影響を与えないよう、折りたたみ/非表示状態のオン・オフは `dashboard.eventSection.*` などの独立した UI 設定キーで管理する。

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

**ラベル: behavior-preserving / 工数 S / 優先度 高**

`lib/progress/lap-value.ts:14` と `lib/progress/throughput.ts:9` に `new Set(['1'])` が別々に定義されている（lap-value 側のコメントが「throughput.ts と同じ集合」と自認）。同じ進捗レポート画面に `forwardLaps` と `itemsFarmed` が並ぶため、片方だけ除外IDを追加すると画面内で数字が食い違う。`lib/progress/` 内の共有定数に一本化する。

### 3. `lib/master-data/update.ts`（1085行・過去6ヶ月45コミット、リポジトリ最大かつ最高頻度）の5分割

**ラベル: behavior-preserving（4番目のみ要判断） / 工数 M〜L / 優先度 高（churn最大）**

diffハンクを関数単位で分類した結果、`fetchAndTransformData` のみ変更28件・`fetchDashboardMeta` のみ変更9件・両方3件で、変更理由の異なる2責務が同居していることが裏付けられた（既存 `update.test.ts` の describe 境界もこれに一致）。

分割案:
1. `lib/master-data/dashboard.ts` — `fetchDashboardMeta` 関連
2. `lib/master-data/atlas-events.ts` — `AtlasEvent`型・`fetchActiveEvents`・`eventDropItems`・`fetchBasicServants`
3. `lib/master-data/nice-war-source.ts` — 取得元決定（fs→KVキャッシュ→全量fetch）・`NiceWarCache`
4. `lib/master-data/item-naming.ts` — `NAME_OVERRIDES`・`normalizeItemName`・`getCategory`
5. `lib/master-data/quest-selection.ts` — Top5/Top100相対効率の純粋フィルタ

実装時の必須事項:
- **バレル再エクスポートを作らない**。消費者は6スクリプト+2テストのみで、機械的なimport修正の方が恒久shimより安価。
- `update.ts:7-21` の `export type {...} from './types'` ブロックは**確認済みの死にコード**（全消費者が `./types` から直接import。`grep`で裏取り済み）。削除可（XS、単独で先に着手してよい）。
- `:189-204`（nice_event 40MB撤廃）・`:243-254`（weak ETag）・`:324-329`（KV無条件採用の理由）・`:457-462`（O(N×M)排除）・`:560-563`（rarity fingerprintにaddedAtを入れるな）の**荷重コメントは解決済み障害の再発防止根拠なので、コードと一緒に必ず移送する**。レビュー必須項目にすること。
- `aaQuestId→短縮ID` マップ構築が2箇所（:633-638, :989-994）で異なる入力から重複している。**同じ入力のまま**関数抽出するなら behavior-preserving、**入力を統一する**なら behavior-touching（pod-free期間の対象クエスト集合が変わる）。

推奨順序: 死にコード削除 → 分割案3・4（小さい） → 分割案1・2 → 荷重コメント整理。stable-ids.ts との結合は既に十分疎（呼び出し4箇所のみ）で分離作業は不要と判断。

### 4. cloud-sync クラスタの重複2件（安全に統合可能）

**ラベル: behavior-preserving / 工数 S ずつ / 優先度 中**

- `hooks/use-cloud-sync.ts:258-265` と `components/cloud/index.tsx:95-102` に、クラウド応答の旧形式正規化ロジック（`metadata`/`storage`の有無判定→epochラップ）が二重実装されている。`normalizeCloudResponse()` に切り出す。`components/cloud/index.tsx:105` の `MOCK_CLOUD_KEY` ハードコード文字列もこの時点でhookのexportに寄せる。
- `lib/cloud-sync/shrink-guard.ts:30-41` と `lib/cloud-sync/storage-diff.ts:26-37` の `parseRecord` が重複（jscpd検出済み）。統合理由は行数ではなく安全性 — パース規則がずれると「ガードは発火したのに差分が何も表示されない」画面になりうる。`measureSize` は別物なので `parseRecord` のみ共通化する。

**触ってはいけないもの**: `handleLoad`（確認ダイアログへ溜める設計）を `fetchCloudData`（`checkConflict` 経由で未確認のままauto-apply しうる）に寄せる変更。AGENTS.mdのBLOCKER（クラウド同期の無確認上書き）に該当する。

### 5. `lib/event-plan.ts` の内部重複（383-398行 / 421-436行）

**ラベル: behavior-preserving / 工数 S/M / 優先度 中**

`residualAfterBoxes → allocateShop → residualDemand` の3段が探索ループ内と打ち切り後で二重化。差分である `if (shopItem && fromShop < qty) residualDemand.set(...)` は**デッドブランチと確認済み**（直前で `remaining = Math.max(0, qty - fromShop)` を計算しているため、`fromShop < qty` なら常に `remaining > 0` となり、直前行の `if (remaining > 0) residualDemand.set(...)` と完全に同じ条件・同じ代入を二重に行っている）。1回のボックス数評価を行う純関数 `evaluateBoxCount(event, n, ownedCurrency, itemDemand)` を抽出し、ループ内（383-418行）と打ち切り後（421-438行）を1行に集約する。

### 6. `components/material/index.tsx` / `result.tsx` の育成記録台帳・ソルバー送信の分離

**ラベル: behavior-preserving / 工数 S ずつ / 優先度 中**

- `index.tsx` は①フィルタ/ソート②目標一括ブロードキャスト③育成記録モードの所持数台帳（126-217行）④hash駆動スクロール⑤ページchromeの5責務が同居。台帳部分（`checkStartChange`/`applyStartChange`/`possessionRef`/`trackingMode`）を `hooks/use-tracking-ledger.ts` に切り出す（JSXゼロなのに現状Indexをマウントしないとテストできない）。
- `result.tsx` のソルバー送信用クエリ構築（259-347行、目標A/B分岐）を `lib/farming/build-solve-params.ts` に切り出す。

**分割しないほうがよいもの**: `servant-card.tsx`。`longPressFired` を pointerdown/contextmenu/click で共有する規約はタッチ端末の合成イベントバグ対策であり、336行のテストが固定している。分けると規約が2ファイルに割れて壊れやすくなるだけ。

### 7. cloud-sync の「多重マウントされる singleton」構造（大掛かり・保留推奨）

**ラベル: behavior-touching / 工数 M / 優先度 低（単独で企画すること）**

`use-cloud-sync.ts` は `sync-engine.tsx`（常駐headless）・`nav.tsx`（2箇所）・`cloud-indicator.tsx`・`/cloud`ページから同時にマウントされ、`isApplyingCloudData`等がモジュールスコープの`let`でsingletonを偽装している。責務軸で分割するとモジュール変数の所有者がN倍に増えて悪化するため、分割するなら「常駐する`CloudSyncEngine`にstore/providerを1つ置き、他は購読側にする」インスタンス軸の再設計が必要。現在は全インスタンスが個別に`fetchCloudData()`を撃っておりGET回数と自動適用タイミングが変わるため、単独の`openspec new change`として企画すべきで、上記6項目とは同じPRに混ぜない。

### 8. ダッシュボード/farming クラスタが集計churnで最も高い（個別ファイルは大きくない）

**ラベル: 調査のみ・設計は次回 / 優先度 情報共有**

単体では大きくないが、過去6ヶ月の変更頻度を積み上げるとリポジトリ最高: `app/page.tsx`(16) / `RecommendedQuest.tsx`(20) / `progress-report-content.tsx`(20) / `farming/index.tsx`(20) / `NearGoalSection.tsx`(16) / `ProgressSection.tsx`(13) / `GachaSection.tsx`(11) / `EventSection.tsx`(11)。BACKLOG内の「所持アイテム数入力をダッシュボードから利用したい」「/farming モバイルUI崩れ」がこのクラスタに集中する。今回は深掘りしていないため、この2件に着手するタイミングで構造調査を改めて行うのが妥当。

### 9. `QuestEfficiencyList.tsx` / `QuestEfficiencyCard.tsx` の localStorage state 9個の完全重複

**ラベル: behavior-preserving / 工数 S / 優先度 中**

`components/quests/QuestEfficiencyList.tsx`(72-94行付近)と `components/quests/QuestEfficiencyCard.tsx`(30-47行付近)で、`possession`/`materialResult`/`itemsRaw`/`shortageOnly`/`includeSkillStones`/`includePieces`/`denominator`/`includeQp`/`includeBond`/`includeExp` の9個の `useLocalStorage` 呼び出し(キー文字列・デフォルト値含む)が一言一句同一で存在する(Card側はsetter無しの読み取り専用)。新しいフィルターの追加・デフォルト値変更時に一覧と詳細でキー名やデフォルト値がずれるリスクがある。`hooks/use-quest-efficiency-options.ts` に集約する。

### 10. localStorage キー文字列のハードコード散在(`'posession'` 等)

**ラベル: behavior-preserving / 工数 S〜M / 優先度 低〜中**

`'posession'`(歴史的タイポ)というリテラル文字列が `hooks/use-cloud-sync.ts` の `KEYS` 配列定義とは独立に12ファイル・14箇所で直接ハードコードされている(`QuestEfficiencyList.tsx`, `QuestEfficiencyCard.tsx`, `PossessionModal.tsx`, `NearGoalSection.tsx`, `components/cloud/parts/stats-logic.ts`, `components/material/index.tsx`, `components/material/result.tsx`, `hooks/use-progress-report.ts`, `lib/cloud-sync/storage-diff.ts`, `lib/cloud-sync/shrink-guard.ts`, `lib/progress/diff.ts` ほど。件数はgrep確認済み)。クラウド同期対象キー(`use-cloud-sync.ts` の `KEYS`)と実利用キーが型で結びついていないため、新機能追加時に同期対象への追加漏れが起きうる。`lib/constants/storage-keys.ts` 等でキー名定数化し、`KEYS` 側もそこから参照する形にする。工数が膨らみやすいので着手は他の小粒項目より後でよい。

### 11. `QuestEfficiencyList.tsx` のinclude/excludeトグルUIのコピペ重複

**ラベル: behavior-preserving / 工数 XS / 優先度 低**

同ファイル260-302行付近で「スキル石」「モニュピ」の含む/除くトグル(ラベル+`ToggleGroup`+2つの`ToggleGroupItem`)が構造・propsともほぼ同一のブロックとして2回書かれている(コード確認済み)。`IncludeExcludeToggle`のような小さなインラインコンポーネントに切り出してJSXをスリム化できる。優先度は低いが着手コストも最小。

### 付record: 死にコード・ツール設定の別件（このセクションの対象外・削除はユーザー判断）

- `knip.json` の `entry` に Next.js App Router のエントリ（`app/layout.tsx`/`page.tsx`等）が含まれておらず、`app/layout.tsx→layout.tsx→header.tsx→Nav`のような到達チェーンが追えていない。`components/common/nav.tsx`（直近6ヶ月17コミットの現役ファイル）が誤って「未使用」判定されるなど、`pnpm run audit:dead-code` のレポート全体の信頼性が下がっている。App Routerのエントリglobを追加するのが妥当（ツール設定のみ、挙動変更なし）。
- 一方 `components/common/footer.tsx` と `components/common/logo.tsx` は、App Router移行コミット(`04bc5a6`)以降どこからも参照されておらず、**本物の死にコード**と確認済み（grep裏取り済み）。削除可。
- BACKLOG.md 冒頭の「現在値の減算が下限で止まる」「右クリック/長押しで操作できることが案内されていない」の2件は、`5ab0bd1`（PR #34）と `openspec/changes/decrement-wrap-hint/`（tasks.md全項目`[x]`）で実装済みだったため、2026-08-16 にエントリ削除および change の archive を完了。




