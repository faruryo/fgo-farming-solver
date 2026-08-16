## Context

`components/material/servant-card.tsx` の現在値操作は、加算（タップ）と減算（右クリック/長押し）で非対称になっている。

- 加算 `handleChipClick`（184-197行目）: `const next = cur >= max ? min : cur + 1` — 上限で下限へラップする。
- 減算 `handlePointerDown`（131-144行目・長押しタイマー内）と `handleContextMenu`（151-162行目）: どちらも `applyStart(target, idx, cur, cur - 1)` を呼ぶだけ。`applyStart`（105-116行目）は `Math.max(min, Math.min(max, next))` でクランプし `clamped === prev` なら早期returnするため、下限では何も起きない。

いずれも共通の `applyStart` を経由し、`onWillStartChange`（育成記録モードON時の所持数不足チェック・ブロック）と `onStartChange`（所持数の自動増減・トースト表示）を呼ぶ。ラップを実装する場合もこの経路をそのまま使うため、既存の育成記録モード連携（`components/material/index.tsx` の `checkStartChange` / `applyStartChange`）は変更不要。

操作方法の案内は現在、`components/material/index.tsx` 458-481行目の育成記録モード設定パネル内ツールチップにのみ存在し、右クリックへの言及が無く、パネルを開かないと到達できない。

## Goals / Non-Goals

**Goals:**
- スキル/アペンドの減算操作（長押し/右クリック）を、加算のラップ挙動と対称にする。
- 操作案内をサーヴァント一覧から常時視認できる場所へ移し、発見可能性を上げる。

**Non-Goals:**
- 霊基再臨（ピップUI）へのラップ適用。ピップはクリックで任意の段階へ直接ジャンプする別体系の操作であり、右クリック -1 の意味合いも他と異なるため対象外とする。
- 明示的な `-` ボタンの追加（カード密度への影響が大きいため今回は不採用。案内強化で対応する）。
- このファイル・コンポーネント全体の i18n 化（今回追加/変更する文字列のみ `t()` を通す）。

## Decisions

### D1: ラップの実装方式

`applyStart` 自体は変更せず、呼び出し前に減算先の値を計算するヘルパーを追加する:

```ts
const decrementTarget = (target: TargetKey, cur: number) => {
  if (target === 'ascension') return cur - 1 // ピップは対象外、現状通りクランプのみ
  const min = TARGET_MIN[target]
  const max = TARGET_MAX[target]
  return cur <= min ? max : cur - 1
}
```

`handlePointerDown` のタイマー内と `handleContextMenu`（いずれも `ascension` 呼び出しと共有される点に注意）で、`cur - 1` を `decrementTarget(target, cur)` に置き換える。`applyStart` のクランプ・早期return・`onWillStartChange`/`onStartChange` 連携は無変更。

代替案として `applyStart` 内部でラップを吸収する方法も検討したが、`applyStart` は `handlePipClick` とも共有されており、対象を判定する分岐が同じ場所に増えるより呼び出し側で完結させる方が影響範囲が追いやすい。

### D2: 所持数計算はそのまま流用できる（検証済み）

ラップにより 1 回の操作で最大 9 段階分（スキル/アペンド）の差分が発生しうるが、`lib/diff-materials.ts` の `diffMaterialsForStartChange` は `prevStart`→`newStart` の差分をレベル幅に関係なく汎用的に集計する実装であり、既に霊基再臨のピップ UI（`handlePipClick` で任意の段階へ直接ジャンプ）が同じ関数を使って最大 4 段階分の一括消費/返還を実運用している。`checkStartChange`（`components/material/index.tsx` 125-170行目）の所持数不足ブロックも、ジャンプ幅に関係なく汎用的に効く。したがって今回のラップで新しい計算経路は不要で、既存の消費/返還・不足ブロック・トースト（`lib/tracking-toast.ts`）をそのまま利用できる。

### D3: 常設ヒントの配置と文言

`components/material/index.tsx` の「Servant grid」セクション、`filtered.length === 0` の空状態分岐と対になる既存の else 分岐内（グリッド直前）に1行追加する。新たな条件分岐を作らず、既存の分岐構造に相乗りする。

文言は「タップ:+1 ／ 右クリック・長押し:-1」とし、霊基再臨（クリックで直接段階指定・ラップなし）には当てはまらないことを踏まえ、チップ操作（スキル/アペンド）の説明として読める範囲に留める。

i18n: このファイルはこれまで `react-i18next` 未導入のため、`useTranslation('material')` を新規導入し、`locales/ja.json` / `locales/en.json` の `material` namespace にヒント用キーを追加する。`components/material/index.test.tsx` には現状 `react-i18next` のモックが無いため、モック追加も対応に含める（`catalog-loader.test.tsx` の1行モックを参考にする）。

### D4: 既存ツールチップの整理

育成記録モード設定パネルのツールチップ（458-481行目）から、常設ヒントと重複し情報が古い操作説明（「タップ:+1／長押し:-1」、右クリックの言及なし）を削除し、育成記録モード固有の自動増減説明のみを残す。この残す文言も編集対象になるため `t()` 化し、ja/en 両方にキーを追加する。

## Risks / Trade-offs

- [Risk] 下限での長押し/右クリックが、これまでの「何も起きない（no-op）」から「一気に上限へジャンプ」に変わる。育成記録モードONかつ所持数が足りている場合、誤操作で大きな消費が即確定する（`showTrackingToast` はundo無し、2.5秒で消える通知のみ）。所持数が不足していれば `checkStartChange` がブロックし `showBlockedToast` で気づけるため、実害があるのは「所持数が足りているのに意図しない大ジャンプが起きる」場合に限られる。
  → Mitigation: D2の通り計算自体は既存のピップ多段ジャンプと同じ経路で正しく動作する。誤操作時の体験を追加で緩和する対応（例: 長押しのみ対象外にする等）は本Changeでは行わず、Open Questionとして残す。
- [Risk] 既存テスト `components/material/servant-card.test.tsx` の「下限を下回らないことを検証するテスト」（`does not decrement skill below its minimum (1)`）が、`onStartChange` が呼ばれないことを前提にしているため、ラップ実装後は失敗する。
  → Mitigation: tasksでこのテストをラップ後の期待値（`onStartChange` が `('skill', 0, 1, 10)` で呼ばれる）へ更新し、appendSkill の 0→10 ケースも追加する。ascension の下限クランプ回帰テストは変更しない。

## Migration Plan

データ移行は発生しない。フロントエンドのみの変更で、既存の `localStorage`/クラウド同期データ構造に影響しない。ロールバックは通常のリバートで完結する。

## Open Questions

- 下限での長押し/右クリックによる大ジャンプ（誤操作耐性・undo無し）を許容するか、緩和策（例: 長押しはラップ対象外にし右クリックのみラップする等）を入れるかは未確定。今回のChangeでは完全対称ラップ（BACKLOGの要望通り）をデフォルト案として採用し、PRレビューでの指摘を踏まえて最終判断する。
