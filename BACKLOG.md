# Backlog

まだ change 化していない課題を置く場所。着手するときは `openspec/changes/` へ proposal を切り出す。

---

## 所持を外して戻すと育成状況(start)が全部リセットされる

**重要度: 高（ユーザーデータの不可逆な破壊、かつ全端末へ伝播する）**

### 症状

1. 育成済みのサーヴァントの「所持」を一度外し、再度所持に戻す
2. 再臨・スキル・アペンドの**現在値がすべて 0 または 1 になる**（再臨0 / スキル1 / アペンド0）
3. 元に戻そうとして値を上げると、必要素材が増えて「アイテム不足」表示になることがある

### 原因

`hooks/use-chaldea-state-merger.ts:74-108` の `resetDisabledServantStarts` が、
`disabled: true`（＝未所持）のサーヴァントについて **マージのたびに `start` を
`initialState` のデフォルトへ無条件で上書き**している。

```
// Unowned (disabled) servants have no UI to edit their current value, so any
// stored `start` is either a stale "all" template leak or otherwise not
// user-intended. Unconditionally correct it back to the real default on every
// merge.
```

デフォルト値は `hooks/create-chaldea-state.ts` の `levels` 定義そのもので、
ascension `[0,4]` / skill `[1,10]` / appendSkill `[0,10]` の下限。症状の「0や1」と一致する。

`end` は意図的に温存されるため、**現在値だけが最小に落ちて目標値は据え置き**になる。
これが「戻そうとしたらアイテム不足」の正体で、必要素材の差分が最大まで開いた状態。

### なぜ復旧できないか（伝播経路）

`mergeChaldeaState` は `useChaldeaState` から `useLocalStorage` の `onGet` として渡っている
（`hooks/use-chaldea-state.ts`）。したがって:

1. localStorage 読み込み時にリセットされた値が state に入る
2. `useLocalStorage` の永続化 effect が、その state を localStorage へ書き戻す
3. 書き戻しで `ls-sync` が発火し `markDirty` → 自動同期がクラウドへ push

つまり **所持を外した瞬間に元の値は失われ、他端末にも上書きが伝播する**。
所持に戻しても復元元が残っていないので直らない。

### 修正方針（未確定）

元コメントの意図は「未所持サーヴァントの `start` は編集UIが無く、`all` テンプレートの
残骸が漏れている可能性がある」なので、それ自体は正当な懸念。ただし対処が破壊的すぎる。

- 案A: 保存値は保持したまま、未所持の間は**表示・計算時にだけ**デフォルト扱いする（永続化しない）
- 案B: `all` テンプレート由来の漏れかどうかを判別できる印を持たせ、漏れだけを消す
- 案C: リセット前の `start` を退避し、所持に戻したときに復元する

案Aが素直に見えるが、`all` 漏れの再発防止をどう担保するかが論点。着手時に
`hooks/use-chaldea-state-merger.test.ts` の既存ケース（`all` 漏れ対策）を壊さないこと。

### 再現・検証時の注意

自動同期がONだと検証中の破壊がクラウドへ飛ぶ。**先に自動同期をOFFにするか、
ローカルバックアップを取ってから**再現させること。

---

## 現在値の減算が下限で止まる（上限へラップしてほしい）

**重要度: 中（機能不足。データ破壊は無い）**

### 要望

右クリック / 長押しで現在値を減らしていったとき、下限に達したら**上限へラップ**してほしい。
スキルなら 1 → 10、アペンドなら 0 → 10。目標値近くまで一気に戻せるので入力が楽になる。

### 現状

`components/material/servant-card.tsx`

- 加算（タップ / 左クリック）: `handleChipClick` (184-197) は
  `const next = cur >= max ? min : cur + 1` で **上限に達すると下限へラップする**
- 減算（右クリック / 長押し）: `handleContextMenu` (151-162) と `handlePointerDown` (131-144) が
  どちらも `applyStart(target, idx, cur, cur - 1)` を呼ぶだけ。
  `applyStart` (105-116) は `Math.max(min, Math.min(max, next))` でクランプし、
  さらに `if (clamped === prev) return` で弾くため、**下限では何も起きない**

つまり加算だけが循環していて減算が循環しない、非対称な状態。要望は対称にすること。

### 論点

- 霊基再臨（min 0 / max 4）も同様に 0 → 4 とするか。加算側は既にラップしているので
  揃えるのが自然だが、再臨はピップUIで `handlePipClick` (171-182) が別ロジックを持つ
  （点灯中のピップを押すと -1）。ここの整合も併せて決める必要がある
- ラップは誤操作時の巻き戻しが大きい。`onWillStartChange` を通るので育成記録モードON時は
  所持数の自動増減も一緒に大きく動く点に注意

---

## 右クリック / 長押しで操作できることが案内されていない

**重要度: 中（発見可能性。知らないと減算操作に到達できない）**

### 問題

現在値の減算は右クリックまたは長押しでしか行えないが、それを知る手段がほぼ無い。

唯一の案内は `components/material/index.tsx:475-480` のツールチップ本文:

```
タップ:+1 ／ 長押し:-1
ON 時、現在値を変更すると所持数を自動で増減します。
```

これが届きにくい理由が4つ重なっている:

1. **別機能のヘルプに同居している** — このツールチップは「育成記録モード」スイッチ横の
   `?` ボタン (458-474) に付いており、操作方法の案内だと気づけない
2. **hover 前提のツールチップ** — タッチ端末では開きにくい。`cursor: 'help'` も
   マウス想定のまま
3. **右クリックに言及が無い** — 「長押し」しか書かれていない
4. **条件付き描画の中にある** — `showGlobal && (` (410) で囲まれた全体設定パネル内なので、
   パネルが閉じていると存在しない

### 検討方向（未確定）

案内の置き場所そのものを設計し直す必要がある。初回のみのコーチマーク、カード上の常設ヒント、
空状態でのガイド、などが候補。「どこに書くか」より「操作を知らなくても減算に到達できるか」を
先に決めたい（例: 明示的な - ボタンを置けば案内自体が不要になる）。

上の「下限で止まる」課題と同じ操作系の話なので、着手するなら一緒に設計するのが良い。

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

## 素材計算から周回数計算への遷移における数値相違と画面遷移フローの再構成

**重要度: 高（UX混乱の解消・データ引き継ぎとページ遷移の見直し）**

### 問題 / 要望

1. **数値の相違**: 素材計算（サーヴァント選択）→「必要な素材を計算する（`/material/result`）」→「周回数を求める（`/farming`）」と遷移した際、ストック目標を有効にしていても引き継がれる素材数の数字が異なっている。
2. **遷移フローの冗長性**: ユーザー視点として素材計算から周回数計算へ移動する間に「必要な素材を計算する」ページを毎回挟む意味を感じにくいため、ページ遷移や全体のデータフローを再構成したい。

### 原因 / 現状のコード構造

- **データ引き継ぎの乖離**: `components/material/result.tsx` の `goSolver` から `/farming` へ遷移する際、通常不足分 `plainDeficiency`（`items`）とストック目標 `effectiveDeficiency`（`itemsStock`）が URL パラメータとして渡されるが、`/farming` 側の初期表示・URL クエリ解釈で数値がずれて見えたり意図した目標値が伝わらない状態が発生している。
- **画面遷移の二重ステップ**: サーヴァント育成目標を立てた後、`/material/result` をワンクッション挟まないと `/farming` に行けない UX 設計になっている。

### 検討方向

- **数値不一致の修正**: `goSolver` パラメータ生成と `/farming` (`components/farming/index.tsx`) での `items` / `itemsStock` の受け渡し・初期値反映ロジックを修正し、ストック目標時にも期待通りの素材数が正しく周回計算に引き継がれるようにする。
- **画面遷移の再構成**:
  - 素材計算画面（サーヴァント選択）からダイレクトに「周回数を求める」へ移動できるショートカットボタンを設ける。
  - または `/material/result` と `/farming` の画面構成や連携ステップを見直し、余分なクッションページを意識させないスムーズな画面フローへリファクタリングする。


---

## Material Catalog 移行後、loading 中のページに title / metadata が無い

**重要度: 中（クローラと共有プレビューにのみ影響。利用者の体験とデータは無傷）**

### 症状

`/material` と `/material/[className]` は静的シェルを返し、catalog を client fetch してから
`Index` / `Material` を mount する。mount 前の HTML は
`<p>素材データを読み込んでいます…</p>` だけで、`<title>` も description も無い。
旧実装は SSR で `components/common/head.tsx` を含む `Material` を返していたため、
クローラと SNS の共有カードにはクラス名入りの metadata が出ていた。

### 原因

`app/material/[className]/page.tsx` が `MaterialCatalogLoader` だけを返し、
metadata を出していた `Head` が catalog 取得後にしか描画されない。
`openspec/changes/fix-material-catalog-freshness/design.md` の Risks は
payload と round trip には触れているが、metadata の欠落は挙げていない。

### 検討方向

クラス名は URL から確定するので、catalog を待たずに解決できる。
`page.tsx` 側に `generateMetadata` を置く（`generateStaticParams` と同じ
`MATERIAL_CLASS_NAMES` を使う）だけで、loading 中も含めて metadata が出る。
client 側の `Head` と二重に出ないよう、どちらが正になるかは実装時に確認する。

---

## Material Catalog の更新伝播が設計値の2倍になりうる

**重要度: 低（最大で数分の鮮度差。データの正しさには影響しない）**

### 症状

`design.md` は「KV `cacheTtl` と browser `max-age` を5分に制限する」と書いているが、
実際の2つは直列に効くため、最悪で約10分の伝播遅れになる。

- `app/api/material-catalog/route.ts`: `MASTER_DATA.get(..., { cacheTtl: 300 })`
- 同: 応答ヘッダ `Cache-Control: public, max-age=300`

加えて `public` なので Cloudflare の共有キャッシュにも載る。

### 検討方向

「30分以内の反映」を運用の期待値として維持するなら合算で5分に収める
（例: `cacheTtl` か `max-age` の一方を60秒にする）。
逆に10分を許容するなら design.md の記述を実態に合わせて直す。
どちらが正しいかは、Free plan の KV 読み取り回数と鮮度のどちらを優先するかの判断。
